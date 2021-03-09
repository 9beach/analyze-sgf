/* eslint max-lines: ["error", 300] */

const fs = require('fs');
const assert = require('assert');

const katagoconv = require('../src/katagoconv');
const sgfconv = require('../src/sgfconv');

describe('seqFromKataGoMoveInfo', () => {
  it('should be expected values.', () => {
    const moveInfo = { pv: ['A1', 'B2', 'C3'] };

    assert.equal(
      katagoconv.seqFromKataGoMoveInfo('W', moveInfo),
      '(;W[aa];B[bb];W[cc])',
    );
    assert.equal(
      katagoconv.seqFromKataGoMoveInfo('B', moveInfo),
      '(;B[aa];W[bb];B[cc])',
    );
  });
});

describe('initialStonesFromRoot', () => {
  it('should return valid initialStones.', () => {
    const rs = sgfconv.rootAndSeqFromSGF(
      '(HA[2]AB[aa][bb]AW[ab][cc];W[po];B[hm]TE[1])',
    );
    assert.deepEqual(katagoconv.initialStonesFromRoot(rs.root), [
      ['B', 'A1'],
      ['B', 'B2'],
      ['W', 'A2'],
      ['W', 'C3'],
    ]);
  });
  it('should return empty initialStones.', () => {
    const rs = sgfconv.rootAndSeqFromSGF('(HA[2];B[hm]TE[1])');
    assert.deepEqual(katagoconv.initialStonesFromRoot(rs.root), []);
  });
});

describe('seqToKataGoMoves', () => {
  it('should be expected values.', () => {
    let seq;

    seq = '(...HA[2]AB[dp][pd];W[po];B[hm]TE[1];W[ae]IT[])';
    assert.deepEqual(katagoconv.seqToKataGoMoves(seq), [
      ['W', 'Q15'],
      ['B', 'H13'],
      ['W', 'A5'],
    ]);
    seq = '(...HA[2]AB[dp][pd];W[po];B[hm]TE[1];W[]IT[])';
    assert.deepEqual(katagoconv.seqToKataGoMoves(seq), [
      ['W', 'Q15'],
      ['B', 'H13'],
    ]);
  });
  it('should return expected move counts for all "examples/t-*".', () => {
    const movesfromseq = (len, path) => {
      const sgf = fs.readFileSync(path).toString();
      const moves = katagoconv.seqToKataGoMoves(sgfconv.removeTails(sgf));
      assert.equal(len, moves.length);
    };

    movesfromseq(12, 'test/examples/t-complex.sgf');
    movesfromseq(18, 'test/examples/t-encoding-cp949.sgf');
    movesfromseq(180, 'test/examples/t-lee-vs-alphago.sgf');
    movesfromseq(294, 'test/examples/t-oro-1.sgf');
    movesfromseq(226, 'test/examples/t-oro-2.sgf');
    movesfromseq(207, 'test/examples/t-lian-vs-shin.sgf');
    movesfromseq(3, 'test/examples/t-sabaki-1.sgf');
    movesfromseq(4, 'test/examples/t-sabaki-2.sgf');
  });
});
