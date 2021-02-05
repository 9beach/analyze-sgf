const assert = require('assert');

const parseBadJSON = require('../src/bad-json');

describe('parseBadJSON', function () {
  const value = 'a: 1,b: 2,c: "test",dd: [1,2]';
  it('should be expected values', () => {
    assert.deepEqual(parseBadJSON(value), { a:1, b: 2, c:"test", dd: [1,2]});
  });
});
