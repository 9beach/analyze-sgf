/**
 * @fileOverview Helper functions for parsing SGF and KataGo analysis JSON
 *               formats.
 */

// ('XX[11]YY[22]', 0) => '11'
// ('XX[11]YY[22]', 8) => '22'
// ('XX[11]YY[22]', 9) => ''
function inBraket(value, index = 0) {
  const start = value.indexOf('[', index);
  const end = value.indexOf(']', start);

  if (start === -1 || end === -1) {
    return '';
  }

  return value
    .substring(start + 1, end)
    .replace(/^ */, '')
    .replace(/ *$/, '');
}

// ('XX', 'XX[11]YY[22]YY[33]') => 11
function valueFromSequence(prop, sgf) {
  const start = sgf.search(new RegExp(`\\b${prop}\\[`));

  return start === -1 ? '' : inBraket(sgf, start);
}

// ('AB', '(;GM[1]FF[4]...AB[dp][pd];W...') => '[dp][pd]'
// ('GM', '(;GM[1]FF[4]...AB[dp][pd];W...') => '[1]'
function rawvaluesFromSequence(prop, sgf) {
  if (sgf.indexOf(`${prop}[`) !== -1) {
    const re = new RegExp(`.*\\b${prop}((\\[[^\\]]*\\])+).*`);
    return sgf.replace(re, '$1');
  }

  return '';
}

// ('YY', 'XX[11]YY[22][33]') => ['22', '33']
function valuesFromSequence(prop, sgf) {
  const values = rawvaluesFromSequence(prop, sgf);

  return values.length === 0
    ? []
    : values.substring(1, values.length - 1).split('][');
}

// 'I' => 'J'
// 'J' => 'K'
function nextChar(c) {
  return String.fromCharCode(c.charCodeAt(0) + 1);
}

// 'J' => 'I'
// 'K' => 'J'
function prevChar(c) {
  return String.fromCharCode(c.charCodeAt(0) - 1);
}

// 'aa' => 'A1'
// 'bd' => 'B4'
// 'ia' => 'J1'
function iaToJ1(value) {
  const v = value.toUpperCase();

  if (v[0] >= 'I') {
    return nextChar(v[0]) + (v.charCodeAt(1) - 64).toString();
  }

  return v[0] + (v.charCodeAt(1) - 64).toString();
}

// 'A1' => 'aa'
function iaFromJ1(v) {
  if (v[0] >= 'J') {
    return (
      prevChar(v[0].toLowerCase()) +
      String.fromCharCode(parseInt(v.substring(1, v.length), 10) + 96)
    );
  }

  return (
    v[0].toLowerCase() +
    String.fromCharCode(parseInt(v.substring(1, v.length), 10) + 96)
  );
}

// Removes line feeds and comments.
function removeComment(sgf) {
  return sgf
    .replace(/\r\n/g, '')
    .replace(/\n/g, '')
    .replace(/\bC\[[^\]]*\\\]/g, 'C[')
    .replace(/\bC\[[^\]]*\]/g, '');
}

// '(abc(def(gh)(xy))(123(45)(66)))' => '(abcdefgh)'
// '(abc\n(def(gh)(xy))(123(45)(66)))' => '(abcdefgh)'
function removeTails(sgf) {
  let moves = removeComment(sgf);
  let reduced = moves;

  // FIXME: Very poor logic.
  for (;;) {
    moves = reduced;
    reduced = reduced
      // ')  )' => '))'
      // '(  )' => '))'
      // '(  (' => '(('
      .replace(/([()]) *([()])/g, '$1$2')
      // ')(dfg)' => ')'
      .replace(/\)\([^()]*\)/g, ')')
      // '((abc))' => '(abc)'
      // 'x(abc)y' => 'xabcy'
      // 'x(abc)(' => 'x(abc)('
      .replace(/([^)])\(([^()]*)\)([^(])/g, '$1$2$3');

    if (moves === reduced) break;
  }

  return reduced;
}

// '(abc;B[aa];B[bb]' => { root: 'abc', sequence: ';B[aa];B[bb]' }
// '(;o[aa];B[bb]' => { root: ';o[aa]', sequence: ';B[bb]' }
// '(abc;)' => { root: 'abc;', sequence: '' }
function rootsequenceFromSGF(sgf) {
  let tailless = removeTails(sgf);

  // Skips ORO winrates ')\n// ...\n//...'.
  tailless = tailless.substring(0, tailless.lastIndexOf(')') + 1);

  if (tailless[0] !== '(' || tailless[tailless.length - 1] !== ')') {
    throw Error(`SGF parse error: ${tailless}`);
  }

  // Root node may have ';', so start from 2.
  let start = tailless.search(/;[BW]\[/, 2);

  if (start === -1) {
    start = tailless.length - 1;
  }

  return {
    root: tailless.substring(1, start),
    sequence: tailless.substring(start, tailless.length - 1),
  };
}

// ('(;W[aa];B[bb];W[cc])', 'XX', 0) => '(;W[aa]XX;B[bb];W[cc])'
// ('(;W[aa];B[bb];W[cc])', 'XX', 7) => '(;W[aa];B[bb]XX;W[cc])'
function addProperty(sequence, mark, index) {
  const start = sequence.indexOf(']', index);

  if (start !== -1) {
    return (
      sequence.substring(0, start + 1) + mark + sequence.substring(start + 1)
    );
  }

  return '';
}

// ('(;W[aa];B[bb];W[cc])', 0) => '(;W[aa]TE[1];B[bb];W[cc])'
function toGoodNode(sequence, index = 0) {
  return addProperty(sequence, 'TE[1]', index);
}

// ('(;W[aa];B[bb];W[cc])', 0) => '(;W[aa]BM[1];B[bb];W[cc])'
function toBadNode(sequence, index = 0) {
  return addProperty(sequence, 'BM[1]', index);
}

// ('(;W[aa];B[bb];W[cc])', 0) => '(;W[aa]BM[1]HO[1];B[bb];W[cc])'
function toBadHotSpot(sequence, index = 0) {
  return addProperty(sequence, 'BM[1]HO[1]', index);
}

// ('(;W[aa];B[bb])', 'hey[]', 0) => '(;W[aa]C[hey[\]];B[bb])'
function addComment(sequence, comment, index = 0) {
  const replaced = comment.replace(/\]/g, '\\]');
  return addProperty(sequence, `C[${replaced}]`, index);
}

// rootsequence => [ 'B', 'W' ] or [ 'W', 'B' ]
function getPLs(rootsequence) {
  const { root, sequence } = rootsequence;
  const pls = [];

  const index = sequence.search(/\b[BW]\[/);
  if (index !== -1) {
    pls.push(sequence[index]);
  } else if (valueFromSequence('PL', root) !== '') {
    pls.push(valueFromSequence('PL', root));
  } else {
    pls.push('B');
  }

  if (pls[0] === 'W') pls.push('B');
  else pls.push('W');

  return pls;
}

// '..AB[aa][bb]AW[ab];W[po]...' => [["B","A1"],["B","B2"],["W","A2"]]
function initialstonesFromSequence(sequence) {
  return [
    ...valuesFromSequence('AB', sequence).map((pos) => ['B', iaToJ1(pos)]),
    ...valuesFromSequence('AW', sequence).map((pos) => ['W', iaToJ1(pos)]),
  ];
}

// '..AB[dp];W[po];B[hm];W[ae]...' => [["W","Q15"],["B","H13"],["W","A5"]]
// '..AB[dp];W[po];B[hm]TE[1];W[]...' => [["W","Q15"],["B","H13"]]
function katagomovesFromSequence(sequence) {
  return sequence
    .split(';')
    .filter((move) => move.search(/[BW]\[[^\]]/) === 0)
    .map((move) => [move[0], iaToJ1(move.substring(2, 4))]);
}

// ("W", { scoreLead: 21.050, pv:["A1","B2","C3"] }) => '(;W[aa];B[bb];W[cc])'
function katagomoveinfoToSequence(pl, moveInfo) {
  const sequence = moveInfo.pv.reduce(
    (acc, move) => [
      `${acc[0]};${acc[1]}[${iaFromJ1(move)}]`,
      acc[1] === 'W' ? 'B' : 'W',
    ],
    ['', pl],
  );

  return `(${sequence[0]})`;
}

module.exports = {
  iaFromJ1,
  iaToJ1,
  getPLs,
  valueFromSequence,
  valuesFromSequence,
  addProperty,
  toGoodNode,
  toBadNode,
  toBadHotSpot,
  addComment,
  removeComment,
  removeTails,
  rootsequenceFromSGF,
  initialstonesFromSequence,
  katagomovesFromSequence,
  katagomoveinfoToSequence,
};
