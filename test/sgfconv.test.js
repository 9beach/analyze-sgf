/* eslint max-lines: ["error", 300] */

const assert = require('assert');

const sgfconv = require('../src/sgfconv');

describe('rootAndSeqFromSGF', () => {
  it('should remove all the comments.', () => {
    const parsed = sgfconv.rootAndSeqFromSGF('(GN[xx]C[aaa];W[aa]C[bb])');
    assert.deepEqual(parsed.root, { GN: ['xx'] });
    assert.equal(parsed.seq, ';W[aa]');
  });
  it('should include the comment of root node.', () => {
    const parsed = sgfconv.rootAndSeqFromSGF('(X[a]C[aa\n];W[aa]C[b])', true);
    assert.deepEqual(parsed.root, { X: ['a'], C: ['aa\n'] });
    assert.equal(parsed.seq, ';W[aa]');
  });
  it('should unescape "[".', () => {
    const parsed = sgfconv.rootAndSeqFromSGF('(C[aaa\n\\]];W[aa]C[b])', true);
    assert.deepEqual(parsed.root, { C: ['aaa\n]'] });
    assert.equal(parsed.seq, ';W[aa]');
  });
  it('should include multi-values.', () => {
    const parsed = sgfconv.rootAndSeqFromSGF('(GN[\n\n]X[4][5];W[aa];B[bb])');
    assert.deepEqual(parsed.root, { GN: ['\n\n'], X: ['4', '5'] });
    assert.equal(parsed.seq, ';W[aa];B[bb]');
  });
});

describe('propsFromObject', () => {
  it('should include multi-values.', () => {
    const seq = sgfconv.propsFromObject({
      A: ['0'],
      C: ['haha'],
      B: ['aa', 'bb'],
    });
    assert.equal(seq, ';A[0]B[aa][bb]');
  });
});

describe('removeTails', () => {
  it('should remove all the comments.', () => {
    const parsed = sgfconv.removeTails('(C[xx];B[aa];(B[bb])(W[cc])');
    assert.equal(parsed, '(;;B[aa];B[bb])');
  });
  it('should include the comments of root node.', () => {
    const parsed = sgfconv.removeTails('(C[xx];B[aa];(B[bb]C[xx])', true);
    assert.equal(parsed, '(;C[xx];B[aa];B[bb])');
  });
  it('should remove line feeds.', () => {
    const parsed = sgfconv.removeTails('(GN[\n\n];B[aa];(B[bb]C[xx])(W[cc])');
    assert.equal(parsed, '(;GN[];B[aa];B[bb])');
  });
  it('should include komi 0.', () => {
    const parsed = sgfconv.removeTails('(AP[aa]KM[0];B[aa];(B[bb])(W[cc])');
    assert.equal(parsed, '(;AP[aa]KM[0];B[aa];B[bb])');
  });
});

describe('iaToJ1/iaFromJ1', () => {
  it('should be expected values.', () => {
    assert.equal(sgfconv.iaFromJ1('B4'), 'bd');
    assert.equal(sgfconv.iaToJ1('bd'), 'B4');
    assert.equal(sgfconv.iaFromJ1('P15'), 'oo');
    assert.equal(sgfconv.iaToJ1('io'), 'J15');
    assert.equal(sgfconv.iaFromJ1('A5'), 'ae');
    assert.equal(sgfconv.iaToJ1('ae'), 'A5');
  });
});

describe('toGoodNode/toBadNode/toBadHotSpot', () => {
  const seq = '(;W[po];B[hm])';
  it('should be expected values.', () => {
    assert.equal(sgfconv.toGoodNode(seq, 0), '(;W[po]TE[1];B[hm])');
    assert.equal(sgfconv.toGoodNode(seq, 4), '(;W[po]TE[1];B[hm])');
    assert.equal(sgfconv.toBadNode(seq, 10), '(;W[po];B[hm]BM[1])');
    assert.equal(sgfconv.toBadHotSpot(seq), '(;W[po]BM[1]HO[1];B[hm])');
  });
});

describe('addComment', () => {
  const seq = '(;W[po];B[hm])';
  it('should be added to the first node.', () => {
    assert.equal(sgfconv.addComment(seq, 'comm', 0), '(;W[po]C[comm];B[hm])');
    assert.equal(
      sgfconv.addComment(seq, 'test[]', 5),
      '(;W[po]C[test[\\]];B[hm])',
    );
  });
  it('should be added to the last node.', () => {
    assert.equal(sgfconv.addComment(seq, 'XXyy', 8), '(;W[po];B[hm]C[XXyy])');
  });
});

describe('prettyPathFromSGF', () => {
  it('should be expected values.', () => {
    let sgf;
    let path;

    sgf = 'RE[W+R]PW[white]';
    assert.equal(sgfconv.prettyPathFromSGF(sgf), '(W+R).sgf');

    sgf = 'RE[W+R]PW[white]PB[black]';
    assert.equal(sgfconv.prettyPathFromSGF(sgf), 'white vs black (W+R).sgf');

    sgf = 'DT[2010]PW[white]PB[black]';
    path = sgfconv.prettyPathFromSGF(sgf);
    assert.equal(path, '[2010] white vs black.sgf');

    sgf = 'DT[2010]EV[worldcup]PW[white]PB[black]';
    path = sgfconv.prettyPathFromSGF(sgf);
    assert.equal(path, '[worldcup, 2010] white vs black.sgf');

    sgf = 'EV[worldcup]PW[white]PB[black]';
    path = sgfconv.prettyPathFromSGF(sgf);
    assert.equal(path, '[worldcup] white vs black.sgf');
  });
});

describe('seqToPV', () => {
  it('should be expected values.', () => {
    assert.equal(sgfconv.seqToPV('(;W[po];B[hm];W[ae])'), 'WQ5 H7 A15');
    assert.equal(
      sgfconv.seqToPV('(;W[poxxxx;B[hmxxxx];W[ae]xxxx)'),
      'WQ5 H7 A15',
    );
    assert.equal(sgfconv.seqToPV(';W[po]'), 'Q5');
    assert.equal(sgfconv.seqToPV(';W[po'), 'Q5');
    assert.equal(sgfconv.seqToPV(';W[po12323'), 'Q5');
  });
});
