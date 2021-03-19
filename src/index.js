#!/usr/bin/env node

/**
 * @fileOverview Command line interface for analyze-sgf.
 */

const fs = require('fs');
const chalk = require('chalk');
const jschardet = require('jschardet');
const iconv = require('iconv-lite');

const getopts = require('./getopts');
const sgfconv = require('./sgfconv');
const katagoconv = require('./katagoconv');
const katago = require('./katago');
const GameTree = require('./gametree');
const toSGF = require('./gib2sgf');
const { httpgetSGF, isValidURL } = require('./httpget-sgf');

const log = (message) => console.error(chalk.grey(message));
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

// Analyzes a SGF by KataGo Analysis JSON, not by KataGo Analysis Engine.
//
// Simply returns SGF and KataGo responses from JSON.
// JSON file format: tailless SGF + '\n' + KataGo responses.
function processJSON(path) {
  if (getExt(path) !== 'json') {
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
  const responses = await katago.analyze(
    katagoconv.sgfToKataGoAnalysisQuery(sgf, opts.analysis),
    opts.revisit,
    opts.sgf.minWinrateDropForVariations / 100,
    opts.katago,
  );

  return { newPath, responses, sgf };
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
function saveAnalyzed(targetPath, sgf, responses, saveResponse, gopts) {
  if (!targetPath || !sgf || !responses) return;
  if (responses.search('{"error"') === 0) throw Error(responses.slice(0, -1));

  const targetName = targetPath.substring(0, targetPath.lastIndexOf('.'));

  // Saves analysis responses to JSON.
  if (saveResponse) {
    const jsonPath = `${targetName}.json`;

    // JSON file format: tailless SGF + '\n' + KataGo responses.
    fs.writeFileSync(jsonPath, `${sgfconv.removeTails(sgf)}\n${responses}`);
    log(`generated: ${jsonPath}`);
  }

  // Saves analyzed SGF.
  const gametree = new GameTree(sgf, responses, gopts);
  const sgfPath = `${targetName}${gopts.fileSuffix}.sgf`;

  fs.writeFileSync(sgfPath, gametree.getSGF());
  log(`generated: ${sgfPath}`);

  const report = gametree.getReport();
  if (report) console.log(report);
}
