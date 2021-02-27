/**
 * @fileOverview Generates the game report on players info, good moves,
 *               bad moves, and bad hot spots.
 */

const sgfconv = require('./sgfconv');

const percents = (f) => (f * 100).toFixed(2);

function makeGoodBads(pl, stat) {
  return [
    // 0: Good moves.
    stat.drops.filter(
      (n) => n.pl === pl && n.winrateDrop < stat.goodmovewinrate,
    ),
    // 1: Not bad moves.
    stat.drops.filter(
      (n) => n.pl === pl && n.winrateDrop < stat.badmovewinrate,
    ),
    // 2: Bad moves.
    stat.drops.filter(
      (n) => n.pl === pl && n.winrateDrop >= stat.badmovewinrate,
    ),
    // 3: Bad hot spots.
    stat.drops.filter(
      (n) => n.pl === pl && n.winrateDrop >= stat.badhotspotwinrate,
    ),
    // 4: Top 10 win rate drops.
    stat.drops
      .filter((n) => n.pl === pl && n.winrateDrop)
      .sort((a, b) => b.winrateDrop - a.winrateDrop)
      .slice(0, 10),
    // 5: Top 10 score drops.
    stat.drops
      .filter((n) => n.pl === pl && n.scoreDrop)
      .sort((a, b) => b.scoreDrop - a.scoreDrop)
      .slice(0, 10),
    // 6: Total.
    stat.drops.filter((n) => n.pl === pl),
  ];
}

// e.g.:
// * More than 5% win rate drops (5.56%, 5/90): #79 ⇣9.20%, #83 ⇣8.49%, ...
function getDropList(title, moves, total, listMoves, isScore) {
  if (!moves.length) {
    return '';
  }

  let format = `* ${title}`;
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

// e.g.:
// * Less than 2% win rate drops (83.33%, 75/90)
// * Less than 5% win rate drops (94.44%, 85/90)
// * More than 5% win rate drops (5.56%, 5/90): #79 ⇣9.20%, #83 ⇣8.49%, ...
// * More than 20% win rate drops (2.22%, 2/90): #89 ⇣25.12%, #93 ⇣26.86%
// * Top 10 win rate drops: #93 ⇣26.86%, #89 ⇣25.12%, ...
// * Top 10 score drops: #89 ⇣6.34, #93 ⇣4.61, #167 ⇣4.40, ...
function goodAndBads(
  moves,
  goodmovewinrate,
  badmovewinrate,
  badhotspotwinrate,
) {
  const total = moves[6].length;
  return (
    getDropList(
      `Less than ${goodmovewinrate * 100}% win rate drops`,
      moves[0],
      total,
      false,
    ) +
    getDropList(
      `Less than ${badmovewinrate * 100}% win rate drops`,
      moves[1],
      total,
      false,
    ) +
    getDropList(
      `More than ${badmovewinrate * 100}% win rate drops`,
      moves[2],
      total,
      true,
    ) +
    getDropList(
      `More than ${badhotspotwinrate * 100}% win rate drops`,
      moves[3],
      total,
      true,
    ) +
    getDropList('Top 10 win rate drops', moves[4], null, true) +
    getDropList('Top 10 score drops', moves[5], null, true, true)
  );
}

function colorPL(pl, color) {
  if (pl) return `${pl} (${color})`;
  return color;
}

// Generates report.
function reportGame(stat) {
  // Handles SGF dialect (KO/TE/RD).
  let km = sgfconv.getAnyOfProperties(stat.root, ['KM', 'KO']);
  km = km ? `Komi ${km}` : km;
  const ev = sgfconv.getAnyOfProperties(stat.root, ['EV', 'TE', 'GN']);
  const dt = sgfconv.getAnyOfProperties(stat.root, ['DT', 'RD']);

  const re = sgfconv.valueFromSequence(stat.root, 'RE');
  const title = [ev, km, re, dt].filter((v) => v).join(', ');

  const pb = colorPL(sgfconv.valueFromSequence(stat.root, 'PB'), 'Black');
  const pw = colorPL(sgfconv.valueFromSequence(stat.root, 'PW'), 'White');

  return (
    `# Analyze-SGF Report\n\n${title}` +
    `\n\n${pb}\n${goodAndBads(
      makeGoodBads('B', stat),
      stat.goodmovewinrate,
      stat.badmovewinrate,
      stat.badhotspotwinrate,
    )}\n${pw}\n${goodAndBads(
      makeGoodBads('W', stat),
      stat.goodmovewinrate,
      stat.badmovewinrate,
      stat.badhotspotwinrate,
    )}\nAnalyzed by KataGo Parallel Analysis Engine ` +
    `(${stat.visits} max visits).`
  );
}

// e.g.
// * Blacks more than 5% win rate drop: #117 ⇣14.99%, #127 ⇣11.81%, ...
// * Blacks more than 20% win rate drop: #129 ⇣30.29%
function badsLeft(stat, pl, turnNumber) {
  const goodbads = makeGoodBads(pl, stat);
  const color = pl === 'B' ? 'Black' : 'White';
  return (
    getDropList(
      `${color} bad moves`,
      goodbads[2].filter((m) => m.index > turnNumber),
      null,
      true,
    ) +
    getDropList(
      `${color} bad hot spots`,
      goodbads[3].filter((m) => m.index > turnNumber),
      null,
      true,
    )
  );
}

// Generates bad moves left report.
function reportBadsLeft(stat, turnNumber) {
  const report =
    badsLeft(stat, 'B', turnNumber) + badsLeft(stat, 'W', turnNumber);
  if (report.length !== 0) {
    return `Bad moves left\n\n${report}`;
  }
  return '';
}

// Gets file name from SGF
//
// e.g.
// [제22회 농심배 13국, 2021-02-25] 커제 vs 신진서 (185수 흑불계승).sgf
function prettyPath(sgf) {
  let ev = sgfconv.getAnyOfProperties(sgf, ['EV', 'TE', 'GN']);
  // Repalces it for bad format of Tygem.
  ev = ev.replace(' .', '');
  const dt = sgfconv.getAnyOfProperties(sgf, ['DT', 'RD']);
  ev = [ev, dt].join(', ');
  if (ev) ev = `[${ev}]`;

  let players = '';
  // Repalces it for bad format of Tygem.
  const pw = sgfconv.valueFromSequence(sgf, 'PW').replace(/:.*/, '');
  const pb = sgfconv.valueFromSequence(sgf, 'PB').replace(/:.*/, '');
  if (pw && pb) players = `${pw} vs ${pb}`;

  let re = sgfconv.valueFromSequence(sgf, 'RE').replace(/:.*/, '');
  if (re) re = `(${re})`;

  return `${[ev, players, re].filter((v) => v).join(' ')}.sgf`;
}

module.exports = { reportGame, reportBadsLeft, prettyPath };
