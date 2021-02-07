/** 
 * @fileOverview Command line interface for analyze-sgf.
 */
'use strict';

const help = 
`Usage: analyze-sgf [-k=json-data] [-g=json-data] [-s] [-r=json-file] sgf-file

Option: 
  -k, --katago            JSON data for KataGo Parallel Analysis Engine query
  -g, --sgf               JSON data for making reviewed SGF file
  -s,                     Save KataGo responses JSON
  -r,                     Analyze KataGo responses JSON

Examples:
  analyze-sgf -k 'rules:"korean",komi:6.5' baduk.sgf
  analyze-sgf -k 'maxVisits:6400,analyzeTurns:[197,198]' baduk.sgf
  analyze-sgf -g 'maxVisits:600' baduk.sgf
  analyze-sgf baduk.sgf
  analyze-sgf -r baduk-responses.json baduk.sgf

Edit ~/.analyze-sgf.yml for default options
Report analyze-sgf bugs to <https://github.com/9beach/analyze-sgf/issues>
analyze-sgf home page: <https://github.com/9beach/analyze-sgf/>`;

module.exports = help;
