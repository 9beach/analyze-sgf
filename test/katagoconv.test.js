/* eslint max-lines: ["error", 300] */

const fs = require('fs');
const assert = require('assert');

const katagoconv = require('../src/katagoconv');
const sgfconv = require('../src/sgfconv');

describe('sequenceFromKataGoMoveInfo', () => {
  it('should be expected values.', () => {
    const moveInfo = { pv: ['A1', 'B2', 'C3'] };

    assert.equal(
      katagoconv.sequenceFromKataGoMoveInfo('W', moveInfo),
      '(;W[aa];B[bb];W[cc])',
    );
    assert.equal(
      katagoconv.sequenceFromKataGoMoveInfo('B', moveInfo),
      '(;B[aa];W[bb];B[cc])',
    );
  });
});

describe('sequenceToInitialStones', () => {
  it('should be expected values.', () => {
    let sequence;

    sequence = '(...HA[2]AB[aa][bb]AW[ab][cc];W[po];B[hm]TE[1]...)';
    assert.deepEqual(katagoconv.sequenceToInitialStones(sequence), [
      ['B', 'A1'],
      ['B', 'B2'],
      ['W', 'A2'],
      ['W', 'C3'],
    ]);
    sequence = '(...HA[2];B[hm]TE[1]...)';
    assert.deepEqual(katagoconv.sequenceToInitialStones(sequence), []);
  });
});

describe('sequenceToKataGoMoves', () => {
  it('should be expected values.', () => {
    let sequence;

    sequence = '(...HA[2]AB[dp][pd];W[po];B[hm]TE[1];W[ae]IT[])';
    assert.deepEqual(katagoconv.sequenceToKataGoMoves(sequence), [
      ['W', 'Q15'],
      ['B', 'H13'],
      ['W', 'A5'],
    ]);
    sequence = '(...HA[2]AB[dp][pd];W[po];B[hm]TE[1];W[]IT[])';
    assert.deepEqual(katagoconv.sequenceToKataGoMoves(sequence), [
      ['W', 'Q15'],
      ['B', 'H13'],
    ]);
  });
  it('should be expected values for "examples/t-*".', () => {
    const movesfromsequence = (len, path) => {
      const sgf = fs.readFileSync(path).toString();
      const moves = katagoconv.sequenceToKataGoMoves(
        sgfconv.removeTails(sgf),
      );
      assert.equal(len, moves.length);
    };

    movesfromsequence(12, 'test/examples/t-complex.sgf');
    movesfromsequence(18, 'test/examples/t-encoding-cp949.sgf');
    movesfromsequence(180, 'test/examples/t-lee-vs-alphago.sgf');
    movesfromsequence(294, 'test/examples/t-oro-1.sgf');
    movesfromsequence(226, 'test/examples/t-oro-2.sgf');
    movesfromsequence(207, 'test/examples/t-lian-vs-shin.sgf');
    movesfromsequence(3, 'test/examples/t-sabaki-1.sgf');
    movesfromsequence(4, 'test/examples/t-sabaki-2.sgf');
  });
});
