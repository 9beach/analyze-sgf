/**
 * @fileOverview Generates the game report on players info, good moves,
 *               bad moves, and bad hot spots.
 */

const sgfconv = require('./sgfconv');

const percents = (f) => (f * 100).toFixed(2);

function movesstat(goodorbad, moves, total, listMoves, isScore) {
  if (!moves.length) {
    return '';
  }

  let format = `* ${goodorbad}`;
  if (total) {
    const ratio = percents(moves.length / total);
    format += ` (${ratio}%, ${moves.length}/${total})`;
  }

  if (listMoves) {
    format += ': ';
    if (isScore) {
      format += moves
        .map((m) => `#${m.index + 1} ⇣${m.scoreDrop.toFixed(2)}`)
        .join(', ');
    } else {
      format += moves
        .map((m) => `#${m.index + 1} ⇣${percents(m.winrateDrop)}%`)
        .join(', ');
    }
  }

  return `${format}\n`;
}

function reportGoodAndBad(
  moves,
  goodmovewinrate,
  badmovewinrate,
  badhotspotwinrate,
) {
  const total = moves[6].length;
  return (
    movesstat(
      `Less than ${goodmovewinrate * 100}% win rate drops`,
      moves[0],
      total,
      false,
    ) +
    movesstat(
      `Less than ${badmovewinrate * 100}% win rate drops`,
      moves[1],
      total,
      false,
    ) +
    movesstat(
      `More than ${badmovewinrate * 100}% win rate drops`,
      moves[2],
      total,
      true,
    ) +
    movesstat(
      `More than ${badhotspotwinrate * 100}% win rate drops`,
      moves[3],
      total,
      true,
    ) +
    movesstat('Top 10 win rate drops', moves[4], null, true) +
    movesstat('Top 10 score drops', moves[5], null, true, true)
  );
}

// (' 신진서  ', 'Black') => '신진서 (Black)'
// ('', 'Black') => 'Black'
function colorPL(player, color) {
  let pl = player;
  if (pl !== '') pl += ` (${color})`;
  else pl = `${color}`;
  return pl;
}

function goodBads(pl, stat) {
  const moves = [];
  // 0: Good moves.
  moves.push(
    stat.drops.filter(
      (n) => n.pl === pl && n.winrateDrop < stat.goodmovewinrate,
    ),
  );
  // 1: Not bad moves.
  moves.push(
    stat.drops.filter(
      (n) => n.pl === pl && n.winrateDrop < stat.badmovewinrate,
    ),
  );
  // 2: Bad moves.
  moves.push(
    stat.drops.filter(
      (n) => n.pl === pl && n.winrateDrop >= stat.badmovewinrate,
    ),
  );
  // 3: Bad hot spots.
  moves.push(
    stat.drops.filter(
      (n) => n.pl === pl && n.winrateDrop >= stat.badhotspotwinrate,
    ),
  );
  // 4: The biggest win rate drops.
  moves.push(
    stat.drops
      .filter((n) => n.pl === pl && n.winrateDrop)
      .sort((a, b) => b.winrateDrop - a.winrateDrop)
      .slice(0, 10),
  );
  // 5: The biggest score drops.
  moves.push(
    stat.drops
      .filter((n) => n.pl === pl && n.scoreDrop)
      .sort((a, b) => b.scoreDrop - a.scoreDrop)
      .slice(0, 10),
  );
  // 6: Total.
  moves.push(stat.drops.filter((n) => n.pl === pl));
  return moves;
}

// Generates report.
function reportGame(stat) {
  // Handles SGF dialect (KO/TE/RD).
  let km = sgfconv.getAnyOfProperties(stat.root, ['KM', 'KO']);
  km = km !== '' ? `Komi ${km}` : km;
  const ev = sgfconv.getAnyOfProperties(stat.root, ['EV', 'TE', 'GN']);
  const dt = sgfconv.getAnyOfProperties(stat.root, ['DT', 'RD']);

  const re = sgfconv.valueFromSequence(stat.root, 'RE');
  const title = [ev, km, re, dt].filter((v) => v !== '').join(', ');

  const pb = colorPL(sgfconv.valueFromSequence(stat.root, 'PB'), 'Black');
  const pw = colorPL(sgfconv.valueFromSequence(stat.root, 'PW'), 'White');

  const blackGoodBads = goodBads('B', stat);
  const whiteGoodBads = goodBads('W', stat);

  return (
    `# Analyze-SGF Report\n\n${title}` +
    `\n\n${pb}\n${reportGoodAndBad(
      blackGoodBads,
      stat.goodmovewinrate,
      stat.badmovewinrate,
      stat.badhotspotwinrate,
    )}` +
    `\n${pw}\n${reportGoodAndBad(
      whiteGoodBads,
      stat.goodmovewinrate,
      stat.badmovewinrate,
      stat.badhotspotwinrate,
    )}` +
    `\nAnalyzed by KataGo Parallel Analysis Engine (${stat.visits} max visits).`
  );
}

function nextBads(stat, pl, turnNumber) {
  const goodbads = goodBads(pl, stat);
  const color = pl === 'B' ? 'Black' : 'White';
  const bads = goodbads[2]
    .filter((m) => m.index > turnNumber)
    .map((m) => `#${m.index + 1} ⇣${percents(m.winrateDrop)}%`)
    .join(', ');
  const badhotspots = goodbads[3]
    .filter((m) => m.index > turnNumber)
    .map((m) => `#${m.index + 1} ⇣${percents(m.winrateDrop)}`)
    .join(', ');

  const report = [];

  if (bads !== '') {
    report.push(
      `* ${color} more than ${
        stat.badmovewinrate * 100
      }% win rate drop: ${bads}`,
    );
  }
  if (badhotspots !== '') {
    report.push(
      `* ${color} more than ${
        stat.badhotspotwinrate * 100
      }% win rate drop: ${badhotspots}`,
    );
  }

  return report;
}

// Generates next bad moves report.
function reportBadsLeft(stat, turnNumber) {
  const report = [
    ...nextBads(stat, 'B', turnNumber),
    ...nextBads(stat, 'W', turnNumber),
  ];
  if (report.length !== 0) {
    return `The moves left\n\n${report.join('\n')}`;
  }
  return '';
}

// Gets file name from SGF
function prettyPath(sgf) {
  let ev = sgfconv.getAnyOfProperties(sgf, ['EV', 'TE', 'GN']);
  // Repalces it for bad format of Tygem.
  ev = ev.replace(' .', '');
  const dt = sgfconv.getAnyOfProperties(sgf, ['DT', 'RD']);
  ev = [ev, dt].join(', ');
  if (ev !== '') ev = `[${ev}]`;

  let players = '';
  // Repalces it for bad format of Tygem.
  const pw = sgfconv.valueFromSequence(sgf, 'PW').replace(/:.*/, '');
  const pb = sgfconv.valueFromSequence(sgf, 'PB').replace(/:.*/, '');
  if (pw !== '' && pb !== '') players = `${pw} vs ${pb}`;

  let re = sgfconv.valueFromSequence(sgf, 'RE').replace(/:.*/, '');
  if (re !== '') re = `(${re})`;

  return `${[ev, players, re].filter((v) => v !== '').join(' ')}.sgf`;
}

module.exports = { reportGame, reportBadsLeft, prettyPath };
