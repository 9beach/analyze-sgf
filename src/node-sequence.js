/**
 * @fileOverview NodeSequence data structure.
 *               Please see <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

const Node = require('./node');

// Carries a SGF NodeSequence and its win rate. It's used for a variation.
class NodeSequence extends Node {
  constructor(sequence, title, prevInfo, curInfo, sgfOpts) {
    // e.g., '(;B[dp];W[po];B[hm])'.
    super(sequence, title);
    super.setWinrate(prevInfo, curInfo, sgfOpts);
    // As a sequence.
    this.info += `* Sequence: ${this.formatPV().replace(/ \(.*/, '')}\n`;
  }
}

module.exports = NodeSequence;
