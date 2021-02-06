/**
 * @fileOverview Node data structure. Please see 
 *               <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>
 */
'use strict'

const sgfconv = require('./sgfconv');

// Contains 1) Node or NodeSequence of SGF, 2) win rate infomations, 
// and 3) NodeSequence for variations.
class Node {
  // ';B[dp];W[po];B[hm]', 'B[aa]', 'W[cc]', ...
  sequence;
  // 'B' or 'W'
  pl;

  // Node statistics.
  winrate;
  winrateLoss;
  scoreLoss;
  scoreLead;
  myWinrate;
  myScoreLead;
  visits;

  constructor(sequence) {
    this.sequence = sequence;
    const index = sequence.search(/\b[BW]\[/);

    if (index == -1) {
      throw 'Invalid NodeSequece: ' + sequence;
    }

    this.pl = sequence.substring(index, index + 1);
  }

  // Calculates scoreLoss, winrateLoss, ..., from KataGo response, and 
  // sets them to myself.
  setWinrate(previnfo, currentinfo) {
    if (previnfo) {
      let winrateLoss = previnfo.winrate - currentinfo.winrate;
      let scoreLoss = previnfo.scoreLead - currentinfo.scoreLead;

      if (this.pl == 'W') {
        this.winrateLoss = -winrateLoss;
        this.scoreLoss = -scoreLoss;
      } else {
        this.winrateLoss = winrateLoss;
        this.scoreLoss = scoreLoss;
      }
    }

    if (this.pl == 'W') { 
      this.myWinrate = 1 - currentinfo.winrate;
      this.myScoreLead = -currentinfo.scoreLead;
    } else {
      this.myWinrate = currentinfo.winrate;
      this.myScoreLead = currentinfo.scoreLead;
    }

    this.winrate = currentinfo.winrate;
    this.scoreLead = currentinfo.scoreLead;
    this.visits = currentinfo.visits;
  }

  // Add properties to this.sequence:
  //
  // "B[po]" => "B[po]BM[1]HO[1]SBKV[5500.00]C[...]"
  // "(;B[po];W[os];...)" => 
  //     "(;B[po]BM[1]HO[1]SBKV[5500.00]C[* Win rate ...];W[os];...)"
  setProperties(sgfOpts) {
    if (this.#propertiesSet == true) {
      return;
    }

    let properties = this.sequence;

    if (this.winrate != null) {
      // Comment
      properties = sgfconv.addComment(properties, this.getStatistics());

      // RSGF winrate
      properties = sgfconv.addProperty(properties, 'SBKV[' + 
        (parseFloat(this.winrate) * 100).toFixed(2) + ']', 0);
    }

    if (this.winrateLoss < sgfOpts.maxWinrateLossForGoodMove / 100) {
      properties = sgfconv.toGoodNode(properties, 0);
    } else if (this.winrateLoss > 
      sgfOpts.minWinrateLossForBadHotSpot / 100) {
      properties = sgfconv.toBadHotSpot(properties, 0);
    } else if (this.winrateLoss > 
      sgfOpts.minWinrateLossForBadMove / 100) {
      properties = sgfconv.toBadNode(properties, 0);
    }

    this.#propertiesSet = true;
    this.sequence = properties;
  }

  // Returns "As Black:\n* Win rate: 55.00%\n* Win rate ..."
  getStatistics() {
    const asPL = 'As ' + (this.pl == 'W' ? 'White' : 'Black') + ':\n';
    return (asPL + "* Win rate: " + 
      (parseFloat(this.myWinrate) * 100).toFixed(2) + '%' + 
      (this.winrateLoss != null 
      ? "\n* Win rate loss: " + 
      (parseFloat(this.winrateLoss) * 100).toFixed(2) + '%'
      : '') + 
      "\n* Score lead: " + parseFloat(this.myScoreLead).toFixed(2) + 
      (this.scoreLoss != null 
      ? "\n* Score loss: " + parseFloat(this.scoreLoss).toFixed(2)
      : '') + 
      "\n* Visits: " + this.visits);
  }

  // Prevents duplicated set.
  #propertiesSet;
}

module.exports = Node;
