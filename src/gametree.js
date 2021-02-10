/**
 * @fileOverview GameTree data structure. Please see
 *               <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

const sgfconv = require('./sgfconv');
const Node = require('./node');

// Return values are like: '신진서 (Black):', 'Black :', 'White :'
function getplayer(key, color, root) {
  let pl = sgfconv.valueFromSequence(key, root);

  pl = pl.replace(/ *$/, '');
  pl = pl.replace(/^ */, '');

  if (pl !== '') {
    pl += ` (${color}):`;
  } else {
    pl = `${color}:`;
  }

  return pl;
}

// [1, 2, 5] => 'move 1, move 2, move 5'
function joinmoves(moves) {
  return moves
    .sort((a, b) => a - b)
    .map((x) => `move ${x + 1}`)
    .join(', ');
}

// Return value is like:
// * Bad moves (11.54%, 12/104): move 39, move 69, move 105, move 109, ...
function formatmoves(goodbad, moves, total, listmoves = true) {
  let format;

  if (moves && moves.length > 0) {
    const ratio = ((moves.length / total) * 100).toFixed(2);
    format = `* ${goodbad} (${ratio}%, ${moves.length}/${total})`;
  } else {
    format = '';
  }

  if (moves && listmoves) {
    format += `: ${joinmoves(moves)}\n`;
  } else if (format !== '') {
    format += '\n';
  }

  return format;
}

// Return value is like:
// * Good moves (75.00%, 78/104)
// * Bad moves (11.54%, 12/104): move 39, move 69, move 105, move 109, ...
// * Bad hot spots (0.96%, 1/104): move 141
function movesstat(total, moves) {
  return (
    formatmoves('Good moves', moves[0], total, false) +
    formatmoves('Bad moves', moves[1], total) +
    formatmoves('Bad hot spots', moves[2], total)
  );
}

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
    this.lastmovevariation = sgfOpts.showVariationsAfterLastMove;
    this.badmoveonlyvariation = sgfOpts.showVariationsOnlyForBadMove;

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

    // Second, gets win rate infos and varations from KataGo responses.
    this.fromKataGoResponses(katagoResponses, sgfconv.getPLs(rootsequence));
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
    const blacks = [[], [], []];
    const whites = [[], [], []];

    for (let i = this.nodes.length - 1; i >= 0; i -= 1) {
      const node = this.nodes[i];
      const { pl } = node;
      let tail = '';

      // Counts bad moves for root comment
      if (node.winrateLoss < this.goodmovewinrate) {
        if (pl === 'B') {
          blacks[0].push(i);
        } else {
          whites[0].push(i);
        }
      }
      if (node.winrateLoss > this.badmovewinrate) {
        if (pl === 'B') {
          blacks[1].push(i);
        } else {
          whites[1].push(i);
        }
      }
      if (node.winrateLoss > this.badhotspotwinrate) {
        if (pl === 'B') {
          blacks[2].push(i);
        } else {
          whites[2].push(i);
        }
      }

      // Adds variations.
      //
      // If winrateLoss of a node is bigger than minWinrateLossForVariations,
      // add variations.
      if (node.variations) {
        if (
          node.winrateLoss > this.variationwinrate ||
          this.badmoveonlyvariation === false ||
          this.turnsgiven ||
          (i === this.nodes.length - 1 && this.lastmovevariation)
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
        this.setRootComment(blacks, whites),
      );
    }

    this.sgf = `(${this.root}${this.sgf})`;

    return this.sgf;
  }

  // Fills winrate infos and variations of nodes from KataGo Analysis
  // responses.
  fromKataGoResponses(katagoresponses, pls) {
    // Checks KataGo error response.
    //
    // Now responses is of array type.
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
    function turnnumber(a) {
      return parseInt(a.replace(/.*:/, ''), 10);
    }
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

      // Sets info to move (turnNumber - 1).
      if (turnNumber !== 0) {
        if (prevjson != null && turnNumber - 1 === prevjson.turnNumber) {
          this.nodes[turnNumber - 1].setWinrate(
            prevjson.rootInfo,
            curjson.rootInfo,
          );
        } else {
          this.nodes[turnNumber - 1].setWinrate(null, curjson.rootInfo);
        }
      }

      const nextPL = pls[turnNumber % 2];

      // To add PVs after last move. We add pass move (B[], or W[]), and
      // then add PVs.
      if (this.lastmovevariation && this.nodes.length === turnNumber) {
        this.nodes.push(new Node(`${nextPL}[]`));
      }

      // Adds variations to next pl.
      if (
        (this.lastmovevariation || turnNumber !== this.nodes.length) &&
        (!this.turnsgiven || this.turns.indexOf(turnNumber) !== -1)
      ) {
        this.nodes[turnNumber].variations = [];
        const { variations } = this.nodes[turnNumber];

        curjson.moveInfos.some((moveInfo) => {
          const variation = new Node(
            sgfconv.katagomoveinfoToSequence(nextPL, moveInfo),
          );

          variation.setWinrate(curjson.rootInfo, moveInfo);

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

    // Converts infos to SGF move properties.
    this.nodes.forEach((node) => {
      // Adds move properties.
      node.setProperties(this.opts);

      if (node.variations) {
        // Adds variations properties.
        node.variations.forEach((v) => v.setProperties(this.opts));
      }
    });
    // FIXME: Remove last move if have no variations.
  }

  // Sets players info, total good moves, bad moves, ... in root comment.
  setRootComment(blacks, whites) {
    if (this.rootComment) {
      return this.rootComment;
    }
    if (this.turnsgiven) {
      this.rootComment = '';
      return this.rootComment;
    }

    const blacktot = this.nodes.reduce(
      (acc, cur) => acc + (cur.sequence[0] === 'B' ? 1 : 0),
      0,
    );
    const whitetot = this.nodes.reduce(
      (acc, cur) => acc + (cur.sequence[0] === 'W' ? 1 : 0),
      0,
    );

    const pb = getplayer('PB', 'Black', this.root);
    const pw = getplayer('PW', 'White', this.root);

    this.rootComment =
      `# Analyze-SGF Report` +
      `\n\n${pb}\n${movesstat(blacktot, blacks)}` +
      `\n${pw}\n${movesstat(whitetot, whites)}` +
      `\nGood move: less than ` +
      `${this.goodmovewinrate * 100}% win rate loss` +
      `\nBad move: more than ` +
      `${this.badmovewinrate * 100}% win rate loss` +
      `\nBad hot spot: more than ` +
      `${this.badhotspotwinrate * 100}% win rate loss` +
      `\n\nVariations added for the moves of more then ` +
      `${this.variationwinrate * 100}% win rate loss.` +
      `\nMaximum variations number for each move is ` +
      `${this.maxvariations}.` +
      `\n\nAnalyzed by KataGo Parallel Analysis Engine ` +
      `(${this.maxvisits} max visits).`;

    return this.rootComment;
  }
}

module.exports = GameTree;
