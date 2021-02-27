/**
 * @fileOverview Node data structure. Please see
 *               <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

const sgfconv = require('./sgfconv');

// Contains Node or tailless NodeSequence of SGF, win rate infomations, and
// NodeSequence for variations.
class Node {
  constructor(sequence, comment, previnfo, currentinfo, sgfOpts) {
    // Node or tailless NodeSequence of SGF.
    //
    // e.g. 'B[aa]', 'W[cc]', '(;B[dp];W[po];B[hm])'
    this.sequence = sequence;
    this.comment = comment;

    const index = sequence.search(/\b[BW]\[/);
    if (index === -1) {
      throw Error(`Invalid NodeSequece: ${sequence}`);
    }
    // 'B' or 'W'
    this.pl = sequence.substring(index, index + 1);

    if (sgfOpts) this.setWinrate(previnfo, currentinfo, sgfOpts);
  }

  addProperty(prop) {
    this.sequence = sgfconv.addProperty(this.sequence, prop);
  }

  get() {
    if (this.comment) return sgfconv.addComment(this.sequence, this.comment);
    return this.sequence;
  }

  formatPV() {
    return (
      `${sgfconv.sequenceToPV(this.sequence)} (` +
      `${formatWinrate(this.winrate)}, ${formatScoreLead(this.scoreLead)})`
    );
  }

  setComment(comment) {
    this.comment = comment;
  }

  getComment() {
    return this.comment;
  }

  // Calculates scoreDrop, winrateDrop, ..., sets them to myself properties.
  setWinrate(previnfo, currentinfo, sgfOpts) {
    if (previnfo) {
      this.winrateDrop = previnfo.winrate - currentinfo.winrate;
      this.scoreDrop = previnfo.scoreLead - currentinfo.scoreLead;

      if (this.pl === 'W') {
        this.winrateDrop = -this.winrateDrop;
        this.scoreDrop = -this.scoreDrop;
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

    setProperties(this, sgfOpts);
  }
}

const fixFloat = (f) => parseFloat(f).toFixed(2);

/* eslint no-param-reassign: ["error", { "props": false }] */

// Add properties (comment, god move, bad move, ...) to this.sequence.
//
// node, sgfOpts => "B[po]BM[1]HO[1]SBKV[5500.00]C[...]"
// node, sgfOpts => "(;B[po]BM[1]HO[1]SBKV[55.00]C[...];W[os];...)"
function setProperties(node, sgfOpts) {
  if (node.propertiesGot === true) {
    return;
  }
  node.propertiesGot = true;

  let properties = node.sequence;

  if (node.winrate != null) {
    // Comment.
    node.comment += `\n\n${getWinratesReport(node)}`;

    // RSGF winrate.
    properties = sgfconv.addProperty(
      properties,
      `SBKV[${fixFloat(node.winrate * 100)}]`,
      0,
    );
  }

  if (node.winrateDrop < sgfOpts.maxWinrateDropForGoodMove / 100) {
    properties = sgfconv.toGoodNode(properties);
  } else if (node.winrateDrop > sgfOpts.minWinrateDropForBadHotSpot / 100) {
    properties = sgfconv.toBadHotSpot(properties);
  } else if (node.winrateDrop > sgfOpts.minWinrateDropForBadMove / 100) {
    properties = sgfconv.toBadNode(properties);
  }

  node.sequence = properties;
}

function formatWinrate(winrate) {
  const v = fixFloat(winrate * 100);
  if (v > 50) return `B ${v}%`;
  return `W ${(100 - v).toFixed(2)}%`;
}

function formatScoreLead(scoreLead) {
  const v = parseFloat(scoreLead).toFixed(2);
  if (v > 0) return `B ${v}`;
  return `W ${(-v).toFixed(2)}`;
}

// (node) => "As Black:\n* Win rate: 55.00%\n* Win rate drop: ...".
function getWinratesReport(node) {
  let winrateDrop;
  let scoreDrop;

  const winrate = `* Win rate: ${formatWinrate(node.winrate)}\n`;
  const scoreLead = `* Score lead: ${formatScoreLead(node.scoreLead)}\n`;

  if (node.winrateDrop !== undefined) {
    winrateDrop = fixFloat(node.winrateDrop * 100);
    winrateDrop = `* Win rate drop: ${node.pl} ⇣${winrateDrop}%\n`;
    scoreDrop = `* Score drop: ${node.pl} ⇣${fixFloat(node.scoreDrop)}\n`;
  } else {
    winrateDrop = '';
    scoreDrop = '';
  }

  return winrate + scoreLead + winrateDrop + scoreDrop;
}

module.exports = Node;
