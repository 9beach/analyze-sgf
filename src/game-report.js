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

    const evkmredt = [
      ofRoot('EV') || ofRoot('GN'),
      ofRoot('KM') ? `Komi ${ofRoot('KM')}` : '',
      ofRoot('RE'),
      ofRoot('DT'),
    ]
      .filter((v) => v)
      .join(', ');
    const title = evkmredt ? `\n${evkmredt}\n` : '';

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
    return report ? `Bad moves left\n\n${report}` : '';
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
// * KataGo top choices (54.81%, 57/104)
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
    getDropList(goodmove, moves[0], total, false) +
    getDropList(notbadmove, moves[1], total, false) +
    getDropList(badmove, moves[2], total, true, true) +
    getDropList(badhotspot, moves[3], total, true, true) +
    getDropList('Top 10 win rate drops', moves[4], null, true, true) +
    getDropList('Top 10 score drops', moves[5], null, true, true, true)
  );
}

function plColor(pl, color) {
  return pl ? `${pl} (${color})` : color;
}

// e.g.,
// * Blacks bad moves: #117 ⇣14.99%, #127 ⇣11.81%, ...
// * Blacks bad hot spots: #129 ⇣30.29%
function getBadsLeft(pl, goodBads, turnNumber) {
  const badmovesText = pl === 'B' ? 'Black bad moves' : 'White bad moves';
  const hotspotText = pl === 'B' ? 'Black bad hot spots' : 'White hot spots';
  const movesLeft = (i, turn) => goodBads[i].filter((m) => m.index > turn);
  return (
    getDropList(badmovesText, movesLeft(2, turnNumber), null, true, true) +
    getDropList(hotspotText, movesLeft(3, turnNumber), null, true, true)
  );
}

module.exports = GameReport;
