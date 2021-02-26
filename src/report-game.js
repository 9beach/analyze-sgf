/**
 * @fileOverview Generates the game report on players info, good moves,
 *               bad moves, and bad hot spots.
 */

const sgfconv = require('./sgfconv');

const percents = (f) => (f * 100).toFixed(2);

function makeGoodBads(pl, stat) {
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
  // 4: Top 10 win rate drops.
  moves.push(
    stat.drops
      .filter((n) => n.pl === pl && n.winrateDrop)
      .sort((a, b) => b.winrateDrop - a.winrateDrop)
      .slice(0, 10),
  );
  // 5: Top 10 score drops.
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

function reportGoodAndBad(
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

function colorPL(player, color) {
  let pl = player;
  if (pl !== '') pl += ` (${color})`;
  else pl = `${color}`;
  return pl;
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

  return (
    `# Analyze-SGF Report\n\n${title}` +
    `\n\n${pb}\n${reportGoodAndBad(
      makeGoodBads('B', stat),
      stat.goodmovewinrate,
      stat.badmovewinrate,
      stat.badhotspotwinrate,
    )}\n${pw}\n${reportGoodAndBad(
      makeGoodBads('W', stat),
      stat.goodmovewinrate,
      stat.badmovewinrate,
      stat.badhotspotwinrate,
    )}\nAnalyzed by KataGo Parallel Analysis Engine ` +
    `(${stat.visits} max visits).`
  );
}

function badsLeft(stat, pl, turnNumber) {
  const goodbads = makeGoodBads(pl, stat);
  const color = pl === 'B' ? 'Black' : 'White';
  return (
    getDropList(
      `${color}s more than ${stat.badmovewinrate * 100}% win rate drop`,
      goodbads[2].filter((m) => m.index > turnNumber),
      null,
      true,
    ) +
    getDropList(
      `${color}s more than ${stat.badhotspotwinrate * 100}% win rate drop`,
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
    return `The moves left\n\n${report}`;
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
