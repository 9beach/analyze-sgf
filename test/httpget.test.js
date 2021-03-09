const assert = require('assert');

const { isValidURL, httpget } = require('../src/httpget');

describe('httpget', () => {
  it('should download same SGF for cyberoro.', () => {
    const url =
      'https://www.cyberoro.com/gibo_new/giboviewer/giboviewer.asp?gibo=https://open.cyberoro.com/gibo/202102/usul-bekchanghee.sgf&gibonum=37122&bimg=&wimg=';
    assert.equal(isValidURL(url), true);
    const sgf = httpget(url);
    assert.equal(sgf.indexOf('(;GM['), 0);
    assert.equal(sgf[sgf.length - 1], ')');
  }).timeout(10000);
  it('should download same SGF for Tygem.', () => {
    const url = 'http://service.tygem.com/service/gibo2/?seq=26978';
    assert.equal(isValidURL(url), true);
    const sgf = httpget(url);
    assert.equal(sgf.indexOf('(;GM['), 0);
    assert.equal(sgf[sgf.length - 1], ')');
  }).timeout(10000);
});
