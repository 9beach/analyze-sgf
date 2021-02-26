/**
 * @fileOverview Generates the game report on players info, good moves,
 *               bad moves, and bad hot spots.
 */

const sgfconv = require('./sgfconv');

// [1, 2, 5] => 'move 1, move 2, move 5'
function joinmoves(moves) {
  return moves.map((x) => `#${x + 1}`).join(', ');
}

// ('Bad moves', [39, 69, 105, 109, ...], 104) =>
// '* Bad moves (11.54%, 12/104): move 39, move 69, move 105, move 109, ...'
function movesstat(goodorbad, moves, total, listmoves = true) {
  if (!moves.length) {
    return '';
  }

  const ratio = ((moves.length / total) * 100).toFixed(1);
  let format = `* ${goodorbad} (${ratio}%, ${moves.length}/${total})`;

  if (listmoves) {
    format += `: ${joinmoves(moves)}`;
  }

  return `${format}\n`;
}

function reportGoodAndBad(total, moves) {
  return (
    movesstat('Good moves', moves[0], total, false) +
    movesstat('Bad moves', moves[1], total) +
    movesstat('Bad hot spots', moves[2], total)
  );
}

// (' 신진서  ', 'Black') => '신진서 (Black)'
// ('', 'Black') => 'Black'
function colorPL(player, color) {
  let pl = player;
  if (pl !== '') {
    pl += ` (${color})`;
  } else {
    pl = `${color}`;
  }

  return pl;
}

function prettyPath(sgf) {
  let ev = sgfconv.getAnyOfProperties(sgf, ['EV', 'TE', 'GN']);
  if (ev !== '') ev = `[${ev}]`;
  const dt = sgfconv.getAnyOfProperties(sgf, ['DT', 'RD']);

  let players = '';
  const pw = sgfconv.valueFromSequence(sgf, 'PW').replace(/:.*/, '');
  const pb = sgfconv.valueFromSequence(sgf, 'PB').replace(/:.*/, '');
  if (pw !== '' && pb !== '') players = `${pw} vs ${pb}`;

  let re = sgfconv.valueFromSequence(sgf, 'RE').replace(/:.*/, '');
  if (re !== '') re = `(${re})`;

  return `${[ev, players, re, dt].filter((v) => v !== '').join(' ')}.sgf`;
}

// Generates report.
function reportGame(
  stat,
  goodmovewinrate,
  badmovewinrate,
  badhotspotwinrate,
  visits,
) {
  // Handles SGF dialect (KO/TE/RD).
  let km = sgfconv.getAnyOfProperties(stat.root, ['KM', 'KO']);
  km = km !== '' ? `Komi ${km}` : km;
  const ev = sgfconv.getAnyOfProperties(stat.root, ['EV', 'TE', 'GN']);
  const dt = sgfconv.getAnyOfProperties(stat.root, ['DT', 'RD']);

  const re = sgfconv.valueFromSequence(stat.root, 'RE');
  const title = [ev, km, re, dt].filter((v) => v !== '').join(', ');

  const pb = colorPL(sgfconv.valueFromSequence(stat.root, 'PB'), 'Black');
  const pw = colorPL(sgfconv.valueFromSequence(stat.root, 'PW'), 'White');

  return (
    `# Analyze-SGF Report\n\n${title}` +
    `\n\n${pb}\n${reportGoodAndBad(stat.blacksTotal, stat.blackGoodBads)}` +
    `\n${pw}\n${reportGoodAndBad(stat.whitesTotal, stat.whiteGoodBads)}` +
    `\nGood move: less than ${goodmovewinrate * 100}% win rate drop` +
    `\nBad move: more than ${badmovewinrate * 100}% win rate drop` +
    `\nBad hot spot: more than ${badhotspotwinrate * 100}% win rate drop` +
    `\n\nAnalyzed by KataGo Parallel Analysis Engine (${visits} max visits).`
  );
}

function nextBads(stat, pl, turnNumber) {
  const goodbads = pl === 'B' ? stat.blackGoodBads : stat.whiteGoodBads;
  const color = pl === 'B' ? 'Black' : 'White';
  const bads = goodbads[1]
    .filter((m) => m > turnNumber)
    .map((x) => `#${x + 1}`)
    .join(', ');
  const badhotspots = goodbads[2]
    .filter((m) => m > turnNumber)
    .map((x) => `#${x + 1}`)
    .join(', ');

  const report = [];

  if (bads !== '') {
    report.push(`* ${color} bad moves: ${bads}`);
  }
  if (badhotspots !== '') {
    report.push(`* ${color} bad hot spots: ${badhotspots}`);
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
    return `Bad moves left\n\n${report.join('\n')}`;
  }
  return '';
}

module.exports = { reportGame, reportBadsLeft, prettyPath };
