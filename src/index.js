#!/usr/bin/env node

/**
 * @fileOverview Command line interface for analyze-sgf.
 */

const fs = require('fs').promises;
const afs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const pgetopt = require('posix-getopt');
const homedir = require('os').homedir();
const chalk = require('chalk');
const jschardet = require('jschardet');
const iconv = require('iconv-lite');
const { spawn } = require('child_process');

const parseBadJSON = require('./bad-json');
const GameTree = require('./gametree');
const sgfconv = require('./sgfconv');

const log = (message) => console.error(chalk.grey(message));
const config = `${homedir}${path.sep}.analyze-sgf.yml`;

// Makes JSON data to send KataGo Parallel Analysis Engine.
function sgfToKataGoAnalysisQuery(id, sgf, opts) {
  const query = { ...opts };
  const sequence = sgfconv.removeTails(sgf);
  const komi = sgfconv.valueFromSequence('KM', sequence);

  if (komi !== '') {
    query.komi = parseFloat(komi);
  }

  const initialPlayer = sgfconv.valueFromSequence('PL', sequence);

  if (initialPlayer !== '') {
    query.initialPlayer = initialPlayer;
  }

  query.id = id;
  query.initialStones = sgfconv.initialstonesFromSequence(sequence);
  query.moves = sgfconv.katagomovesFromSequence(sequence);

  if (!query.analyzeTurns) {
    query.analyzeTurns = [...Array(query.moves.length + 1).keys()];
  }

  return query;
}

// Requests analysis to KataGo, and reads responses.
async function kataGoAnalyze(queries, opts) {
  const katago = spawn(`${opts.path} ${opts.arguments}`, [], {
    shell: true,
  });

  let responses = '';

  katago.on('exit', (code) => {
    if (code !== 0) {
      log(
        `Failed to run KataGo. Please fix "${config}".` +
          `\n${JSON.stringify(opts)}`,
      );
      process.exit(1);
    }
  });

  // Sends query to KataGo.
  await katago.stdin.write(queries);
  katago.stdin.end();

  // Reads analysis from KataGo.
  // eslint-disable-next-line no-restricted-syntax
  for await (const data of katago.stdout) {
    responses += data;
  }

  return responses;
}

function saveAnalyzed(targetpath, sgf, responses, opts) {
  const rsgfpath = `${
    targetpath.substring(0, targetpath.lastIndexOf('.')) + opts.fileSuffix
  }.sgf`;
  const gametree = new GameTree(sgf, responses, opts);

  afs.writeFileSync(rsgfpath, gametree.getSGF());
  log(`${rsgfpath} generated.`);

  const report = gametree.getRootComment();
  if (report !== '') {
    console.log(report);
  }
}

// Main routine.
(async () => {
  // Generates config file.
  try {
    await fs.access(config);
  } catch (error) {
    await fs.copyFile(require.resolve('./analyze-sgf.yml'), config);
    log(`${config} generated.`);
  }

  const help = (await fs.readFile(require.resolve('./help'))).toString();

  let responsespath;
  let savegiven = false;
  let analysisOpts = {};
  let sgfOpts = {};
  let katagoOpts = {};

  // Parses args.
  try {
    const parser = new pgetopt.BasicParser(
      'k:(katago)a:(analysis)g:(sgf)sf:h',
      process.argv,
    );

    let opt = null;

    for (;;) {
      opt = parser.getopt();
      if (opt === undefined) {
        break;
      }
      switch (opt.option) {
        case 'a':
          analysisOpts = parseBadJSON(opt.optarg);
          break;
        case 'k':
          katagoOpts = parseBadJSON(opt.optarg);
          break;
        case 'g':
          sgfOpts = parseBadJSON(opt.optarg);
          break;
        case 's':
          savegiven = true;
          break;
        case 'f':
          responsespath = opt.optarg;
          break;
        case 'h':
        default:
          process.stderr.write(help);
          process.exit(1);
      }
    }

    let sgfpaths;

    // sgfpaths given.
    if (parser.optind() < process.argv.length) {
      sgfpaths = process.argv.slice(parser.optind());
      if (responsespath) {
        log(`\`-f\` option can't be used with SGF files: ${sgfpaths}`);
        process.exit(1);
      }
    } else if (!responsespath) {
      log('Please specify SGF files or `-f` option.');
      process.stderr.write(help);
      process.exit(1);
    }

    // Reads config file.
    const opts = yaml.load(await fs.readFile(config));

    analysisOpts = { ...opts.analysis, ...analysisOpts };
    sgfOpts = { ...opts.sgf, ...sgfOpts };
    katagoOpts = { ...opts.katago, ...katagoOpts };
    sgfOpts.analyzeTurns = analysisOpts.analyzeTurns;

    if (responsespath) {
      // Analyzes by KataGo Analysis JSON.
      const sgfresponses = (await fs.readFile(responsespath)).toString();
      // JSON file format: tailless SGF + '\n' + KataGo response.
      const index = sgfresponses.indexOf('\n');
      const sgf = sgfresponses.substring(0, index);
      const responses = sgfresponses.substring(index + 1);

      saveAnalyzed(responsespath, sgf, responses, sgfOpts);
    } else {
      // Analyzes by KataGo Analysis Engine.
      //
      // Reads SGF and makes KagaGo queries.
      const sgfqueries = sgfpaths.map((sgfpath, id) => {
        const content = afs.readFileSync(sgfpath);
        const detected = jschardet.detect(content);
        const sgf = iconv.decode(content, detected.encoding).toString();
        const query = sgfToKataGoAnalysisQuery(
          `9beach-${id.toString().padStart(3, '0')}`,
          sgf,
          analysisOpts,
        );

        return { sgf, query };
      });

      const response = await kataGoAnalyze(
        sgfqueries
          .map((sgfquery) => `${JSON.stringify(sgfquery.query)}`)
          .join('\n'),
        katagoOpts,
      );

      // Does not exit. Gives "katago.on('exit', (code) => { ..." a change.
      if (response === '') {
        return;
      }

      // Splits long response by query id.
      const responses = response.split('\n').reduce((acc, analysis) => {
        // analysis: '{"id":"9beach-000","isDuringSearch" ...'
        const id = parseInt(analysis.replace(/.*9beach-/, ''), 10);
        if (Number.isNaN(id)) return acc;
        acc[id] += `${analysis}\n`;
        return acc;
      }, Array(sgfpaths.length).fill(''));

      sgfpaths.forEach((sgfpath, id) => {
        try {
          if (responses[id] === '') {
            throw Error('no response');
          }
          if (responses[id].search('{"error":"') === 0) {
            throw Error(responses[id].replace('\n', ''));
          }
          // Saves analysis responses to JSON.
          if (savegiven) {
            const sgfName = sgfpath.substring(0, sgfpath.lastIndexOf('.'));

            // JSON file format: tailless SGF + '\n' + KataGo response.
            afs.writeFileSync(
              `${sgfName}${sgfOpts.jsonSuffix}.json`,
              `${sgfconv.removeTails(sgfqueries[id].sgf)}\n${responses[id]}`,
            );
            log(`${sgfName}${sgfOpts.jsonSuffix}.json generated.`);
          }

          // Saves analyzed SGF.
          saveAnalyzed(sgfpath, sgfqueries[id].sgf, responses[id], sgfOpts);
        } catch (error) {
          log(`KataGo error: ${error.message} while processing ${sgfpath}`);
        }
      });
    }
  } catch (error) {
    log(error.message);
    process.exit(1);
  }
})();
