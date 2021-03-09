const assert = require('assert');

const parseBadJSON = require('../src/bad-json');

describe('parseBadJSON', () => {
  const value = 'a: 1,bb: 2,ccc: "test", dddd: [1,2]';
  it('should be expected values.', () => {
    assert.deepEqual(parseBadJSON(value), {
      a: 1,
      bb: 2,
      ccc: 'test',
      dddd: [1, 2],
    });
  });
});
