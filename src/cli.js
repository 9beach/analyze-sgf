#!/usr/bin/env node

/** 
 * @fileOverview Command line interface for analyze-sgf.
 */
'use strict';

const config = (process.env.HOME || process.env.USERPROFILE) + 
  '/.analyze-sgf.yml';

(async () => {
  const fs = require('fs').promises;
  const GameTree = require('./gametree');

  // Creates config file.
  try {
    await fs.access(config);
  } catch (error) {
    await fs.copyFile(require.resolve('./analyze-sgf.yml'), config);
    console.error('"' + config + '" created.');
  }

  let responsesPath = null;
  let saveGiven = false;
  let analysisOpts = {};
  let sgfOpts = {};

  // Parses args.
  try {
    const help = require('./help'); 
    const pgetopt = require('posix-getopt');
    const parseBadJSON = require('./bad-json');
    const parser = new pgetopt.BasicParser('k:(katago)g:(sgf)sr:', 
      process.argv);

    let opt = null;
    let analyzeTurnsGiven = false;

    while ((opt = parser.getopt()) !== undefined) {
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
    const yaml = require('js-yaml');
    let defaultOpts = yaml.load(await fs.readFile(config));

    analysisOpts = Object.assign({}, defaultOpts.analysis, analysisOpts);
    sgfOpts = Object.assign({}, defaultOpts.sgf, sgfOpts);

    const sgf = (await fs.readFile(sgfPath)).toString();
    // analysisOpts.analyzeTurns is set below.
    const query = sgfToKataGoAnalysisQuery(sgf, analysisOpts);
    // Copys some options.
    sgfOpts.analyzeTurns = analysisOpts.analyzeTurns;

    const responses = (responsesPath == null
      ? (await kataGoAnalyze(sgf, query, defaultOpts.katago))
      : (await fs.readFile(responsesPath)).toString());

    if (saveGiven && !responsesPath) {
      const sgfName = sgfPath.substring(0, sgfPath.lastIndexOf('.'));

      await fs.writeFile(sgfName + '-responses.json', responses);
      console.error('"' + sgfName + '-responses.json' + '" created.');
    }

    // Saves responses to SGF.
    const rsgfPath = sgfPath.substring(0, sgfPath.lastIndexOf('.'))
      + defaultOpts.sgf.fileSuffix + '.sgf';
    const gametree = new GameTree(sgf, responses, sgfOpts);

    await fs.writeFile(rsgfPath, gametree.sgf());
    console.error('"' + rsgfPath + '" created.');

    const report = gametree.rootComment();
    if (report != '') {
      console.log(report);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
})();

// Requests analysis to KataGo, and reads responses.
async function kataGoAnalyze(sgf, query, katagoOpts) {
  // Spawns KataGo.
  const {spawn} = require('child_process');
  const katago = spawn(katagoOpts.path + ' ' + 
    katagoOpts.arguments, [], {shell: true});

  let responses = '';
  let error = '';

  katago.on('exit', (code) => {
    if (code != 0) {
      console.error('Failed to run KataGo from ' + config);
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
  for await (const data of katago.stdout) {
    responses += data;
  }

  // Reads stderr from KataGo.
  for await (const data of katago.stderr) {
    error += data;
  }

  return responses;
}

const sgfconv = require('./sgfconv');

// Gets JSON data to send KataGo Parallel Analysis Engine with pipe.
function sgfToKataGoAnalysisQuery(sgf, analysisOpts) {
  const sequence = sgfconv.removeTails(sgf);
  const komi = sgfconv.valueFromSequence('KM', sequence);

  if (komi != '') {
    analysisOpts.komi = parseFloat(komi);
    console.error('"komi" is set to ' + analysisOpts.komi + ' from SGF.');
  }

  const initialPlayer = sgfconv.valueFromSequence('PL', sequence);

  if (initialPlayer != '') {
    analysisOpts.initialPlayer = initialPlayer;
    console.error('"initialPlayer" is set to ' + initialPlayer + 
      ' from SGF.');
  }

  analysisOpts.id = '9beach';
  analysisOpts.initialStones = sgfconv.initialstonesFromSequence(sequence);
  analysisOpts.moves = sgfconv.katagomovesFromSequence(sequence);

  if (!analysisOpts.analyzeTurns) {
    analysisOpts.analyzeTurns = 
      [...Array(analysisOpts.moves.length + 1).keys()];
  }

  return JSON.stringify(analysisOpts);
}
