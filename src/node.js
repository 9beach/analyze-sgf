/**
 * @fileOverview Node data structure. Please see
 *               <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

const sgfconv = require('./sgfconv');

// Contains Node or tailless NodeSequence of SGF, win rate infomations, and
// NodeSequence for variations.
class Node {
  constructor(sequence, title = '') {
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

    this.comment = title;
  }

  get() {
    if (this.comment !== '')
      return sgfconv.addComment(this.sequence, this.comment);
    return this.sequence;
  }

  pv() {
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

  // Calculates scoreDrop, winrateDrop, ..., from KataGo response, and sets
  // them to myself.
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

    if (sgfOpts) {
      setProperties(this, sgfOpts);
    }
  }
}

/* eslint no-param-reassign: ["error", { "props": false }] */

// Add properties (comment, god move, bad move, ...) to this.sequence.
//
// node, sgfOpts => "B[po]BM[1]HO[1]SBKV[5500.00]C[...]"
// node, sgfOpts => "(;B[po]BM[1]HO[1]SBKV[55.00]C[...];W[os];...)"
function setProperties(node, sgfOpts) {
  if (node.propertiesGot === true) {
    return;
  }

  let properties = node.sequence;

  if (node.winrate != null) {
    // Comment.
    node.comment += `\n\n${getWinratesReport(node)}`;

    // RSGF winrate.
    properties = sgfconv.addProperty(
      properties,
      `SBKV[${(parseFloat(node.winrate) * 100).toFixed(2)}]`,
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

  node.propertiesGot = true;
  node.sequence = properties;
}

function formatWinrate(winrate) {
  const v = (parseFloat(winrate) * 100).toFixed(2);
  if (v > 50) return `B ${v}%`;
  return `W ${100 - v}%`;
}

function formatScoreLead(scoreLead) {
  const v = parseFloat(scoreLead).toFixed(2);
  if (v > 0) return `B ${v}`;
  return `W ${-v}`;
}

// (node) => "As Black:\n* Win rate: 55.00%\n* Win rate drop: ...".
function getWinratesReport(node) {
  const visits = `* Visits: ${node.visits}`;
  let winrateDrop;
  let scoreDrop;

  const winrate = `* Win rate: ${formatWinrate(node.winrate)}\n`;
  const scoreLead = `* Score lead: ${formatScoreLead(node.scoreLead)}\n`;

  if (node.winrateDrop !== undefined) {
    winrateDrop = (parseFloat(node.winrateDrop) * 100).toFixed(2);
    winrateDrop = `* Win rate drop: ${winrateDrop}%\n`;
    scoreDrop = `* Score drop: ${parseFloat(node.scoreDrop).toFixed(2)}\n`;
  } else {
    winrateDrop = '';
    scoreDrop = '';
  }

  return winrate + winrateDrop + scoreLead + scoreDrop + visits;
}

module.exports = Node;
