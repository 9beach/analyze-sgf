const fs = require('fs');
const assert = require('assert');

const sgfconv = require('../src/sgfconv');

describe('rootsequenceFromSGF', () => {
  it('should be expected values.', () => {
    let parsed = sgfconv.rootsequenceFromSGF('(abc;B[aa];B[bb])');
    assert.equal(parsed.root, 'abc');
    assert.equal(parsed.sequence, ';B[aa];B[bb]');

    parsed = sgfconv.rootsequenceFromSGF('(abc;W[aa];B[bb])');
    assert.equal(parsed.root, 'abc');
    assert.equal(parsed.sequence, ';W[aa];B[bb]');

    parsed = sgfconv.rootsequenceFromSGF('(abc;o[aa];B[bb])');
    assert.equal(parsed.root, 'abc;o[aa]');
    assert.equal(parsed.sequence, ';B[bb]');

    parsed = sgfconv.rootsequenceFromSGF('(test)');
    assert.equal(parsed.root, 'test');
    assert.equal(parsed.sequence, '');

    parsed = sgfconv.rootsequenceFromSGF('(;abc)');
    assert.equal(parsed.root, ';abc');
    assert.equal(parsed.sequence, '');

    parsed = sgfconv.rootsequenceFromSGF('(abc;)');
    assert.equal(parsed.root, 'abc;');
    assert.equal(parsed.sequence, '');
  });
});

describe('valueFromSequence', () => {
  it('should be expected values.', () => {
    const value = 'XX[11]YY[22]YY[33]AA[ 44 ]';
    assert.equal(sgfconv.valueFromSequence('XX', value), '11');
    assert.equal(sgfconv.valueFromSequence('YY', value), '22');
    assert.equal(sgfconv.valueFromSequence('ZZ', value), '');
    assert.equal(sgfconv.valueFromSequence('AA', value), '44');
  });
  it('should be expected values for test/ex-sabaki-1.sgf', () => {
    const result = fs.readFileSync('test/ex-sabaki-1.sgf');
    const sequence = sgfconv.removeTails(result.toString());
    assert.equal(sgfconv.valueFromSequence('AP', sequence), 'Sabaki:0.51.1');
    assert.equal(sgfconv.valueFromSequence('KM', sequence), '6.5');
    assert.equal(sgfconv.valueFromSequence('GM', sequence), '1');
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
    assert.equal(sgfconv.toGoodNode(sequence, 6), '(;W[po]TE[1];B[hm])');
    assert.equal(sgfconv.toBadNode(sequence, 7), '(;W[po];B[hm]BM[1])');
    assert.equal(sgfconv.toBadNode(sequence, 8), '(;W[po];B[hm]BM[1])');
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
      sgfconv.addComment(sequence, 'test[]', 6),
      '(;W[po]C[test[\\]];B[hm])',
    );
    assert.equal(
      sgfconv.addComment(sequence, 'XXyy', 7),
      '(;W[po];B[hm]C[XXyy])',
    );
  });
});

describe('removeTails', () => {
  const values = [
    '(ABC(DEF(GH)\n(\n(\n\nY)(ab)\n(1)))\n\n(1(4\n5)\n(6\n6)\n))',
    '(ABC(DEF\n(GH)\n(XY))(123\n(45)(66)))',
    '(a(b((c)(d)(f(g)(h))))(c(d)(e)))',
    '((abc))',
    'x(abc)y',
    'x(abc)(',
    ')(abc)x',
    'aa[aa(](11)(abc)x',
    '(aa[aa)](11)(abc)x)',
    'aa[(aa) ()]((11)(abc)x',
  ];
  it('should be expected values.', () => {
    assert.equal(sgfconv.removeTails(values[0]), '(ABCDEFGH)');
    assert.equal(sgfconv.removeTails(values[1]), '(ABCDEFGH)');
    assert.equal(sgfconv.removeTails(values[2]), '(abc)');
    assert.equal(sgfconv.removeTails(values[3]), '(abc)');
    assert.equal(sgfconv.removeTails(values[4]), 'xabcy');
    assert.equal(sgfconv.removeTails(values[5]), 'x(abc)(');
    assert.equal(sgfconv.removeTails(values[6]), ')x');
    assert.equal(sgfconv.removeTails(values[7]), 'aa[aa(]11x');
    assert.equal(sgfconv.removeTails(values[8]), '(aa[aa)]11x)');
    assert.equal(sgfconv.removeTails(values[9]), 'aa[aa](11x');

    const sgf = fs.readFileSync('test/ex-sabaki-1.sgf');
    assert.equal(
      sgfconv.removeTails(sgf.toString()),
      '(;GM[1]FF[4]CA[UTF-8]AP[Sabaki:0.51.1]KM[6.5]SZ[19]DT[2021-01-25]' +
        'HA[2]AB[dp][pd];W[po];B[hm]TE[1];W[ae]IT[])',
    );
  });
});

describe('katagomoveinfoToSequence', () => {
  it('should be expected values.', () => {
    const moveInfo = {
      scoreLead: 21.05059,
      pv: ['A1', 'B2', 'C3'],
    };

    assert.equal(
      sgfconv.katagomoveinfoToSequence('W', moveInfo),
      '(;W[aa];B[bb];W[cc])',
    );
  });
});

describe('initialstonesFromSequence', () => {
  it('should be expected values.', () => {
    const sequence = '(...HA[2]AB[aa][bb]AW[ab][cc];W[po];B[hm]TE[1]...)';
    assert.deepEqual(sgfconv.initialstonesFromSequence(sequence), [
      ['B', 'A1'],
      ['B', 'B2'],
      ['W', 'A2'],
      ['W', 'C3'],
    ]);
  });
});

describe('katagomovesFromSequence', () => {
  it('should be expected values.', () => {
    let sequence = '(...HA[2]AB[dp][pd];W[po];B[hm]TE[1];W[ae]IT[])';
    assert.deepEqual(sgfconv.katagomovesFromSequence(sequence), [
      ['W', 'Q15'],
      ['B', 'H13'],
      ['W', 'A5'],
    ]);

    sequence = '(...HA[2]AB[dp][pd];W[po];B[hm]TE[1];W[]IT[])';
    assert.deepEqual(sgfconv.katagomovesFromSequence(sequence), [
      ['W', 'Q15'],
      ['B', 'H13'],
    ]);
  });
});

describe('katagomovesFromSequence/removeTails', () => {
  it('should be expected values.', () => {
    let sgf;
    const removesequence = sgfconv.katagomovesFromSequence;

    sgf = fs.readFileSync('test/ex-sabaki-1.sgf').toString();
    assert.equal(3, removesequence(sgfconv.removeTails(sgf)).length);
    sgf = fs.readFileSync('test/ex-sabaki-2.sgf').toString();
    assert.equal(18, removesequence(sgfconv.removeTails(sgf)).length);
    sgf = fs.readFileSync('test/ex-oro-1.sgf').toString();
    assert.equal(294, removesequence(sgfconv.removeTails(sgf)).length);
    sgf = fs.readFileSync('test/ex-oro-2.sgf').toString();
    assert.equal(226, removesequence(sgfconv.removeTails(sgf)).length);
    sgf = fs.readFileSync('test/ex-complex.sgf').toString();
    assert.equal(12, removesequence(sgfconv.removeTails(sgf)).length);
    sgf = fs.readFileSync('test/ex-ren-vs-shin.sgf').toString();
    assert.equal(207, removesequence(sgfconv.removeTails(sgf)).length);
    sgf = fs.readFileSync('test/ex-lee-vs-alphago.sgf').toString();
    assert.equal(180, removesequence(sgfconv.removeTails(sgf)).length);
    sgf = fs.readFileSync('test/ex-encoding-cp949.sgf').toString();
    assert.equal(18, removesequence(sgfconv.removeTails(sgf)).length);
  });
});
