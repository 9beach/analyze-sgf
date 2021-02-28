/**
 * @fileOverview Converts Tygem's GIB format to SGF.
 *
 *               Based on <https://github.com/SabakiHQ/Sabaki/blob/master/src/modules/fileformats/gib.js>.
 */

// Converts GIB to SGF.
function convert(gib) {
  const root = makeRoot(gib);
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
function makeRE(line, grltRegex, zipsuRegex) {
  let match = grltRegex.exec(line);

  if (match) {
    const grlt = parseFloat(match[1]);
    match = zipsuRegex.exec(line);
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

// 'STO 0 2 2 15 15' => ';W[pp]'
function sgfnodeFromSTO(line) {
  const start = line.indexOf(' ');
  if (start === -1) throw Error(`Invalid STO format (${line})`);
  const sto = line.substring(start + 1).trim();
  const move = sto.split(/\s+/);
  const pl = move[2] === '1' ? 'B' : 'W';
  const x = parseInt(move[3], 10);
  const y = parseInt(move[4], 10);

  return `;${pl}[${String.fromCharCode(97 + x)}${String.fromCharCode(97 + y)}]`;
}

const handicapStones = [
  null,
  null,
  'pd][dp',
  'pd][dd][dp',
  'dp][dd][pd][pp',
  'dp][dd][pd][pp][jj',
  'dp][dd][pd][pp][dj][pj',
  'dp][dd][pd][pp][dj][pj][jj',
  'dp][dd][pd][pp][dj][pj][jd][jp',
  'dp][dd][pd][pp][dj][pj][jd][jp][jj',
];

// 'hey (there)' => ['hey', 'there']
function parsePair(line) {
  const index = line.lastIndexOf('(');
  return [
    line.substring(0, index).trim(),
    line.substring(index + 1, line.length - 1).trim(),
  ];
}

const makeProperty = (p, v) => `${p}[${v}]`;

function makeRoot(gib) {
  let root = ';FF[3]GM[1]SZ[19]AP[https://github.com/9beach/analyze-sgf]';

  let hasDT;
  let hasRE;
  let hasKM;

  let line;

  // PB, BR
  line = valueOfGIB(gib, 'GAMEBLACKNAME');
  if (line) {
    const pair = parsePair(line);
    root += makeProperty('PB', pair[0]);
    root += makeProperty('BR', pair[1]);
  }

  // PW, WR
  line = valueOfGIB(gib, 'GAMEWHITENAME');
  if (line) {
    const pair = parsePair(line);
    root += makeProperty('PW', pair[0]);
    root += makeProperty('WR', pair[1]);
  }

  // EV
  line = valueOfGIB(gib, 'GAMENAME');
  if (line) root += makeProperty('EV', line);

  // RE, KM
  line = valueOfGIB(gib, 'GAMEINFOMAIN');
  if (line) {
    if (!hasRE) {
      const result = makeRE(line, /GRLT:(\d+),/, /ZIPSU:(\d+),/);
      if (result) {
        root += makeProperty('RE', result);
        hasRE = true;
      }
    }
    if (!hasKM) {
      const match = line.match(/GONGJE:(\d+),/);
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
  line = valueOfGIB(gib, 'GAMETAG');
  if (line) {
    if (!hasDT) {
      const match = line.match(/C(\d\d\d\d):(\d\d):(\d\d)/);
      if (match) {
        const date = match.slice(1).join('-');
        root += makeProperty('DT', date);
        hasDT = true;
      }
    }
    if (!hasRE) {
      const result = makeRE(line, /,W(\d+),/, /,Z(\d+),/);
      if (result) {
        root += makeProperty('RE', result);
        hasRE = true;
      }
    }
    if (!hasKM) {
      const match = line.match(/,G(\d+),/);
      if (match) {
        const komi = parseInt(match[1], 10) / 10;
        root += makeProperty('KM', komi);
        hasKM = true;
      }
    }
  }

  // HA, AB
  line = valueOfINI(gib);
  if (line) {
    const setup = line.split(/\s+/);
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

module.exports = convert;
