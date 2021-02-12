/**
 * @fileOverview Node data structure. Please see
 *               <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

const sgfconv = require('./sgfconv');

// Contains Node or tailless NodeSequence of SGF, win rate infomations, and
// NodeSequence for variations.
class Node {
  constructor(sequence) {
    // Node or tailless NodeSequence of SGF.
    //
    // 'B[aa]' or 'W[cc]' or ';B[dp];W[po];B[hm]' or ...
    this.sequence = sequence;
    const index = sequence.search(/\b[BW]\[/);

    if (index === -1) {
      throw Error(`Invalid NodeSequece: ${sequence}`);
    }

    // 'B' or 'W'
    this.pl = sequence.substring(index, index + 1);
  }

  // Calculates scoreLoss, winrateLoss, ..., from KataGo response, and sets
  // them to myself.
  setWinrate(previnfo, currentinfo, sgfOpts) {
    if (previnfo) {
      this.winrateLoss = previnfo.winrate - currentinfo.winrate;
      this.scoreLoss = previnfo.scoreLead - currentinfo.scoreLead;

      if (this.pl === 'W') {
        this.winrateLoss = -this.winrateLoss;
        this.scoreLoss = -this.scoreLoss;
      }
    }

    if (this.pl === 'W') {
      this.myWinrate = 1 - currentinfo.winrate;
      this.myScoreLead = -currentinfo.scoreLead;
    } else {
      this.myWinrate = currentinfo.winrate;
      this.myScoreLead = currentinfo.scoreLead;
    }

    this.winrate = currentinfo.winrate;
    this.scoreLead = currentinfo.scoreLead;
    this.visits = currentinfo.visits;

    if (sgfOpts) {
      this.setProperties(sgfOpts);
    }
  }

  // Add properties (comment, god move, bad move, ...) to this.sequence.
  //
  // Private. `setWinrate` automatically calls this.
  //
  // sgfOpts => "B[po]BM[1]HO[1]SBKV[5500.00]C[...]"
  // sgfOpts => "(;B[po]BM[1]HO[1]SBKV[55.00]C[...];W[os];...)"
  setProperties(sgfOpts) {
    if (this.propertiesGot === true) {
      return;
    }

    let properties = this.sequence;

    if (this.winrate != null) {
      // Comment.
      properties = sgfconv.addComment(properties, this.getWinratesReport());

      // RSGF winrate.
      properties = sgfconv.addProperty(
        properties,
        `SBKV[${(parseFloat(this.winrate) * 100).toFixed(2)}]`,
        0,
      );
    }

    if (this.winrateLoss < sgfOpts.maxWinrateLossForGoodMove / 100) {
      properties = sgfconv.toGoodNode(properties, 0);
    } else if (this.winrateLoss > sgfOpts.minWinrateLossForBadHotSpot / 100) {
      properties = sgfconv.toBadHotSpot(properties, 0);
    } else if (this.winrateLoss > sgfOpts.minWinrateLossForBadMove / 100) {
      properties = sgfconv.toBadNode(properties, 0);
    }

    this.propertiesGot = true;
    this.sequence = properties;
  }

  // () => "As Black:\n* Win rate: 55.00%\n* Win rate loss: ...".
  getWinratesReport() {
    const pl = this.pl === 'W' ? 'As White:\n' : 'As Black:\n';
    const visits = `* Visits: ${this.visits}`;
    let winrate;
    let scoreLead;
    let winrateLoss;
    let scoreLoss;

    winrate = (parseFloat(this.myWinrate) * 100).toFixed(2);
    winrate = `* Win rate: ${winrate}%\n`;
    scoreLead = parseFloat(this.myScoreLead).toFixed(2);
    scoreLead = `* Score lead: ${scoreLead}\n`;

    if (this.winrateLoss !== undefined) {
      winrateLoss = (parseFloat(this.winrateLoss) * 100).toFixed(2);
      winrateLoss = `* Win rate loss: ${winrateLoss}%\n`;
      scoreLoss = `* Score loss: ${parseFloat(this.scoreLoss).toFixed(2)}\n`;
    } else {
      winrateLoss = '';
      scoreLoss = '';
    }

    return pl + winrate + winrateLoss + scoreLead + scoreLoss + visits;
  }
}

module.exports = Node;
