#!/usr/bin/env node

/**
 * @fileOverview Command line interface for analyze-sgf.
 */

const fs = require('fs');
const chalk = require('chalk');
const jschardet = require('jschardet');
const iconv = require('iconv-lite');
const { spawn } = require('child_process');

const getopts = require('./getopts');
const sgfconv = require('./sgfconv');
const GameTree = require('./gametree');
const toSGF = require('./gib2sgf');
const { prettyPath } = require('./report-game');
const { httpget, isValidURL } = require('./httpget');

const log = (message) => console.error(chalk.grey(message));
const getext = (path) =>
  path.substring(1 + path.lastIndexOf('.'), path.length).toLowerCase();

// Pargses args.
const opts = getopts();

// Starts async communication with kataGoAnalyze().
(async () => {
  try {
    // Analyzes by KataGo Analysis JSON, not by KataGO engine.
    if (opts.jsonGiven) {
      opts.paths.forEach((path) => {
        const ext = getext(path);
        if (ext !== 'json') {
          log(`skip ${path}.`);
          return;
        }

        const sgfresponses = fs.readFileSync(path).toString();
        // JSON file format: tailless SGF + '\n' + KataGo responses.
        const index = sgfresponses.indexOf('\n');
        const sgf = sgfresponses.substring(0, index);
        const responses = sgfresponses.substring(index + 1);

        saveAnalyzed(path, sgf, responses, false, opts.sgf);
      });
    } else {
      // Analyzes by KataGo Analysis Engine.
      //
      // Reads SGF and makes KagaGo queries.
      opts.paths.map(async (path) => {
        const ext = getext(path);
        const isURL = isValidURL(path);
        if (ext !== 'sgf' && ext !== 'gib' && !isURL) {
          log(`skip ${path}.`);
          return;
        }

        let sgf;
        let newPath;

        if (!isURL) {
          const content = fs.readFileSync(path);
          const detected = jschardet.detect(content);
          sgf = iconv.decode(content, detected.encoding).toString();
          if (ext === 'gib') sgf = toSGF(sgf);
          newPath = path;
        } else {
          sgf = httpget(path);
          newPath = prettyPath(sgf);
          fs.writeFileSync(newPath, sgf);
          log(`${newPath} generated.`);
        }

        const query = sgfToKataGoAnalysisQuery(sgf, opts.analysis);

        // Sends queries to KataGo
        const responses = await kataGoAnalyze(
          JSON.stringify(query),
          opts.katago,
        );

        if (responses) {
          saveAnalyzed(newPath, sgf, responses, opts.saveGiven, opts.sgf);
        }
      });
    }
  } catch (error) {
    log(error.message);
    process.exit(1);
  }
})();

// Makes JSON data to send KataGo Parallel Analysis Engine.
function sgfToKataGoAnalysisQuery(sgf, analysisOpts) {
  const query = { ...analysisOpts };
  const sequence = sgfconv.removeTails(sgf);
  const komi = sgfconv.valueFromSequence(sequence, 'KM');

  if (komi) {
    query.komi = parseFloat(komi);
  } else {
    // Handles SGF dialect.
    const ko = sgfconv.valueFromSequence(sequence, 'KO');
    if (ko) {
      query.komi = parseFloat(ko);
    }
  }

  const initialPlayer = sgfconv.valueFromSequence(sequence, 'PL');

  if (initialPlayer) {
    query.initialPlayer = initialPlayer;
  }

  query.id = Math.random().toString();
  query.initialStones = sgfconv.initialstonesFromSequence(sequence);
  query.moves = sgfconv.katagomovesFromSequence(sequence);

  if (!query.analyzeTurns) {
    query.analyzeTurns = [...Array(query.moves.length + 1).keys()];
  }

  return query;
}

// Saves SGF file and JSON responses from KataGo.
function saveAnalyzed(targetPath, sgf, responses, saveResponse, sgfOpts) {
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
      const jsonPath = `${targetName}.json`;

      // JSON file format: tailless SGF + '\n' + KataGo responses.
      fs.writeFileSync(jsonPath, `${sgfconv.removeTails(sgf)}\n${responses}`);
      log(`${jsonPath} generated.`);
    }

    // Saves analyzed SGF.
    const gametree = new GameTree(sgf, responses, sgfOpts);
    const sgfPath = `${targetName}${sgfOpts.fileSuffix}.sgf`;

    fs.writeFileSync(sgfPath, gametree.get());
    log(`${sgfPath} generated.`);

    const report = gametree.getComment();
    if (report) {
      console.log(report);
    }
  } catch (error) {
    log(`${error}, while processing ${targetPath}`);
  }
}

// Requests analysis to KataGo, and reads responses.
async function kataGoAnalyze(queries, katagoOpts) {
  const katago = spawn(`${katagoOpts.path} ${katagoOpts.arguments}`, [], {
    shell: true,
  });

  let responses = '';

  katago.on('exit', (code) => {
    if (code !== 0) {
      log(
        'Failed to run KataGo. Please fix ".analyze-sgf.yml".' +
          `\n${JSON.stringify(katagoOpts)}`,
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
