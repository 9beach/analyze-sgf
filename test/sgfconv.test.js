/* eslint max-lines: ["error", 300] */

const fs = require('fs');
const assert = require('assert');
const jschardet = require('jschardet');
const iconv = require('iconv-lite');

const sgfconv = require('../src/sgfconv');

describe('rootsequenceFromSGF', () => {
  it('should remove tails.', () => {
    const parsed = sgfconv.rootsequenceFromSGF('(a;B[aa];(B[bb])(W[cc])');
    assert.equal(parsed.root, ';');
    assert.equal(parsed.sequence, ';B[aa];B[bb]');
  });
  it('should remove comments.', () => {
    const parsed = sgfconv.rootsequenceFromSGF('(GN[xx]C[aaa];W[aa]C[bb])');
    assert.equal(parsed.root, ';GN[xx]');
    assert.equal(parsed.sequence, ';W[aa]');
  });
  it('should split to root node and sequence.', () => {
    let parsed = sgfconv.rootsequenceFromSGF('(abc;o[aa];B[bb])');
    assert.equal(parsed.root, ';');
    assert.equal(parsed.sequence, ';B[bb]');

    parsed = sgfconv.rootsequenceFromSGF('(abc;;o[aa];B[bb])');
    assert.equal(parsed.root, ';');
    assert.equal(parsed.sequence, ';B[bb]');
  });
  it('should preserve line feeds.', () => {
    const parsed = sgfconv.rootsequenceFromSGF('(GN[\n];B[aa];B[bb]');
    assert.equal(parsed.root, ';GN[\n]');
    assert.equal(parsed.sequence, ';B[aa];B[bb]');
  });
});

describe('removeTails', () => {
  it('should remove comments.', () => {
    const parsed = sgfconv.removeTails('(abc;B[aa];(B[bb]C[xx])(W[cc])');
    assert.equal(parsed, '(;;B[aa];B[bb])');
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

describe('valueFromSequence', () => {
  it('should be expected values.', () => {
    const value = 'XX[11]YY[22]YY[33]AA[ 44 ]';
    assert.equal(sgfconv.valueFromSequence(value, 'XX'), '11');
    assert.equal(sgfconv.valueFromSequence(value, 'YY'), '22');
    assert.equal(sgfconv.valueFromSequence(value, 'ZZ'), '');
    assert.equal(sgfconv.valueFromSequence(value, 'AA'), '44');
  });
  it('should be expected values for "examples/t-sabaki-1.sgf".', () => {
    const result = fs.readFileSync('test/examples/t-sabaki-1.sgf');
    const sequence = sgfconv.removeTails(result.toString());
    assert.equal(sgfconv.valueFromSequence(sequence, 'AP'), 'Sabaki:0.51.1');
    assert.equal(sgfconv.valueFromSequence(sequence, 'KM'), '6.5');
    assert.equal(sgfconv.valueFromSequence(sequence, 'GM'), '1');
  });
  it('should be expected values for "examples/t-encoding-cp949.sgf".', () => {
    const content = fs.readFileSync('test/examples/t-encoding-cp949.sgf');
    const detected = jschardet.detect(content);
    const sgf = iconv.decode(content, detected.encoding).toString();

    assert.equal('커제', sgfconv.valueFromSequence(sgf, 'PB'));
    assert.equal('탕웨이싱', sgfconv.valueFromSequence(sgf, 'PW'));
  });
});

describe('valuesFromSequence', () => {
  it('should be expected values.', () => {
    const value = '(;GM[1]FF[4]...AB[dp][pd];W...';
    assert.deepEqual(sgfconv.valuesFromSequence('AB', value), ['dp', 'pd']);
    assert.deepEqual(sgfconv.valuesFromSequence('FF', value), ['4']);
    assert.deepEqual(sgfconv.valuesFromSequence('GM', value), ['1']);
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
  const sequence = '(;W[po];B[hm])';
  it('should be expected values.', () => {
    assert.equal(sgfconv.toGoodNode(sequence, 0), '(;W[po]TE[1];B[hm])');
    assert.equal(sgfconv.toGoodNode(sequence, 4), '(;W[po]TE[1];B[hm])');
    assert.equal(sgfconv.toBadNode(sequence, 10), '(;W[po];B[hm]BM[1])');
    assert.equal(sgfconv.toBadHotSpot(sequence), '(;W[po]BM[1]HO[1];B[hm])');
  });
});

describe('addComment', () => {
  const sequence = '(;W[po];B[hm])';
  it('should be expected values.', () => {
    assert.equal(
      sgfconv.addComment(sequence, 'comm', 0),
      '(;W[po]C[comm];B[hm])',
    );
    assert.equal(
      sgfconv.addComment(sequence, 'test[]', 5),
      '(;W[po]C[test[\\]];B[hm])',
    );
    assert.equal(
      sgfconv.addComment(sequence, 'XXyy', 8),
      '(;W[po];B[hm]C[XXyy])',
    );
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

describe('sequenceToPV', () => {
  it('should be expected values.', () => {
    assert.equal(sgfconv.sequenceToPV('(;W[po];B[hm];W[ae])'), 'WQ5 H7 A15');
    assert.equal(
      sgfconv.sequenceToPV('(;W[poxxxx;B[hmxxxx];W[ae]xxxx)'),
      'WQ5 H7 A15',
    );
    assert.equal(sgfconv.sequenceToPV(';W[po]'), 'Q5');
    assert.equal(sgfconv.sequenceToPV(';W[po'), 'Q5');
    assert.equal(sgfconv.sequenceToPV(';W[po12323'), 'Q5');
  });
});
