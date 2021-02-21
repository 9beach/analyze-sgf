const fs = require('fs');
const assert = require('assert');
const yaml = require('js-yaml');

const sgfconv = require('../src/sgfconv');
const GameTree = require('../src/gametree');

const yamlpath = require.resolve('../src/analyze-sgf.yml');

const opts = yaml.load(fs.readFileSync(yamlpath));
const sgfopts = opts.sgf;

const compareButLines = (x, y) =>
  assert.equal(x.replace(/\n/g, ''), y.replace(/\n/g, ''));

function compareButComments(original, json, expected) {
  const sgf = fs.readFileSync(original).toString();
  let responses = fs.readFileSync(json).toString();
  const index = responses.indexOf('\n');
  responses = responses.substring(index + 1);

  const gametree = new GameTree(sgf, responses, sgfopts);
  let rsgf = gametree.get();
  rsgf = sgfconv.removeComment(rsgf);

  let esgf = fs.readFileSync(expected).toString();
  esgf = sgfconv.removeComment(esgf);

  assert.equal(esgf, rsgf);
}

function compare(original, json, expected) {
  const sgf = fs.readFileSync(original).toString();

  let responses = fs.readFileSync(json).toString();
  const index = responses.indexOf('\n');
  responses = responses.substring(index + 1);

  const gametree = new GameTree(sgf, responses, sgfopts);
  const rsgf = gametree.get();

  compareButLines(fs.readFileSync(expected).toString(), rsgf);
}

describe('GameTree', () => {
  it('should be expected values.', () => {
    const gametree = new GameTree('(PL[]C[12\n34];B[aa];W[bb])', '', opts);
    compareButLines(gametree.get(), '(PL[];B[aa]C[Move #1];W[bb]C[Move #2])');
  });

  it('should be expected values for "test/examples/t-*".', () => {
    sgfopts.maxVariationsForEachMove = 10;
    sgfopts.maxWinrateDropForGoodMove = 2;
    sgfopts.minWinrateDropForBadMove = 5;
    sgfopts.minWinrateDropForBadHotSpot = 20;
    sgfopts.minWinrateDropForVariations = 5;
    sgfopts.showVariationsAfterLastMove = false;
    sgfopts.analyzeTurns = undefined;

    compareButComments(
      'test/examples/t-lian-vs-shin.sgf',
      'test/examples/t-lian-vs-shin.json',
      'test/examples/t-lian-vs-shin-analyzed.sgf',
    );

    compareButComments(
      'test/examples/t-sabaki-1.sgf',
      'test/examples/t-sabaki-1.json',
      'test/examples/t-sabaki-1-default.sgf',
    );

    sgfopts.showVariationsAfterLastMove = true;
    sgfopts.analyzeTurns = undefined;

    compareButComments(
      'test/examples/t-sabaki-1.sgf',
      'test/examples/t-sabaki-1.json',
      'test/examples/t-sabaki-1-lastmove.sgf',
    );

    sgfopts.showVariationsAfterLastMove = true;
    sgfopts.analyzeTurns = [0, 1, 2, 3, 4, 5];

    compareButComments(
      'test/examples/t-sabaki-1.sgf',
      'test/examples/t-sabaki-1.json',
      'test/examples/t-sabaki-1-turns-lastmove.sgf',
    );

    sgfopts.showVariationsAfterLastMove = false;

    compareButComments(
      'test/examples/t-sabaki-1.sgf',
      'test/examples/t-sabaki-1.json',
      'test/examples/t-sabaki-1-turns.sgf',
    );
  });

  it('should be expected values for "test/examples/t-lian-vs-shin.json".', () => {
    sgfopts.maxVariationsForEachMove = 10;
    sgfopts.maxWinrateDropForGoodMove = 2;
    sgfopts.minWinrateDropForBadMove = 5;
    sgfopts.minWinrateDropForBadHotSpot = 20;
    sgfopts.minWinrateDropForVariations = 5;
    sgfopts.showVariationsAfterLastMove = false;
    sgfopts.analyzeTurns = undefined;

    // Be careful. Easy to fail with the change of comments formats.
    compare(
      'test/examples/t-lian-vs-shin.sgf',
      'test/examples/t-lian-vs-shin.json',
      'test/examples/t-lian-vs-shin-analyzed.sgf',
    );
  });
});
