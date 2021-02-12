/**
 * @fileOverview GameTree data structure. Please see
 *               <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

const report = require('./report-game');
const sgfconv = require('./sgfconv');
const Node = require('./node');

// Contains RootNode (this.root) and NodeSequnce (this.nodes).
class GameTree {
  constructor(sgf, katagoResponses, sgfOpts) {
    const rootsequence = sgfconv.rootsequenceFromSGF(sgf);

    this.root = rootsequence.root;
    this.nodes = [];
    this.opts = sgfOpts;

    // Makes long option names short.
    this.goodmovewinrate = sgfOpts.maxWinrateLossForGoodMove / 100;
    this.badmovewinrate = sgfOpts.minWinrateLossForBadMove / 100;
    this.badhotspotwinrate = sgfOpts.minWinrateLossForBadHotSpot / 100;
    this.variationwinrate = sgfOpts.minWinrateLossForVariations / 100;
    this.badvariations = sgfOpts.showBadVariations;
    this.turnsgiven = sgfOpts.analyzeTurnsGiven;
    this.turns = sgfOpts.analyzeTurns;
    this.maxvariations = sgfOpts.maxVariationsForEachMove;
    this.lastmovevariations = sgfOpts.showVariationsAfterLastMove;
    this.badmoveonlyvariations = sgfOpts.showVariationsOnlyForBadMove;

    // First, gets root node and tailless main sequence from sgf.
    let left = rootsequence.sequence;
    let start = -1;

    for (;;) {
      start = left.search(/;[BW]\[/);
      if (start === -1) {
        break;
      }
      const index = left.indexOf(']', start);
      this.nodes.push(new Node(left.substring(start + 1, index + 1)));

      left = left.substring(start + 3, left.length);
    }

    // Second, fills win rates and variations from KataGo analysis.
    this.fromKataGoResponses(katagoResponses, sgfconv.getPLs(rootsequence));
  }

  // From KataGo analysis, fills win rates and variations.
  fromKataGoResponses(katagoresponses, pls) {
    // Checks KataGo error response.
    if (
      katagoresponses.search('{"error":"') === 0 ||
      katagoresponses.search('{"warning":') === 0
    ) {
      throw Error(`KataGo error: ${katagoresponses}`);
    }

    let responses = katagoresponses.split('\n');
    if (responses[responses.length - 1] === '')
      responses = responses.slice(0, responses.length - 1);

    if (responses.length) {
      this.responsesgiven = true;
    }

    // Sorts responses by turnNumber.
    //
    // Response format: '{"id":"Q","isDuringSearch..."turnNumber":3}'
    const turnnumber = (a) => parseInt(a.replace(/.*:/, ''), 10);
    responses.sort((a, b) => turnnumber(a) - turnnumber(b));

    // Notice that:
    // - pls -> pls[0] is the first move player.
    // - moves, nodes -> moves[0] is the first move.
    // - curjson.turnNumber -> 0, for the variations for the first move.
    // - curjson.turnNumber -> 1, for the first move info.
    // - turnNumber 0 -> pl 'W', nextPL 'B'
    let prevjson = null;
    this.maxvisits = 0;

    responses.forEach((response) => {
      const curjson = JSON.parse(response);
      // turnNumber - 1 is current node.
      const { turnNumber } = curjson;

      this.maxvisits = Math.max(curjson.rootInfo.visits, this.maxvisits);

      // Sets win rates to move (turnNumber - 1).
      if (turnNumber !== 0) {
        if (prevjson != null && turnNumber - 1 === prevjson.turnNumber) {
          this.nodes[turnNumber - 1].setWinrate(
            prevjson.rootInfo,
            curjson.rootInfo,
          );
        } else {
          this.nodes[turnNumber - 1].setWinrate(null, curjson.rootInfo);
        }
        this.nodes[turnNumber - 1].setProperties(this.opts);
      }

      const nextPL = pls[turnNumber % 2];

      // To add PVs after last move. We add pass move (B[], or W[]), and
      // then add PVs.
      if (this.lastmovevariations && this.nodes.length === turnNumber) {
        this.nodes.push(new Node(`${nextPL}[]`));
      }

      // Adds variations to next pl.
      if (
        (this.lastmovevariations || turnNumber !== this.nodes.length) &&
        (!this.turnsgiven || this.turns.indexOf(turnNumber) !== -1)
      ) {
        this.nodes[turnNumber].variations = [];
        const { variations } = this.nodes[turnNumber];

        curjson.moveInfos.some((moveInfo) => {
          const variation = new Node(
            sgfconv.katagomoveinfoToSequence(nextPL, moveInfo),
          );

          variation.setWinrate(curjson.rootInfo, moveInfo);
          variation.setProperties(this.opts);

          if (
            this.badvariations === true ||
            this.goodmovewinrate > variation.winrateLoss
          ) {
            if (variations.length < this.maxvariations) {
              variations.push(variation);
            }
          }
          return variations.length >= this.maxvariations;
        });
      }
      prevjson = curjson;
    });

    // FIXME: Remove last move if have no variations.
  }

  getRootComment() {
    return this.rootComment;
  }

  // Makes SGF GameTree, and returns it.
  getSGF() {
    if (this.sgf) {
      return this.sgf;
    }

    this.sgf = '';

    // 0: Good, 1: bad, and 2: bad hot spots.
    const blackgoodbads = [[], [], []];
    const whitegoodbads = [[], [], []];

    for (let i = this.nodes.length - 1; i >= 0; i -= 1) {
      const node = this.nodes[i];
      const { pl } = node;
      let tail = '';

      // Counts bad moves for root comment
      if (node.winrateLoss < this.goodmovewinrate) {
        if (pl === 'B') {
          blackgoodbads[0].push(i);
        } else {
          whitegoodbads[0].push(i);
        }
      }
      if (node.winrateLoss > this.badmovewinrate) {
        if (pl === 'B') {
          blackgoodbads[1].push(i);
        } else {
          whitegoodbads[1].push(i);
        }
      }
      if (node.winrateLoss > this.badhotspotwinrate) {
        if (pl === 'B') {
          blackgoodbads[2].push(i);
        } else {
          whitegoodbads[2].push(i);
        }
      }

      // Adds variations.
      //
      // If winrateLoss of a node is bigger than minWinrateLossForVariations,
      // add variations.
      if (node.variations) {
        if (
          node.winrateLoss > this.variationwinrate ||
          this.badmoveonlyvariations === false ||
          this.turnsgiven ||
          (i === this.nodes.length - 1 && this.lastmovevariations)
        ) {
          tail += node.variations.reduce((acc, cur) => acc + cur.sequence, '');
        }
      }

      if (tail !== '') {
        this.sgf = `(;${node.sequence}${this.sgf})${tail}`;
      } else {
        this.sgf = `;${node.sequence}${this.sgf}`;
      }
    }

    if (this.responsesgiven) {
      this.root = sgfconv.addComment(
        this.root,
        this.setRootComment(blackgoodbads, whitegoodbads),
      );
    }

    this.sgf = `(${this.root}${this.sgf})`;

    return this.sgf;
  }

  // Sets players info, total good moves, bad moves, ... to root comment, and
  // returns it.
  setRootComment(blackgoodbads, whitegoodbads) {
    if (this.rootComment) {
      return this.rootComment;
    }
    if (this.turnsgiven) {
      this.rootComment = '';
      return this.rootComment;
    }

    const blackplayer = sgfconv.valueFromSequence('PB', this.root);
    const blacktotal = this.nodes.reduce(
      (acc, cur) => acc + (cur.sequence[0] === 'B' ? 1 : 0),
      0,
    );
    const whiteplayer = sgfconv.valueFromSequence('PW', this.root);
    const whitetotal = this.nodes.length - blacktotal;

    this.rootComment = report(
      blackplayer,
      blacktotal,
      blackgoodbads,
      whiteplayer,
      whitetotal,
      whitegoodbads,
      this.goodmovewinrate,
      this.badmovewinrate,
      this.badhotspotwinrate,
      this.variationwinrate,
      this.maxvariations,
      this.maxvisits,
    );

    return this.rootComment;
  }
}

module.exports = GameTree;
