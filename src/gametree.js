/**
 * @fileOverview GameTree data structure. Please see
 *               <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

const report = require('./report-game');
const sgfconv = require('./sgfconv');
const Node = require('./node');

// Contains RootNode (this.root) and NodeSequnce (this.nodes).
class GameTree {
  constructor(sgf, katagoresponses, opts) {
    const rootsequence = sgfconv.rootsequenceFromSGF(sgf);

    this.root = rootsequence.root;
    this.opts = opts;

    // Makes long option names short.
    this.goodmovewinrate = opts.maxWinrateLossForGoodMove / 100;
    this.badmovewinrate = opts.minWinrateLossForBadMove / 100;
    this.badhotspotwinrate = opts.minWinrateLossForBadHotSpot / 100;
    this.variationwinrate = opts.minWinrateLossForVariations / 100;

    // Gets root node and tailless main sequence from sgf.
    this.nodes = rootsequence.sequence
      .split(';')
      .filter((node) => node.search(/[BW]\[[^\]]/) === 0)
      .map((node) => new Node(node.substring(0, 5)));

    // Fills win rates and variations of this.nodes.
    this.fromKataGoResponses(katagoresponses, sgfconv.getPLs(rootsequence));
  }

  // From KataGo responses, fills win rates and variations of this.nodes.
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
    //
    // * responses.length === nodes.length + 1
    // * Adds responses[0].moveInfos to nodes[0].variations.
    // * To use moveInfos (preview variations) of the last response, we need
    //   to add the node of pass move (B[] or W[]) to this.nodes, and then we
    //   can add moveInfos to the node.
    // * Sets win rates info (responses[1].rootInfo) to nodes[0].
    // * responses[0].rootInfo is useless.
    //
    // KataGo's moveInfos (variations) of turnNumber is for the variations of
    // node[turnNumber], but KataGo's rootInfo (win rates info) of turnNumber
    // is for node[turnNumber - 1]. So we call (turnNumber - 1) curturn, and
    // call turnNumber nextturn.
    let prevjson;
    this.maxvisits = 0;

    // Sets win rates and add moveInfos (variations) to this.nodes.
    responses.forEach((response) => {
      const curjson = JSON.parse(response);
      const { turnNumber } = curjson;
      const curturn = turnNumber - 1;
      const nextturn = curturn + 1;
      const prevturn = prevjson ? prevjson.turnNumber - 1 : undefined;
      const nextpl = pls[nextturn % 2];

      this.maxvisits = Math.max(curjson.rootInfo.visits, this.maxvisits);

      // Sets win rates to this.nodes[curturn].
      if (curturn >= 0) {
        const node = this.nodes[curturn];
        if (curturn === prevturn + 1) {
          // To calculate node.winrateLoss, we need both of
          // prevjson.rootInfo.winrate and curjson.rootInfo.winrate.
          node.setWinrate(prevjson.rootInfo, curjson.rootInfo, this.opts);
        } else {
          node.setWinrate(null, curjson.rootInfo, this.opts);
        }
      }

      // For preview variations of last response, adds the node of pass move
      // (B[] or W[]) to this.nodes.
      if (
        this.opts.showVariationsAfterLastMove &&
        this.nodes.length === nextturn
      ) {
        this.nodes.push(new Node(`${nextpl}[]`));
      }

      // Adds variations to this.nodes[nextturn].
      if (
        nextturn < this.nodes.length &&
        (!this.opts.analyzeTurns ||
          this.opts.analyzeTurns.indexOf(nextturn) !== -1)
      ) {
        this.nodes[nextturn].variations = curjson.moveInfos
          .map((moveinfo) => {
            const variation = new Node(
              sgfconv.katagomoveinfoToSequence(nextpl, moveinfo),
            );

            variation.setWinrate(curjson.rootInfo, moveinfo, this.opts);
            return variation;
          })
          .filter(
            (variation) =>
              this.opts.showBadVariations === true ||
              this.goodmovewinrate > variation.winrateLoss,
          )
          .slice(0, this.opts.maxVariationsForEachMove);
      }
      prevjson = curjson;
    });

    // FIXME: Remove last move if have no variations.
  }

  getRootComment() {
    return this.rootComment;
  }

  // Makes SGF GameTree, and returns it.
  //
  // To understand the logic below, you need to read
  // <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
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
          this.opts.analyzeTurns ||
          this.opts.showVariationsOnlyForBadMove === false ||
          node.winrateLoss > this.variationwinrate ||
          (last && this.opts.showVariationsAfterLastMove)
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

    this.setRootComment();
    this.sgf = `(${this.root}${this.sgf})`;

    return this.sgf;
  }

  // Sets players info, total good moves, bad moves, ... to this.rootComment
  // and this.root.
  setRootComment() {
    if (!this.responsesgiven || this.rootComment || this.opts.analyzeTurns) {
      this.rootComment = '';
      return;
    }

    // Counts good moves, bad moves, and bad hotspots.
    // 0: Good, 1: bad, and 2: bad hotspots.
    const stat = {
      blackGoodBads: [[], [], []],
      whiteGoodBads: [[], [], []],
    };

    function addToBlackOrWhite(pl, index, num) {
      if (pl === 'B') stat.blackGoodBads[index].push(num);
      else stat.whiteGoodBads[index].push(num);
    }

    this.nodes.forEach((node, num) => {
      const { pl } = node;

      if (node.winrateLoss < this.goodmovewinrate) {
        addToBlackOrWhite(pl, 0, num);
      } else if (node.winrateLoss > this.badmovewinrate) {
        addToBlackOrWhite(pl, 1, num);
        if (node.winrateLoss > this.badhotspotwinrate) {
          addToBlackOrWhite(pl, 2, num);
        }
      }
    });

    // Makes report, i.e. root comment.
    stat.pb = sgfconv.valueFromSequence('PB', this.root);
    stat.blacksTotal = this.nodes.reduce(
      (acc, cur) => acc + (cur.sequence[0] === 'B' ? 1 : 0),
      0,
    );
    stat.pw = sgfconv.valueFromSequence('PW', this.root);
    stat.whitesTotal = this.nodes.length - stat.blacksTotal;

    this.rootComment = report(
      stat,
      this.goodmovewinrate,
      this.badmovewinrate,
      this.badhotspotwinrate,
      this.variationwinrate,
      this.opts.maxVariationsForEachMove,
      this.maxvisits,
    );

    this.root = sgfconv.addComment(this.root, this.rootComment);
  }
}

module.exports = GameTree;
