/**
 * @fileOverview Parses process arguments and config.
 */

const fs = require('fs');
const syspath = require('path');
const yaml = require('js-yaml');
const posixgetopt = require('posix-getopt');
const homedir = require('os').homedir();
const chalk = require('chalk');

const parseBadJSON = require('./bad-json');

const log = (message) => console.error(chalk.grey(message));
const help = fs.readFileSync(require.resolve('./help')).toString();
const config = `${homedir}${syspath.sep}.analyze-sgf.yml`;

function helpexit() {
  process.stderr.write(help);
  process.exit(1);
}

// Parses process arguments, reads config, and returns JSON object.
function getopts() {
  // Generates config file.
  try {
    fs.accessSync(config);
  } catch (error) {
    fs.copyFileSync(require.resolve('./analyze-sgf.yml'), config);
    log(`generated: ${config}`);
  }

  // Reads 7 keys.
  const args = parseArgs();
  // Merges each of 3 keys.
  const yml = readConfig(args.katago, args.analysis, args.sgf);

  if (args.revisit && args.revisit < yml.analysis.maxVisits) {
    log(
      `revisit argument (${args.revisit}) is less than maxVisits ` +
        `(${yml.analysis.maxVisits})`,
    );
    process.exit(1);
  }

  // Merge them.
  return { ...args, ...yml };
}

// Parses args.
function parseArgs() {
  let jsonGiven = false;
  let saveGiven = false;
  let revisit;
  let analysis = {};
  let sgf = {};
  let katago = {};

  const parser = new posixgetopt.BasicParser(
    'k:(katago)a:(analysis)g:(sgf)r:(revisit)sfh',
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
        analysis = parseBadJSON(opt.optarg);
        break;
      case 'k':
        katago = parseBadJSON(opt.optarg);
        break;
      case 'g':
        sgf = parseBadJSON(opt.optarg);
        break;
      case 'r':
        revisit = parseInt(opt.optarg, 10);
        break;
      case 's':
        saveGiven = true;
        break;
      case 'f':
        jsonGiven = true;
        break;
      case 'h':
      default:
        helpexit();
    }
  }

  if (jsonGiven && saveGiven) log('neglected `-s` with `-f`.');
  if (jsonGiven && revisit) log('neglected `--revisit` with `-f`.');

  if (parser.optind() >= process.argv.length) {
    log('Please specify SGF/GIB files.');
    helpexit();
  }
  const paths = process.argv.slice(parser.optind());

  return { katago, analysis, sgf, revisit, saveGiven, jsonGiven, paths };
}

// Reads config and merges each key of it with args.
function readConfig(kopts, aopts, sopts) {
  const opts = yaml.load(fs.readFileSync(config));

  const katago = { ...opts.katago, ...kopts };
  const analysis = { ...opts.analysis, ...aopts };
  const sgf = { ...opts.sgf, ...sopts };

  sgf.analyzeTurns = analysis.analyzeTurns;

  // Backward compatibility to v0.0.8.
  if (sgf.maxWinrateLossForGoodMove && !sgf.maxWinrateDropForGoodMove) {
    sgf.maxWinrateDropForGoodMove = sgf.maxWinrateLossForGoodMove;
  }
  if (sgf.minWinrateLossForBadMove && !sgf.minWinrateDropForBadMove) {
    sgf.minWinrateDropForBadMove = sgf.minWinrateLossForBadMove;
  }
  if (sgf.minWinrateLossForBadHotSpot && !sgf.minWinrateDropForBadHotSpot) {
    sgf.minWinrateDropForBadHotSpot = sgf.minWinrateLossForBadHotSpot;
  }
  if (sgf.minWinrateLossForVariations && !sgf.minWinrateDropForVariations) {
    sgf.minWinrateDropForVariations = sgf.minWinrateLossForVariations;
  }

  return { katago, analysis, sgf };
}

module.exports = getopts;
