/**
 * @fileOverview SGF Tail data structure.
 *               Please see <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

const sgfconv = require('./sgfconv');
const Node = require('./node');

// Carries a SGF Tail.
class Tail extends Node {
  // Sets a NodeSeq array to carry the variations.
  setVariations(variations) {
    this.variations = variations;
    if (this.hasVariation())
      this.pvs = `The proposed variations\n\n${this.variations.reduce(
        (acc, cur, index) => `${acc}${index + 1}. ${cur.formatPV()}\n`,
        '',
      )}`;
  }

  hasVariation() {
    return this.variations && this.variations.length;
  }

  // Gets SGF node with comments.
  getSGF() {
    const comment = [this.info, this.report, this.pvs]
      .filter((v) => v)
      .join('\n');

    if (comment) return sgfconv.addComment(this.node, comment);
    return this.node;
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
