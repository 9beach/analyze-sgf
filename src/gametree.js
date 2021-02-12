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
    // * pls[0] is the first move player.
    // * Adds responses[0].moveInfos to nodes[0].variations.
    // * Sets responses[1].rootInfo to nodes[0];
    // * responses[0].rootInfo is useless.
    let prevjson = undefined;
    this.maxvisits = 0;

    // Sets win rates and add PVs.
    responses.forEach((response) => {
      const curjson = JSON.parse(response);
      const { turnNumber } = curjson;
      const curturn = turnNumber - 1;
      const nextturn = curturn + 1;
      const prevturn = (prevjson ? prevjson.turnNumber - 1 : undefined);

      this.maxvisits = Math.max(curjson.rootInfo.visits, this.maxvisits);

      // Sets win rates to move (turnNumber - 1).
      if (curturn >= 0) {
        const node = this.nodes[curturn];
        if (curturn === prevturn + 1) {
          node.setWinrate(prevjson.rootInfo, curjson.rootInfo, this.opts);
        } else {
          node.setWinrate(null, curjson.rootInfo, this.opts);
        }
      }

      const nextPL = pls[nextturn % 2];

      // To add PVs after last move. Adds pass move (B[], or W[]), and
      // then adds PVs.
      if (this.lastmovevariations && this.nodes.length === nextturn) {
        this.nodes.push(new Node(`${nextPL}[]`));
      }

      // Adds variations to the next move.
      if (
        (this.lastmovevariations || nextturn < this.nodes.length) &&
        (!this.turnsgiven || this.turns.indexOf(nextturn) !== -1)
      ) {
        this.nodes[nextturn].variations = [];
        const { variations } = this.nodes[nextturn];

        curjson.moveInfos.some((moveInfo) => {
          const variation = new Node(
            sgfconv.katagomoveinfoToSequence(nextPL, moveInfo),
          );

          variation.setWinrate(curjson.rootInfo, moveInfo, this.opts);

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

    // Accumulates nodes and tails (variations).
    let last = true;
    this.sgf = this.nodes.reduceRight((acc, node) => {
      let tail = '';

      if (node.variations) {
        if (
          this.turnsgiven ||
          this.badmoveonlyvariations === false ||
          node.winrateLoss > this.variationwinrate ||
          (last && this.lastmovevariations)
        ) {
          last = false;
          tail += node.variations.reduce(
            (sum, variation) => sum + variation.sequence,
            '',
          );
        }
      }

      if (tail !== '') {
        return `(;${node.sequence}${acc})${tail}`;
      }
      return `;${node.sequence}${acc}`;
    }, '');

    if (this.responsesgiven) {
      this.setRootComment();
    }
    this.sgf = `(${this.root}${this.sgf})`;

    return this.sgf;
  }

  // Sets players info, total good moves, bad moves, ... to this.rootComment
  // and this.root.
  setRootComment() {
    if (this.rootComment) {
      return;
    }
    if (this.turnsgiven) {
      this.rootComment = '';
      return;
    }

    // Counts good moves, bad moves, and bad hotspots.
    // 0: Good, 1: bad, and 2: bad hotspots.
    const blackgoodbads = [[], [], []];
    const whitegoodbads = [[], [], []];

    function addtoblackorwhite(pl, index, num) {
      if (pl === 'B') {
        blackgoodbads[index].push(num);
      } else {
        whitegoodbads[index].push(num);
      }
    }

    this.nodes.forEach((node, i) => {
      const { pl } = node;

      if (node.winrateLoss < this.goodmovewinrate) {
        addtoblackorwhite(pl, 0, i);
      } else if (node.winrateLoss > this.badmovewinrate) {
        addtoblackorwhite(pl, 1, i);
        if (node.winrateLoss > this.badhotspotwinrate) {
          addtoblackorwhite(pl, 2, i);
        }
      }
    });

    // Makes report, i.e. root comment.
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

    this.root = sgfconv.addComment(this.root, this.rootComment);
  }
}

module.exports = GameTree;
