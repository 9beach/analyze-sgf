/**
 * @fileOverview Generate the game report on players info, good moves,
 *               bad moves, and bad hot spots.
 */

const sgfconv = require('./sgfconv');

// [1, 2, 5] => 'move 1, move 2, move 5'
function joinmoves(moves) {
  return moves.map((x) => `move ${x + 1}`).join(', ');
}

// ('Bad moves', [39, 69, 105, 109, ...], 104) =>
// '* Bad moves (11.54%, 12/104): move 39, move 69, move 105, move 109, ...'
function movesstat(goodorbad, moves, total, listmoves = true) {
  if (!moves.length) {
    return '';
  }

  const ratio = ((moves.length / total) * 100).toFixed(2);
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

// (' 신진서  ', 'Black') => '신진서 (Black):'
// ('', 'Black') => 'Black:'
function colorPL(player, color) {
  let pl = player.replace(/ *$/, '').replace(/^ */, '');

  if (pl !== '') {
    pl += ` (${color}):`;
  } else {
    pl = `${color}:`;
  }

  return pl;
}

// Generates report.
function reportGame(
  stat,
  goodmovewinrate,
  badmovewinrate,
  badhotspotwinrate,
  variationwinrate,
  maxvariations,
  visits,
) {
  // Handles SGF dialect.
  let km;
  km = sgfconv.valueFromSequence('KM', stat.root);
  if (km === '') {
    km = sgfconv.valueFromSequence('KO', stat.root);
  }
  km = km !== '' ? `Komi ${km}` : km;

  let ev;
  ev = sgfconv.valueFromSequence('EV', stat.root);
  if (ev === '') {
    ev = sgfconv.valueFromSequence('TE', stat.root);
  }

  let dt;
  dt = sgfconv.valueFromSequence('DT', stat.root);
  if (dt === '') {
    dt = sgfconv.valueFromSequence('RD', stat.root);
  }

  const re = sgfconv.valueFromSequence('RE', stat.root);
  const title = [ev, km, re, dt].filter((v) => v !== '').join(', ');

  const pb = colorPL(sgfconv.valueFromSequence('PB', stat.root), 'Black');
  const pw = colorPL(sgfconv.valueFromSequence('PW', stat.root), 'White');

  return (
    `# Analyze-SGF Report\n\n${title}` +
    `\n\n${pb}\n${reportGoodAndBad(stat.blacksTotal, stat.blackGoodBads)}` +
    `\n${pw}\n${reportGoodAndBad(stat.whitesTotal, stat.whiteGoodBads)}` +
    `\nGood move: less than ${goodmovewinrate * 100}% win rate drop` +
    `\nBad move: more than ${badmovewinrate * 100}% win rate drop` +
    `\nBad hot spot: more than ${badhotspotwinrate * 100}% win rate drop` +
    `\n\nVariations added for the moves having more than ` +
    `${variationwinrate * 100}% win rate drop.` +
    `\nThe maximum variation number for each move is ${maxvariations}.` +
    `\n\nAnalyzed by KataGo Parallel Analysis Engine (${visits} max visits).`
  );
}

function nextBads(stat, pl, turnNumber) {
  const goodbads = pl === 'B' ? stat.blackGoodBads : stat.whiteGoodBads;
  const color = pl === 'B' ? 'Black' : 'White';
  const bads = goodbads[1]
    .filter((m) => m > turnNumber)
    .map((x) => `move ${x + 1}`)
    .join(', ');
  const badhotspots = goodbads[2]
    .filter((m) => m > turnNumber)
    .map((x) => `move ${x + 1}`)
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
    return `Bad moves left:\n\n${report.join('\n')}`;
  }
  return '';
}

module.exports = { reportGame, reportBadsLeft };
