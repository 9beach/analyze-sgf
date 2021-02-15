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
const jschardet = require('jschardet');
const iconv = require('iconv-lite');
const { spawn } = require('child_process');

const parseBadJSON = require('./bad-json');
const GameTree = require('./gametree');
const sgfconv = require('./sgfconv');

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
    console.error(`"initialPlayer" is set to ${initialPlayer} from SGF.`);
  }

  query.id = `9beach-${id.toString().padStart(3, '0')}`;
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
  let error = '';

  katago.on('exit', (code) => {
    if (code !== 0) {
      const erroropts = JSON.stringify(opts, null, 2)
        .replace(/,\n/, '\n')
        .replace('  "path": ', '  path: ')
        .replace('  "arguments": ', '  arguments: ');
      process.stderr.write(
        `Failed to run KataGo. Try to fix "${config}".\n` +
          `${erroropts}\n${error}`,
      );
      process.exit(1);
    }
  });

  // Sends query to KataGo.
  await katago.stdin.write(queries);
  katago.stdin.end();

  // Reads analysis from KataGo.
  //
  // eslint-disable-next-line no-restricted-syntax
  for await (const data of katago.stdout) {
    responses += data;
  }

  // Reads stderr from KataGo.
  //
  // eslint-disable-next-line no-restricted-syntax
  for await (const data of katago.stderr) {
    error += data;
  }

  return responses;
}

function saveAnalyzed(targetpath, sgf, responses, opts) {
  const rsgfpath = `${
    targetpath.substring(0, targetpath.lastIndexOf('.')) + opts.fileSuffix
  }.sgf`;
  const gametree = new GameTree(sgf, responses, opts);

  afs.writeFileSync(rsgfpath, gametree.getSGF());
  console.error(`${rsgfpath} generated.`);

  const report = gametree.getRootComment();
  if (report !== '') {
    console.log(report);
  }
}

// Main routine.
(async () => {
  // Creates config file.
  try {
    await fs.access(config);
  } catch (error) {
    await fs.copyFile(require.resolve('./analyze-sgf.yml'), config);
    console.error(`${config} generated.`);
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
      'k:(katago)a:(analysis)g:(sgf)sf:',
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
        default:
          console.error(help);
          process.exit(1);
      }
    }

    let sgfpaths;

    // sgfpaths given.
    if (parser.optind() < process.argv.length) {
      sgfpaths = process.argv.slice(parser.optind());
      if (responsespath) {
        console.error(
          `\`-f\` option can't be used with SGF files: ${sgfpaths}`,
        );
        process.exit(1);
      }
    } else if (!responsespath) {
      console.error('Please specify SGF files or `-f` option.');
      process.exit(1);
    }

    // Reads config file.
    const defaultOpts = yaml.load(await fs.readFile(config));

    analysisOpts = { ...defaultOpts.analysis, ...analysisOpts };
    sgfOpts = { ...defaultOpts.sgf, ...sgfOpts };
    katagoOpts = { ...defaultOpts.katago, ...katagoOpts };

    if (responsespath) {
      // Analyzes by KataGo Analysis JSON.
      const sgfresponses = (await fs.readFile(responsespath)).toString();
      // First line is SGF.
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
        const query = sgfToKataGoAnalysisQuery(id, sgf, analysisOpts);

        return { sgf, query };
      });

      const response = await kataGoAnalyze(
        sgfqueries.reduce(
          (acc, sgfquery) => `${JSON.stringify(sgfquery.query)}\n${acc}`,
          '',
        ),
        katagoOpts,
      );

      if (response === '') {
        return;
      }

      // Splits long response by query id.
      const responses = response.split('\n').reduce((acc, analysis) => {
        const index = parseInt(analysis.replace(/.*9beach-/, ''), 10);
        if (Number.isNaN(index)) return acc;
        acc[index] += `${analysis}\n`;
        return acc;
      }, new Array(sgfpaths.length).fill(''));

      sgfpaths.forEach((sgfpath, id) => {
        try {
          // Saves analysis responses to JSON.
          if (savegiven) {
            const sgfName = sgfpath.substring(0, sgfpath.lastIndexOf('.'));

            afs.writeFileSync(
              `${sgfName}-responses.json`,
              `${sgfconv.removeTails(sgfqueries[id].sgf)}\n${responses[id]}`,
            );
            console.error(`${sgfName}-responses.json generated.`);
          }

          // Saves analyzed SGF.
          saveAnalyzed(sgfpath, sgfqueries[id].sgf, responses[id], sgfOpts);
        } catch (error) {
          console.error(error.message);
        }
      });
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
})();
