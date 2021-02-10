/**
 * @fileOverview Generate the game report on players info, good moves,
 *               bad moves, and bad hot spots.
 */

// [1, 2, 5] => 'move 1, move 2, move 5'
function joinmoves(moves) {
  return moves
    .sort((a, b) => a - b)
    .map((x) => `move ${x + 1}`)
    .join(', ');
}

// Return value is like:
// * Bad moves (11.54%, 12/104): move 39, move 69, move 105, move 109, ...
function movesstat(goodbad, moves, total, listmoves = true) {
  let format;

  if (moves && moves.length > 0) {
    const ratio = ((moves.length / total) * 100).toFixed(2);
    format = `* ${goodbad} (${ratio}%, ${moves.length}/${total})`;
  } else {
    format = '';
  }

  if (moves && listmoves) {
    format += `: ${joinmoves(moves)}\n`;
  } else if (format !== '') {
    format += '\n';
  }

  return format;
}

// Return value is like:
// * Good moves (75.00%, 78/104)
// * Bad moves (11.54%, 12/104): move 39, move 69, move 105, move 109, ...
// * Bad hot spots (0.96%, 1/104): move 141
function goodbadsreport(total, moves) {
  return (
    movesstat('Good moves', moves[0], total, false) +
    movesstat('Bad moves', moves[1], total) +
    movesstat('Bad hot spots', moves[2], total)
  );
}

// Return values are like: '신진서 (Black):', 'Black :', 'White :'
function blackorwhite(player, color) {
  let pl = player.replace(/ *$/, '').replace(/^ */, '');

  if (pl !== '') {
    pl += ` (${color}):`;
  } else {
    pl = `${color}:`;
  }

  return pl;
}

// Generates report.
function reportmoves(
  blackplayer,
  blacktotal,
  blackgoodbads,
  whiteplayer,
  whitetotal,
  whitegoodbads,
  goodmovewinrate,
  badmovewinrate,
  badhotspotwinrate,
  variationwinrate,
  maxvariations,
  maxvisits,
) {
  const pb = blackorwhite(blackplayer, 'Black');
  const pw = blackorwhite(whiteplayer, 'White');

  return (
    `# Analyze-SGF Report` +
    `\n\n${pb}\n${goodbadsreport(blacktotal, blackgoodbads)}` +
    `\n${pw}\n${goodbadsreport(whitetotal, whitegoodbads)}` +
    `\nGood move: less than ${goodmovewinrate * 100}% win rate loss` +
    `\nBad move: more than ${badmovewinrate * 100}% win rate loss` +
    `\nBad hot spot: more than ${badhotspotwinrate * 100}% win rate loss` +
    `\n\nVariations added for the moves of more then ` +
    `${variationwinrate * 100}% win rate loss.` +
    `\nMaximum variations number for each move is ${maxvariations}.` +
    `\n\nAnalyzed by KataGo Parallel Analysis Engine (${maxvisits} max visits).`
  );
}

module.exports = reportmoves;
