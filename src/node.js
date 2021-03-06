/**
 * @fileOverview SGF Node data structure.
 *               Please see <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

/* eslint no-param-reassign: ["error", { "props": false }] */

const sgfconv = require('./sgfconv');

// Carries a SGF Node and its win rate.
class Node {
  constructor(node, title) {
    // e.g., ';B[aa]', ';W[cc]'.
    this.node = node;
    this.info = title ? `${title}\n` : '';
    this.report = '';

    const index = node.search(/\b[BW]\[/);
    if (index === -1) {
      throw Error(`Invalid NodeSequece: ${node}`);
    }
    // 'B' or 'W'
    this.pl = node.substring(index, index + 1);
  }

  // Sets comment.
  setReport(report) {
    this.report = report;
  }

  // Gets SGF node with comments.
  getSGF() {
    const comment = [this.info, this.report].filter((v) => v).join('\n');

    if (comment) return sgfconv.addComment(this.node, comment);
    return this.node;
  }

  // Calculates scoreDrop, winrateDrop, ... and sets them to this.info and
  // the properties of this.node.
  setWinrate(prevInfo, curInfo, opts) {
    calcWinrate(this, prevInfo, curInfo);
    setProperties(this, opts);
  }

  // e.g., 'BC9 B17 F16 L3 F14 R7 (B 54.61%, B 0.19)'
  formatPV() {
    return (
      `${sgfconv.sequenceToPV(this.node)} (` +
      `${formatWinrate(this.winrate)}, ${formatScoreLead(this.scoreLead)}, ` +
      `${this.visits} visits)`
    );
  }
}

// Calculates scoreDrop, winrateDrop, winrate, ...
function calcWinrate(that, prevInfo, curInfo) {
  if (prevInfo) {
    that.winrateDrop = prevInfo.winrate - curInfo.winrate;
    that.scoreDrop = prevInfo.scoreLead - curInfo.scoreLead;

    if (that.pl === 'W') {
      that.winrateDrop = -that.winrateDrop;
      that.scoreDrop = -that.scoreDrop;
    }
  }

  if (that.pl === 'W') {
    that.myWinrate = 1 - curInfo.winrate;
    that.myScoreLead = -curInfo.scoreLead;
  } else {
    that.myWinrate = curInfo.winrate;
    that.myScoreLead = curInfo.scoreLead;
  }

  that.winrate = curInfo.winrate;
  that.scoreLead = curInfo.scoreLead;
  that.visits = curInfo.visits;
}

const fixFloat = (float) => parseFloat(float).toFixed(2);

// Sets winrate, scoreDrop, winrateDrop, ... to that.info and the properties
// of that.node.
function setProperties(that, opts) {
  if (that.propertiesGot === true) {
    return;
  }
  that.propertiesGot = true;

  if (that.winrate != null) {
    // Does not add winrate report to SGF comment property. Adds it when
    // Node.getSGF() is called.
    that.info += `\n${getWinratesInfo(that)}`;

    // RSGF win rate.
    that.node = sgfconv.addProperty(
      that.node,
      `SBKV[${fixFloat(that.winrate * 100)}]`,
      0,
    );
  }

  if (that.winrateDrop < opts.maxWinrateDropForGoodMove / 100)
    that.node = sgfconv.toGoodNode(that.node);
  else if (that.winrateDrop > opts.minWinrateDropForBadHotSpot / 100)
    that.node = sgfconv.toBadHotSpot(that.node);
  else if (that.winrateDrop > opts.minWinrateDropForBadMove / 100)
    that.node = sgfconv.toBadNode(that.node);
}

function formatWinrate(winrate) {
  const v = fixFloat(winrate * 100);
  if (v > 50) return `B ${v}%`;
  return `W ${fixFloat(100 - v)}%`;
}

function formatScoreLead(scoreLead) {
  const v = fixFloat(scoreLead);
  if (v > 0) return `B ${v}`;
  return `W ${fixFloat(-v)}`;
}

// e.g.,
// * Win rate: B 51.74%
// * Score lead: W 0.20
// * Win rate drop: B ⇣30.29%
// * Score drop: B ⇣4.31
// * Visits: 1015
function getWinratesInfo(that) {
  let winrateDrop;
  let scoreDrop;

  const winrate = `* Win rate: ${formatWinrate(that.winrate)}\n`;
  const scoreLead = `* Score lead: ${formatScoreLead(that.scoreLead)}\n`;
  const visits = `* Visits: ${that.visits}\n`;
  if (that.winrateDrop !== undefined) {
    winrateDrop = fixFloat(that.winrateDrop * 100);
    winrateDrop = `* Win rate drop: ${that.pl} ⇣${winrateDrop}%\n`;
    scoreDrop = `* Score drop: ${that.pl} ⇣${fixFloat(that.scoreDrop)}\n`;
  } else {
    winrateDrop = '';
    scoreDrop = '';
  }

  return winrate + scoreLead + winrateDrop + scoreDrop + visits;
}

module.exports = Node;
