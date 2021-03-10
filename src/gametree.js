/**
 * @fileOverview GameTree data structure.
 *               Please see <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

/* eslint no-param-reassign: ["error", { "props": false }] */

const sgfconv = require('./sgfconv');
const katagoconv = require('./katagoconv');
const Tail = require('./tail');
const NodeSeq = require('./nodeseq');
const GameReport = require('./game-report');

// Carries a SGF RootNode (this.root) and Tail array (this.nodes).
class GameTree {
  constructor(sgf, katagoResponses, opts) {
    const rs = sgfconv.rootAndSeqFromSGF(sgf);

    this.opts = opts;

    // Gets root node and sequence from SGF.
    this.root = rs.root;
    this.nodes = rs.seq
      .split(';')
      .filter((node) => node.search(/\b[BW]\[/) !== -1)
      .map((node, index) => {
        const i = node.search(/\b[BW]\[/);
        return new Tail(`;${node.substring(i, i + 5)}`, `Move ${index + 1}`);
      });

    // Gets variations and winrates from KataGo responses.
    const pls = getPLs(rs);
    setWinrateAndVariatons(this, katagoResponses, pls);
    setReports(this);
  }

  getReport() {
    return (this.root.C && this.root.C[0]) || '';
  }

  // Makes SGF GameTree, and returns it.
  //
  // To understand the logic below, please read
  // <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
  getSGF() {
    if (this.sgf) return this.sgf;

    // Accumulates node and tail (variations).
    const seqtail = this.nodes.reduceRight((acc, cur) => {
      const tail = cur.getTailSGF(this.opts);
      if (tail) return `\n(${cur.getSGF()}${acc})${tail}`;
      return `\n${cur.getSGF()}${acc}`;
    }, '');

    this.sgf = `(${sgfconv.propsFromObject(this.root, true)}${seqtail})`;
    return this.sgf;
  }
}

// Splits and sorts responses by turnNumber.
//
// Response format: '{"id":"Q","isDuringSearch..."turnNumber":3}'
function splitResponses(that, katagoResponses) {
  if (katagoResponses.search('{"error":"') === 0) {
    throw Error(katagoResponses.replace('\n', ''));
  }

  const responses = katagoResponses.split('\n');
  if (!responses[responses.length - 1]) responses.pop();

  if (responses.length) that.responsesGiven = true;

  const getTurnNumber = (a) => parseInt(a.replace(/.*:/, ''), 10);
  return responses.sort((a, b) => getTurnNumber(a) - getTurnNumber(b));
}

// Sets win rate and variations from KataGo responses.
function setWinrateAndVariatons(that, katagoResponses, pls) {
  const responses = splitResponses(that, katagoResponses);

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
  that.maxVisits = responses.reduce(
    (acc, response) => {
      const curJSON = JSON.parse(response);
      // Skips warning.
      if (curJSON.warning) {
        return acc;
      }
      const { turnNumber } = curJSON;
      const curTurn = turnNumber - 1;
      const nextTurn = turnNumber;
      const prevTurn = acc.prevJSON ? acc.prevJSON.turnNumber - 1 : undefined;
      const nextPL = pls[nextTurn % 2];

      // Sets win rate.
      if (curTurn >= 0) {
        const node = that.nodes[curTurn];
        // To calculate node.winrateDrop, we need both of
        // prevJSON.rootInfo.winrate and curJSON.rootInfo.winrate.
        if (curTurn === prevTurn + 1)
          node.setWinrate(acc.prevJSON.rootInfo, curJSON.rootInfo, that.opts);
        else node.setWinrate(null, curJSON.rootInfo, that.opts);
      }

      // Adds passing move if necessary.
      if (
        that.opts.showVariationsAfterLastMove &&
        that.nodes.length === nextTurn
      )
        that.nodes.push(new Tail(`;${nextPL}[]`));

      // Sets variations.
      if (
        nextTurn < that.nodes.length &&
        (!that.opts.analyzeTurns ||
          that.opts.analyzeTurns.indexOf(nextTurn) !== -1)
      )
        that.nodes[nextTurn].setVariations(
          variationsFromResponse(that, curJSON, nextPL, nextTurn),
        );

      return {
        prevJSON: curJSON,
        maxVisits: Math.max(curJSON.rootInfo.visits, acc.maxVisits),
      };
    },
    { prevJSON: null, maxVisits: 0 },
  ).maxVisits;
  // FIXME: Remove passing move if has no variation.
}

// Does not care about winrateDrop of the turn. Only cares winrateDrops of the
// variations.
function variationsFromResponse(that, response, pl, turn) {
  return response.moveInfos
    .map(
      (moveInfo) =>
        new NodeSeq(
          katagoconv.seqFromKataGoMoveInfo(pl, moveInfo),
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
  that.root.C = [r.reportGame()];

  // 'Bad moves left' report for each node.
  that.nodes.forEach((node, index) => {
    node.setReport(r.reportBadsLeft(index));
  });
}

// rs => [ 'B', 'W' ] or [ 'W', 'B' ]
function getPLs(rs) {
  const { root, seq } = rs;
  const pls = [];

  const index = seq.search(/\b[BW]\[/);
  if (index !== -1) pls.push(seq[index]);
  else if (root.PL) pls.push(root.PL[0]);
  else pls.push('B');

  if (pls[0] === 'W') pls.push('B');
  else pls.push('W');

  return pls;
}

module.exports = GameTree;
