const fs = require('fs');
const assert = require('assert');

const sgfconv = require('../src/sgfconv');

let defaultOpts;

const yaml = require('js-yaml');
const yamlPath = require.resolve('../src/analyze-sgf.yml');

defaultOpts = yaml.load(fs.readFileSync(yamlPath));

defaultOpts.analysis.maxVisits = 6400;
defaultOpts.sgf.maxVariationsForEachMove = 10;

describe('sgfToKataGoAnalysisQuery', function () {
  it('should be expected values for test/ren-vs-shin-query.json', () => {
    const sgf = fs.readFileSync('test/ren-vs-shin.sgf').toString();
    const query = fs.readFileSync('test/ren-vs-shin-query.json').toString();

    assert.equal(query, sgfconv.sgfToKataGoAnalysisQuery(sgf, 
      defaultOpts.analysis));
  });
});

describe('kataGoAnalysisResponseToSGF', function () {
  it('should be expected values for test/ren-vs-shin.*', () => {
    const sgf = fs.readFileSync('test/ren-vs-shin.sgf').toString();
    const responses = fs.readFileSync('test/ren-vs-shin-responses.json').toString();
    // const rsqf = fs.readFileSync('test/ren-vs-shin-analyzed.sgf').toString();
    // const analyzed = sgfconv.kataGoAnalysisResponseToSGF(sgf, 
    //   responses, defaultOpts.sgf);
    // assert.equal(analyzed, rsgf);
  });
});
