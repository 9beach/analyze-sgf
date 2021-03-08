/**
 * @fileOverview Helper functions to parse SGF format.
 */

const sgfparser = require('@sabaki/sgf');

// ('XX[11]YY[22]', 0) => '11'
// ('XX[11]YY[22]', 8) => '22'
function inBraket(value, index = 0) {
  const start = value.indexOf('[', index);
  const end = value.indexOf(']', start);

  if (start === -1 || end === -1) {
    return '';
  }
  return value.substring(start + 1, end).trim();
}

// ('XX', 'XX[11]YY[22]YY[33]') => 11
function valueFromSequence(sgf, prop) {
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
// 'ia' => 'J1'
function iaToJ1(value) {
  const v = value.toUpperCase();

  if (v[0] >= 'I') {
    return nextChar(v[0]) + (v.charCodeAt(1) - 64).toString();
  }
  return v[0] + (v.charCodeAt(1) - 64).toString();
}

// For real Goban display.
//
// 'aa' => 'A19'
// 'bd' => 'B16'
function iaToJ19(value) {
  const v = value.toUpperCase();

  if (v[0] >= 'I') {
    return nextChar(v[0]) + (84 - v.charCodeAt(1)).toString();
  }
  return v[0] + (84 - v.charCodeAt(1)).toString();
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

function anyValueFromSequence(sgf, props) {
  let value = '';
  props.some((p) => {
    value = valueFromSequence(sgf, p);
    return value;
  });
  return value;
}

function regexIndexOf(string, regex, start) {
  const indexOf = string.substring(start || 0).search(regex);
  return indexOf >= 0 ? indexOf + (start || 0) : indexOf;
}

// ('(;W[aa];B[bb];W[cc])', 'XX', 0) => '(;W[aa]XX;B[bb];W[cc])'
// ('(;W[aa];B[bb];W[cc])', 'XX', 7) => '(;W[aa];B[bb]XX;W[cc])'
function addProperty(sequence, mark, index) {
  const start = regexIndexOf(sequence, /[^\\]\]/, Math.max(0, index - 1));

  if (start !== -1) {
    return (
      sequence.substring(0, start + 2) + mark + sequence.substring(start + 2)
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

// For SABAKI autoplaying PVs.
// '(;W[po];B[hm];W[ae]...)' => 'WQ5 H7 A15'
// ';W[po]' => 'Q5'
function sequenceToPV(sequence) {
  const pl = sequence[0] === '(' ? sequence[2] : sequence[0];
  let len = 0;
  const pv = sequence
    .split(';')
    .filter((move) => move.search(/[BW]\[[^\]]/) === 0)
    .map((move, index) => {
      len = index;
      return iaToJ19(move.substring(2, 4));
    })
    .join(' ');

  return len > 0 ? pl + pv : pv;
}

// Risky but effective.
// Fixes SGF dialects (KO/TE/RD) for other SGF editors.
// Fixes bad Tygem SGF. e.g., '대주배 16강 .'
// Fixes bad Tygem SGF. e.g., '김미리:김미리:4단'.
function correctSGFDialects(sgf) {
  return sgf
    .replace(/\([;]*TE\[/, '(;GM[1]FF[4]EV[')
    .replace(/\bRD\[/, 'DT[')
    .replace(/\bK[OM]\[\]/, '')
    .replace(/\bKO\[/, 'KM[')
    .replace(/ \.\]/, ']')
    .replace(/(P[BW]\[[^\]:]*):[^\]]*\]/g, '$1]');
}

// Makes file name from SGF.
//
// e.g., '[제22회 농심배 13국, 2021-02-25] 커제 vs 신진서 (185수 흑불계승).sgf'
function prettyPathFromSGF(sgf) {
  const nsgf = correctSGFDialects(sgf);
  let evDT = [
    // For bad Tygem SGF. e.g., '대주배 16강 .'
    anyValueFromSequence(nsgf, ['EV', 'GN']).replace(' .', ''),
    valueFromSequence(nsgf, 'DT'),
  ]
    .filter((v) => v)
    .join(', ');
  if (evDT) evDT = `[${evDT}]`;

  let players = '';
  const pw = valueFromSequence(nsgf, 'PW');
  const pb = valueFromSequence(nsgf, 'PB');
  if (pw && pb) players = `${pw} vs ${pb}`;

  let re = valueFromSequence(nsgf, 'RE');
  if (re) re = `(${re})`;

  return `${[evDT, players, re].filter((v) => v).join(' ')}.sgf`;
}

// 2000 => '2k'
function formatK(num) {
  return Math.abs(num) > 999
    ? `${Math.sign(num) * (Math.abs(num) / 1000).toFixed(1)}k`
    : Math.sign(num) * Math.abs(num);
}

function mknode(data) {
  if (data.B) return `;B[${data.B[0]}]`;
  if (data.W) return `;W[${data.W[0]}]`;
  return '';
}

function mksequence(node) {
  if (node.children.length)
    return mknode(node.data) + mksequence(node.children[0]);
  return mknode(node.data);
}

function mkprops(ks, removeComment) {
  return Object.keys(ks).reduce((acc, k) => {
    if (removeComment && k === 'C') return acc;
    let sum = acc;
    sum += k;
    sum += ks[k].reduce(
      (insum, cur) => `${insum}[${cur.replace(/\]/g, '\\]')}]`,
      '',
    );
    return sum;
  }, ';');
}

// '(FF[4]GM[1]C[test];B[aa]C[test];(B[bb])(B[cc])'
//   => { root: ';FF[4]GM[1]', sequence: ';B[aa];B[bb]' }
// '(;FF[4]GM[1];B[aa];(B[bb]C[test])(B[cc])'
//   => { root: ';FF[4]GM[1]', sequence: ';B[aa];B[bb]' }
function rootsequenceFromSGF(sgf, removeComment = true) {
  const nodes = sgfparser.parse(sgf);
  return {
    root: mkprops(nodes[0].data, removeComment),
    sequence: mksequence(nodes[0]),
  };
}

// Strips tail, comments, and line feeds from SGF.
function removeTails(sgf) {
  const rs = rootsequenceFromSGF(sgf.replace(/\r\n/g, '').replace(/\n/g, ''));
  return `(${rs.root + rs.sequence})`;
}

module.exports = {
  iaFromJ1,
  iaToJ1,
  iaToJ19,
  valueFromSequence,
  valuesFromSequence,
  addProperty,
  toGoodNode,
  toBadNode,
  toBadHotSpot,
  addComment,
  removeTails,
  anyValueFromSequence,
  rootsequenceFromSGF,
  correctSGFDialects,
  prettyPathFromSGF,
  formatK,
  sequenceToPV,
};
