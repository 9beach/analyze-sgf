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
  it('should be expected values for test/ren-vs-shin.*', () => {
    const sgfOpts = defaultOpts.sgf;

    sgfOpts.maxVariationsForEachMove = 10;
    sgfOpts.maxWinrateLossForGoodMove = 2;
    sgfOpts.minWinrateLossForBadMove = 5;
    sgfOpts.minWinrateLossForBadHotSpot = 20;
    sgfOpts.minWinrateLossForVariations = 5;
    sgfOpts.showVariationsAfterLastMove = false;
    sgfOpts.showBadVariations = false;
    sgfOpts.analyzeTurnsGiven = false;

    const sgf = fs.readFileSync('test/ren-vs-shin.sgf').toString();
    const responses = fs.readFileSync('test/ren-vs-shin-responses.json')
      .toString();
    const gametree = new GameTree(sgf, responses, sgfOpts);
    let rsgf = gametree.sgf();
    rsgf = sgfconv.removeComment(rsgf);

    let ex = fs.readFileSync('test/ren-vs-shin-analyzed.sgf').toString();
    ex = sgfconv.removeComment(ex);

    assert.equal(ex, rsgf);
  });
});
