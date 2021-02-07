/**
 * @fileOverview Helper functions for parsing SGF and KataGo analysis JSON 
 *               formats.
 */
'use strict';

// 'XX[11]YY[22]', 0 => '11'
// 'XX[11]YY[22]', 2 => '11'
// 'XX[11]YY[22]', 8 => '22'
// 'XX[11]YY[22]', 9 => ''
function inBraket(value, index = 0) {
  const start = value.indexOf('[', index);
  const end = value.indexOf(']', start);

  if (start == -1 || end == -1) {
    return '';
  } else {
    return value.substring(start + 1, end)
      .replace(/^ */, '')
      .replace(/ *$/, '');
  }
}

// 'XX', 'XX[11]YY[22]YY[33]' => 11
function valueFromSequence(prop, sgf) {
  const start = sgf.search(new RegExp('\\b' + prop + '\\['));

  return (-1 == start ? '' : inBraket(sgf, start));
}

// 'AB', '(;GM[1]FF[4]...AB[dp][pd];W...' => '[dp][pd]'
// 'GM', '(;GM[1]FF[4]...AB[dp][pd];W...' => '[1]'
function rawvaluesFromSequence(prop, sgf) {
  if (-1 != sgf.indexOf(prop + '[')) {
    const re = new RegExp('.*\\b' + prop + '((\\[[^\\]]*\\])+).*');
    return sgf.replace(re, '$1');
  } else {
    return '';
  }
}

// 'YY', 'XX[11]YY[22][33]' => ['22', '33']
function valuesFromSequence(prop, sgf) {
  let values = rawvaluesFromSequence(prop, sgf);

  return (values.length == 0
    ? ''
    : values.substring(1, values.length - 1).split(']['));
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
  value = value.toUpperCase(); 
  if (value[0] >= "I") {
    return nextChar(value[0]) + (value.charCodeAt(1) - 64).toString();
  } else {
    return value[0] + (value.charCodeAt(1) - 64).toString();
  }
}

// 'A1' => 'aa'
// 'B4' => 'b4'
// 'J1' => 'ia'
function iaFromJ1(value) {
  if (value[0] >= "J") {
    return prevChar(value[0].toLowerCase()) + String.fromCharCode(
      parseInt(value.substring(1, value.length)) + 96);
  } else {
    return value[0].toLowerCase() + String.fromCharCode(
      parseInt(value.substring(1, value.length)) + 96);
  }
}

// '(abc;B[aa];B[bb]' => { root: 'abc', sequence: ';B[aa];B[bb]' }
// '(;W[aa];B[bb]' => { root: '', sequence: ';W[aa];B[bb]' }
// '(;o[aa];B[bb]' => { root: ';o[aa]', sequence: ';B[bb]' }
// '(;abc)' => { root: ';abc', sequence: '' }
// '(abc;)' => { root: 'abc;', sequence: '' }
function rootsequenceFromSGF(sgf) {
  sgf = removeTails(sgf);

  sgf = sgf.substring(0, sgf.lastIndexOf(')') + 1);

  if (sgf[0] != '(' || sgf[sgf.length - 1] != ')') {
    throw 'SGF parse error: ' + sgf;
  }

  // Root node may have ';', so start from 2.
  let start = sgf.search(/;[BW]\[/, 2);

  if (start == -1) {
    start = sgf.length - 1;
  }
  return { 
    root: sgf.substring(1, start),
    sequence: sgf.substring(start, sgf.length - 1)
  };
}

function removeComment(sgf) {
  // Removes line feeds and comments.
  sgf = sgf.replace(/\r\n/g, '').replace(/\n/g, '');
  sgf = sgf.replace(/\bC\[[^\]]*\\\]/g, 'C[');
  sgf = sgf.replace(/\bC\[[^\]]*\]/g, '');

  return sgf;
}

// '(abc(def(gh)(xy))(123(45)(66)))' => '(abcdefgh)'
// '(abc\n(def(gh)(xy))(123(45)(66)))' => '(abcdefgh)'
function removeTails(sgf) {
  sgf = removeComment(sgf);

  let moves = sgf;
  let reduced = sgf;

  // FIXME: Very poor logic.
  while (true) {
    moves = reduced;
    // ')  )' => '))'
    // '(  )' => '))'
    // '(  (' => '(('
    reduced = reduced.replace(/([()]) *([()])/g, '$1$2'); 
    // ')(dfg)' => ')'
    reduced = reduced.replace(/\)\([^()]*\)/g, ')');
    // '((abc))' => '(abc)'
    // 'x(abc)y' => 'xabcy'
    // 'x(abc)(' => 'x(abc)('
    reduced = reduced.replace(/([^)])\(([^()]*)\)([^(])/g, '$1$2$3'); 

    if (moves === reduced) break;
  }
  return reduced;
}

// ('(;W[aa];B[bb];W[cc])', 'XX', 0) => '(;W[aa]XX;B[bb];W[cc])'
// ('(;W[aa];B[bb];W[cc])', 'XX', 7) => '(;W[aa];B[bb]XX;W[cc])'
function addProperty(sequence, mark, index) {
  const start = sequence.indexOf(']', index);

  if (start != -1) {
    return sequence.substring(0, start + 1) + mark + 
      sequence.substring(start + 1);
  } else {
    return '';
  }
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

// ('(;W[aa];B[bb];W[cc])', 'test', 0) 
// => '(;W[aa]C[test]BM[1]HO[1];B[bb];W[cc])'
function addComment(sequence, comment, index = 0) {
  comment = comment.replace(/\]/g, '\\]');
  return addProperty(sequence, 'C[' + comment + ']', index);
}

// Gets PLs. pls = [ 'B', 'W' ] or [ 'W', 'B' ]
function getPLs(rootsequence) {
  const root = rootsequence.root;
  const sequence = rootsequence.sequence;
  let pls = [];

  const index = sequence.search(/\b[BW]\[/);
  if (index != -1) {
    pls.push(sequence[index]);
  } else if (valueFromSequence('PL', root) != '') {
    pls.push(valueFromSequence('PL', root));
  } else {
    pls.push('B');
  }
  if (pls[0] === 'W') {
    pls.push('B');
  } else { 
    pls.push('W');
  }

  return pls;
}

// '..AB[dp];W[po];B[hm]TE[1];W[ae]...' => [["W","Q15"],["B","H13"],["W","A5"]]
// '..AB[dp];W[po];B[hm]TE[1];W[]...' => [["W","Q15"],["B","H13"]]
function katagomovesFromSequence(sequence) {
  let left = sequence;
  let moves = [];
  let start = -1;

  while (start = left.search(/;[BW]\[[^\]]/), start != -1) {
    const value = inBraket(left, start + 1);

    moves.push([left[start + 1], iaToJ1(value)]);
    left = left.substring(start + 3, left.length);
  }

  return moves;
}

// '..AB[aa][bb]AW[ab][cc];W[po]...' 
// => [["B","A1"],["B","B2"],["W","A2"],["W","C3"]]
function initialstonesFromSequence(sequence) {
  const ab = valuesFromSequence('AB', sequence);
  const aw = valuesFromSequence('AW', sequence);
  let initialStones = [];

  for (let i = 0; i < ab.length; ++i) {
    initialStones.push(['B',iaToJ1(ab[i])]);
  }
  for (let i = 0; i < aw.length; ++i) {
    initialStones.push(['W',iaToJ1(aw[i])]);
  }

  return initialStones;
}

// ("W", {scoreLead: 21.05059, pv:["A1","B2","C3"]}) 
// => '(;W[aa];B[bb];W[cc])'
function katagomoveinfoToSequence(player, moveInfo) {
  let sequence = '(';

  for (const move of moveInfo.pv) {
    sequence += ';' + player + '[' + iaFromJ1(move) + ']';

    if (player == 'W') {
      player = 'B';
    } else {
      player = 'W';
    }
  }
  sequence += ')';

  return sequence;
}

module.exports = {
  iaFromJ1,
  iaToJ1,
  valueFromSequence,
  valuesFromSequence,
  toGoodNode,
  toBadNode,
  toBadHotSpot,
  rootsequenceFromSGF,
  getPLs,
  removeTails,
  removeComment,
  addComment,
  addProperty,
  initialstonesFromSequence,
  katagomovesFromSequence,
  katagomoveinfoToSequence
};
