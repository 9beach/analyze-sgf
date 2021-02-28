/**
 * @fileOverview GameTree data structure. Please see
 *               <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

const sgfconv = require('./sgfconv');
const Node = require('./node');
const { reportGame, reportBadsLeft } = require('./report-game');

// Contains RootNode (this.root) and NodeSequnce (this.nodes).
class GameTree {
  constructor(sgf, katagoResponses, opts) {
    const rootsequence = sgfconv.rootsequenceFromSGF(sgf);

    this.root = rootsequence.root;
    this.opts = opts;
    this.comment = '';

    // Makes long option names short.
    this.goodmovewinrate = opts.maxWinrateDropForGoodMove / 100;
    this.badmovewinrate = opts.minWinrateDropForBadMove / 100;
    this.badhotspotwinrate = opts.minWinrateDropForBadHotSpot / 100;
    this.variationwinrate = opts.minWinrateDropForVariations / 100;

    // Gets root node and tailless main sequence from SGF.
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
    let last = true;
    this.sgf = this.nodes.reduceRight((acc, node) => {
      let tail = '';

      if (node.variations) {
        if (
          this.opts.analyzeTurns ||
          this.opts.showVariationsOnlyForBadMove === false ||
          node.winrateDrop > this.variationwinrate ||
          (last && this.opts.showVariationsAfterLastMove)
        ) {
          last = false;
          tail += node.variations.reduce((sum, cur) => sum + cur.get(), '');
        }
      }

      if (tail) {
        return `\n(;${node.get()}${acc})${tail}`;
      }
      return `\n;${node.get()}${acc}`;
    }, '');

    this.sgf = `(${this.root}${this.sgf})`;

    return this.sgf;
  }
}

// Fills win rates and variations of that.nodes from KataGo responses.
function fillWinratesAndVarations(that, katagoResponses, pls) {
  // FIXME: Refactor me.
  //
  // Checks KataGo error response.
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
  // * Adds responses[0].moveInfos to nodes[0].variations.
  // * To use moveInfos (preview variations) of the last response, we need
  //   to add the node of passing move (B[] or W[]) to that.nodes, and
  //   then we can add moveInfos to the node.
  // * Sets win rates info (responses[1].rootInfo) to nodes[0].
  // * responses[0].rootInfo is useless.
  //
  // KataGo's moveInfos (variations) of turnNumber is for the variations of
  // node[turnNumber], but KataGo's rootInfo (win rates info) of turnNumber
  // is for node[turnNumber - 1]. So we call (turnNumber - 1) curturn, and
  // call turnNumber nextturn.
  let prevJSON;
  that.maxvisits = 0;

  // Sets win rates and add moveInfos (variations) to that.nodes.
  responses.forEach((response) => {
    const curJSON = JSON.parse(response);
    // Skips warning.
    if (curJSON.warning) {
      return;
    }
    const { turnNumber } = curJSON;
    const curturn = turnNumber - 1;
    const nextturn = curturn + 1;
    const prevturn = prevJSON ? prevJSON.turnNumber - 1 : undefined;
    const nextPL = pls[nextturn % 2];

    that.maxvisits = Math.max(curJSON.rootInfo.visits, that.maxvisits);

    // Sets win rates to that.nodes[curturn].
    if (curturn >= 0) {
      const node = that.nodes[curturn];
      if (curturn === prevturn + 1) {
        // To calculate node.winrateDrop, we need both of
        // prevJSON.rootInfo.winrate and curJSON.rootInfo.winrate.
        node.setWinrate(prevJSON.rootInfo, curJSON.rootInfo, that.opts);
      } else {
        node.setWinrate(null, curJSON.rootInfo, that.opts);
      }
    }

    // For preview variations of last response, adds the node of passing
    // move (B[] or W[]) to that.nodes.
    if (
      that.opts.showVariationsAfterLastMove &&
      that.nodes.length === nextturn
    ) {
      that.nodes.push(new Node(`${nextPL}[]`, `Move ${curturn + 1}`));
    }

    // Adds variations to that.nodes[nextturn].
    if (
      nextturn < that.nodes.length &&
      (!that.opts.analyzeTurns ||
        that.opts.analyzeTurns.indexOf(nextturn) !== -1)
    ) {
      that.nodes[nextturn].variations = curJSON.moveInfos
        .map(
          (moveinfo) =>
            new Node(
              sgfconv.katagomoveinfoToSequence(nextPL, moveinfo),
              `A variation of move ${nextturn + 1}`,
              curJSON.rootInfo,
              moveinfo,
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
    prevJSON = curJSON;
  });
  // FIXME: Remove last move if have no variations.
}

/* eslint no-param-reassign: ["error", { "props": false }] */

// Fills the report of the game, and the comments of each node and variations.
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
    visits: that.maxvisits,
  };

  that.comment = reportGame(stat);
  that.root = sgfconv.addComment(that.root, that.comment);

  that.nodes.forEach((node, num) => {
    let comment = node.getComment();
    // 2. Adds 'Bad moves left' comment to each node.
    const report = reportBadsLeft(stat, num);
    if (report) {
      if (comment) comment += '\n';
      comment += report;
    }
    // 3. Adds PV comment to each node and variation.
    if (node.variations) {
      if (comment) comment += '\n';
      comment += 'The proposed variations\n\n';
      node.variations.forEach((v, index) => {
        // Adds PVs comment to each node.
        comment += `${index + 1}. ${v.formatPV()}\n`;
        // Adds a PV comment to each variation.
        let vcomment = v.getComment();
        vcomment += `* Sequence: ${v.formatPV().replace(/ \(.*/, '')}\n`;
        v.setComment(vcomment);
      });
    }
    node.setComment(comment);
  });
}

module.exports = GameTree;
