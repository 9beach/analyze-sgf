/**
 * @fileOverview GameTree data structure. Please see
 *               <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

const sgfconv = require('./sgfconv');
const Node = require('./node');
const { reportGame, reportBadsLeft } = require('./report-game');

// Contains RootNode (this.root) and NodeSequnce (this.nodes).
class GameTree {
  constructor(sgf, katagoresponses, opts) {
    const rootsequence = sgfconv.rootsequenceFromSGF(sgf);

    this.root = rootsequence.root;
    this.opts = opts;
    this.comment = '';

    // Makes long option names short.
    this.goodmovewinrate = opts.maxWinrateDropForGoodMove / 100;
    this.badmovewinrate = opts.minWinrateDropForBadMove / 100;
    this.badhotspotwinrate = opts.minWinrateDropForBadHotSpot / 100;
    this.variationwinrate = opts.minWinrateDropForVariations / 100;

    // Gets root node and tailless main sequence from sgf.
    this.nodes = rootsequence.sequence
      .split(';')
      .filter((node) => node.search(/[BW]\[[^\]]/) === 0)
      .map(
        (node, index) => new Node(node.substring(0, 5), `Move ${index + 1}`),
      );

    // Fills win rates and variations of this.nodes.
    fromKataGoResponses(this, katagoresponses, sgfconv.getPLs(rootsequence));

    // Updates comment mostly related to winrates.
    updateComment(this);
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
          tail += node.variations.reduce(
            (acc, cur) => acc + cur.get(),
            '',
          );
        }
      }

      if (tail !== '') {
        return `\n(;${node.get()}${acc})${tail}`;
      }
      return `\n;${node.get()}${acc}`;
    }, '');

    this.sgf = `(${this.root}${this.sgf})`;

    return this.sgf;
  }
}

/* eslint no-param-reassign: ["error", { "props": false }] */

// Sets players info, total good moves, bad moves, ... to gametree.comment,
// gametree.root, and gametree.node.comment.
function updateComment(gametree) {
  if (!gametree.responsesgiven || gametree.comment !== '') return;

  // FIXME: Refactor me.
  //
  // 1. Makes game report (root comment).

  // Counts good moves, bad moves, and bad hotspots.
  // 0: Good, 1: bad, and 2: bad hotspots.
  const stat = {
    blackGoodBads: [[], [], []],
    whiteGoodBads: [[], [], []],
    root: gametree.root,
  };

  function addToBlackOrWhite(pl, index, num) {
    if (pl === 'B') stat.blackGoodBads[index].push(num);
    else stat.whiteGoodBads[index].push(num);
  }

  gametree.nodes.forEach((node, num) => {
    const { pl } = node;
    if (node.winrateDrop < gametree.goodmovewinrate) {
      addToBlackOrWhite(pl, 0, num);
    } else if (node.winrateDrop > gametree.badmovewinrate) {
      addToBlackOrWhite(pl, 1, num);
      if (node.winrateDrop > gametree.badhotspotwinrate) {
        addToBlackOrWhite(pl, 2, num);
      }
    }
  });

  stat.blacksTotal = gametree.nodes.reduce(
    (acc, cur) => acc + (cur.get()[0] === 'B' ? 1 : 0),
    0,
  );
  stat.whitesTotal = gametree.nodes.length - stat.blacksTotal;

  gametree.comment = reportGame(
    stat,
    gametree.goodmovewinrate,
    gametree.badmovewinrate,
    gametree.badhotspotwinrate,
    gametree.variationwinrate,
    gametree.opts.maxVariationsForEachMove,
    gametree.maxvisits,
  );

  gametree.root = sgfconv.addComment(
    gametree.root,
    gametree.comment,
    gametree.root.length - 2,
  );

  gametree.nodes.forEach((node, num) => {
    // 2. Adds PVs info to the comments of each nodes and variations.
    let comment = node.getComment();
    if (node.variations) {
      // PVs for each node.
      if (comment !== '') comment += '\n\n';
      comment += 'Proposed variations\n';
      node.variations.forEach((v, index) => {
        comment += `\n${index + 1}. ${v.formatPV()}`;
        // Sequence for each variation.
        let vcomment = v.getComment();
        vcomment += `\n* Sequence: ${v.formatPV()}`;
        v.setComment(vcomment);
      });
    }

    // 3. Adds 'Bad moves left' comment to each node.
    const report = reportBadsLeft(stat, num);
    if (comment !== '') {
      node.setComment(`${comment}\n\n${report}`);
    } else {
      node.setComment(comment + report);
    }
  });
}

// From KataGo responses, fills win rates and variations of this.nodes.
function fromKataGoResponses(gametree, katagoresponses, pls) {
  // Checks KataGo error response.
  if (katagoresponses.search('{"error":"') === 0) {
    throw Error(katagoresponses.replace('\n', ''));
  }

  let responses = katagoresponses.split('\n');
  if (responses[responses.length - 1] === '')
    responses = responses.slice(0, responses.length - 1);

  if (responses.length) gametree.responsesgiven = true;

  // Sorts responses by turnNumber.
  //
  // Response format: '{"id":"Q","isDuringSearch..."turnNumber":3}'
  const turnnumber = (a) => parseInt(a.replace(/.*:/, ''), 10);
  responses.sort((a, b) => turnnumber(a) - turnnumber(b));

  // Notice that:
  //
  // * responses.length === nodes.length + 1
  // * Adds responses[0].moveInfos to nodes[0].variations.
  // * To use moveInfos (preview variations) of the last response, we need
  //   to add the node of passing move (B[] or W[]) to gametree.nodes, and
  //   then we can add moveInfos to the node.
  // * Sets win rates info (responses[1].rootInfo) to nodes[0].
  // * responses[0].rootInfo is useless.
  //
  // KataGo's moveInfos (variations) of turnNumber is for the variations of
  // node[turnNumber], but KataGo's rootInfo (win rates info) of turnNumber
  // is for node[turnNumber - 1]. So we call (turnNumber - 1) curturn, and
  // call turnNumber nextturn.
  let prevjson;
  gametree.maxvisits = 0;

  // Sets win rates and add moveInfos (variations) to gametree.nodes.
  responses.forEach((response) => {
    const curjson = JSON.parse(response);
    // Skips warning.
    if (curjson.warning) {
      return;
    }
    const { turnNumber } = curjson;
    const curturn = turnNumber - 1;
    const nextturn = curturn + 1;
    const prevturn = prevjson ? prevjson.turnNumber - 1 : undefined;
    const nextpl = pls[nextturn % 2];

    gametree.maxvisits = Math.max(curjson.rootInfo.visits, gametree.maxvisits);

    // Sets win rates to gametree.nodes[curturn].
    if (curturn >= 0) {
      const node = gametree.nodes[curturn];
      if (curturn === prevturn + 1) {
        // To calculate node.winrateDrop, we need both of
        // prevjson.rootInfo.winrate and curjson.rootInfo.winrate.
        node.setWinrate(prevjson.rootInfo, curjson.rootInfo, gametree.opts);
      } else {
        node.setWinrate(null, curjson.rootInfo, gametree.opts);
      }
    }

    // For preview variations of last response, adds the node of passing
    // move (B[] or W[]) to gametree.nodes.
    if (
      gametree.opts.showVariationsAfterLastMove &&
      gametree.nodes.length === nextturn
    ) {
      gametree.nodes.push(new Node(`${nextpl}[]`, `Move ${curturn + 1}`));
    }

    // Adds variations to gametree.nodes[nextturn].
    if (
      nextturn < gametree.nodes.length &&
      (!gametree.opts.analyzeTurns ||
        gametree.opts.analyzeTurns.indexOf(nextturn) !== -1)
    ) {
      gametree.nodes[nextturn].variations = curjson.moveInfos
        .map((moveinfo) => {
          const variation = new Node(
            sgfconv.katagomoveinfoToSequence(nextpl, moveinfo),
            `A variation of move ${nextturn + 1}`,
          );

          variation.setWinrate(curjson.rootInfo, moveinfo, gametree.opts);
          return variation;
        })
        .filter(
          (variation) =>
            gametree.opts.showBadVariations === true ||
            gametree.goodmovewinrate > variation.winrateDrop,
        )
        .slice(0, gametree.opts.maxVariationsForEachMove);
    }
    prevjson = curjson;
  });
  // FIXME: Remove last move if have no variations.
}

module.exports = GameTree;
