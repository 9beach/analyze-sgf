/**
 * @fileOverview Convert between one line SGF and JSON query/response of 
 *               KataGo Parallel Analysis Engine.
 */
'use strict';

const internal = require('./sgfconv-internal');

// Gets JSON data to send KataGo Parallel Analysis Engine with pipe.
function sgfToKataGoAnalysisQuery(sgf, analysisOpts) {
  const reduced = internal.reduceTailsOfSGF(sgf);
  const komi = internal.valueOfProp('KM', reduced);

  if (komi != '') {
    analysisOpts.komi = parseFloat(komi);
    console.error('"komi" is set to ' + analysisOpts.komi + ' from SGF.');
  }

  const initialPlayer = internal.valueOfProp('PL', reduced);
  if (initialPlayer != '') {
    analysisOpts.initialPlayer = initialPlayer;
    console.error('"initialPlayer" is set to ' + initialPlayer + ' from SGF.');
  }

  analysisOpts.id = 'q9';
  analysisOpts.initialStones = internal.initialStonesFromSequence(reduced);
  analysisOpts.moves = internal.katagomovesFromSequence(reduced);

  if (!analysisOpts.analyzeTurns) {
    analysisOpts.analyzeTurns = 
      [...Array(analysisOpts.moves.length + 1).keys()];
  }

  return JSON.stringify(analysisOpts);
}

function kataGoAnalysisResponseToSGF(sgf, responses, sgfOpts) {
  // Checks KataGo error response.
  //
  // Now responses is of array type.
  if (responses.search('{"error":"') == 0 
    || responses.search('{"warning":') == 0) {
    throw 'KataGo error: ' + responses;
  }

  responses = responses.split('\n');
  if (responses[responses.length - 1] == '')
    responses = responses.slice(0, responses.length - 1);

  // Sorts responses by turnNumber.
  //
  // Response format: '{"id":"Q","isDuringSearch..."turnNumber":3}'
  responses.sort((a, b) =>
    parseInt(a.replace(/.*:/, '')) - parseInt(b.replace(/.*:/, ''))
  );

  const reduced = internal.rootAndSequenceFromSGF(sgf);
  const sgfmoves = internal.sgfmovesFromResponses(reduced, responses, sgfOpts);
  const rsgf = internal.sgfmovesToGameTree(reduced.root, sgfmoves, sgfOpts);

  return rsgf;
}

module.exports = { sgfToKataGoAnalysisQuery
                 , kataGoAnalysisResponseToSGF
                 };
