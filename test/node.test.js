const fs = require('fs');
const assert = require('assert');
const yaml = require('js-yaml');

const Node = require('../src/node');

const yamlpath = require.resolve('../src/analyze-sgf.yml');
const opts = yaml.load(fs.readFileSync(yamlpath));
const sgfopts = opts.sgf;

describe('Node.setWinrate', () => {
  it('should result expected pl.', () => {
    const node = new Node('(;B[aa];W[bb])');

    assert.equal(node.pl, 'B');
  });

  it('should result expected winrate.', () => {
    const node = new Node('(;B[aa];W[bb])');
    const currinfo = { winrate: 0.44, scoreLead: 6.5, visits: 1000 };

    node.setWinrate(null, currinfo, sgfopts);

    assert.equal(node.winrateDrop, undefined);
    assert.equal(node.scoreDrop, undefined);
  });

  it('should result expected winrate drop.', () => {
    const node = new Node('(;B[aa];W[bb])');
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
  });

  it('should result inverted winrate drop.', () => {
    const node = new Node('(;W[aa];B[bb])');
    const previnfo = { winrate: 0.4, scoreLead: 5.0, visits: 1000 };
    const currinfo = { winrate: 0.44, scoreLead: 6.5, visits: 1000 };

    node.setWinrate(previnfo, currinfo, sgfopts);

    assert.equal(node.winrateDrop.toFixed(2), 0.04);
    assert.equal(node.scoreDrop.toFixed(1), 1.5);
    assert.equal(node.myScoreLead.toFixed(1), -6.5);
    assert.equal(node.myWinrate.toFixed(2), 0.56);
  });
});

describe('Node.formatPV', () => {
  it('should result expected PVs.', () => {
    const node = [new Node('(;B[aa];W[bb];B[cc])'), new Node(';B[aa]')];
    const previnfo = { winrate: 0.4, scoreLead: 5.0, visits: 1000 };
    const currinfo = { winrate: 0.44, scoreLead: 6.5, visits: 1000 };

    node[0].setWinrate(previnfo, currinfo, sgfopts);
    assert.equal(
      node[0].formatPV(19),
      'BA19 B18 C17 (W 56.00%, B 6.50, 1000 visits)',
    );

    node[1].setWinrate(previnfo, currinfo, sgfopts);
    assert.equal(node[1].formatPV(19), 'A19 (W 56.00%, B 6.50, 1000 visits)');
    assert.equal(node[1].formatPV(9), 'A9 (W 56.00%, B 6.50, 1000 visits)');
  });
});
