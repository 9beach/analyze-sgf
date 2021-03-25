/**
 * @fileOverview Helper functions for KataGo analysis JSON format.
 */

const sgfconv = require('./sgfconv');

// { AB: ['aa', 'bb'], AW: ['ab'] } => [["B", "A1"], ["B", "B2"], ["W", "A2"]]
const initialStonesFromRoot = (root) => [
  ...(root.AB || []).map((pos) => ['B', sgfconv.iaToJ1(pos)]),
  ...(root.AW || []).map((pos) => ['W', sgfconv.iaToJ1(pos)]),
];

// ("W", { scoreLead: 21.050, pv:["A1","B2","C3"] }) => '(;W[aa];B[bb];W[cc])'
const seqFromKataGoMoveInfo = (pl, moveInfo) =>
  `(${
    moveInfo.pv.reduce(
      (acc, move) => [
        `${acc[0]};${acc[1]}[${sgfconv.iaFromJ1(move)}]`,
        acc[1] === 'W' ? 'B' : 'W',
      ],
      ['', pl],
    )[0]
  })`;

// ';W[po];B[hm];W[ae]' => [["W","Q15"],["B","H13"],["W","A5"]]
// ';W[po];TE[1]B[hm];W[]' => [["W","Q15"],["B","H13"]]
// (';W[po];B[hm];W[tt]', 19) => [["W","Q15"],["B","H13"]]
const seqToKataGoMoves = (seq, sz = 19) =>
  seq
    .split(';')
    .filter((move) => move && sgfconv.isRegularMove(move, sz))
    .map((move) => {
      const i = move.search(/\b[BW]\[[^\]]/);
      return [move[i], sgfconv.iaToJ1(move.substring(i + 2, i + 4))];
    });

// '{"id":"Q","isDuringSearch..."turnNumber":3}' => 3
const toTurnNumber = (r) => parseInt(r.replace(/.*:/, ''), 10);

// Overwrites revisited to original.
const mergeKataGoResponses = (original, revisited, turns) =>
  original
    .split('\n')
    .filter((l) => turns.indexOf(toTurnNumber(l)) === -1)
    .join('\n') + revisited;

// Makes turnNumber to real turnNumber map.
//
// Pass moves are not included in KataGo analysis. So we need to convert
// KataGo turnNumbers to real turnNumbers considering previous passing moves.
// Real `turnNumber` is `realTurnNumbersMap[turnNumber]`.
const makeRealTurnNumbersMap = (seq) =>
  [0].concat(
    seq
      .split(';')
      .filter((v) => v)
      .map((move, index) => (sgfconv.isRegularMove(move) ? index + 1 : -1))
      .filter((v) => v !== -1),
  );

// Returns array of (turnNumber - 1) whose win rate drops by more than given
// winrateDrop.
const winrateDropTurnsFromKataGoResponses = (responses, winrateDrop) =>
  responses
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

// Makes JSON data to send KataGo Parallel Analysis Engine.
function sgfToKataGoAnalysisQuery(sgf, analysisOpts) {
  const query = { ...analysisOpts };

  // Gets komi from SGF.
  const rs = sgfconv.rootAndSeqFromSGF(sgf);

  if (rs.root.KM) query.komi = parseFloat(rs.root.KM[0]);
  if (rs.root.PL) [query.initialPlayer] = rs.root.PL;
  const sz = rs.root.SZ ? parseInt(rs.root.SZ[0], 10) : 0;

  query.id = `9beach-${Date.now()}`;
  query.initialStones = initialStonesFromRoot(rs.root);
  query.moves = seqToKataGoMoves(rs.seq, sz);

  if (!query.analyzeTurns) {
    query.analyzeTurns = [...Array(query.moves.length + 1).keys()];
  } else if (sgfconv.hasPassMoves(rs.seq)) {
    const realTurnNumbers = makeRealTurnNumbersMap(rs.seq);
    query.analyzeTurns = query.analyzeTurns
      .map((turn) => realTurnNumbers.indexOf(turn))
      .filter((turn) => turn !== -1);
  }
  return query;
}

module.exports = {
  initialStonesFromRoot,
  seqToKataGoMoves,
  seqFromKataGoMoveInfo,
  sgfToKataGoAnalysisQuery,
  mergeKataGoResponses,
  winrateDropTurnsFromKataGoResponses,
  makeRealTurnNumbersMap,
};
