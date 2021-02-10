const fs = require('fs');
const assert = require('assert');
const yaml = require('js-yaml');

const sgfconv = require('../src/sgfconv');
const GameTree = require('../src/gametree');

const yamlpath = require.resolve('../src/analyze-sgf.yml');

const opts = yaml.load(fs.readFileSync(yamlpath));
const sgfopts = opts.sgf;

describe('GameTree', () => {
  it('should be expected values.', () => {
    const gametree = new GameTree('(PL[]C[12\n34];B[aa];W[bb])', '', opts);
    assert.equal(gametree.getSGF(), '(PL[];B[aa];W[bb])');
  });

  it('should be expected values for test/ex-ren-vs-shin.*', () => {
    sgfopts.maxVariationsForEachMove = 10;
    sgfopts.maxWinrateLossForGoodMove = 2;
    sgfopts.minWinrateLossForBadMove = 5;
    sgfopts.minWinrateLossForBadHotSpot = 20;
    sgfopts.minWinrateLossForVariations = 5;
    sgfopts.showVariationsAfterLastMove = false;
    sgfopts.analyzeTurnsGiven = false;

    function compareWithoutComments(original, json, expected) {
      const sgf = fs.readFileSync(original).toString();
      const responses = fs.readFileSync(json).toString();
      const gametree = new GameTree(sgf, responses, sgfopts);
      let rsgf = gametree.getSGF();
      rsgf = sgfconv.removeComment(rsgf);

      let ex = fs.readFileSync(expected).toString();
      ex = sgfconv.removeComment(ex);

      assert.equal(ex, rsgf);
    }

    compareWithoutComments(
      'test/ex-ren-vs-shin.sgf',
      'test/ex-ren-vs-shin-responses.json',
      'test/ex-ren-vs-shin-analyzed.sgf',
    );

    compareWithoutComments(
      'test/ex-sabaki-1.sgf',
      'test/ex-sabaki-1-responses.json',
      'test/ex-sabaki-1-default.sgf',
    );

    sgfopts.showVariationsAfterLastMove = true;
    sgfopts.analyzeTurnsGiven = false;

    compareWithoutComments(
      'test/ex-sabaki-1.sgf',
      'test/ex-sabaki-1-responses.json',
      'test/ex-sabaki-1-lastmove.sgf',
    );

    sgfopts.showVariationsAfterLastMove = true;
    sgfopts.analyzeTurnsGiven = true;
    sgfopts.analyzeTurns = [0, 1, 2, 3, 4, 5];

    compareWithoutComments(
      'test/ex-sabaki-1.sgf',
      'test/ex-sabaki-1-responses.json',
      'test/ex-sabaki-1-turns-lastmove.sgf',
    );

    sgfopts.showVariationsAfterLastMove = false;
    sgfopts.analyzeTurnsGiven = true;

    compareWithoutComments(
      'test/ex-sabaki-1.sgf',
      'test/ex-sabaki-1-responses.json',
      'test/ex-sabaki-1-turns.sgf',
    );

    function compareWithComments(original, json, expected) {
      const sgf = fs.readFileSync(original).toString();
      const responses = fs.readFileSync(json).toString();
      const gametree = new GameTree(sgf, responses, sgfopts);
      const rsgf = gametree.getSGF();
      const ex = fs.readFileSync(expected).toString();

      assert.equal(ex, rsgf);
    }

    sgfopts.maxVariationsForEachMove = 10;
    sgfopts.maxWinrateLossForGoodMove = 2;
    sgfopts.minWinrateLossForBadMove = 5;
    sgfopts.minWinrateLossForBadHotSpot = 20;
    sgfopts.minWinrateLossForVariations = 5;
    sgfopts.showVariationsAfterLastMove = false;
    sgfopts.analyzeTurnsGiven = false;

    // Be careful. Easy to fail with the change of comments formats.
    compareWithComments(
      'test/ex-ren-vs-shin.sgf',
      'test/ex-ren-vs-shin-responses.json',
      'test/ex-ren-vs-shin-analyzed.sgf',
    );
  });
});
