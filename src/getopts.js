/**
 * @fileOverview Parses process arguments and config.
 */

const fs = require('fs');
const syspath = require('path');
const yaml = require('js-yaml');
const pgetopt = require('posix-getopt');
const homedir = require('os').homedir();
const chalk = require('chalk');

const parseBadJSON = require('./bad-json');

const log = (message) => console.error(chalk.grey(message));
const config = `${homedir}${syspath.sep}.analyze-sgf.yml`;

// Parses process arguments and config, and return JSON object.
function getopts() {
  // Generates config file.
  try {
    fs.accessSync(config);
  } catch (error) {
    fs.copyFileSync(require.resolve('./analyze-sgf.yml'), config);
    log(`generated: ${config}`);
  }

  const args = parseArgs();
  const conf = readConfig(args.kopts, args.aopts, args.sopts);
  return { ...args, ...conf };
}

function parseArgs() {
  const help = fs.readFileSync(require.resolve('./help')).toString();

  let jsonGiven = false;
  let saveGiven = false;
  let aopts = {};
  let sopts = {};
  let kopts = {};

  // Parses args.
  const parser = new pgetopt.BasicParser(
    'k:(kopts)a:(aopts)g:(sopts)sfh',
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
        aopts = parseBadJSON(opt.optarg);
        break;
      case 'k':
        kopts = parseBadJSON(opt.optarg);
        break;
      case 'g':
        sopts = parseBadJSON(opt.optarg);
        break;
      case 's':
        saveGiven = true;
        break;
      case 'f':
        jsonGiven = true;
        break;
      case 'h':
      default:
        process.stderr.write(help);
        process.exit(1);
    }
  }

  // paths given.
  if (parser.optind() >= process.argv.length) {
    log('Please specify SGF/GIB files.');
    process.stderr.write(help);
    process.exit(1);
  }

  if (jsonGiven && saveGiven) {
    log('neglected `-s` with `-f`.');
  }

  const paths = process.argv.slice(parser.optind());

  return { kopts, aopts, sopts, paths, jsonGiven, saveGiven };
}

// Reads config file and merges options.
function readConfig(kopts, aopts, sopts) {
  const opts = yaml.load(fs.readFileSync(config));

  const katago = { ...opts.katago, ...kopts };
  const analysis = { ...opts.analysis, ...aopts };
  const sgf = { ...opts.sgf, ...sopts };

  sgf.analyzeTurns = analysis.analyzeTurns;

  // Backward compatibility to v0.0.8
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
