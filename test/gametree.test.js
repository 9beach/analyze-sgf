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

  it('should be expected values for "test/t-ren-vs-shin.*".', () => {
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

      let esgf = fs.readFileSync(expected).toString();
      esgf = sgfconv.removeComment(esgf);

      assert.equal(esgf, rsgf);
    }

    compareWithoutComments(
      'test/t-ren-vs-shin.sgf',
      'test/t-ren-vs-shin-responses.json',
      'test/t-ren-vs-shin-analyzed.sgf',
    );

    compareWithoutComments(
      'test/t-sabaki-1.sgf',
      'test/t-sabaki-1-responses.json',
      'test/t-sabaki-1-default.sgf',
    );

    sgfopts.showVariationsAfterLastMove = true;
    sgfopts.analyzeTurnsGiven = false;

    compareWithoutComments(
      'test/t-sabaki-1.sgf',
      'test/t-sabaki-1-responses.json',
      'test/t-sabaki-1-lastmove.sgf',
    );

    sgfopts.showVariationsAfterLastMove = true;
    sgfopts.analyzeTurnsGiven = true;
    sgfopts.analyzeTurns = [0, 1, 2, 3, 4, 5];

    compareWithoutComments(
      'test/t-sabaki-1.sgf',
      'test/t-sabaki-1-responses.json',
      'test/t-sabaki-1-turns-lastmove.sgf',
    );

    sgfopts.showVariationsAfterLastMove = false;
    sgfopts.analyzeTurnsGiven = true;

    compareWithoutComments(
      'test/t-sabaki-1.sgf',
      'test/t-sabaki-1-responses.json',
      'test/t-sabaki-1-turns.sgf',
    );

    function compareWithComments(original, json, expected) {
      const sgf = fs.readFileSync(original).toString();
      const responses = fs.readFileSync(json).toString();
      const gametree = new GameTree(sgf, responses, sgfopts);
      const rsgf = gametree.getSGF();

      assert.equal(fs.readFileSync(expected).toString(), rsgf);
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
      'test/t-ren-vs-shin.sgf',
      'test/t-ren-vs-shin-responses.json',
      'test/t-ren-vs-shin-analyzed.sgf',
    );
  });
});
