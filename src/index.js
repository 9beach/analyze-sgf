#!/usr/bin/env node

/**
 * @fileOverview Command line interface for analyze-sgf.
 */

const afs = require('fs');
const chalk = require('chalk');
const jschardet = require('jschardet');
const iconv = require('iconv-lite');
const { spawn } = require('child_process');

const getopts = require('./getopts');
const sgfconv = require('./sgfconv');
const GameTree = require('./gametree');

const log = (message) => console.error(chalk.grey(message));

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
      const jsonPath = `${targetName}.json`;

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
        'Failed to run KataGo. Please fix ".analyze-sgf.yml".' +
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
const opts = getopts();

// Starts async communication with kataGoAnalyze().
(async () => {
  try {
    if (opts.responsesPath) {
      // Analyzes by KataGo Analysis JSON.
      const sgfresponses = afs.readFileSync(opts.responsesPath).toString();
      // JSON file format: tailless SGF + '\n' + KataGo response.
      const index = sgfresponses.indexOf('\n');
      const sgf = sgfresponses.substring(0, index);
      const responses = sgfresponses.substring(index + 1);

      saveAnalyzed(opts.responsesPath, sgf, responses, false, opts.sgf);
    } else {
      // Analyzes by KataGo Analysis Engine.
      //
      // Reads SGF and makes KagaGo queries.
      const sgfqueries = opts.sgfPaths.map((sgfPath, id) => {
        const content = afs.readFileSync(sgfPath);
        const detected = jschardet.detect(content);
        const sgf = iconv.decode(content, detected.encoding).toString();
        const query = sgfToKataGoAnalysisQuery(
          `9beach-${id.toString().padStart(3, '0')}`,
          sgf,
          opts.analysis,
        );

        return { sgf, query };
      });

      // Sends queries to KataGo
      const response = await kataGoAnalyze(
        // Gets queries olny.
        sgfqueries
          .map((sgfquery) => `${JSON.stringify(sgfquery.query)}`)
          .join('\n'),
        opts.katago,
      );

      // Does not exit(1) if fails. Gives "katago.on('exit', ...)" a change.
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
      }, Array(opts.sgfPaths.length).fill(''));

      opts.sgfPaths.forEach((sgfPath, id) =>
        // Saves analyzed SGF.
        saveAnalyzed(
          sgfPath,
          sgfqueries[id].sgf,
          responses[id],
          opts.saveGiven,
          opts.sgf,
        ),
      );
    }
  } catch (error) {
    log(error.message);
    process.exit(1);
  }
})();
