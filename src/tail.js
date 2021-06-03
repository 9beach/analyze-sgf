/**
 * @fileOverview SGF Tail data structure.
 *               Please see <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

const sgfconv = require('./sgfconv');
const Node = require('./node');

// Carries a SGF Tail.
class Tail extends Node {
  // Sets a NodeSeq array to carry the variations.
  setVariations(variations, boardYSize) {
    this.variations = variations;
    if (this.hasVariation())
      this.pvs = `The proposed variations\n\n${this.variations.reduce(
        (acc, cur, index) =>
          `${acc}${index + 1}. ${cur.formatPV(boardYSize)}\n`,
        '',
      )}`;

    // KataGo choice no. what?
    this.choice = this.variations
      .map((v) => sgfconv.rootAndSeqFromSGF(v.getSGF()).seq.split(';')[1])
      .indexOf(this.node.substring(1));
  }

  hasVariation() {
    return this.variations && this.variations.length;
  }

  // Gets SGF node with comments.
  getSGF() {
    if (this.info && this.report && this.pvs && this.sgf) return this.sgf;

    if (this.choice >= 0) {
      const choiceText = `* KataGo ${
        this.choice === 0 ? 'top choice' : `choice no. ${this.choice + 1}`
      }\n`;
      if (this.winrate) this.info += choiceText;
      else this.info += `\n${choiceText}`;
    }

    const comment = [this.info, this.report, this.pvs]
      .filter((v) => v)
      .join('\n');

    if (comment) this.sgf = sgfconv.addComment(this.node, comment);
    else this.sgf = this.node;

    return this.sgf;
  }

  // Gets SGF tail (variations).
  getTailSGF(opts) {
    if (!this.hasVariation()) return '';
    if (
      opts.analyzeTurns ||
      opts.showVariationsOnlyForBadMove === false ||
      this.winrateDrop > opts.minWinrateDropForVariations / 100 ||
      (opts.showVariationsAfterLastMove &&
        this.node.search(/[BW]\[\]/) !== -1)
    )
      return this.variations.reduce((acc, cur) => acc + cur.getSGF(), '');
    return '';
  }
}

module.exports = Tail;
