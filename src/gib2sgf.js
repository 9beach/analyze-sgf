/**
 * @fileOverview Converts SGF to GIB (Tygem format).
 *
 *               Based on <https://github.com/SabakiHQ/Sabaki/blob/master/src/modules/fileformats/gib.js>.
 */

function convert(gib) {
  const root = getRoot(gib);
  const sequence = gib
    .substring(gib.indexOf('STO'), gib.length)
    .split('\n')
    .filter((line) => line.indexOf('STO ') !== -1)
    .map((line) => getTail(line))
    .reduce((acc, cur) => acc + sto2move(cur), '');

  return `(${root}${sequence})`;
}

function getProp(gib, prop) {
  const start = gib.indexOf(`\\[${prop}=`);
  if (start === -1) return undefined;
  const end = gib.indexOf('\\]', start + prop.length);
  if (end === -1) return undefined;

  return gib.substring(start + prop.length + 3, end).trim();
}

function getINI(gib) {
  const start = gib.indexOf('INI ');
  if (start === -1) return undefined;
  const end = gib.indexOf('\n', start + 4);
  if (end === -1) return undefined;

  return gib.substring(start + 4, end).trim();
}

function getTail(line) {
  const start = line.indexOf(' ');
  if (start === -1) return undefined;
  return line.substring(start + 1, line.length).trim();
}

function getPair(line) {
  const index = line.lastIndexOf('(');
  return [
    line.substring(0, index).trim(),
    line.substring(index + 1, line.length - 1).trim(),
  ];
}

function getRE(line, grltRegex, zipsuRegex) {
  let result = '';
  let match = grltRegex.exec(line);

  if (match) {
    const grlt = parseFloat(match[1]);
    match = zipsuRegex.exec(line);
    if (match) {
      const zipsu = parseFloat(match[1]);
      result = makeResult(grlt, zipsu);
    }
  }

  return result;
}

function sto2move(sto) {
  const move = sto.split(/\s+/);
  const pl = move[2] === '1' ? 'B' : 'W';
  const x = parseInt(move[3], 10);
  const y = parseInt(move[4], 10);

  return `;${pl}[${String.fromCharCode(97 + x)}${String.fromCharCode(97 + y)}]`;
}

function makeResult(grlt, zipsu) {
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

function getRoot(gib) {
  const prop = (p, v) => `${p}[${v}]`;
  let root = ';FF[3]GM[1]SZ[19]AP[https://github.com/9beach/analyze-sgf]';

  let hasDT;
  let hasRE;
  let hasKM;

  // PB, BR
  let line = getProp(gib, 'GAMEBLACKNAME');
  if (line) {
    const pair = getPair(line);
    root += prop('PB', pair[0]);
    root += prop('BR', pair[1]);
  }

  // PW, WR
  line = getProp(gib, 'GAMEWHITENAME');
  if (line) {
    const pair = getPair(line);
    root += prop('PW', pair[0]);
    root += prop('WR', pair[1]);
  }

  // RE, KM
  line = getProp(gib, 'GAMEINFOMAIN');
  if (line) {
    if (!hasRE) {
      const result = getRE(line, /GRLT:(\d+),/, /ZIPSU:(\d+),/);
      if (result) {
        root += prop('RE', result);
        hasRE = true;
      }
    }
    if (!hasKM) {
      const match = line.match(/GONGJE:(\d+),/);
      if (match) {
        const komi = parseInt(match[1], 10) / 10;
        if (komi) {
          root += prop('KM', komi);
          hasKM = true;
        }
      }
    }
  }

  // DT, RE, KM
  line = getProp(gib, 'GAMETAG');
  if (line) {
    if (!hasDT) {
      const match = line.match(/C(\d\d\d\d):(\d\d):(\d\d)/);
      if (match) {
        const date = match.slice(1).join('-');
        root += prop('DT', date);
        hasDT = true;
      }
    }
    if (!hasRE) {
      const result = getRE(line, /,W(\d+),/, /,Z(\d+),/);
      if (result) {
        root += prop('RE', result);
        hasRE = true;
      }
    }
    if (!hasKM) {
      const match = line.match(/,G(\d+),/);
      if (match) {
        const komi = parseInt(match[1], 10) / 10;
        root += prop('KM', komi);
        hasKM = true;
      }
    }
  }

  // HA, AB
  line = getINI(gib);
  if (line) {
    const setup = line.split(/\s+/);
    if (setup[3]) {
      const handicap = parseInt(setup[2], 10);
      if (handicap >= 2) {
        root += prop('HA', handicap);
        root += prop('AB', handicapStones[handicap]);
      }
    }
  }

  return root;
}

module.exports = convert;
