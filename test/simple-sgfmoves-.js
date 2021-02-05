/**
 * @fileOverview Simple KataGo responses and SGFmoves for test.
 */
'use strict';

const sgf = '(;GM[1]FF[4]CA[UTF-8]KM[7.5]SZ[19];B[po])';

// Real winrate of KakaGo responses is of float type and less than 1. 
// Belows are just for easy testing.
const responses = [
  '{"id": "foo", "moveInfos": [ { "pv": ["A1", "B2"], "scoreLead": 10, "visits": 4, "winrate": 0.5 }, { "pv": ["C3", "D4"], "scoreLead": 20, "visits": 2, "winrate": 0.54 } ], "rootInfo": { "scoreLead": 9, "visits": 500, "winrate": 0.52 }, "turnNumber": 0}',
  '{"id": "foo", "moveInfos": [ { "pv": ["E5", "F6"], "scoreLead": 10, "visits": 4, "winrate": 0.4 }, { "pv": ["G7", "H8"], "scoreLead": 23, "visits": 2, "winrate": 0.54 } ], "rootInfo": { "scoreLead": 20, "visits": 500, "winrate": 0.56 }, "turnNumber": 1}' ];

module.exports = { sgf, responses };
