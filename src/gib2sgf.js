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

// Gets RE value.
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

// 'hey(there)' => ['hey', 'there']
function parsePair(value) {
  const index = value.lastIndexOf('(');
  return [
    value.substring(0, index).trim(),
    value.substring(index + 1, value.length - 1).trim(),
  ];
}

const makeProperty = (p, v) => `${p}[${v}]`;

function sgfrootFromGIB(gib) {
  let root = ';FF[3]GM[1]SZ[19]AP[https://github.com/9beach/analyze-sgf]';
  let value;

  // PB, BR
  value = valueOfGIB(gib, 'GAMEBLACKNAME');
  if (value) {
    const pair = parsePair(value);
    root += makeProperty('PB', pair[0]);
    root += makeProperty('BR', pair[1]);
  }

  // PW, WR
  value = valueOfGIB(gib, 'GAMEWHITENAME');
  if (value) {
    const pair = parsePair(value);
    root += makeProperty('PW', pair[0]);
    root += makeProperty('WR', pair[1]);
  }

  // EV
  value = valueOfGIB(gib, 'GAMENAME');
  if (value) root += makeProperty('EV', value);

  // DT, RE, KM
  root += propertiesFromGIB(gib);

  // HA, AB
  value = valueOfINI(gib);
  if (value) {
    const setup = value.split(/\s+/);
    if (setup[3]) {
      const handicap = parseInt(setup[2], 10);
      if (handicap >= 2) {
        root += makeProperty('HA', handicap);
        root += makeProperty('AB', handicapStones[handicap]);
      }
    }
  }

  return root;
}

// DT, RE, KM
function propertiesFromGIB(gib) {
  let root = '';
  let hasRE;
  let hasKM;
  let value;

  // RE, KM
  value = valueOfGIB(gib, 'GAMEINFOMAIN');
  if (value) {
    if (!hasRE) {
      const result = getRE(value, /GRLT:(\d+),/, /ZIPSU:(\d+),/);
      if (result) {
        root += makeProperty('RE', result);
        hasRE = true;
      }
    }
    if (!hasKM) {
      const match = value.match(/GONGJE:(\d+),/);
      if (match) {
        const komi = parseInt(match[1], 10) / 10;
        if (komi) {
          root += makeProperty('KM', komi);
          hasKM = true;
        }
      }
    }
  }

  // DT, RE, KM
  value = valueOfGIB(gib, 'GAMETAG');
  if (value) {
    let match = value.match(/C(\d\d\d\d):(\d\d):(\d\d)/);
    if (match) {
      const date = match.slice(1).join('-');
      root += makeProperty('DT', date);
    }
    if (!hasRE) {
      const result = getRE(value, /,W(\d+),/, /,Z(\d+),/);
      if (result) {
        root += makeProperty('RE', result);
        hasRE = true;
      }
    }
    if (!hasKM) {
      match = value.match(/,G(\d+),/);
      if (match) {
        const komi = parseInt(match[1], 10) / 10;
        root += makeProperty('KM', komi);
        hasKM = true;
      }
    }
  }

  return root;
}

module.exports = convert;
