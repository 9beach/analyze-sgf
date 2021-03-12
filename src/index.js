#!/usr/bin/env node

/**
 * @fileOverview Command line interface for analyze-sgf.
 */

const fs = require('fs');
const syspath = require('path');
const homedir = require('os').homedir();
const chalk = require('chalk');
const jschardet = require('jschardet');
const iconv = require('iconv-lite');
const progress = require('cli-progress');
const { spawn } = require('child_process');
const { reduce } = require('axax/es5/reduce');

const getopts = require('./getopts');
const sgfconv = require('./sgfconv');
const katagoconv = require('./katagoconv');
const GameTree = require('./gametree');
const toSGF = require('./gib2sgf');
const { httpgetSGF, isValidURL } = require('./httpget-sgf');

const log = (message) => console.error(chalk.grey(message));
const config = `${homedir}${syspath.sep}.analyze-sgf.yml`;
const getExt = (path) =>
  path.substring(1 + path.lastIndexOf('.'), path.length).toLowerCase();

// Parses args and merges them with yaml config.
const opts = getopts();

// Starts async communication with KataGo.
(async () => {
  // Analyzes by KataGo Analysis Engine.
  opts.paths.map(async (path) => {
    try {
      const { newPath, sgf, responses } = opts.jsonGiven
        ? processJSON(path)
        : await processSGF(path);
      saveAnalyzed(newPath, sgf, responses, opts.saveGiven, opts.sgf);
    } catch (error) {
      log(`${error.message}, while processing: ${path}`);
    }
  });
})();

// Analyzes a SGF by KataGo Analysis JSON, not by KataGO Analysis Engine.
//
// Simply returns SGF and KataGo responses from JSON.
// JSON file format: tailless SGF + '\n' + KataGo responses.
function processJSON(path) {
  const ext = getExt(path);
  if (ext !== 'json') {
    log(`skipped: ${path}`);
    return {};
  }

  const sgfAndResponses = fs.readFileSync(path).toString();
  const index = sgfAndResponses.indexOf('\n');
  const sgf = sgfconv.correctSGFDialects(sgfAndResponses.substring(0, index));
  const responses = sgfAndResponses.substring(index + 1);

  return { newPath: path, responses, sgf };
}

// Analyzes a SGF by KataGo Analysis Engine.
async function processSGF(path) {
  const ext = getExt(path);
  const isURL = isValidURL(path);

  if (ext !== 'sgf' && ext !== 'gib' && !isURL) {
    log(`skipped: ${path}`);
    return {};
  }

  // Gets SGF file name and contents from Web, GIB, or SGF.
  const { newPath, sgf } = getNewPathAndSGF(isURL, path, ext);

  // Sends query to KataGo.
  const query = katagoconv.sgfToKataGoAnalysisQuery(sgf, opts.analysis);
  const responses = await kataGoAnalyze(query, opts.katago);

  // KataGoAnalyze already has printed error message. So we just return.
  if (!responses) return {};

  // If revisit given, try again.
  const newResponses = opts.revisit
    ? await revisitKataGo(responses, query)
    : responses;

  return { newPath, responses: newResponses, sgf };
}

// Gets SGF file name and contents from Web, GIB, or SGF.
function getNewPathAndSGF(isURL, path, ext) {
  // Gets SGF from web server and generates file.
  if (isURL) {
    const sgf = httpgetSGF(path);
    const newPath = sgfconv.prettyPathFromSGF(sgf);
    fs.writeFileSync(newPath, sgf);
    log(`downloaded: ${newPath}`);
    return { sgf, newPath };
  }

  // Reads SGF/GIB file.
  const content = fs.readFileSync(path);
  const detected = jschardet.detect(content);
  const sgf = iconv.decode(content, detected.encoding).toString();

  // Converts it if GIB given.
  const newSGF = ext === 'gib' ? toSGF(sgf) : sgfconv.correctSGFDialects(sgf);
  return { sgf: newSGF, newPath: path };
}

// Saves SGF file and JSON responses from KataGo.
function saveAnalyzed(targetPath, sgf, responses, saveResponse, sgfOpts) {
  if (!targetPath || !sgf || !responses) return;
  if (responses.search('{"error":"') === 0)
    throw Error(responses.slice(0, -1)); // Removes line feed.

  const targetName = targetPath.substring(0, targetPath.lastIndexOf('.'));

  // Saves analysis responses to JSON.
  if (saveResponse) {
    const jsonPath = `${targetName}.json`;

    // JSON file format: tailless SGF + '\n' + KataGo responses.
    fs.writeFileSync(jsonPath, `${sgfconv.removeTails(sgf)}\n${responses}`);
    log(`generated: ${jsonPath}`);
  }

  // Saves analyzed SGF.
  const gametree = new GameTree(sgf, responses, sgfOpts);
  const sgfPath = `${targetName}${sgfOpts.fileSuffix}.sgf`;

  fs.writeFileSync(sgfPath, gametree.getSGF());
  log(`generated: ${sgfPath}`);

  const report = gametree.getReport();
  if (report) {
    console.log(report);
  }
}

// FIXME: No respawn.
// Requests analysis to KataGo, and reads responses.
async function kataGoAnalyze(query, katagoOpts) {
  const katago = spawn(`${katagoOpts.path} ${katagoOpts.arguments}`, [], {
    shell: true,
  });

  katago.on('exit', (code) => {
    if (code !== 0) {
      log(
        `Process error. Please fix: ${config}\n${JSON.stringify(katagoOpts)}`,
      );
      process.exit(1);
    }
  });

  const bar = new progress.SingleBar(
    {
      format: `{bar} {percentage}% ({value}/{total}, ${sgfconv.formatK(
        query.maxVisits,
      )} visits) | ETA: {eta_formatted} ({duration_formatted})`,
      barsize: 30,
    },
    progress.Presets.rect,
  );
  bar.start(query.analyzeTurns.length, 0);

  // Sends query to KataGo.
  await katago.stdin.write(`${JSON.stringify(query)}\n`);
  katago.stdin.end();

  // Reads analysis from KataGo.
  const { responses } = await reduce(
    (acc, cur) => {
      const count = (cur.toString().match(/\n/g) || []).length;
      bar.update(acc.count + count);
      return {
        count: acc.count + count,
        responses: acc.responses + cur,
      };
    },
    { count: 0, responses: '' },
  )(katago.stdout);

  bar.stop();
  return responses;
}

// Revisits KataGo and merges responses.
async function revisitKataGo(responses, query) {
  const queryRe = { ...query };
  queryRe.maxVisits = opts.revisit;
  queryRe.analyzeTurns = katagoconv.winrateDropTurnsFromKataGoResponses(
    responses,
    opts.sgf.minWinrateDropForVariations / 100,
  );

  if (!queryRe.analyzeTurns.length) {
    log(
      'No move found whose win rate drops by more than ' +
        `${opts.sgf.minWinrateDropForVariations}%.`,
    );
    return null;
  }

  const responsesRe = await kataGoAnalyze(queryRe, opts.katago);
  if (!responsesRe) {
    log('revisit error');
    return null;
  }
  return katagoconv.mergeKataGoResponses(
    responses,
    responsesRe,
    queryRe.analyzeTurns,
  );
}
