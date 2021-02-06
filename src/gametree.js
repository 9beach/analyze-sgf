/**
 * @fileOverview GameTree data structure. Please see 
 *               <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>
 */
'use strict';

const sgfconv = require('./sgfconv');
const Node = require('./node');

// Contains RootNode (#root) and NodeSequnce (#nodes).
class GameTree {
  constructor(sgf, katagoResponses, sgfOpts) {
    const rootsequence = sgfconv.rootsequenceFromSGF(sgf);

    this.#root = rootsequence.root;
    this.#pls = sgfconv.getPLs(rootsequence);
    this.#nodes = [];
    this.#sgfOpts = sgfOpts;

    // Fills nodes.
    let left = rootsequence.sequence;
    let start = -1;

    while (start = left.search(/;[BW]\[/), start != -1) {
      const index = left.indexOf(']', start);
      this.#nodes.push(new Node(left.substring(start + 1, index + 1)));

      left = left.substring(start + 3, left.length);
    }

    // Gets info from KataGo responses.
    this.#fromKataGoResponses(katagoResponses, sgfOpts);
  }

  rootComment() {
    return this.#rootComment;
  }

  // Makes SGF GameTree.
  sgf() {
    if (!this.#sgf) {
      this.#sgf = '';
    } else {
      return this.#sgf;
    }

    const maxWinrateLossForGoodMove = 
      this.#sgfOpts.maxWinrateLossForGoodMove / 100;
    const minWinrateLossForBadMove 
      = this.#sgfOpts.minWinrateLossForBadMove / 100;
    const minWinrateLossForBadHotSpot = 
      this.#sgfOpts.minWinrateLossForBadHotSpot / 100;
    const minWinrateLossForVariations = 
      this.#sgfOpts.minWinrateLossForVariations / 100;

    // Good, bad, and bad hot spot moves.
    let blackGoodBads = [[],[],[]];
    let whiteGoodBads = [[],[],[]];

    for (let i = this.#nodes.length - 1; i >= 0; --i) {
      const node = this.#nodes[i];
      const pl = node.pl;
      var tail = '';

      // Counts bad moves for root comment
      if (node.winrateLoss < maxWinrateLossForGoodMove) {
        if (pl == 'B') {
          blackGoodBads[0].push(i);
        } else {
          whiteGoodBads[0].push(i);
        }
      }
      if (node.winrateLoss > minWinrateLossForBadMove) {
        if (pl == 'B') {
          blackGoodBads[1].push(i);
        } else {
          whiteGoodBads[1].push(i);
        }
      }
      if (node.winrateLoss > minWinrateLossForBadHotSpot) {
        if (pl == 'B') {
          blackGoodBads[2].push(i);
        } else {
          whiteGoodBads[2].push(i);
        }
      }

      // Adds variations.
      //
      // If winrateLoss of a node is bigger than minWinrateLossForVariations, 
      // add variations.
      if (node.variations) {
        if ((node.winrateLoss > minWinrateLossForVariations) 
          || this.#sgfOpts.showVariationsOnlyForBadMove == false
          || this.#sgfOpts.analyzeTurnsGiven
          || (i == (this.#nodes.length - 1) 
          && this.#sgfOpts.showVariationsAfterLastMove)) {
          for (const variation of node.variations) {
            tail += variation.sequence;
          }
        }
      }

      if (tail != '') {
        this.#sgf = '(;' + node.sequence + this.#sgf + ')' + tail; 
      } else {
        this.#sgf = ';' + node.sequence + this.#sgf;
      }
    }

    if (this.#responsesGiven == true) {
      this.#setRootComment(blackGoodBads, whiteGoodBads);
      this.#root = sgfconv.addComment(this.#root, this.rootComment());
    }

    this.#sgf = '(' + this.#root + this.#sgf + ')';

    return this.#sgf;
  }

  // Fills winrate infos and variations of nodes from KataGo Analysis 
  // responses.
  #fromKataGoResponses(responses) {
    // Checks KataGo error response.
    //
    // Now responses is of array type.
    if (responses.search('{"error":"') == 0 
      || responses.search('{"warning":') == 0) {
      throw Error('KataGo error: ' + responses);
    }

    responses = responses.split('\n');
    if (responses[responses.length - 1] == '')
      responses = responses.slice(0, responses.length - 1);

    if (responses.length) {
      this.#responsesGiven = true;
    }

    // Sorts responses by turnNumber.
    //
    // Response format: '{"id":"Q","isDuringSearch..."turnNumber":3}'
    responses.sort((a, b) =>
      parseInt(a.replace(/.*:/, '')) - parseInt(b.replace(/.*:/, ''))
    );

    // Notice that:
    // - pls -> pls[0] is the first move player.
    // - moves, nodes -> moves[0] is the first move.
    // - currJSON.turnNumber -> 0, for the variations for the first move.
    // - currJSON.turnNumber -> 1, for the first move info.
    //
    // (ex) turnNumber 0 -> pl 'W', nextPL 'B'
    let prevJSON = null;
    this.#maxVisits = 0;

    for (const response of responses) {
      const currJSON = JSON.parse(response);
      // turnNumber - 1 is current node.
      const turnNumber = currJSON.turnNumber;
      // Adds infos to current pl.
      const pl = this.#pls[(turnNumber + 1) % 2];
      // Adds variations to next pl.
      const nextPL = this.#pls[turnNumber % 2];

      this.#maxVisits = Math.max(currJSON.rootInfo.visits, 
        this.#maxVisits);

      // Sets info to move (turnNumber - 1).
      if (turnNumber != 0) {
        if (prevJSON != null && (turnNumber - 1) == prevJSON.turnNumber) {
          this.#nodes[turnNumber - 1].setWinrate(prevJSON.rootInfo, 
            currJSON.rootInfo)
        } else {
          this.#nodes[turnNumber - 1].setWinrate(prevJSON.rootInfo, 
            currJSON.rootInfo)
        }
      }

      // To add PVs after last move. We add pass move (B[], or W[]), and 
      // then add PVs.
      if (this.#sgfOpts.showVariationsAfterLastMove == true
        && nodes.length == turnNumber) {
        nodes.push(new Node(this.#pls[1] + '[]'));
      }

      // Sets PVs to move of turnNumber.
      if ((this.#sgfOpts.showVariationsAfterLastMove == true
        || turnNumber != this.#nodes.length)
        && (this.#sgfOpts.analyzeTurnsGiven == false
        || this.#sgfOpts.analyzeTurns.indexOf(turnNumber) != -1)) {
        let variations = (this.#nodes[turnNumber].variations = []);

        for (const moveInfo of currJSON.moveInfos) {
          const variation = new Node(sgfconv.katagomoveinfoToSequence(nextPL, 
            moveInfo));

          variation.setWinrate(currJSON.rootInfo, moveInfo);

          if (this.#sgfOpts.showBadVariations == true
            || this.#sgfOpts.maxWinrateLossForGoodMove / 100 > 
            variation.winrateLoss) {
            if (variations.length < this.#sgfOpts.maxVariationsForEachMove) {
              variations.push(variation);
            } else {
              break;
            }
          }
        }
      }
      prevJSON = currJSON;
    }

    // Converts infos to SGF move properties.
    for (const node of this.#nodes) {
      // Adds move properties.
      node.setProperties(this.#sgfOpts);

      if (node.variations) {
        // Adds variations properties.
        for (const variation of node.variations) {
          variation.setProperties(this.#sgfOpts);
        }
      }
    }
    // FIXME: Remove last move if have no variations.
  }

  #setRootComment(blackGoodBads, whiteGoodBads) {
    if (this.#rootComment) {
      return;
    }
    if (this.#sgfOpts.analyzeTurnsGiven) {
      this.#rootComment = '';
      return;
    }

    let rootComment = '';

    const blackTotal = this.#nodes
      .reduce((acc, cur) => acc + (cur.sequence[0] == 'B' ? 1 : 0), 0);
    const whiteTotal = this.#nodes
      .reduce((acc, cur) => acc + (cur.sequence[0] == 'W' ? 1 : 0), 0);

    let pb = sgfconv.valueFromSequence('PB', this.#root);
    pb = pb.replace(/ *$/, '');
    pb = pb.replace(/^ */, '');

    if (pb != '') {
      pb = pb + ' (Black)';
    } else {
      pb = 'Black';
    }

    let pw = sgfconv.valueFromSequence('PW', this.#root);
    pw = pw.replace(/ *$/, '');
    pw = pw.replace(/^ */, '');

    if (pw != '') {
      pw = pw + ' (White)';
    } else {
      pw = 'White';
    }

    function movesjoin(moves) {
      return moves
        .sort((a, b) => a - b)
        .map(x => 'move ' + (x + 1))
        .join(', ');
    }

    rootComment = '# Analyze-SGF Report';

    function stat(comment, total, moves) {
      comment = '\n* Good moves (' + 
        ((moves[0].length / total) * 100).toFixed(2) + '%' + 
        ', ' + moves[0].length + '/' + total + ')';
      if (moves[1].length > 0) {
        comment += '\n* Bad moves (' + 
          ((moves[1].length / total) * 100).toFixed(2) + '%' + 
          ', ' + moves[1].length + '/' + total + '): ' + 
          movesjoin(moves[1]);
      }
      if (moves[2].length > 0) {
        comment += '\n* Bad hot sOpts (' + 
          ((moves[2].length / total) * 100).toFixed(2) + '%' + 
          ', ' + moves[2].length + '/' + total + '): ' + 
          movesjoin(moves[2]);
      }
      return comment;
    }

    rootComment += '\n\n' + pb + ':';
    rootComment += stat(rootComment, blackTotal, blackGoodBads);

    rootComment += '\n\n' + pw + ':';
    rootComment += stat(rootComment, whiteTotal, whiteGoodBads);

    rootComment += 
      '\n\nGood move: less than ' + this.#sgfOpts.maxWinrateLossForGoodMove + 
      '% win rate loss' + 
      '\nBad move: more than ' + this.#sgfOpts.minWinrateLossForBadMove + 
      '% win rate loss' + 
      '\nBad hot spot: more than ' +
      this.#sgfOpts.minWinrateLossForBadHotSpot + '% win rate loss\n' +
      '\nVariations added for the moves of more then ' + 
      this.#sgfOpts.minWinrateLossForVariations + '% win rate loss.' +
      '\nMaximum variations number for each move is ' + 
      this.#sgfOpts.maxVariationsForEachMove + '.' + 
      '\n\nAnalyzed with KataGo Parallel Analysis Engine (' + 
      this.#maxVisits + ' max visits).';

    this.#rootComment = rootComment;
  }

  #root;
  #pls;
  #sgf;
  #rootComment;
  #responsesGiven;

  // Key data structure containing Node array.
  #nodes;

  #maxVisits;
  #sgfOpts;
}

module.exports = GameTree;
