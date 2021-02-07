/**
 * @fileOverview Converts JSON-like string 'age:1,name:"Kim",...' to JSON
 *               string '{"age":1,"name":"Kim",...}'.
 */
'use strict';

module.exports = (badJSON) => {
  return JSON.parse('{' + badJSON
    .replace(/:\s*"([^"]*)"/g, function(match, p1) {
      return ': "' + p1.replace(/:/g, '@colon@') + '"';
    })
    // Replaces ":" with "@colon@" if it's between single-quotes
    .replace(/:\s*'([^']*)'/g, function(match, p1) {
      return ': "' + p1.replace(/:/g, '@colon@') + '"';
    })
    // Adds double-quotes around any tokens before the remaining ":"
    .replace(/(['"])?([a-z0-9A-Z_]+)(['"])?\s*:/g, '"$2": ')
    // Turns "@colon@" back into ":"
    .replace(/@colon@/g, ':')
    + '}');
};
