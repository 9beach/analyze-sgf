/**
 * @fileOverview NodeSequence data structure used to carry a variation.
 *
 *               Please see <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

const Node = require('./node');

// Carries SGF NodeSequence and win rate information.
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
