#!/usr/bin/env node

/**
 * @fileOverview A interface for parsing process arguments and config.
 */

const afs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const pgetopt = require('posix-getopt');
const homedir = require('os').homedir();
const chalk = require('chalk');

const parseBadJSON = require('./bad-json');

// Parses process arguments and config, and return JSON object.
function getopts() {
  const log = (message) => console.error(chalk.grey(message));
  const config = `${homedir}${path.sep}.analyze-sgf.yml`;

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
  let analysis = {};
  let sgf = {};
  let katago = {};

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
        analysis = parseBadJSON(opt.optarg);
        break;
      case 'k':
        katago = parseBadJSON(opt.optarg);
        break;
      case 'g':
        sgf = parseBadJSON(opt.optarg);
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

  katago = { ...opts.katago, ...katago };
  analysis = { ...opts.analysis, ...analysis };
  sgf = { ...opts.sgf, ...sgf };

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

  return { katago, analysis, sgf, sgfPaths, responsesPath, saveGiven };
}

module.exports = getopts;
