/* eslint max-lines-per-function: ["error", 100] */

const fs = require('fs');
const assert = require('assert');
const yaml = require('js-yaml');

const sgfconv = require('../src/sgfconv');
const GameTree = require('../src/gametree');

const yamlpath = require.resolve('../src/analyze-sgf.yml');

const opts = yaml.load(fs.readFileSync(yamlpath));
const sgfopts = opts.sgf;

// Removes line feeds and comments.
function removeComment(sgf) {
  return sgf
    .replace(/\r\n/g, '')
    .replace(/\n/g, '')
    .replace(/\\\]/g, '@$$yy$$@')
    .replace(/\bC\[[^\]]*\]/g, '')
    .replace(/@$$yy$$@/g, '\\]');
}

function compareButComments(original, json, expected) {
  let sgf = fs.readFileSync(original).toString();
  sgf = sgfconv.correctSGFDialects(sgf);
  let responses = fs.readFileSync(json).toString();
  const index = responses.indexOf('\n');
  responses = responses.substring(index + 1);

  const gametree = new GameTree(sgf, responses, sgfopts);
  let rsgf = gametree.getSGF();
  rsgf = removeComment(rsgf);

  let esgf = fs.readFileSync(expected).toString();
  esgf = removeComment(esgf);

  assert.equal(esgf, rsgf);
}

function compare(original, json, expected) {
  let sgf = fs.readFileSync(original).toString();
  sgf = sgfconv.correctSGFDialects(sgf);

  let responses = fs.readFileSync(json).toString();
  const index = responses.indexOf('\n');
  responses = responses.substring(index + 1);

  const gametree = new GameTree(sgf, responses, sgfopts);
  const rsgf = gametree.getSGF();

  assert.equal(fs.readFileSync(expected).toString(), rsgf);
}

describe('GameTree', () => {
  it('should remove the comment of root node, and add move comment.', () => {
    const compareButLines = (x, y) =>
      assert.equal(x.replace(/\n/g, ''), y.replace(/\n/g, ''));
    const gametree = new GameTree('(PL[]C[12\n34];B[aa];W[bb])', '', opts);
    compareButLines(
      gametree.getSGF(),
      '(;PL[];B[aa]C[Move 1];W[bb]C[Move 2])',
    );
  });

  it('should be expected values for "t-lian-vs-shin.sgf".', () => {
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
  });

  it('should be expected values for "t-sabaki-1-default.sgf".', () => {
    compareButComments(
      'test/examples/t-sabaki-1.sgf',
      'test/examples/t-sabaki-1.json',
      'test/examples/t-sabaki-1-default.sgf',
    );
  });

  it('should add passing move for "t-sabaki-1-lastmove.sgf".', () => {
    sgfopts.showVariationsAfterLastMove = true;
    sgfopts.analyzeTurns = undefined;

    compareButComments(
      'test/examples/t-sabaki-1.sgf',
      'test/examples/t-sabaki-1.json',
      'test/examples/t-sabaki-1-lastmove.sgf',
    );
  });

  it('should add passing move and all the variations.', () => {
    sgfopts.showVariationsAfterLastMove = true;
    sgfopts.analyzeTurns = [0, 1, 2, 3, 4, 5];

    compareButComments(
      'test/examples/t-sabaki-1.sgf',
      'test/examples/t-sabaki-1.json',
      'test/examples/t-sabaki-1-turns-lastmove.sgf',
    );
  });

  it('should add all the variations.', () => {
    sgfopts.showVariationsAfterLastMove = false;

    compareButComments(
      'test/examples/t-sabaki-1.sgf',
      'test/examples/t-sabaki-1.json',
      'test/examples/t-sabaki-1-turns.sgf',
    );
  });

  it('should be same for each comment of "t-lian-vs-shin.sgf".', () => {
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
