/**
 * @fileOverview Converts Tygem's GIB format to SGF.
 */

// e.g.,
//
// \HS
// \[GAMEBLACKLEVEL=3\]
// ...
// \[GAMECOMMENT=\]
// \[GAMETAG=S1,R3,D5,G0,W255,Z0,T30-3-1200,C2016:03:26:17:29, ...\]
// \HE
// \GS
// 2 1 0
// 119 0 &4
// INI 0 1 3 &4
// STO 0 2 2 15 15
// STO 0 3 1 13 16
// ...
// STO 0 119 1 10 8
// \GE

// Converts GIB to SGF.
function convert(gib) {
  const root = sgfrootFromGIB(gib);
  const sequence = gib
    .substring(gib.indexOf('STO'))
    .split('\n')
    .filter((line) => line.indexOf('STO ') !== -1)
    .reduce((acc, cur) => acc + sgfnodeFromSTO(cur.trim()), '');

  return `(${root}${sequence})`;
}

// 1 => 'A'
// 2 => 'B'
const oneToA = (x) => String.fromCharCode(97 + x);

// 'STO 0 2 2 15 15' => ';W[pp]'
function sgfnodeFromSTO(line) {
  const move = line.split(/\s+/);
  const pl = move[3] === '1' ? 'B' : 'W';
  const x = parseInt(move[4], 10);
  const y = parseInt(move[5], 10);

  return `;${pl}[${oneToA(x)}${oneToA(y)}]`;
}

function sgfrootFromGIB(gib) {
  let root = ';FF[3]GM[1]SZ[19]AP[https://github.com/9beach/analyze-sgf]';

  // PB, BR
  root += pbFromGIB(gib);
  // PW, WR
  root += pwFromGIB(gib);
  // EV
  root += evFromGIB(gib);
  // DT, RE, KM
  root += reFromGIB(gib);
  root += kmFromGIB(gib);
  root += dtFromGIB(gib);
  // HA, AB
  root += haFromGIB(gib);

  return root;
}

const makeProperty = (p, v) => `${p}[${v}]`;

// Gets PB, BR.
function pbFromGIB(gib) {
  const value = valueOfGIB(gib, 'GAMEBLACKNAME');
  if (value) {
    const pair = parsePlRank(value);
    return makeProperty('PB', pair[0]) + makeProperty('BR', pair[1]);
  }
  return '';
}

// Gets PW, WR.
function pwFromGIB(gib) {
  const value = valueOfGIB(gib, 'GAMEWHITENAME');
  if (value) {
    const pair = parsePlRank(value);
    return makeProperty('PW', pair[0]) + makeProperty('WR', pair[1]);
  }
  return '';
}

// Gets EV.
function evFromGIB(gib) {
  const value = valueOfGIB(gib, 'GAMENAME');
  if (value) return makeProperty('EV', value);
  return '';
}

// Gets DT.
function dtFromGIB(gib) {
  const value = valueOfGIB(gib, 'GAMETAG');
  if (value) {
    const v = value.match(/C(\d\d\d\d):(\d\d):(\d\d)/);
    if (v) return makeProperty('DT', v.slice(1).join('-'));
  }
  return '';
}

// Gets RE.
function reFromGIB(gib) {
  let value = valueOfGIB(gib, 'GAMEINFOMAIN');
  if (value) {
    const v = getRE(value, /GRLT:(\d+),/, /ZIPSU:(\d+),/);
    if (v) return makeProperty('RE', v);
  }

  value = valueOfGIB(gib, 'GAMETAG');
  if (value) {
    const v = getRE(value, /,W(\d+),/, /,Z(\d+),/);
    if (v) return makeProperty('RE', v);
  }

  return '';
}

// Gets KM.
function kmFromGIB(gib) {
  let value = valueOfGIB(gib, 'GAMEINFOMAIN');
  if (value) {
    const v = value.match(/GONGJE:(\d+),/);
    if (v) {
      const komi = parseInt(v[1], 10) / 10;
      if (!Number.isNaN(komi)) return makeProperty('KM', komi);
    }
  }

  value = valueOfGIB(gib, 'GAMETAG');
  if (value) {
    const v = value.match(/,G(\d+),/);
    if (v) {
      const komi = parseInt(v[1], 10) / 10;
      if (!Number.isNaN(komi)) return makeProperty('KM', komi);
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
  if (value) {
    const setup = value.split(/\s+/);
    if (setup[3]) {
      const handicap = parseInt(setup[2], 10);
      if (handicap >= 2)
        return (
          makeProperty('HA', handicap) +
          makeProperty('AB', handicapStones[handicap])
        );
    }
  }
  return '';
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
  if (end === -1) return '';
  return gib.substring(start + prop.length + 3, end).trim();
}

// '...\nINI 0 1 5 ...\n...' => '0 1 5 ...'
function valueOfINI(gib) {
  const start = gib.indexOf('INI ');
  if (start === -1) return '';
  const end = gib.indexOf('\n', start + 4);
  if (end === -1) return '';
  return gib.substring(start + 4, end).trim();
}

// Gets RE.
function getRE(value, grltRegex, zipsuRegex) {
  let match = grltRegex.exec(value);

  if (match) {
    const grlt = parseFloat(match[1]);
    match = zipsuRegex.exec(value);
    if (match) {
      const zipsu = parseFloat(match[1]);
      return parseRE(grlt, zipsu);
    }
  }

  return '';
}

function parseRE(grlt, zipsu) {
  const easycases = { 3: 'B+R', 4: 'W+R', 7: 'B+T', 8: 'W+T' };

  if (easycases[grlt] !== undefined) {
    return easycases[grlt];
  }

  if (grlt === 0 || grlt === 1) {
    const winner = grlt === 0 ? 'B' : 'W';
    const margin = (zipsu / 10).toString();
    return `${winner}+${margin}`;
  }

  return '';
}

module.exports = convert;
