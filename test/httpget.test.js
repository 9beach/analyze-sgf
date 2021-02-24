const assert = require('assert');

const { isValidURL, httpget } = require('../src/httpget');

describe('httpget', () => {
  it('should be expected values.', () => {
    let sgf;
    let url =
      'https://www.cyberoro.com/gibo_new/giboviewer/giboviewer.asp?gibo=https://open.cyberoro.com/gibo/202102/usul-bekchanghee.sgf&gibonum=37122&bimg=&wimg=';
    assert.equal(isValidURL(url), true);
    sgf = httpget(url);
    assert.equal(sgf.indexOf('(TE['), 0);
    assert.equal(sgf[sgf.length - 1], ')');

    url = 'http://service.tygem.com/service/gibo2/?seq=26978';
    assert.equal(isValidURL(url), true);
    sgf = httpget(url);
    assert.equal(sgf.indexOf('(;GM['), 0);
    assert.equal(sgf[sgf.length - 1], ')');
  });
});
