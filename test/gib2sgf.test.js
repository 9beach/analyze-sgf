const fs = require('fs');
const assert = require('assert');
const jschardet = require('jschardet');
const iconv = require('iconv-lite');

const convert = require('../src/gib2sgf');

describe('convert', () => {
  it('should be same for t-gb2312.sgf.', () => {
    const content = fs.readFileSync('test/examples/t-gb2312.gib');
    const detected = jschardet.detect(content);
    const gib = iconv.decode(content, detected.encoding).toString();

    const sgf = fs.readFileSync('test/examples/t-gb2312.sgf').toString();
    assert.equal(convert(gib), sgf);
  });
  it('should be same for t-euc-kr.sgf.', () => {
    const content = fs.readFileSync('test/examples/t-euc-kr.gib');
    const detected = jschardet.detect(content);
    const gib = iconv.decode(content, detected.encoding).toString();

    const sgf = fs.readFileSync('test/examples/t-euc-kr.sgf').toString();
    assert.equal(convert(gib), sgf);
  });
  it('should be same for t-utf-8.sgf.', () => {
    const content = fs.readFileSync('test/examples/t-utf-8.gib');
    const detected = jschardet.detect(content);
    const gib = iconv.decode(content, detected.encoding).toString();

    const sgf = fs.readFileSync('test/examples/t-utf-8.sgf').toString();
    assert.equal(convert(gib), sgf);
  });
});
