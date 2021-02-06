#!/usr/bin/env node

/** 
 * @fileOverview Command line interface for analyze-sgf.
 */
'use strict';

const fs = require('fs').promises;
const sgfconv = require('./index');

const yamlPath = (process.env.HOME || process.env.USERPROFILE) + 
  '/.analyze-sgf.yml';
let analysisOpts = {};
let sgfOpts = {};
let saveJSON = false;
let sgfPath = null;
let responsesPath = null;

const HELP = 
`Usage: analyze-sgf [-k=json-data] [-g=json-data] [-s] [-r=json-file] sgf-file

Option: 
  -k, --katago            JSON data for KataGo Parallel Analysis Engine query
  -g, --sgf               JSON data for making reviewed SGF file
  -s,                     Save KataGo responses JSON
  -r,                     Analyze KataGo responses JSON

Examples:
  analyze-sgf --katago 'rules:"korean",komi:6.5' baduk.sgf
  analyze-sgf -k 'maxVisits:6400,analyzeTurns:[197,198]' baduk.sgf
  analyze-sgf -g 'maxVisits:600' baduk.sgf    # The bigger, the more accurate.
  analyze-sgf baduk.sgf
  analyze-sgf -r baduk-responses.json baduk.sgf

Edit ~/.analyze-sgf.yml for default options
Report analyze-sgf bugs to <https://github.com/9beach/analyze-sgf/issues>
analyze-sgf home page: <https://github.com/9beach/analyze-sgf/>`;

(async () => {
  // Creates "~/.analyze-sgf.yml".
  try {
    await fs.access(yamlPath);
  } catch (error) {
    const defaultOptsPath = require.resolve('./analyze-sgf.yml');
    await fs.copyFile(defaultOptsPath, yamlPath);
    console.error('"' + yamlPath + '" created.');
  }

  // Parses args.
  try {
    const pgetopt = require('posix-getopt');
    const parseBadJSON = require('./bad-json');

    let parser = new pgetopt.BasicParser('k:(katago)g:(sgf)sr:', process.argv);
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
          saveJSON = true;
          break;
        case 'r':
          responsesPath = opt.optarg;
          break;
        default:
          console.error(HELP);
          process.exit(1);
      }
    }

    sgfOpts.analyzeTurnsGiven = analyzeTurnsGiven;

    if (parser.optind() >= process.argv.length) {
      console.error(HELP);
      process.exit(1);
    }

    sgfPath = process.argv[parser.optind()];

    // Reads options.
    const yaml = require('js-yaml');
    let defaultOpts = yaml.load(await fs.readFile(yamlPath));

    analysisOpts = Object.assign({}, defaultOpts.analysis, analysisOpts);
    sgfOpts = Object.assign({}, defaultOpts.sgf, sgfOpts);

    const sgf = (await fs.readFile(sgfPath)).toString();
    // analysisOpts.analyzeTurns is set below.
    const query = sgfconv.sgfToKataGoAnalysisQuery(sgf, analysisOpts);
    // Copys some options.
    sgfOpts.analyzeTurns = analysisOpts.analyzeTurns;

    const responses = (responsesPath == null
      ? (await kataGoAnalyze(sgf, query, defaultOpts.katago))
      : (await fs.readFile(responsesPath)).toString());

    // Saves responses to SGF.
    const rsgf = sgfconv.kataGoAnalysisResponseToSGF(sgf, responses, sgfOpts);
    const rsgfPath = sgfPath.substring(0, sgfPath.lastIndexOf('.'))
      + defaultOpts.sgf.fileSuffix + '.sgf';

    await fs.writeFile(rsgfPath, rsgf);
    console.error('"' + rsgfPath + '" created.');

    const report = sgfconv.sgfToKataGoAnalysisReport(rsgf);
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

  katago.on('exit', (code) => {
    if (code != 0) {
      console.error('Please fix "path" or "arguments" in ' + yamlPath);
      process.exit(1);
    }
  });

  // Sends query to KataGo.
  const sgfName = sgfPath.substring(0, sgfPath.lastIndexOf('.'));

  if (saveJSON) {
    await fs.writeFile(sgfName + '-query.json', query);
    console.error('"' + sgfName + '-query.json' + '" created.');
  }

  await katago.stdin.write(query);
  katago.stdin.end();

  // Reads analysis from KataGo.
  let responses = '';
  for await (const data of katago.stdout) {
    responses += data;
  }

  if (saveJSON) {
    await fs.writeFile(sgfName + '-responses.json', responses);
    console.error('"' + sgfName + '-responses.json' + '" created.');
  }

  return responses;
}
