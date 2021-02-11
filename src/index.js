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

// Makes JSON data to send KataGo Parallel Analysis Engine.
function sgfToKataGoAnalysisQuery(sgf, opts) {
  const query = { ...opts };
  const sequence = sgfconv.removeTails(sgf);
  const komi = sgfconv.valueFromSequence('KM', sequence);

  if (komi !== '') {
    query.komi = parseFloat(komi);
    console.error(`"komi" is set to ${query.komi} from SGF.`);
  }

  const initialPlayer = sgfconv.valueFromSequence('PL', sequence);

  if (initialPlayer !== '') {
    query.initialPlayer = initialPlayer;
    console.error(`"initialPlayer" is set to ${initialPlayer} from SGF.`);
  }

  query.id = '9beach';
  query.initialStones = sgfconv.initialstonesFromSequence(sequence);
  query.moves = sgfconv.katagomovesFromSequence(sequence);

  if (!query.analyzeTurns) {
    query.analyzeTurns = [...Array(query.moves.length + 1).keys()];
  }

  return query;
}

// Requests analysis to KataGo, and reads responses.
async function kataGoAnalyze(sgf, query, katagoopts) {
  const katago = spawn(`${katagoopts.path} ${katagoopts.arguments}`, [], {
    shell: true,
  });

  let responses = '';
  let error = '';

  katago.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Failed to run KataGo from ${config}`);
      // Just for error readibility.
      const opts = JSON.stringify(katagoopts, null, 2)
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
  //
  // eslint-disable-next-line no-restricted-syntax
  for await (const data of katago.stdout) {
    responses += data;
  }

  // Reads stderr from KataGo.
  //
  // eslint-disable-next-line no-restricted-syntax
  for await (const data of katago.stderr) {
    error += data;
  }

  return responses;
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

  let responsespath = null;
  let savegiven = false;
  let analysisopts = {};
  let sgfopts = {};
  let katagoopts = {};

  // Parses args.
  try {
    const parser = new pgetopt.BasicParser(
      'k:(katago)a:(analysis)g:(sgf)sf:',
      process.argv,
    );

    let opt = null;
    let turnsgiven = false;

    for (;;) {
      opt = parser.getopt();
      if (opt === undefined) {
        break;
      }
      switch (opt.option) {
        case 'a':
          analysisopts = parseBadJSON(opt.optarg);
          if (opt.optarg.search('analyzeTurns') >= 0) {
            turnsgiven = true;
          }
          break;
        case 'k':
          katagoopts = parseBadJSON(opt.optarg);
          break;
        case 'g':
          sgfopts = parseBadJSON(opt.optarg);
          break;
        case 's':
          savegiven = true;
          break;
        case 'f':
          responsespath = opt.optarg;
          break;
        default:
          console.error(help);
          process.exit(1);
      }
    }

    sgfopts.analyzeTurnsGiven = turnsgiven;

    if (parser.optind() >= process.argv.length) {
      console.error(help);
      process.exit(1);
    }

    const sgfpath = process.argv[parser.optind()];

    // Reads config file.
    const defaultopts = yaml.load(await fs.readFile(config));

    analysisopts = { ...defaultopts.analysis, ...analysisopts };
    sgfopts = { ...defaultopts.sgf, ...sgfopts };
    katagoopts = { ...defaultopts.katago, ...katagoopts };

    // Reads SGF.
    const content = await fs.readFile(sgfpath);
    const detected = jschardet.detect(content);
    const iconv = new Iconv(detected.encoding, 'utf-8');
    const sgf = iconv.convert(content).toString('utf-8');

    // Makes query for KataGo.
    const query = sgfToKataGoAnalysisQuery(sgf, analysisopts);
    // Copys some options.
    sgfopts.analyzeTurns = query.analyzeTurns;

    const responses =
      responsespath == null
        ? await kataGoAnalyze(sgf, JSON.stringify(query), katagoopts)
        : (await fs.readFile(responsespath)).toString();

    if (savegiven && !responsespath) {
      const sgfName = sgfpath.substring(0, sgfpath.lastIndexOf('.'));

      await fs.writeFile(`${sgfName}-responses.json`, responses);
      console.error(`"${sgfName}-responses.json" created.`);
    }

    // Saves responses to SGF.
    const rsgfpath = `${
      sgfpath.substring(0, sgfpath.lastIndexOf('.')) +
      defaultopts.sgf.fileSuffix
    }.sgf`;
    const gametree = new GameTree(sgf, responses, sgfopts);

    await fs.writeFile(rsgfpath, gametree.getSGF());
    console.error(`"${rsgfpath}" created.`);

    const report = gametree.getRootComment();
    if (report !== '') {
      console.log(report);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
