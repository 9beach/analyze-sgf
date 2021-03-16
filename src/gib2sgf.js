#!/usr/bin/env node

/**
 * @fileOverview Converts Tygem's GIB format to SGF.
 */

// GIB format example.
//
// \HS
// ...
// \[GAMECOMMENT=\]
// \[GAMETAG=S1,R3,D5,G0,W255,Z0,T30-3-1200,C2016:03:26:17:29, ...\]
// \HE
// \GS
// 2 1 0
// 119 0 &4
// INI 0 1 3 &4
// STO 0 2 2 15 15
// ...
// STO 0 119 1 10 8
// \GE

// ('EV', 'World Cup') => 'EV[World Cup]'
const mkProp = (p, v) => (v ? `${p}[${v}]` : '');

// Converts GIB to SGF.
function convert(gib) {
  // Gets RootNode from HS~HE and INI.
  // Properties: FF, GM, SZ, AP, PB, BR, PW, WR, EV, RE, KM, DT, HA, AB.
  const root = `;FF[3]GM[1]SZ[19]AP[https://github.com/9beach/analyze-sgf]${
    pbFromGIB(gib) +
    pwFromGIB(gib) +
    mkProp('EV', propValueFromGIB(gib, 'GAMENAME')) +
    reFromGIB(gib) +
    kmFromGIB(gib) +
    dtFromGIB(gib) +
    haFromGIB(gib)
  }`;

  // Gets SGF NodeSequence from STOs.
  const seq = gib
    .substring(gib.indexOf('STO'))
    .split('\n')
    .filter((line) => line.indexOf('STO ') !== -1)
    .reduce((acc, cur) => acc + nodeFromSTO(cur.trim()), '');

  return `(${root}${seq})`;
}

// '1' => 'A'
const oneToA = (x) => String.fromCharCode(97 + parseInt(x, 10));

// 'STO 0 2 2 15 15' => ';W[pp]'
function nodeFromSTO(line) {
  const ns = line.split(/\s+/);
  const pl = ns[3] === '1' ? 'B' : 'W';

  return `;${pl}[${oneToA(ns[4])}${oneToA(ns[5])}]`;
}

// Gets PB, BR.
function pbFromGIB(gib) {
  const v = propValueFromGIB(gib, 'GAMEBLACKNAME');
  if (!v) return '';

  const pair = parsePlRank(v);
  return mkProp('PB', pair[0]) + mkProp('BR', pair[1]);
}

// Gets PW, WR.
function pwFromGIB(gib) {
  const v = propValueFromGIB(gib, 'GAMEWHITENAME');
  if (!v) return '';

  const pair = parsePlRank(v);
  return mkProp('PW', pair[0]) + mkProp('WR', pair[1]);
}

// Gets DT.
function dtFromGIB(gib) {
  const v = propValueFromGIB(gib, 'GAMETAG');
  if (!v) return '';

  const w = v.match(/C(\d\d\d\d):(\d\d):(\d\d)/);
  return w ? mkProp('DT', w.slice(1).join('-')) : '';
}

// Gets RE.
function reFromGIB(gib) {
  const ginfo = propValueFromGIB(gib, 'GAMEINFOMAIN');
  if (ginfo) return mkProp('RE', getRE(ginfo, /GRLT:(\d+),/, /ZIPSU:(\d+),/));

  const gtag = propValueFromGIB(gib, 'GAMETAG');
  return gtag ? mkProp('RE', getRE(gtag, /,W(\d+),/, /,Z(\d+),/)) : '';
}

// Gets KM.
function kmFromGIB(gib) {
  const ginfo = propValueFromGIB(gib, 'GAMEINFOMAIN');
  if (ginfo) {
    const v = ginfo.match(/GONGJE:(\d+),/);
    if (v) {
      const komi = parseInt(v[1], 10) / 10;
      if (!Number.isNaN(komi)) return mkProp('KM', komi.toString());
    }
  }

  const gtag = propValueFromGIB(gib, 'GAMETAG');
  if (gtag) {
    const v = gtag.match(/,G(\d+),/);
    if (v) {
      const komi = parseInt(v[1], 10) / 10;
      if (!Number.isNaN(komi)) return mkProp('KM', komi.toString());
    }
  }
  return '';
}

const handicapStones = [
  null,
  null,
  'dp][pd',
  'dp][pd][dd',
  'dp][pd][dd][pp',
  'dp][pd][dd][pp][jj',
  'dp][pd][dd][pp][dj][pj',
  'dp][pd][dd][pp][dj][pj][jj',
  'dp][pd][dd][pp][dj][pj][jd][jp',
  'dp][pd][dd][pp][dj][pj][jd][jp][jj',
];

// Gets HA, AB.
function haFromGIB(gib) {
  const v = valueOfINI(gib);
  if (!v) return '';

  const setup = v.split(/\s+/);
  const ha = parseInt(setup[2], 10);
  return ha >= 2 && ha <= 9
    ? mkProp('HA', ha) + mkProp('AB', handicapStones[ha])
    : '';
}

// 'lee(8k)' => ['lee', '8k']
function parsePlRank(v) {
  const index = v.lastIndexOf('(');
  return [
    v.substring(0, index).trim(),
    v.substring(index + 1, v.length - 1).trim(),
  ];
}

// ('...\[GAMEWHITENICK=xyz\]...', 'GAMEWHITENICK') => 'xyz'
function propValueFromGIB(gib, prop) {
  const start = gib.indexOf(`\\[${prop}=`);
  if (start === -1) return '';

  const end = gib.indexOf('\\]', start + prop.length);
  return end === -1 ? '' : gib.substring(start + prop.length + 3, end).trim();
}

// '...\nINI 0 1 5 ...\n...' => '0 1 5 ...'
function valueOfINI(gib) {
  const start = gib.indexOf('INI ');
  if (start === -1) return '';

  const end = gib.indexOf('\n', start + 4);
  return end === -1 ? '' : gib.substring(start + 4, end).trim();
}

// Gets RE.
function getRE(v, grltRegex, zipsuRegex) {
  const gmatch = grltRegex.exec(v);
  if (!gmatch) return '';

  const grlt = parseFloat(gmatch[1]);
  const zmatch = zipsuRegex.exec(v);
  return zmatch ? parseRE(grlt, parseFloat(zmatch[1])) : '';
}

function parseRE(grlt, zipsu) {
  const easycases = { 3: 'B+R', 4: 'W+R', 7: 'B+T', 8: 'W+T' };
  if (easycases[grlt] !== undefined) return easycases[grlt];

  return grlt === 0 || grlt === 1
    ? `${grlt === 0 ? 'B' : 'W'}+${zipsu / 10}`
    : '';
}

module.exports = convert;

if (require.main === module) {
  if (process.argv.length !== 2) {
    console.log('Usage: gib2sgf < FILE');
    process.exit(1);
  }

  let data = '';
  process.stdin.on('data', (chunk) => {
    data += chunk;
  });

  process.stdin.on('end', () => console.log(convert(data)));
}
