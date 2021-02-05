/**
 * @fileOverview Converts JSON-like string 'a:1,b:"test",...' to JSON
 *               string '{"a":1, "b":"test",...}'.
 */
'use strict';


module.exports = (badJSON) => {
	return JSON.parse('{' + badJSON
		.replace(/:\s*"([^"]*)"/g, function(match, p1) {
			return ': "' + p1.replace(/:/g, '@colon@') + '"';
		})
		// Replace ":" with "@colon@" if it's between single-quotes
		.replace(/:\s*'([^']*)'/g, function(match, p1) {
			return ': "' + p1.replace(/:/g, '@colon@') + '"';
		})
		// Add double-quotes around any tokens before the remaining ":"
		.replace(/(['"])?([a-z0-9A-Z_]+)(['"])?\s*:/g, '"$2": ')
		// Turn "@colon@" back into ":"
		.replace(/@colon@/g, ':')
    + '}');
};
