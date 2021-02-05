/**
 * @fileOverview Helper functions for sgfconv.js.
 */
'use strict';

// 'XX[11]YY[22]', 0 => '11'
// 'XX[11]YY[22]', 2 => '11'
// 'XX[11]YY[22]', 5 => '22'
// 'XX[11]YY[22]', 8 => '22'
// 'XX[11]YY[22]', 9 => ''
function inBraket(value, index = 0) {
  const start = value.indexOf('[', index);
  const end = value.indexOf(']', start);

  if (start == -1 || end == -1) {
    return '';
  } else {
    return value.substring(start + 1, end)
      .replace(/^ */, '')
      .replace(/ *$/, '');
  }
}

// 'XX', 'XX[11]YY[22]YY[33]' => 11
function valueOfProp(prop, sgf) {
  const start = sgf.search(new RegExp('\\b' + prop + '\\['));

  return (-1 == start ? '' : inBraket(sgf, start));
}

// 'AB', '(;GM[1]FF[4]...AB[dp][pd];W...' => '[dp][pd]'
// 'GM', '(;GM[1]FF[4]...AB[dp][pd];W...' => '[1]'
function rawPropValuesFromSGF(prop, sgf) {
  if (-1 != sgf.indexOf(prop + '[')) {
    const re = new RegExp('.*\\b' + prop + '((\\[[^\\]]*\\])+).*');
    return sgf.replace(re, '$1');
  } else {
    return '';
  }
}

// 'YY', 'XX[11]YY[22][33]' => ['22', '33']
function valuesOfProp(prop, sgf) {
  let values = rawPropValuesFromSGF(prop, sgf);

  return (values.length == 0
    ? ''
    : values.substring(1, values.length - 1).split(']['));
}

// 'I' => 'J'
// 'J' => 'K'
function nextChar(c) {
  return String.fromCharCode(c.charCodeAt(0) + 1);
}

// 'J' => 'I'
// 'K' => 'J'
function prevChar(c) {
  return String.fromCharCode(c.charCodeAt(0) - 1);
}

// 'aa' => 'A1'
// 'bd' => 'B4'
// 'ia' => 'J1'
function iaToJ1(value) {
  value = value.toUpperCase(); 
  if (value[0] >= "I") {
    return nextChar(value[0]) + (value.charCodeAt(1) - 64).toString();
  } else {
    return value[0] + (value.charCodeAt(1) - 64).toString();
  }
}

// 'A1' => 'aa'
// 'B4' => 'b4'
// 'J1' => 'ia'
function iaFromJ1(value) {
  if (value[0] >= "J") {
    return prevChar(value[0].toLowerCase()) + String.fromCharCode(
      parseInt(value.substring(1, value.length)) + 96);
  } else {
    return value[0].toLowerCase() + String.fromCharCode(
      parseInt(value.substring(1, value.length)) + 96);
  }
}

// '..AB[dp];W[po];B[hm]TE[1];W[ae]...' => [{move:"W[po]"},{move:"B[hm]"},...]
function sgfmovesFromSequence(sequence) {
  let left = sequence;
  let sgfmoves = [];
  let start = -1;

  while (start = left.search(/;[BW]\[/), start != -1) {
    const index = left.indexOf(']', start);
    sgfmoves.push({move: left.substring(start + 1, index + 1)});

    left = left.substring(start + 3, left.length);
  }

  return sgfmoves;
}

// (move, info) => "As Black:\n* Win rate: 55.00%\n* Win rate ..."
function infoToComment(move, info) {
  const pl = move[move.search(/[BW]/)];
  const aspl = 'As ' + (pl == 'W' ? 'White' : 'Black') + ':\n';
  return (aspl + "* Win rate: " + 
    (parseFloat(info.myWinrate) * 100).toFixed(2) + '%' + 
    (info.winrateLoss != null 
      ? "\n* Win rate loss: " + 
        (parseFloat(info.winrateLoss) * 100).toFixed(2) + '%'
      : '') + 
    "\n* Score lead: " + parseFloat(info.myScoreLead).toFixed(2) + 
    (info.scoreLoss != null 
      ? "\n* Score loss: " + parseFloat(info.scoreLoss).toFixed(2)
      : '') + 
    "\n* Visits: " + info.visits);
}

// Calculates scoreLoss, winrateLoss, ..., and sets them to sgfmove.
function setInfoToSGFMove(turn, prevInfo, currentInfo, sgfmove) {
  if (prevInfo) {
    let winrateLoss = prevInfo.winrate - currentInfo.winrate;
    let scoreLoss = prevInfo.scoreLead - currentInfo.scoreLead;

    if (turn == 'W') {
      sgfmove.winrateLoss = -winrateLoss;
      sgfmove.scoreLoss = -scoreLoss;
    } else {
      sgfmove.winrateLoss = winrateLoss;
      sgfmove.scoreLoss = scoreLoss;
    }
  }

  if (turn == 'W') { 
    sgfmove.myWinrate = 1 - currentInfo.winrate;
    sgfmove.myScoreLead = -currentInfo.scoreLead;
  } else {
    sgfmove.myWinrate = currentInfo.winrate;
    sgfmove.myScoreLead = currentInfo.scoreLead;
  }
 
  sgfmove.winrate = currentInfo.winrate;
  sgfmove.scoreLead = currentInfo.scoreLead;
  sgfmove.visits = currentInfo.visits;
}
 
// '..AB[dp];W[po];B[hm]TE[1];W[ae]...' => [["W","Q15"],["B","H13"],["W","A5"]]
// '..AB[dp];W[po];B[hm]TE[1];W[]...' => [["W","Q15"],["B","H13"]]
function katagomovesFromSequence(sequence) {
  let left = sequence;
  let moves = [];
  let start = -1;

  while (start = left.search(/;[BW]\[[^\]]/), start != -1) {
    const value = inBraket(left, start + 1);

    moves.push([left[start + 1], iaToJ1(value)]);
    left = left.substring(start + 3, left.length);
  }

  return moves;
}

// '..AB[aa][bb]AW[ab][cc];W[po]...' 
// => [["B","A1"],["B","B2"],["W","A2"],["W","C3"]]
function initialStonesFromSequence(sequence) {
  const ab = valuesOfProp('AB', sequence);
  const aw = valuesOfProp('AW', sequence);
  let initialStones = [];

  for (let i = 0; i < ab.length; ++i) {
    initialStones.push(['B',iaToJ1(ab[i])]);
  }
  for (let i = 0; i < aw.length; ++i) {
    initialStones.push(['W',iaToJ1(aw[i])]);
  }

  return initialStones;
}

// ("W", {scoreLead: 21.05059, pv:["A1","B2","C3"], ...}) 
// => '(;W[aa];B[bb];W[cc])'
function moveInfoToSequence(player, moveInfo) {
  let sequence = '(';

  for (const move of moveInfo.pv) {
    sequence += ';' + player + '[' + iaFromJ1(move) + ']';

    if (player == 'W') {
      player = 'B';
    } else {
      player = 'W';
    }
  }
  sequence += ')';

  return sequence;
}

// '(abc;B[aa];B[bb]' => { root: 'abc', sequence: ';B[aa];B[bb]' }
// '(;W[aa];B[bb]' => { root: '', sequence: ';W[aa];B[bb]' }
// '(;o[aa];B[bb]' => { root: ';o[aa]', sequence: ';B[bb]' }
// '(;abc)' => { root: ';abc', sequence: '' }
// '(abc;)' => { root: 'abc;', sequence: '' }
function rootAndSequenceFromSGF(sgf) {
  sgf = reduceTailsOfSGF(sgf);

  sgf = sgf.substring(0, sgf.lastIndexOf(')') + 1);

  if (sgf[0] != '(' || sgf[sgf.length - 1] != ')') {
    throw 'SGF parse error: ' + sgf;
  }

  // Root node may have ';', so start from 2.
  let start = sgf.search(/;[BW]\[/, 2);

  if (start == -1) {
    start = sgf.length - 1;
  }
  return { root: sgf.substring(1, start),
    sequence: sgf.substring(start, sgf.length - 1) };
}

function stripComment(sgf) {
  // Removes line feeds and comments.
  sgf = sgf.replace(/\r\n/g, '').replace(/\n/g, '');
  sgf = sgf.replace(/\bC\[[^\]]*\\\]/g, 'C[');
  sgf = sgf.replace(/\bC\[[^\]]*\]/g, '');

  return sgf;
}

// '(abc(def(gh)(xy))(123(45)(66)))' => '(abcdefgh)'
// '(abc\n(def(gh)(xy))(123(45)(66)))' => '(abcdefgh)'
function reduceTailsOfSGF(sgf) {
  sgf = stripComment(sgf);

  let moves = sgf;
  let reduced = sgf;

  // FIXME: Very poor logic.
  while (true) {
    moves = reduced;
    // ')  )' => '))'
    // '(  )' => '))'
    // '(  (' => '(('
    reduced = reduced.replace(/([()]) *([()])/g, '$1$2'); 
    // ')(dfg)' => ')'
    reduced = reduced.replace(/\)\([^()]*\)/g, ')');
    // '((abc))' => '(abc)'
    // 'x(abc)y' => 'xabcy'
    // 'x(abc)(' => 'x(abc)('
    reduced = reduced.replace(/([^)])\(([^()]*)\)([^(])/g, '$1$2$3'); 

    if (moves === reduced) break;
  }
  return reduced;
}

// ('(;W[aa];B[bb];W[cc])', 'XX', 0) => '(;W[aa]XX;B[bb];W[cc])'
// ('(;W[aa];B[bb];W[cc])', 'XX', 7) => '(;W[aa];B[bb]XX;W[cc])'
function markMove(sequence, mark, index) {
  const start = sequence.indexOf(']', index);

  if (start != -1) {
    return sequence.substring(0, start + 1) + mark + 
      sequence.substring(start + 1);
  } else {
    return '';
  }
}

// ('(;W[aa];B[bb];W[cc])', 0) => '(;W[aa]TE[1];B[bb];W[cc])'
function markMoveAsGood(sequence, index) {
  return markMove(sequence, 'TE[1]', index);
}

// ('(;W[aa];B[bb];W[cc])', 0) => '(;W[aa]BM[1];B[bb];W[cc])'
function markMoveAsBad(sequence, index) {
  return markMove(sequence, 'BM[1]', index);
}

// ('(;W[aa];B[bb];W[cc])', 0) => '(;W[aa]HO[1];B[bb];W[cc])'
function markMoveAsHotSpot(sequence, index) {
  return markMove(sequence, 'HO[1]', index);
}

// ('(;W[aa];B[bb];W[cc])', 0) => '(;W[aa]BM[1]HO[1];B[bb];W[cc])'
function markMoveAsBadHotSpot(sequence, index) {
  return markMove(sequence, 'BM[1]HO[1]', index);
}

// ('(;W[aa];B[bb];W[cc])', 'test', 0) => '(;W[aa]C[test]BM[1]HO[1];B[bb];W[cc])'
function setMoveComment(sequence, comment, index) {
  comment = comment.replace(/\]/g, '\\]');
  return markMove(sequence, 'C[' + comment + ']', index);
}

// Gets PLs. pls = [ 'B', 'W' ] or [ 'W', 'B' ]
function getPLs(root, moves) {
  let pls = [];

  if (moves.length != 0) {
    pls.push(moves[0][0]);
  } else if (valueOfProp('PL', root) != '') {
    pls.push(valueOfProp('PL', root));
  } else {
    pls.push('B');
  }
  if (pls[0] === 'W') {
    pls.push('B');
  } else { 
    pls.push('W');
  }

  return pls;
}

// ("B[po]", info, sgfOpts) => "B[po]BM[1]HO[1]SBKV[5500.00]C[* Win rate ...]"
// ("(;B[po];W[os];...)", info, sgfOpts)
// => "(;B[po]BM[1]HO[1]SBKV[5500.00]C[* Win rate ...];W[os];...)"
function addProperties(move, info, sgfOpts) {
  let properties = move;

  if (info.winrate != null) {
    // Comment
    properties = setMoveComment(properties, infoToComment(move, info), 0);

    // RSGF winrate
    properties = markMove(properties, 'SBKV[' + 
      (parseFloat(info.winrate) * 100).toFixed(2) + ']', 0);
  }

  if (info.winrateLoss < sgfOpts.maxWinrateLossForGoodMove / 100) {
    properties = markMoveAsGood(properties, 0);
  } else if (info.winrateLoss > sgfOpts.minWinrateLossForBadHotSpot / 100) {
    properties = markMoveAsBadHotSpot(properties, 0);
  } else if (info.winrateLoss > sgfOpts.minWinrateLossForBadMove / 100) {
    properties = markMoveAsBad(properties, 0);
  }

  return properties;
}

// Makes key data structure from sgf and katago responses.
//
// Please see test/sgfconv-internal.test.js
function sgfmovesFromResponses(rootAndSequence, responses, sgfOpts) {
  const pls = getPLs(rootAndSequence.root, 
    katagomovesFromSequence(rootAndSequence.sequence));
  const sgfmoves = sgfmovesFromSequence(rootAndSequence.sequence);

  // Notice that:
  // - pls -> pls[0] is the first move player.
  // - moves, sgfmoves -> moves[0] is the first move.
  // - currJSON.turnNumber -> 0, for the variations for the first move.
  // - currJSON.turnNumber -> 1, for the first move info.
  //
  // (ex) turnNumber 0 -> turn 'W', nextTurn 'B'
  let prevJSON = null;
  sgfOpts.maxVisits = 0;

  for (const response of responses) {
    const currJSON = JSON.parse(response);
    const turnNumber = currJSON.turnNumber;
    // Adds infos to current move.
    const turn = pls[(turnNumber + 1) % 2];
    // Adds variations to next move.
    const nextTurn = pls[turnNumber % 2];

    sgfOpts.maxVisits = Math.max(currJSON.rootInfo.visits, sgfOpts.maxVisits);

    // Sets info to move (turnNumber - 1).
    if (turnNumber != 0) {
      if (prevJSON != null && (turnNumber - 1) == prevJSON.turnNumber) {
        setInfoToSGFMove(turn, prevJSON.rootInfo, currJSON.rootInfo, 
          sgfmoves[turnNumber - 1]);
      } else {
        setInfoToSGFMove(turn, null, currJSON.rootInfo, 
          sgfmoves[turnNumber - 1]);
      }
    }

    // To add PVs after last move. We add pass move (B[], or W[]), and 
    // then add PVs.
    if (sgfOpts.showVariationsAfterLastMove == true
      && sgfmoves.length == turnNumber) {
      sgfmoves.push({move: pls[1] + '[]'});
    }

    // Sets PVs to move of turnNumber.
    if ((sgfOpts.showVariationsAfterLastMove == true
          || turnNumber != sgfmoves.length)
        && (sgfOpts.analyzeTurnsGiven == false
          || sgfOpts.analyzeTurns.indexOf(turnNumber) != -1)) {
      let variations = (sgfmoves[turnNumber].variations = []);

      for (const moveInfo of currJSON.moveInfos) {
        const variation = { moves: moveInfoToSequence(nextTurn, moveInfo) };

        setInfoToSGFMove(nextTurn, currJSON.rootInfo, moveInfo, variation);

        if (sgfOpts.showBadVariations == true
            || sgfOpts.maxWinrateLossForGoodMove / 100 > 
            variation.winrateLoss) {
          if (variations.length < sgfOpts.maxVariationsForEachMove) {
            variations.push(variation);
          } else {
            break;
          }
        }
      }
    }

    prevJSON = currJSON;
  }

  // Converts infos to SGF move properties.
  for (const sgfmove of sgfmoves) {
    // Adds move properties.
    sgfmove.move = addProperties(sgfmove.move, sgfmove, sgfOpts);

    if (sgfmove.variations) {
      // Adds variations properties.
      for (const variation of sgfmove.variations) {
        variation.moves = addProperties(variation.moves, variation, sgfOpts);
      }
    }
  }

  // FIXME: Remove last move if have no variations.

  return sgfmoves;
}

// Makes SGF GameTree.
function sgfmovesToGameTree(root, sgfmoves, sgfOpts) {
  const maxWinrateLossForGoodMove = sgfOpts.maxWinrateLossForGoodMove / 100;
  const minWinrateLossForBadMove = sgfOpts.minWinrateLossForBadMove / 100;
  const minWinrateLossForBadHotSpot = 
    sgfOpts.minWinrateLossForBadHotSpot / 100;
  const minWinrateLossForVariations = 
    sgfOpts.minWinrateLossForVariations / 100;

  // Good, bad, and bad hot spot moves.
  let blackGoodBads = [[],[],[]];
  let whiteGoodBads = [[],[],[]];

  let sgf = '';

  for (let i = sgfmoves.length - 1; i >= 0; --i) {
    const move = sgfmoves[i];
    const pl = move.move[move.move.search(/[BW]/)];
    var tail = '';

    // Counts bad moves for root comment
    if (move.winrateLoss < maxWinrateLossForGoodMove) {
      if (pl == 'B') {
        blackGoodBads[0].push(i);
      } else {
        whiteGoodBads[0].push(i);
      }
    }
    if (move.winrateLoss > minWinrateLossForBadMove) {
      if (pl == 'B') {
        blackGoodBads[1].push(i);
      } else {
        whiteGoodBads[1].push(i);
      }
    }
    if (move.winrateLoss > minWinrateLossForBadHotSpot) {
      if (pl == 'B') {
        blackGoodBads[2].push(i);
      } else {
        whiteGoodBads[2].push(i);
      }
    }

    // Adds variations.
    //
    // If winrateLoss of a move is bigger than minWinrateLossForVariations, 
    // add variations.
    if (move.variations) {
      if ((move.winrateLoss > minWinrateLossForVariations) 
        || sgfOpts.showVariationsOnlyForBadMove == false
        || sgfOpts.analyzeTurnsGiven
        || (i == (sgfmoves.length - 1) 
            && sgfOpts.showVariationsAfterLastMove)) {
        for (const variation of move.variations) {
          tail += variation.moves;
        }
      }
    }

    if (tail != '') {
      sgf = '(;' + move.move + sgf + ')' + tail; 
    } else {
      sgf = ';' + move.move + sgf;
    }
  }

  return '(' + root + getRootComment(root, sgfmoves, blackGoodBads, 
    whiteGoodBads, sgfOpts) + sgf + ')';
}

// As a result:
//
// # KagaGo Report
//
// 커제 (Black):
// * Good moves (83.44%, 126/151)
// * Bad moves (6.62%, 10/151): move 43, move 73, move 75, move 77, move 101, 
//   move 107, move 127, move 139, move 145, move 147
// * Bad hot sopts (0.66%, 1/151): move 77
//
// 신민준 (White):
// * Good moves (88.74%, 134/151)
// * Bad moves (5.30%, 8/151): move 74, move 76, move 80, move 84, move 126, 
//   move 130, move 134, move 146
//
// Good move: less than 2% win rate loss
// Bad move: more than 5% win rate loss
// Bad hot spot: more than 20% win rate loss
// 
// Variations added for the moves of less then 3% win rate loss.
function getRootComment(root, sgfmoves, blackGoodBads, whiteGoodBads, 
  sgfOpts) {
  if (sgfOpts.analyzeTurnsGiven) {
    return '';
  }

  const blackTotal = sgfmoves
    .reduce((acc, cur) => acc + (cur.move[0] == 'B' ? 1 : 0), 0);
  const whiteTotal = sgfmoves
    .reduce((acc, cur) => acc + (cur.move[0] == 'W' ? 1 : 0), 0);

  let pb = valueOfProp('PB', root);
  pb = pb.replace(/ *$/, '');
  pb = pb.replace(/^ */, '');

  if (pb != '') {
    pb = pb + ' (Black)';
  }

  let pw = valueOfProp('PW', root);
  pw = pw.replace(/ *$/, '');
  pw = pw.replace(/^ */, '');

  if (pw != '') {
    pw = pw + ' (White)';
  }

  function movesjoin(moves) {
    return moves
      .sort((a, b) => a - b)
      .map(x => 'move ' + (x + 1))
      .join(', ');
  }

  let rootComment = '# Analyze-SGF Report';

  function stat(comment, total, moves) {
    comment = '\n* Good moves (' + 
      ((moves[0].length / total) * 100).toFixed(2) + '%' + 
      ', ' + moves[0].length + '/' + total + ')';
    if (moves[1].length > 0) {
      comment += '\n* Bad moves (' + 
        ((moves[1].length / total) * 100).toFixed(2) + '%' + 
        ', ' + moves[1].length + '/' + total + '): ' + 
        movesjoin(moves[1]);
    }
    if (moves[2].length > 0) {
      comment += '\n* Bad hot sopts (' + 
        ((moves[2].length / total) * 100).toFixed(2) + '%' + 
        ', ' + moves[2].length + '/' + total + '): ' + 
        movesjoin(moves[2]);
    }
    return comment;
  }

  rootComment += '\n\n' + pb + ':';
  rootComment += stat(rootComment, blackTotal, blackGoodBads);

  rootComment += '\n\n' + pw + ':';
  rootComment += stat(rootComment, whiteTotal, whiteGoodBads);

  rootComment += 
    '\n\nGood move: less than ' + sgfOpts.maxWinrateLossForGoodMove + 
    '% win rate loss' + 
    '\nBad move: more than ' + sgfOpts.minWinrateLossForBadMove + 
    '% win rate loss' + 
    '\nBad hot spot: more than ' +
    sgfOpts.minWinrateLossForBadHotSpot + '% win rate loss\n' +
    '\nVariations added for the moves of less then ' + 
    sgfOpts.minWinrateLossForVariations + '% win rate loss.' +
    '\n\nAnalyzed with KataGo Parallel Analysis Engine (' + sgfOpts.maxVisits + 
    ' max visits).';

  return 'C[' + rootComment + ']';
}

module.exports = { rawPropValuesFromSGF
                 , valueOfProp
                 , valuesOfProp
                 , katagomovesFromSequence
                 , sgfmovesFromResponses
                 , initialStonesFromSequence
                 , iaFromJ1
                 , iaToJ1
                 , moveInfoToSequence
                 , markMove
                 , markMoveAsGood
                 , markMoveAsBad
                 , markMoveAsHotSpot
                 , markMoveAsBadHotSpot
                 , rootAndSequenceFromSGF
                 , sgfmovesFromSequence
                 , reduceTailsOfSGF
                 , stripComment
                 , setMoveComment
                 , sgfmovesToGameTree
                 };
