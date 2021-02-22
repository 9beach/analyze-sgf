const fs = require('fs');
const assert = require('assert');
const yaml = require('js-yaml');

const Node = require('../src/node');

const yamlpath = require.resolve('../src/analyze-sgf.yml');
const opts = yaml.load(fs.readFileSync(yamlpath));
const sgfopts = opts.sgf;

describe('Node', () => {
  it('should be expected values.', () => {
    let node;

    node = new Node(';B[aa];W[bb]');

    assert.equal(node.pl, 'B');

    // winrate as Black.
    const previnfo = { winrate: 0.4, scoreLead: 5.0, visits: 1000 };
    const currinfo = { winrate: 0.44, scoreLead: 6.5, visits: 1000 };

    node.setWinrate(previnfo, currinfo, sgfopts);

    assert.equal(node.winrate, currinfo.winrate);
    assert.equal(node.scoreLead, currinfo.scoreLead);
    assert.equal(node.visits, currinfo.visits);
    assert.equal(node.winrateDrop.toFixed(2), -0.04);
    assert.equal(node.scoreDrop.toFixed(1), -1.5);
    assert.equal(node.myWinrate, currinfo.winrate);
    assert.equal(node.myScoreLead, currinfo.scoreLead);

    node = new Node(';B[aa];W[bb]');
    node.setWinrate(null, currinfo, sgfopts);

    assert.equal(node.winrateDrop, undefined);
    assert.equal(node.scoreDrop, undefined);

    node = new Node(';W[aa];B[bb]');
    node.setWinrate(previnfo, currinfo, sgfopts);

    assert.equal(node.winrateDrop.toFixed(2), 0.04);
    assert.equal(node.scoreDrop.toFixed(1), 1.5);
    assert.equal(node.myScoreLead.toFixed(1), -6.5);
    assert.equal(node.myWinrate.toFixed(2), 0.56);
  });
});
