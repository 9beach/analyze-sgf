/**
 * @fileOverview Helper functions for KataGo analysis JSON format.
 */

const sgfconv = require('./sgfconv');

// '..AB[aa][bb]AW[ab];W[po]...' => [["B","A1"],["B","B2"],["W","A2"]]
function sequenceToInitialStones(sequence) {
  return [
    ...sgfconv
      .valuesFromSequence('AB', sequence)
      .map((pos) => ['B', sgfconv.iaToJ1(pos)]),
    ...sgfconv
      .valuesFromSequence('AW', sequence)
      .map((pos) => ['W', sgfconv.iaToJ1(pos)]),
  ];
}

// ("W", { scoreLead: 21.050, pv:["A1","B2","C3"] }) => '(;W[aa];B[bb];W[cc])'
function sequenceFromKataGoMoveInfo(pl, moveInfo) {
  const sequence = moveInfo.pv.reduce(
    (acc, move) => [
      `${acc[0]};${acc[1]}[${sgfconv.iaFromJ1(move)}]`,
      acc[1] === 'W' ? 'B' : 'W',
    ],
    ['', pl],
  );

  return `(${sequence[0]})`;
}

// Makes JSON data to send KataGo Parallel Analysis Engine.
function sgfToKataGoAnalysisQuery(sgf, analysisOpts) {
  const query = { ...analysisOpts };
  const sequence = sgfconv.removeTails(sgf);
  const komi = sgfconv.valueFromSequence(sequence, 'KM');

  // Overrides komi from SGF.
  if (komi) query.komi = parseFloat(komi);

  const initialPlayer = sgfconv.valueFromSequence(sequence, 'PL');
  if (initialPlayer) {
    query.initialPlayer = initialPlayer;
  }

  query.id = `9beach-${Date.now()}`;
  query.initialStones = sequenceToInitialStones(sequence);
  query.moves = sequenceToKataGoMoves(sequence);

  if (!query.analyzeTurns) {
    query.analyzeTurns = [...Array(query.moves.length + 1).keys()];
  }

  return query;
}

// '..AB[dp];W[po];B[hm];W[ae]...' => [["W","Q15"],["B","H13"],["W","A5"]]
// '..AB[dp];W[po];B[hm]TE[1];W[]...' => [["W","Q15"],["B","H13"]]
function sequenceToKataGoMoves(sequence) {
  return sequence
    .split(';')
    .filter((move) => move.search(/[BW]\[[^\]]/) === 0)
    .map((move) => [move[0], sgfconv.iaToJ1(move.substring(2, 4))]);
}

const getTurnNumber = (a) => parseInt(a.replace(/.*:/, ''), 10);

function joinKataGoResponses(original, revisited, turns) {
  return (
    original
      .split('\n')
      .filter((l) => turns.indexOf(getTurnNumber(l)) === -1)
      .join('\n') + revisited
  );
}

// Returns array of (turnNumber - 1) whose win rate drops by more than given
// paremeter.
function winrateDropTurnsFromKatagoResponses(responses, winrateDrop) {
  return responses
    .replace(/.*"rootInfo"/g, '{"rootInfo"')
    .split('\n')
    .filter((l) => Boolean(l))
    .map((l) => JSON.parse(l))
    .sort((a, b) => a.turnNumber - b.turnNumber)
    .reduce(
      (acc, cur) => {
        if (
          acc.turnNumber === cur.turnNumber - 1 &&
          Math.abs(acc.winrate - cur.rootInfo.winrate) > winrateDrop
        ) {
          // Adds previous turn number for PVs.
          acc.analyzeTurns.push(acc.turnNumber);
        }
        acc.winrate = cur.rootInfo.winrate;
        acc.turnNumber = cur.turnNumber;
        return acc;
      },
      { analyzeTurns: [] },
    ).analyzeTurns;
}

module.exports = {
  sequenceToInitialStones,
  sequenceToKataGoMoves,
  sequenceFromKataGoMoveInfo,
  sgfToKataGoAnalysisQuery,
  joinKataGoResponses,
  winrateDropTurnsFromKatagoResponses,
};
