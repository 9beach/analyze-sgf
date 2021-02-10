/**
 * @fileOverview Converts JSON-like string 'age:1,name:"Kim",...' to
 *               JSON string '{"age":1,"name":"Kim",...}'.
 */

module.exports = (badJSON) => {
  const goodJSON = badJSON
    .replace(
      /:\s*"([^"]*)"/g,
      (match, p1) => `: "${p1.replace(/:/g, '@colon@')}"`,
    )
    // Replaces ":" with "@colon@" if it's between single-quotes
    .replace(
      /:\s*'([^']*)'/g,
      (match, p1) => `: "${p1.replace(/:/g, '@colon@')}"`,
    )
    // Adds double-quotes around any tokens before the remaining ":"
    .replace(/(['"])?([a-z0-9A-Z_]+)(['"])?\s*:/g, '"$2": ')
    // Turns "@colon@" back into ":"
    .replace(/@colon@/g, ':');

  return JSON.parse(`{${goodJSON}}`);
};
