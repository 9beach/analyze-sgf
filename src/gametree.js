/**
 * @fileOverview GameTree data structure.
 *               Please see <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

/* eslint no-param-reassign: ["error", { "props": false }] */

const sgfconv = require('./sgfconv');
const Tail = require('./tail');
const NodeSequence = require('./node-sequence');
const GameReport = require('./game-report');

// Carries a SGF RootNode (this.root) and Tail array (this.nodes).
class GameTree {
  constructor(sgf, katagoResponses, opts) {
    const rootsequence = sgfconv.rootsequenceFromSGF(
      // Fixs SGF dialect (KO/TE/RD) for other SGF editors.
      sgf
        .replace(/\bTE\[/, 'EV[')
        .replace(/\bRD\[/, 'DT[')
        .replace(/\bK[OM]\[\]/, '')
        .replace(/\bKO\[/, 'KM['),
    );

    this.opts = opts;
    this.comment = '';

    // Gets root node and main sequence from SGF.
    this.root = rootsequence.root;
    this.nodes = rootsequence.sequence
      .split(';')
      .filter((node) => node.search(/[BW]\[[^\]]/) === 0)
      .map(
        (node, index) =>
          new Tail(`;${node.substring(0, 5)}`, `Move ${index + 1}`),
      );

    // Gets variations and comments from KataGo responses.
    const pls = getPLs(rootsequence);
    setWinrateAndVariatons(this, katagoResponses, pls);
    setReports(this);
  }

  getReport() {
    return this.report;
  }

  // Makes SGF GameTree, and returns it.
  //
  // To understand the logic below, please read
  // <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
  getSGF() {
    if (this.sgf) {
      return this.sgf;
    }

    // Accumulates node and tail (variations).
    this.sgf = this.nodes.reduceRight((acc, cur) => {
      const tail = cur.getTailSGF(this.opts);
      if (tail) return `\n(${cur.getSGF()}${acc})${tail}`;
      return `\n${cur.getSGF()}${acc}`;
    }, '');

    this.sgf = `(${this.root}${this.sgf})`;

    return this.sgf;
  }
}

// Sets win rate and variations from KataGo responses.
function setWinrateAndVariatons(that, katagoResponses, pls) {
  if (katagoResponses.search('{"error":"') === 0) {
    throw Error(katagoResponses.replace('\n', ''));
  }

  let responses = katagoResponses.split('\n');
  if (!responses[responses.length - 1])
    responses = responses.slice(0, responses.length - 1);

  if (responses.length) that.responsesGiven = true;

  // Sorts responses by turnNumber.
  //
  // Response format: '{"id":"Q","isDuringSearch..."turnNumber":3}'
  const getTurnNumber = (a) => parseInt(a.replace(/.*:/, ''), 10);
  responses.sort((a, b) => getTurnNumber(a) - getTurnNumber(b));

  // Notice that:
  // * responses.length === nodes.length + 1
  // * Sets responses[0].moveInfos (variations) to nodes[0].variations.
  // * Sets responses[1].rootInfo (win rate info) to nodes[0].
  // * responses[0].rootInfo is useless.
  // * To add moveInfos (proposed variations) of the last response, we need
  //   to add the node of passing move (B[] or W[]) to that.nodes, and
  //   then we can add moveInfos to the node.
  //
  // KataGo's moveInfos (variations) of turnNumber is for the variations of
  // node[turnNumber], but KataGo's rootInfo (win rate info) of turnNumber
  // is for node[turnNumber - 1]. So we refer to (turnNumber - 1) as curTurn,
  // and refert to turnNumber as nextTurn.
  let prevJSON;
  that.maxVisits = 0;

  responses.forEach((response) => {
    const curJSON = JSON.parse(response);
    // Skips warning.
    if (curJSON.warning) {
      return;
    }
    const { turnNumber } = curJSON;
    const curTurn = turnNumber - 1;
    const nextTurn = turnNumber;
    const prevTurn = prevJSON ? prevJSON.turnNumber - 1 : undefined;
    const nextPL = pls[nextTurn % 2];

    that.maxVisits = Math.max(curJSON.rootInfo.visits, that.maxVisits);

    // Sets win rate.
    if (curTurn >= 0) {
      const node = that.nodes[curTurn];
      if (curTurn === prevTurn + 1) {
        // To calculate node.winrateDrop, we need both of
        // prevJSON.rootInfo.winrate and curJSON.rootInfo.winrate.
        node.setWinrate(prevJSON.rootInfo, curJSON.rootInfo, that.opts);
      } else {
        node.setWinrate(null, curJSON.rootInfo, that.opts);
      }
    }

    // Adds passing move if necessary.
    if (
      that.opts.showVariationsAfterLastMove &&
      that.nodes.length === nextTurn
    ) {
      that.nodes.push(new Tail(`;${nextPL}[]`));
    }

    // Sets variations.
    if (
      nextTurn < that.nodes.length &&
      (!that.opts.analyzeTurns ||
        that.opts.analyzeTurns.indexOf(nextTurn) !== -1)
    ) {
      that.nodes[nextTurn].setVariations(
        variationsFromResponse(that, curJSON, nextPL, nextTurn),
      );
    }
    prevJSON = curJSON;
  });
  // FIXME: Remove passing move if has no variation.
}

// Does not care about winrateDrop of the turn. Only cares winrateDrops of the
// variations.
function variationsFromResponse(that, response, pl, turn) {
  return response.moveInfos
    .map(
      (moveInfo) =>
        new NodeSequence(
          sgfconv.katagomoveinfoToSequence(pl, moveInfo),
          `A variation of move ${turn + 1}`,
          response.rootInfo,
          moveInfo,
          that.opts,
        ),
    )
    .filter(
      (v) =>
        that.opts.showBadVariations === true ||
        that.opts.maxWinrateDropForGoodMove / 100 > v.winrateDrop,
    )
    .slice(0, that.opts.maxVariationsForEachMove);
}

// Sets the report of the game and each node.
function setReports(that) {
  if (!that.responsesGiven || that.report) return;

  // Game report for root comment.
  const r = new GameReport(that);

  that.report = r.reportGame();
  that.root = sgfconv.addComment(
    that.root,
    that.report,
    that.root.length - 1,
  );

  // 'Bad moves left' report for each node.
  that.nodes.forEach((node, index) => {
    node.setReport(r.reportBadsLeft(index));
  });
}

// rootsequence => [ 'B', 'W' ] or [ 'W', 'B' ]
function getPLs(rootsequence) {
  const { root, sequence } = rootsequence;
  const pls = [];

  const index = sequence.search(/\b[BW]\[/);
  if (index !== -1) {
    pls.push(sequence[index]);
  } else if (sgfconv.valueFromSequence(root, 'PL')) {
    pls.push(sgfconv.valueFromSequence(root, 'PL'));
  } else {
    pls.push('B');
  }

  if (pls[0] === 'W') pls.push('B');
  else pls.push('W');

  return pls;
}

module.exports = GameTree;
