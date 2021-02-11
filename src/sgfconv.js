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
    ? ''
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
  let v = value;

  v = v.toUpperCase();
  if (v[0] >= 'I') {
    return nextChar(v[0]) + (v.charCodeAt(1) - 64).toString();
  }

  return v[0] + (v.charCodeAt(1) - 64).toString();
}

// 'A1' => 'aa'
// 'B4' => 'b4'
// 'J1' => 'ia'
function iaFromJ1(value) {
  const v = value;

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
  let removed = sgf;

  removed = removed.replace(/\r\n/g, '').replace(/\n/g, '');
  removed = removed.replace(/\bC\[[^\]]*\\\]/g, 'C[');
  removed = removed.replace(/\bC\[[^\]]*\]/g, '');

  return removed;
}

// '(abc(def(gh)(xy))(123(45)(66)))' => '(abcdefgh)'
// '(abc\n(def(gh)(xy))(123(45)(66)))' => '(abcdefgh)'
function removeTails(sgf) {
  let moves = removeComment(sgf);
  let reduced = moves;

  // FIXME: Very poor logic.
  for (;;) {
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

// '(abc;B[aa];B[bb]' => { root: 'abc', sequence: ';B[aa];B[bb]' }
// '(;W[aa];B[bb]' => { root: '', sequence: ';W[aa];B[bb]' }
// '(;o[aa];B[bb]' => { root: ';o[aa]', sequence: ';B[bb]' }
// '(;abc)' => { root: ';abc', sequence: '' }
// '(abc;)' => { root: 'abc;', sequence: '' }
function rootsequenceFromSGF(sgf) {
  let tailless = sgf;

  tailless = removeTails(tailless);
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

// ('(;W[aa];B[bb];W[cc])', 'test', 0) =>
// '(;W[aa]C[test]BM[1]HO[1];B[bb];W[cc])'
function addComment(sequence, comment, index = 0) {
  const replaced = comment.replace(/\]/g, '\\]');
  return addProperty(sequence, `C[${replaced}]`, index);
}

// rootsequence => [ 'B', 'W' ] or [ 'W', 'B' ]
function getPLs(rootsequence) {
  const { root } = rootsequence;
  const { sequence } = rootsequence;
  const pls = [];

  const index = sequence.search(/\b[BW]\[/);
  if (index !== -1) {
    pls.push(sequence[index]);
  } else if (valueFromSequence('PL', root) !== '') {
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
  const moves = [];
  let left = sequence;
  let start = -1;

  for (;;) {
    start = left.search(/;[BW]\[[^\]]/);
    if (start === -1) {
      break;
    }

    const value = inBraket(left, start + 1);
    moves.push([left[start + 1], iaToJ1(value)]);
    left = left.substring(start + 3, left.length);
  }

  return moves;
}

// '..AB[aa][bb]AW[ab];W[po]...' => [["B","A1"],["B","B2"],["W","A2"]]
function initialstonesFromSequence(sequence) {
  const ab = valuesFromSequence('AB', sequence);
  const aw = valuesFromSequence('AW', sequence);
  const initialStones = [];

  for (let i = 0; i < ab.length; i += 1) {
    initialStones.push(['B', iaToJ1(ab[i])]);
  }
  for (let i = 0; i < aw.length; i += 1) {
    initialStones.push(['W', iaToJ1(aw[i])]);
  }

  return initialStones;
}

// ("W", {scoreLead: 21.05059, pv:["A1","B2","C3"]}) => '(;W[aa];B[bb];W[cc])'
function katagomoveinfoToSequence(player, moveInfo) {
  let pl = player;
  let sequence = '(';

  moveInfo.pv.forEach((move) => {
    sequence += `;${pl}[${iaFromJ1(move)}]`;

    if (pl === 'W') {
      pl = 'B';
    } else {
      pl = 'W';
    }
  });
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
  katagomoveinfoToSequence,
};
