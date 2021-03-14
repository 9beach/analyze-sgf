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
    mkProp('EV', valueOfGIB(gib, 'GAMENAME')) +
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
  const value = valueOfGIB(gib, 'GAMEBLACKNAME');
  if (!value) return '';

  const pair = parsePlRank(value);
  return mkProp('PB', pair[0]) + mkProp('BR', pair[1]);
}

// Gets PW, WR.
function pwFromGIB(gib) {
  const value = valueOfGIB(gib, 'GAMEWHITENAME');
  if (!value) return '';

  const pair = parsePlRank(value);
  return mkProp('PW', pair[0]) + mkProp('WR', pair[1]);
}

// Gets DT.
function dtFromGIB(gib) {
  const value = valueOfGIB(gib, 'GAMETAG');
  if (!value) return '';

  const v = value.match(/C(\d\d\d\d):(\d\d):(\d\d)/);
  return v ? mkProp('DT', v.slice(1).join('-')) : '';
}

// Gets RE.
function reFromGIB(gib) {
  const ginfo = valueOfGIB(gib, 'GAMEINFOMAIN');
  if (ginfo) return mkProp('RE', getRE(ginfo, /GRLT:(\d+),/, /ZIPSU:(\d+),/));

  const gtag = valueOfGIB(gib, 'GAMETAG');
  return gtag ? mkProp('RE', getRE(gtag, /,W(\d+),/, /,Z(\d+),/)) : '';
}

// Gets KM.
function kmFromGIB(gib) {
  const ginfo = valueOfGIB(gib, 'GAMEINFOMAIN');
  if (ginfo) {
    const v = ginfo.match(/GONGJE:(\d+),/);
    if (v) {
      const komi = parseInt(v[1], 10) / 10;
      if (!Number.isNaN(komi)) return mkProp('KM', komi.toString());
    }
  }

  const gtag = valueOfGIB(gib, 'GAMETAG');
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
  const value = valueOfINI(gib);
  if (!value) return '';

  const setup = value.split(/\s+/);
  const ha = parseInt(setup[2], 10);
  return ha >= 2 && ha <= 9
    ? mkProp('HA', ha) + mkProp('AB', handicapStones[ha])
    : '';
}

// 'lee(8k)' => ['lee', '8k']
function parsePlRank(value) {
  const index = value.lastIndexOf('(');
  return [
    value.substring(0, index).trim(),
    value.substring(index + 1, value.length - 1).trim(),
  ];
}

// ('...\[GAMEWHITENICK=oro\]...', 'GAMEWHITENICK') => 'oro'
function valueOfGIB(gib, prop) {
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
function getRE(value, grltRegex, zipsuRegex) {
  const gmatch = grltRegex.exec(value);

  if (gmatch) {
    const grlt = parseFloat(gmatch[1]);
    const zmatch = zipsuRegex.exec(value);
    if (zmatch) {
      const zipsu = parseFloat(zmatch[1]);
      return parseRE(grlt, zipsu);
    }
  }
  return '';
}

function parseRE(grlt, zipsu) {
  const easycases = { 3: 'B+R', 4: 'W+R', 7: 'B+T', 8: 'W+T' };

  if (easycases[grlt] !== undefined) return easycases[grlt];
  if (grlt === 0 || grlt === 1) {
    const winner = grlt === 0 ? 'B' : 'W';
    const margin = (zipsu / 10).toString();
    return `${winner}+${margin}`;
  }
  return '';
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
