const fs = require('fs');
const assert = require('assert');

const internal = require('../src/sgfconv-internal');

const yaml = require('js-yaml');
const yamlPath = require.resolve('../src/analyze-sgf.yml');

const defaultOpts = yaml.load(fs.readFileSync(yamlPath));
let sgfOpts = defaultOpts.sgf;

describe('rootAndSequenceFromSGF', function () {
  it('should be expected values', () => {
    let parsed = internal.rootAndSequenceFromSGF('(abc;B[aa];B[bb])');
    assert.equal(parsed.root, 'abc');
    assert.equal(parsed.sequence, ';B[aa];B[bb]');

    parsed = internal.rootAndSequenceFromSGF('(abc;W[aa];B[bb])');
    assert.equal(parsed.root, 'abc');
    assert.equal(parsed.sequence, ';W[aa];B[bb]');

    parsed = internal.rootAndSequenceFromSGF('(abc;o[aa];B[bb])');
    assert.equal(parsed.root, 'abc;o[aa]');
    assert.equal(parsed.sequence, ';B[bb]');

    parsed = internal.rootAndSequenceFromSGF('(test)');
    assert.equal(parsed.root, 'test');
    assert.equal(parsed.sequence, '');

    parsed = internal.rootAndSequenceFromSGF('(;abc)');
    assert.equal(parsed.root, ';abc');
    assert.equal(parsed.sequence, '');

    parsed = internal.rootAndSequenceFromSGF('(abc;)');
    assert.equal(parsed.root, 'abc;');
    assert.equal(parsed.sequence, '');
  });
});

describe('valueOfProp', function () {
  const value= 'XX[11]YY[22]YY[33]AA[ 44 ]';
  it('should be expected values for "' + value + '"', () => {
    assert.equal(internal.valueOfProp('XX', value), '11');
    assert.equal(internal.valueOfProp('YY', value), '22');
    assert.equal(internal.valueOfProp('ZZ', value), '');
    assert.equal(internal.valueOfProp('AA', value), '44');
  });
  it('should be expected values for test/sabaki-ex-1.sgf', () => {
    let result = fs.readFileSync('test/sabaki-ex-1.sgf');
    const sequence = internal.reduceTailsOfSGF(result.toString());
    assert.equal(internal.valueOfProp('AP', sequence), 'Sabaki:0.51.1');
    assert.equal(internal.valueOfProp('KM', sequence), '6.5');
    assert.equal(internal.valueOfProp('GM', sequence), '1');
  });
});

describe('rawPropValuesFromSGF', function () {
  it('should be expected values for test/sabaki-ex-1.sgf', () => {
    let result = fs.readFileSync('test/sabaki-ex-1.sgf');
    const sequence = internal.reduceTailsOfSGF(result.toString());
    assert.equal(internal.rawPropValuesFromSGF('AB', sequence), '[dp][pd]');
    assert.equal(internal.rawPropValuesFromSGF('HA', sequence), '[2]');
  });
});

describe('valuesOfProp', function () {
  const value= '(;GM[1]FF[4]...AB[dp][pd];W...';
  it('should be expected values for "' + value + '"', () => {
    assert.deepEqual(internal.valuesOfProp('AB', value), ['dp','pd']);
    assert.deepEqual(internal.valuesOfProp('FF', value), ['4']);
    assert.deepEqual(internal.valuesOfProp('GM', value), ['1']);
  });
});

describe('katagomovesFromSequence', function () {
  it('should be expected values', () => {
    let sequence = '(...HA[2]AB[dp][pd];W[po];B[hm]TE[1];W[ae]IT[])';
    assert.deepEqual(internal.katagomovesFromSequence(sequence), 
      [['W','Q15'],['B','H13'],['W','A5']]);

    sequence = '(...HA[2]AB[dp][pd];W[po];B[hm]TE[1];W[]IT[])';
    assert.deepEqual(internal.katagomovesFromSequence(sequence), 
      [['W','Q15'],['B','H13']]);
  });
});

describe('sgfmovesFromSequence', function () {
  const sequence = '(...HA[2]AB[dp][pd];W[po];B[hm]TE[1];W[ae]IT[])';
  it('should be expected values for "' + sequence + '"', () => {
    assert.deepEqual(internal.sgfmovesFromSequence(sequence), 
      [{move: 'W[po]'},{move: 'B[hm]'},{move: 'W[ae]'}]);
  });
});

describe('initialStonesFromSequence', function () {
  const sequence = '(...HA[2]AB[aa][bb]AW[ab][cc];W[po];B[hm]TE[1]...)';
  it('should be expected values for "' + sequence + '"', () => {
    assert.deepEqual(internal.initialStonesFromSequence(sequence), 
                     [["B","A1"],["B","B2"],["W","A2"],["W","C3"]]);
  });
});

describe('iaToJ1/iaFromJ1', function () {
  it('should be expected values', () => {
    assert.equal(internal.iaFromJ1('B4'), 'bd');
    assert.equal(internal.iaToJ1('bd'), 'B4');
    assert.equal(internal.iaFromJ1('P15'), 'oo');
    assert.equal(internal.iaToJ1('io'), 'J15');
    assert.equal(internal.iaFromJ1('A5'), 'ae');
    assert.equal(internal.iaToJ1('ae'), 'A5');
  });
});

describe('moveInfoToSequence', function () {
  it('should be expected values', () => {
    const moveInfo = {
      scoreLead: 21.05059,
      pv: ["A1","B2","C3"]
    }; 

    assert.equal(internal.moveInfoToSequence('W', moveInfo), 
      '(;W[aa];B[bb];W[cc])');
  });
});

describe('markMoveAs...', function () {
  const sequence = '(;W[po];B[hm])';
  it('should be expected values', () => {
    assert.equal(internal.markMoveAsGood(sequence, 0), '(;W[po]TE[1];B[hm])');
    assert.equal(internal.markMoveAsGood(sequence, 6), '(;W[po]TE[1];B[hm])');
    assert.equal(internal.markMoveAsBad(sequence, 7), '(;W[po];B[hm]BM[1])');
    assert.equal(internal.markMoveAsBad(sequence, 8), '(;W[po];B[hm]BM[1])');
    assert.equal(internal.markMoveAsHotSpot(sequence, 0), '(;W[po]HO[1];B[hm])');
    assert.equal(internal.markMoveAsBadHotSpot(sequence, 0), 
      '(;W[po]BM[1]HO[1];B[hm])');
  });
});

describe('setMoveComment', function () {
  const sequence = '(;W[po];B[hm])';
  it('should be expected values', () => {
    assert.equal(internal.setMoveComment(sequence, 'comm', 0), 
      '(;W[po]C[comm];B[hm])');
    assert.equal(internal.setMoveComment(sequence, 'test[]', 6), 
      '(;W[po]C[test[\\]];B[hm])');
    assert.equal(internal.setMoveComment(sequence, 'XXyy', 7), 
      '(;W[po];B[hm]C[XXyy])');
  });
});

describe('reduceTailsOfSGF', function () {
  const values = [ '(ABC(DEF(GH)\n(\n(\n\nY)(ab)\n(1)))\n\n(1(4\n5)\n(6\n6)\n))'
                 , '(ABC(DEF\n(GH)\n(XY))(123\n(45)(66)))'
                 , '(a(b((c)(d)(f(g)(h))))(c(d)(e)))'
                 , '((abc))'
                 , 'x(abc)y'
                 , 'x(abc)('
                 , ')(abc)x'
                 , 'aa[aa(](11)(abc)x'
                 , '(aa[aa)](11)(abc)x)'
                 , 'aa[(aa) ()]((11)(abc)x'
                 ];
  it('should be expected values', () => {
    assert.equal(internal.reduceTailsOfSGF(values[0]), '(ABCDEFGH)');
    assert.equal(internal.reduceTailsOfSGF(values[1]), '(ABCDEFGH)');
    assert.equal(internal.reduceTailsOfSGF(values[2]), '(abc)');
    assert.equal(internal.reduceTailsOfSGF(values[3]), '(abc)');
    assert.equal(internal.reduceTailsOfSGF(values[4]), 'xabcy');
    assert.equal(internal.reduceTailsOfSGF(values[5]), 'x(abc)(');
    assert.equal(internal.reduceTailsOfSGF(values[6]), ')x');
    assert.equal(internal.reduceTailsOfSGF(values[7]), 'aa[aa(]11x');
    assert.equal(internal.reduceTailsOfSGF(values[8]), '(aa[aa)]11x)');
    assert.equal(internal.reduceTailsOfSGF(values[9]), 'aa[aa](11x');

    const sgf = fs.readFileSync('test/sabaki-ex-1.sgf');
    assert.equal(internal.reduceTailsOfSGF(sgf.toString()), 
      '(;GM[1]FF[4]CA[UTF-8]AP[Sabaki:0.51.1]KM[6.5]SZ[19]DT[2021-01-25]' +
      'HA[2]AB[dp][pd];W[po];B[hm]TE[1];W[ae]IT[])');
  });
});

describe('katagomovesFromSequence/reduceTailsOfSGF', function () {
  it('should be expected values', () => {
    let sgf = fs.readFileSync('test/sabaki-ex-1.sgf');
    assert.equal(3, internal
      .katagomovesFromSequence(internal.reduceTailsOfSGF(sgf.toString()))
      .length
    );
    sgf = fs.readFileSync('test/sabaki-ex-2.sgf');
    assert.equal(18, internal
      .katagomovesFromSequence(internal.reduceTailsOfSGF(sgf.toString()))
      .length
    );
    sgf = fs.readFileSync('test/oro-ex-1.sgf');
    assert.equal(294, internal
      .katagomovesFromSequence(internal.reduceTailsOfSGF(sgf.toString()))
      .length
    );
    sgf = fs.readFileSync('test/oro-ex-2.sgf');
    assert.equal(226, internal
      .katagomovesFromSequence(internal.reduceTailsOfSGF(sgf.toString()))
      .length
    );
    sgf = fs.readFileSync('test/complex-ex.sgf');
    assert.equal(12, internal
      .katagomovesFromSequence(internal.reduceTailsOfSGF(sgf.toString()))
      .length
    );
    sgf = fs.readFileSync('test/ren-vs-shin.sgf');
    assert.equal(207, internal
      .katagomovesFromSequence(internal.reduceTailsOfSGF(sgf.toString()))
      .length
    );
    sgf = fs.readFileSync('test/lee-vs-alphago.sgf');
    assert.equal(180, internal
      .katagomovesFromSequence(internal.reduceTailsOfSGF(sgf.toString()))
      .length
    );
    sgf = fs.readFileSync('test/encoding-cp949.sgf');
    assert.equal(18, internal
      .katagomovesFromSequence(internal.reduceTailsOfSGF(sgf.toString()))
      .length
    );
  });
});

describe('sgfmovesFromResponses', function () {
  it('should be expected values', () => {
    const sgf = '(;GM[1]FF[4]CA[UTF-8]KM[7.5]SZ[19];B[jj])';
    const responses = [
      '{"id": "foo", "moveInfos": [ { "pv": ["A1", "B2"], "scoreLead": 0, "visits": 4, "winrate": 0.81 }, { "pv": ["C3", "D4"], "scoreLead": 1, "visits": 2, "winrate": 0.54 } ], "rootInfo": { "scoreLead": 9, "visits": 500, "winrate": 0.82 }, "turnNumber": 0}',
      '{"id": "foo", "moveInfos": [ { "pv": ["E5", "F6"], "scoreLead": 10, "visits": 4, "winrate": 0.4 }, { "pv": ["G7", "H8"], "scoreLead": 23, "visits": 2, "winrate": 0.54 } ], "rootInfo": { "scoreLead": 20, "visits": 500, "winrate": 0.4 }, "turnNumber": 1}' ];

    sgfOpts.maxWinrateLossForGoodMove = 2;
    sgfOpts.minWinrateLossForBadMove = 5;
    sgfOpts.minWinrateLossForBadHotSpot = 20;
    sgfOpts.minWinrateLossForVariations = 5;
    sgfOpts.analyzeTurnsGiven = false;

    let reduced, moves, rsgf, ex;

    // test test/sgfmoves-test-default.sgf
    sgfOpts.showVariationsAfterLastMove = false;
    sgfOpts.showBadVariations = false;

    reduced = internal.rootAndSequenceFromSGF(sgf);
    moves = internal.sgfmovesFromResponses(reduced, responses, sgfOpts);
    rsgf = internal.sgfmovesToGameTree(reduced.root, moves, sgfOpts);
    rsgf = internal.stripComment(rsgf);

    ex = fs.readFileSync('test/sgfmoves-test-default.sgf');
    ex = internal.stripComment(ex.toString());

    assert.equal(rsgf, ex);

    // test sgfmoves-test-last-move-bad-variations.sgf
    sgfOpts.showVariationsAfterLastMove = true;
    sgfOpts.showBadVariations = true;

    reduced = internal.rootAndSequenceFromSGF(sgf);
    moves = internal.sgfmovesFromResponses(reduced, responses, sgfOpts);
    rsgf = internal.sgfmovesToGameTree(reduced.root, moves, sgfOpts);
    rsgf = internal.stripComment(rsgf);

    ex = fs.readFileSync('test/sgfmoves-test-last-move-bad-variations.sgf');
    ex = internal.stripComment(ex.toString());

    assert.equal(rsgf, ex);
  });
});
