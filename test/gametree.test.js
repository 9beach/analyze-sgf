const fs = require('fs');
const assert = require('assert');

const sgfconv = require('../src/sgfconv');
const GameTree = require('../src/gametree');

const yaml = require('js-yaml');
const yamlpath = require.resolve('../src/analyze-sgf.yml');
const defaultOpts = yaml.load(fs.readFileSync(yamlpath));

describe('GameTree', function () {
  it('should be expected values.', () => {
    const gametree = new GameTree('(PL[]C[12\n34];B[aa];W[bb])', '', 
      defaultOpts.sgf);

    assert.equal(gametree.sgf(), '(PL[];B[aa];W[bb])');
  });
  it('should be expected values for test/ex-ren-vs-shin.*', () => {
    const sgfOpts = defaultOpts.sgf;

    sgfOpts.maxVariationsForEachMove = 10;
    sgfOpts.maxWinrateLossForGoodMove = 2;
    sgfOpts.minWinrateLossForBadMove = 5;
    sgfOpts.minWinrateLossForBadHotSpot = 20;
    sgfOpts.minWinrateLossForVariations = 5;
    sgfOpts.showVariationsAfterLastMove = false;
    sgfOpts.analyzeTurnsGiven = false;

    function compare(original, json, expected) {
      const sgf = fs.readFileSync(original).toString();
      const responses = fs.readFileSync(json).toString();
      const gametree = new GameTree(sgf, responses, sgfOpts);
      let rsgf = gametree.sgf();
      rsgf = sgfconv.removeComment(rsgf);

      let ex = fs.readFileSync(expected).toString();
      ex = sgfconv.removeComment(ex);

      assert.equal(ex, rsgf);
    }

    compare('test/ex-ren-vs-shin.sgf', 'test/ex-ren-vs-shin-responses.json', 
      'test/ex-ren-vs-shin-analyzed.sgf');

    compare('test/ex-sabaki-1.sgf', 'test/ex-sabaki-1-responses.json', 
      'test/ex-sabaki-1-default.sgf');

    sgfOpts.showVariationsAfterLastMove = true;
    sgfOpts.analyzeTurnsGiven = false;

    compare('test/ex-sabaki-1.sgf', 'test/ex-sabaki-1-responses.json', 
      'test/ex-sabaki-1-lastmove.sgf');

    sgfOpts.showVariationsAfterLastMove = true;
    sgfOpts.analyzeTurnsGiven = true;
    sgfOpts.analyzeTurns = [0,1,2,3,4,5];

    compare('test/ex-sabaki-1.sgf', 'test/ex-sabaki-1-responses.json', 
      'test/ex-sabaki-1-turns-lastmove.sgf');

    sgfOpts.showVariationsAfterLastMove = false;
    sgfOpts.analyzeTurnsGiven = true;
    sgfOpts.analyzeTurns = [0,1,2,3,4,5];

    compare('test/ex-sabaki-1.sgf', 'test/ex-sabaki-1-responses.json', 
      'test/ex-sabaki-1-turns.sgf');
  });
});
