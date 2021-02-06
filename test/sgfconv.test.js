const fs = require('fs');
const assert = require('assert');

const sgfconv = require('../src/sgfconv');
const internal = require('../src/sgfconv-internal');

let defaultOpts;

const yaml = require('js-yaml');
const yamlPath = require.resolve('../src/analyze-sgf.yml');

defaultOpts = yaml.load(fs.readFileSync(yamlPath));

describe('sgfToKataGoAnalysisQuery', function () {
  it('should be expected values for test/ren-vs-shin-query.json', () => {
    const sgf = fs.readFileSync('test/ren-vs-shin.sgf').toString();
    const query = fs.readFileSync('test/ren-vs-shin-query.json').toString();

    defaultOpts.analysis.maxVisits = 6400;

    assert.equal(query, sgfconv.sgfToKataGoAnalysisQuery(sgf, 
      defaultOpts.analysis));
  });
});

describe('kataGoAnalysisResponseToSGF', function () {
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
    let rsgf = sgfconv.kataGoAnalysisResponseToSGF(sgf, responses, sgfOpts);
    rsgf = internal.stripComment(rsgf.toString());

    let ex = fs.readFileSync('test/ren-vs-shin-analyzed.sgf');
    ex = internal.stripComment(ex.toString());

    assert.equal(ex, rsgf);
  });
});

describe('rootCommentFromSGF', function () {
  it('should be expected values', () => {
    let sgf = 'abcd]C[1234];W[]';
    let comment = sgfconv.rootCommentFromSGF(sgf);
    assert.equal(comment, '1234');

    sgf = 'abcdC[1234];W[]';
    comment = sgfconv.rootCommentFromSGF(sgf);
    assert.equal(comment, '');

    sgf = 'abcd;C[1234]';
    comment = sgfconv.rootCommentFromSGF(sgf);
    assert.equal(comment, '');

    sgf = 'abcd[1234]';
    comment = sgfconv.rootCommentFromSGF(sgf);
    assert.equal(comment, '');

    sgf = 'abcd;C[];W[]';
    comment = sgfconv.rootCommentFromSGF(sgf);
    assert.equal(comment, '');

    sgf = 'abcd;C[12\n34];W\[';
    comment = sgfconv.rootCommentFromSGF(sgf);
    assert.equal(comment, '12\n34');
  });
});
