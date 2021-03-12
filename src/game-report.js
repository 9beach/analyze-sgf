/**
 * @fileOverview Generates the game report on players info, good moves,
 *               bad moves, and bad hot spots.
 */

// FIXME: Accesses private members of GameTree.
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
      choice: node.choice,
    }));

    this.goodBads = {
      B: makeGoodBads('B', drops, this),
      W: makeGoodBads('W', drops, this),
    };
  }

  // Generates game report.
  reportGame() {
    if (this.report) return this.report;

    const ofRoot = (key) => this.root[key] && this.root[key][0].trim();

    const ev = ofRoot('EV') || ofRoot('GN');
    const km = ofRoot('KM') ? `Komi ${ofRoot('KM')}` : '';
    const re = ofRoot('RE');
    const dt = ofRoot('DT');
    const game = [ev, km, re, dt].filter((v) => v).join(', ');
    const title = game ? `\n${game}\n` : '';

    const pb = plColor(ofRoot('PB'), 'Black');
    const pw = plColor(ofRoot('PW'), 'White');

    const reportPlayer = (goodBads, that) =>
      reportGoodAndBads(
        goodBads,
        that.goodmovewinrate,
        that.badmovewinrate,
        that.badhotspotwinrate,
      );

    this.report =
      `# Analyze-SGF Report\n${title}` +
      `\n${pb}\n${reportPlayer(this.goodBads.B, this)}` +
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
    // 7: KataGo Top Choices.
    drops.filter((n) => n.pl === pl && n.choice === 0),
    // 8: KataGo Choices.
    drops.filter((n) => n.pl === pl && n.choice >= 0),
  ];
}

const percents = (f) => (f * 100).toFixed(2);

// e.g.,:
// * More than 5% win rate drops (5.56%, 5/90): #79 ⇣9.20%, #83 ⇣8.49%, ...
function getDropList(text, moves, total, listMoves, withDrop, isScore) {
  if (!moves.length) return '';
  return [
    `* ${text}`,
    total
      ? ` (${percents(moves.length / total)}%, ${moves.length}/${total})`
      : '',
    listMoves ? ': ' : '',
    listMoves && isScore && withDrop
      ? moves
          .map((m) => `#${m.index + 1} ⇣${m.scoreDrop.toFixed(2)}`)
          .join(', ')
      : '',
    listMoves && !isScore && withDrop
      ? moves
          .map((m) => `#${m.index + 1} ⇣${percents(m.winrateDrop)}%`)
          .join(', ')
      : '',
    listMoves && !withDrop
      ? moves.map((m) => `#${m.index + 1}`).join(', ')
      : '',
    '\n',
  ].join('');
}

// e.g.,:
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
  const goodmove = `Less than ${goodmovewinrate * 100}% win rate drops`;
  const notbadmove = `Less than ${badmovewinrate * 100}% win rate drops`;
  const badmove = `More than ${badmovewinrate * 100}% win rate drops`;
  const badhotspot = `More than ${badhotspotwinrate * 100}% win rate drops`;
  return (
    getDropList('KataGo top choices', moves[7], total, false) +
    getDropList('KataGo choices', moves[8], total, false) +
    getDropList(goodmove, moves[0], total, false) +
    getDropList(notbadmove, moves[1], total, false) +
    getDropList(badmove, moves[2], total, true, true) +
    getDropList(badhotspot, moves[3], total, true, true) +
    getDropList('Top 10 win rate drops', moves[4], null, true, true) +
    getDropList('Top 10 score drops', moves[5], null, true, true, true)
  );
}

function plColor(pl, color) {
  if (pl) return `${pl} (${color})`;
  return color;
}

// e.g.,
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
      true,
    ) +
    getDropList(
      `${color} bad hot spots`,
      goodBads[3].filter((m) => m.index > turnNumber),
      null,
      true,
      true,
    )
  );
}

module.exports = GameReport;
