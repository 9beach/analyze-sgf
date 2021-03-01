/**
 * @fileOverview Node data structure. Please see
 *               <https://homepages.cwi.nl/~aeb/go/misc/sgf.html>.
 */

/* eslint no-param-reassign: ["error", { "props": false }] */

const sgfconv = require('./sgfconv');

// Contains Node or tailless NodeSequence of SGF, win rate information, and
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

    // As a variation.
    if (sgfOpts) {
      this.setWinrate(previnfo, currentinfo, sgfOpts);
      this.comment += `* Sequence: ${formatPV(this).replace(/ \(.*/, '')}\n`;
    }
  }

  hasVariations() {
    return Boolean(this.variations);
  }

  setVariations(variations) {
    this.variations = variations;
  }

  // Gets the sequence with comment.
  get() {
    if (this.comment) return sgfconv.addComment(this.sequence, this.comment);
    return this.sequence;
  }

  // Gets tails of variations.
  getTails(sgfOpts) {
    if (this.hasVariations()) {
      if (
        sgfOpts.analyzeTurns ||
        sgfOpts.showVariationsOnlyForBadMove === false ||
        this.winrateDrop > sgfOpts.minWinrateDropForVariations / 100 ||
        (sgfOpts.showVariationsAfterLastMove && this.sequence[2] === ']')
      ) {
        return this.variations.reduce((acc, cur) => acc + cur.get(), '');
      }
    }
    return '';
  }

  // e.g.
  // 1. BH11 K5 L6 L5 M5 M6 M7 N6 L7 N7 L10 K2 K1 H2 H7 N5 (B 82.79%, B 6.33)
  // 2. BJ13 K5 K13 L11 H11 M6 L10 L9 M10 P2 N2 K2 K1 O1 M9 (B 81.76%, B 2.88)
  getPVs() {
    if (!this.hasVariations()) return '';
    return this.variations.reduce(
      (acc, cur, index) => `${acc}${index + 1}. ${formatPV(cur)}\n`,
      '',
    );
  }

  setComment(comment) {
    this.comment = comment;
  }

  getComment() {
    return this.comment;
  }

  // Calculates scoreDrop, winrateDrop, ... and sets them to this.comment and
  // the properties of this.sequence.
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

    setWinrateToCommentAndProperties(this, sgfOpts);
  }
}

const fixFloat = (f) => parseFloat(f).toFixed(2);

// Sets win rate to that.comment and the properties of that.sequence.
function setWinrateToCommentAndProperties(that, sgfOpts) {
  if (that.propertiesGot === true) {
    return;
  }
  that.propertiesGot = true;

  if (that.winrate != null) {
    // Does not add winrate report to comment property. Adds it when this.get()
    // is called.
    that.comment += `\n\n${getWinratesReport(that)}`;

    // RSGF winrate.
    that.sequence = sgfconv.addProperty(
      that.sequence,
      `SBKV[${fixFloat(that.winrate * 100)}]`,
      0,
    );
  }

  if (that.winrateDrop < sgfOpts.maxWinrateDropForGoodMove / 100)
    that.sequence = sgfconv.toGoodNode(that.sequence);
  else if (that.winrateDrop > sgfOpts.minWinrateDropForBadHotSpot / 100)
    that.sequence = sgfconv.toBadHotSpot(that.sequence);
  else if (that.winrateDrop > sgfOpts.minWinrateDropForBadMove / 100)
    that.sequence = sgfconv.toBadNode(that.sequence);
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

// Returns sequence (by Leela Zero's PV format), win rate, and score lead.
//
// e.g. 'BC9 B17 F16 L3 F14 R7 (B 54.61%, B 0.19)'
function formatPV(that) {
  return (
    `${sgfconv.sequenceToPV(that.sequence)} (` +
    `${formatWinrate(that.winrate)}, ${formatScoreLead(that.scoreLead)})`
  );
}

// (that) => "As Black:\n* Win rate: 55.00%\n* Win rate drop: ...".
function getWinratesReport(that) {
  let winrateDrop;
  let scoreDrop;

  const winrate = `* Win rate: ${formatWinrate(that.winrate)}\n`;
  const scoreLead = `* Score lead: ${formatScoreLead(that.scoreLead)}\n`;

  if (that.winrateDrop !== undefined) {
    winrateDrop = fixFloat(that.winrateDrop * 100);
    winrateDrop = `* Win rate drop: ${that.pl} ⇣${winrateDrop}%\n`;
    scoreDrop = `* Score drop: ${that.pl} ⇣${fixFloat(that.scoreDrop)}\n`;
  } else {
    winrateDrop = '';
    scoreDrop = '';
  }

  return winrate + scoreLead + winrateDrop + scoreDrop;
}

module.exports = Node;
