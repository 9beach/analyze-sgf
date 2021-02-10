#!/usr/bin/env node

/**
 * @fileOverview Command line interface for analyze-sgf.
 */

const fs = require('fs').promises;
const yaml = require('js-yaml');
const pgetopt = require('posix-getopt');
const homedir = require('os').homedir();
const jschardet = require('jschardet');
const { Iconv } = require('iconv');
const { spawn } = require('child_process');

const parseBadJSON = require('./bad-json');
const GameTree = require('./gametree');
const sgfconv = require('./sgfconv');

const config = `${homedir}/.analyze-sgf.yml`;

async function readFileWithChardet(path) {
  const content = await fs.readFile(path);
  const detected = jschardet.detect(content);

  const iconv = new Iconv(detected.encoding, 'utf-8');
  return iconv.convert(content).toString('utf-8');
}

// Requests analysis to KataGo, and reads responses.
async function kataGoAnalyze(sgf, query, katagoOpts) {
  // Spawns KataGo.
  const katago = spawn(`${katagoOpts.path} ${katagoOpts.arguments}`, [], {
    shell: true,
  });

  let responses = '';
  let error = '';

  katago.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Failed to run KataGo from ${config}`);
      const opts = JSON.stringify(katagoOpts, null, 2)
        .replace(/,\n/, '\n')
        .replace('  "path": ', '  path: ')
        .replace('  "arguments": ', '  arguments: ');
      console.error(opts);
      process.stderr.write(error);
      process.exit(1);
    }
  });

  // Sends query to KataGo.
  await katago.stdin.write(query);
  katago.stdin.end();

  // Reads analysis from KataGo.
  // eslint-disable-next-line no-restricted-syntax
  for await (const data of katago.stdout) {
    responses += data;
  }

  // Reads stderr from KataGo.
  // eslint-disable-next-line no-restricted-syntax
  for await (const data of katago.stderr) {
    error += data;
  }

  return responses;
}

// Gets JSON data to send KataGo Parallel Analysis Engine with pipe.
function sgfToKataGoAnalysisQuery(sgf, opts) {
  const analysisOpts = opts;
  const sequence = sgfconv.removeTails(sgf);
  const komi = sgfconv.valueFromSequence('KM', sequence);

  if (komi !== '') {
    analysisOpts.komi = parseFloat(komi);
    console.error(`"komi" is set to ${analysisOpts.komi} from SGF.`);
  }

  const initialPlayer = sgfconv.valueFromSequence('PL', sequence);

  if (initialPlayer !== '') {
    analysisOpts.initialPlayer = initialPlayer;
    console.error(`"initialPlayer" is set to ${initialPlayer} from SGF.`);
  }

  analysisOpts.id = '9beach';
  analysisOpts.initialStones = sgfconv.initialstonesFromSequence(sequence);
  analysisOpts.moves = sgfconv.katagomovesFromSequence(sequence);

  if (!analysisOpts.analyzeTurns) {
    analysisOpts.analyzeTurns = [
      ...Array(analysisOpts.moves.length + 1).keys(),
    ];
  }

  return JSON.stringify(analysisOpts);
}

// Main routine.
(async () => {
  // Creates config file.
  try {
    await fs.access(config);
  } catch (error) {
    await fs.copyFile(require.resolve('./analyze-sgf.yml'), config);
    console.error(`"${config}" created.`);
  }

  const help = (await fs.readFile(require.resolve('./help'))).toString();

  let responsesPath = null;
  let saveGiven = false;
  let analysisOpts = {};
  let sgfOpts = {};

  // Parses args.
  try {
    const parser = new pgetopt.BasicParser(
      'k:(katago)g:(sgf)sr:',
      process.argv,
    );

    let opt = null;
    let analyzeTurnsGiven = false;

    for (;;) {
      opt = parser.getopt();
      if (opt === undefined) {
        break;
      }
      switch (opt.option) {
        case 'k':
          analysisOpts = parseBadJSON(opt.optarg);
          if (opt.optarg.search('analyzeTurns') >= 0) {
            analyzeTurnsGiven = true;
          }
          break;
        case 'g':
          sgfOpts = parseBadJSON(opt.optarg);
          break;
        case 's':
          saveGiven = true;
          break;
        case 'r':
          responsesPath = opt.optarg;
          break;
        default:
          console.error(help);
          process.exit(1);
      }
    }

    sgfOpts.analyzeTurnsGiven = analyzeTurnsGiven;

    if (parser.optind() >= process.argv.length) {
      console.error(help);
      process.exit(1);
    }

    const sgfPath = process.argv[parser.optind()];

    // Reads config file.
    const defaultOpts = yaml.load(await fs.readFile(config));

    analysisOpts = { ...defaultOpts.analysis, ...analysisOpts };
    sgfOpts = { ...defaultOpts.sgf, ...sgfOpts };

    const sgf = await readFileWithChardet(sgfPath);
    // analysisOpts.analyzeTurns is set below.
    const query = sgfToKataGoAnalysisQuery(sgf, analysisOpts);
    // Copys some options.
    sgfOpts.analyzeTurns = analysisOpts.analyzeTurns;

    const responses =
      responsesPath == null
        ? await kataGoAnalyze(sgf, query, defaultOpts.katago)
        : (await fs.readFile(responsesPath)).toString();

    if (saveGiven && !responsesPath) {
      const sgfName = sgfPath.substring(0, sgfPath.lastIndexOf('.'));

      await fs.writeFile(`${sgfName}-responses.json`, responses);
      console.error(`"${sgfName}-responses.json" created.`);
    }

    // Saves responses to SGF.
    const rsgfPath = `${
      sgfPath.substring(0, sgfPath.lastIndexOf('.')) +
      defaultOpts.sgf.fileSuffix
    }.sgf`;
    const gametree = new GameTree(sgf, responses, sgfOpts);

    await fs.writeFile(rsgfPath, gametree.getSGF());
    console.error(`"${rsgfPath}" created.`);

    const report = gametree.getRootComment();
    if (report !== '') {
      console.log(report);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
