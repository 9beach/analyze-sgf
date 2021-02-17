#!/usr/bin/env node

/**
 * @fileOverview Command line interface for analyze-sgf.
 */

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

function saveAnalyzed(targetPath, sgf, responses, saveResponse, opts) {
  try {
    if (responses === '') {
      throw Error('no response');
    }
    if (responses.search('{"error":"') === 0) {
      throw Error(responses.replace('\n', ''));
    }

    const targetName = targetPath.substring(0, targetPath.lastIndexOf('.'));

    // Saves analysis responses to JSON.
    if (saveResponse) {
      const jsonPath = `${targetName}${opts.jsonSuffix}.json`;

      // JSON file format: tailless SGF + '\n' + KataGo response.
      afs.writeFileSync(jsonPath, `${sgfconv.removeTails(sgf)}\n${responses}`);
      log(`${jsonPath} generated.`);
    }

    // Saves analyzed SGF.
    const gametree = new GameTree(sgf, responses, opts);
    const sgfPath = `${targetName}${opts.fileSuffix}.sgf`;

    afs.writeFileSync(sgfPath, gametree.getSGF());
    log(`${sgfPath} generated.`);

    const report = gametree.getRootComment();
    if (report !== '') {
      console.log(report);
    }
  } catch (error) {
    log(`KataGo error: ${error.message} while processing ${targetPath}`);
  }
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

// Starts main routine.
//
// Generates config file.
try {
  afs.accessSync(config);
} catch (error) {
  afs.copyFileSync(require.resolve('./analyze-sgf.yml'), config);
  log(`${config} generated.`);
}

const help = afs.readFileSync(require.resolve('./help')).toString();

let responsesPath;
let saveGiven = false;
let analysisOpts = {};
let sgfOpts = {};
let katagoOpts = {};

// Parses args.
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
      saveGiven = true;
      break;
    case 'f':
      responsesPath = opt.optarg;
      break;
    case 'h':
    default:
      process.stderr.write(help);
      process.exit(1);
  }
}

let sgfPaths;

// sgfPaths given.
if (parser.optind() < process.argv.length) {
  sgfPaths = process.argv.slice(parser.optind());
  if (responsesPath) {
    log(`\`-f\` option can't be used with SGF files: ${sgfPaths}`);
    process.exit(1);
  }
} else if (!responsesPath) {
  log('Please specify SGF files or `-f` option.');
  process.stderr.write(help);
  process.exit(1);
}

if (responsesPath && saveGiven) {
  log('neglected `-s` with `-f`.');
}

// Reads config file.
const opts = yaml.load(afs.readFileSync(config));

analysisOpts = { ...opts.analysis, ...analysisOpts };
sgfOpts = { ...opts.sgf, ...sgfOpts };
katagoOpts = { ...opts.katago, ...katagoOpts };
sgfOpts.analyzeTurns = analysisOpts.analyzeTurns;

// Starts async communication with kataGoAnalyze().
(async () => {
  try {
    if (responsesPath) {
      // Analyzes by KataGo Analysis JSON.
      const sgfresponses = afs.readFileSync(responsesPath).toString();
      // JSON file format: tailless SGF + '\n' + KataGo response.
      const index = sgfresponses.indexOf('\n');
      const sgf = sgfresponses.substring(0, index);
      const responses = sgfresponses.substring(index + 1);

      saveAnalyzed(responsesPath, sgf, responses, false, sgfOpts);
    } else {
      // Analyzes by KataGo Analysis Engine.
      //
      // Reads SGF and makes KagaGo queries.
      const sgfqueries = sgfPaths.map((sgfPath, id) => {
        const content = afs.readFileSync(sgfPath);
        const detected = jschardet.detect(content);
        const sgf = iconv.decode(content, detected.encoding).toString();
        const query = sgfToKataGoAnalysisQuery(
          `9beach-${id.toString().padStart(3, '0')}`,
          sgf,
          analysisOpts,
        );

        return { sgf, query };
      });

      // Sends queries to KataGo
      const response = await kataGoAnalyze(
        // Gets queries olny.
        sgfqueries
          .map((sgfquery) => `${JSON.stringify(sgfquery.query)}`)
          .join('\n'),
        katagoOpts,
      );

      // Does not exit if fails. Gives "katago.on('exit', ...)" a change.
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
      }, Array(sgfPaths.length).fill(''));

      sgfPaths.forEach((sgfPath, id) =>
        // Saves analyzed SGF.
        saveAnalyzed(
          sgfPath,
          sgfqueries[id].sgf,
          responses[id],
          saveGiven,
          sgfOpts,
        ),
      );
    }
  } catch (error) {
    log(error.message);
    process.exit(1);
  }
})();
