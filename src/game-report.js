/**
 * @fileOverview Generates the game report on players info, good moves,
 *               bad moves, and bad hot spots.
 */

const sgfconv = require('./sgfconv');

// FIXME: access to private members of GameTree.
class GameReport {
  constructor(gametree) {
    this.root = gametree.root;
    this.goodmovewinrate = gametree.opts.maxWinrateDropForGoodMove / 100;
    this.badmovewinrate = gametree.opts.minWinrateDropForBadMove / 100;
    this.badhotspotwinrate = gametree.opts.minWinrateDropForBadHotSpot / 100;
    this.visits = gametree.maxVisits;

    const drops = gametree.nodes.map((node, index) => ({
      index,
      pl: node.pl,
      winrateDrop: node.winrateDrop,
      scoreDrop: node.scoreDrop,
    }));

    this.goodBads = {
      B: makeGoodBads('B', drops, this),
      W: makeGoodBads('W', drops, this),
    };
  }

  // Generates game report.
  reportGame() {
    if (this.report) return this.report;

    // Handles SGF dialect (KO/TE/RD).
    let km = sgfconv.getAnyOfProperties(this.root, ['KM', 'KO']);
    km = km ? `Komi ${km}` : km;
    const ev = sgfconv.getAnyOfProperties(this.root, ['EV', 'TE', 'GN']);
    const dt = sgfconv.getAnyOfProperties(this.root, ['DT', 'RD']);

    const re = sgfconv.valueFromSequence(this.root, 'RE');
    const game = [ev, km, re, dt].filter((v) => v).join(', ');

    const pb = colorPL(sgfconv.valueFromSequence(this.root, 'PB'), 'Black');
    const pw = colorPL(sgfconv.valueFromSequence(this.root, 'PW'), 'White');

    this.report =
      `# Analyze-SGF Report\n\n${game}` +
      `\n\n${pb}\n${reportPlayer(this.goodBads.B, this)}` +
      `\n${pw}\n${reportPlayer(this.goodBads.W, this)}` +
      `\nAnalyzed by KataGo Parallel Analysis Engine ` +
      `(${this.visits} max visits).`;

    return this.report;
  }

  // Generates 'Bad moves left' report.
  reportBadsLeft(turnNumber) {
    const report =
      getBadsLeft('B', this.goodBads.B, turnNumber) +
      getBadsLeft('W', this.goodBads.W, turnNumber);
    if (report) return `Bad moves left\n\n${report}`;
    return '';
  }
}

function makeGoodBads(pl, drops, stat) {
  return [
    // 0: Good moves.
    drops.filter((n) => n.pl === pl && n.winrateDrop < stat.goodmovewinrate),
    // 1: Not bad moves.
    drops.filter((n) => n.pl === pl && n.winrateDrop < stat.badmovewinrate),
    // 2: Bad moves.
    drops.filter((n) => n.pl === pl && n.winrateDrop >= stat.badmovewinrate),
    // 3: Bad hot spots.
    drops.filter(
      (n) => n.pl === pl && n.winrateDrop >= stat.badhotspotwinrate,
    ),
    // 4: Top 10 win rate drops.
    drops
      .filter((n) => n.pl === pl && n.winrateDrop)
      .sort((a, b) => b.winrateDrop - a.winrateDrop)
      .slice(0, 10),
    // 5: Top 10 score drops.
    drops
      .filter((n) => n.pl === pl && n.scoreDrop)
      .sort((a, b) => b.scoreDrop - a.scoreDrop)
      .slice(0, 10),
    // 6: Total.
    drops.filter((n) => n.pl === pl),
  ];
}

const percents = (f) => (f * 100).toFixed(2);

// e.g.:
// * More than 5% win rate drops (5.56%, 5/90): #79 ⇣9.20%, #83 ⇣8.49%, ...
function getDropList(text, moves, total, listMoves, isScore) {
  if (!moves.length) {
    return '';
  }

  let format = `* ${text}`;
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
function reportGoodAndBads(
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

function reportPlayer(goodBads, stat) {
  return reportGoodAndBads(
    goodBads,
    stat.goodmovewinrate,
    stat.badmovewinrate,
    stat.badhotspotwinrate,
  );
}

// e.g.
// * Blacks bad moves: #117 ⇣14.99%, #127 ⇣11.81%, ...
// * Blacks bad hot spots: #129 ⇣30.29%
function getBadsLeft(pl, goodBads, turnNumber) {
  const color = pl === 'B' ? 'Black' : 'White';
  return (
    getDropList(
      `${color} bad moves`,
      goodBads[2].filter((m) => m.index > turnNumber),
      null,
      true,
    ) +
    getDropList(
      `${color} bad hot spots`,
      goodBads[3].filter((m) => m.index > turnNumber),
      null,
      true,
    )
  );
}

module.exports = GameReport;
