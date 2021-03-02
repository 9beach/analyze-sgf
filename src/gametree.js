/**
 * @fileOverview GameTree data structure. Please see
 *               <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

/* eslint no-param-reassign: ["error", { "props": false }] */

const sgfconv = require('./sgfconv');
const Node = require('./node');
const { reportGame, reportBadsLeft } = require('./report-game');

// Contains RootNode (this.root) and NodeSequnce (this.nodes).
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

    this.root = rootsequence.root;
    this.opts = opts;
    this.comment = '';

    // Makes long option names short.
    this.goodmovewinrate = opts.maxWinrateDropForGoodMove / 100;
    this.badmovewinrate = opts.minWinrateDropForBadMove / 100;
    this.badhotspotwinrate = opts.minWinrateDropForBadHotSpot / 100;
    this.variationwinrate = opts.minWinrateDropForVariations / 100;

    // Gets root node and main sequence from SGF.
    this.nodes = rootsequence.sequence
      .split(';')
      .filter((node) => node.search(/[BW]\[[^\]]/) === 0)
      .map(
        (node, index) => new Node(node.substring(0, 5), `Move ${index + 1}`),
      );

    const pls = sgfconv.getPLs(rootsequence);
    fillWinratesAndVarations(this, katagoResponses, pls);
    fillComments(this);
  }

  getComment() {
    return this.comment;
  }

  // Makes SGF GameTree, and returns it.
  //
  // To understand the logic below, you need to read
  // <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
  get() {
    if (this.sgf) {
      return this.sgf;
    }

    // Accumulates nodes and tails (variations).
    this.sgf = this.nodes.reduceRight((acc, node) => {
      const tails = node.getTails(this.opts);
      if (tails) return `\n(;${node.get()}${acc})${tails}`;
      return `\n;${node.get()}${acc}`;
    }, '');

    this.sgf = `(${this.root}${this.sgf})`;

    return this.sgf;
  }
}

// Fills win rates and variations of that.nodes from KataGo responses.
function fillWinratesAndVarations(that, katagoResponses, pls) {
  if (katagoResponses.search('{"error":"') === 0) {
    throw Error(katagoResponses.replace('\n', ''));
  }

  let responses = katagoResponses.split('\n');
  if (!responses[responses.length - 1])
    responses = responses.slice(0, responses.length - 1);

  if (responses.length) that.responsesgiven = true;

  // Sorts responses by turnNumber.
  //
  // Response format: '{"id":"Q","isDuringSearch..."turnNumber":3}'
  const getNumberFromJSON = (a) => parseInt(a.replace(/.*:/, ''), 10);
  responses.sort((a, b) => getNumberFromJSON(a) - getNumberFromJSON(b));

  // Notice that:
  // * responses.length === nodes.length + 1
  // * Sets responses[0].moveInfos (variations) to nodes[0].variations.
  // * Sets responses[1].rootInfo (win rates info) to nodes[0].
  // * responses[0].rootInfo is useless.
  // * To add moveInfos (proposed variations) of the last response, we need
  //   to add the node of passing move (B[] or W[]) to that.nodes, and
  //   then we can add moveInfos to the node.
  //
  // KataGo's moveInfos (variations) of turnNumber is for the variations of
  // node[turnNumber], but KataGo's rootInfo (win rates info) of turnNumber
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

    // 1. Sets win rates.
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

    // 2. Adds the node of passing move if necessary.
    if (
      that.opts.showVariationsAfterLastMove &&
      that.nodes.length === nextTurn
    ) {
      that.nodes.push(new Node(`${nextPL}[]`));
    }

    // 3. Adds variations.
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

function variationsFromResponse(that, response, pl, turn) {
  return response.moveInfos
    .map(
      (moveInfo) =>
        new Node(
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
        that.goodmovewinrate > v.winrateDrop,
    )
    .slice(0, that.opts.maxVariationsForEachMove);
}

// Fills the report of the game, and the comments of each node.
function fillComments(that) {
  if (!that.responsesgiven || that.comment) return;

  // 1. Makes game report (root comment).
  const stat = {
    root: that.root,
    drops: that.nodes.map((node, index) => ({
      index,
      pl: node.pl,
      winrateDrop: node.winrateDrop,
      scoreDrop: node.scoreDrop,
    })),
    goodmovewinrate: that.goodmovewinrate,
    badmovewinrate: that.badmovewinrate,
    badhotspotwinrate: that.badhotspotwinrate,
    visits: that.maxVisits,
  };

  that.comment = reportGame(stat);
  that.root = sgfconv.addComment(that.root, that.comment);

  that.nodes.forEach((node, num) => {
    let comment = node.getComment();
    // 2. Adds 'Bad moves left' comment to each node.
    const report = reportBadsLeft(stat, num);
    if (report) {
      comment += '\n';
      comment += report;
    }
    // 3. Adds PVs comment to each node.
    if (node.hasVariations()) {
      comment += '\nThe proposed variations\n\n';
      comment += node.getPVs();
    }
    node.setComment(comment);
  });
}

module.exports = GameTree;
