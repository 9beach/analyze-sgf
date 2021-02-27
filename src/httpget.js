/**
 * @fileOverview Downloads SGF from URL.
 */

const { XMLHttpRequest } = require('xmlhttprequest');

const sgfconv = require('./sgfconv');

function httpgetraw(url) {
  const http = new XMLHttpRequest();
  http.open('GET', url, false);
  http.send(null);
  return http.responseText;
}

const TYGEM_URL_BEGINS = 'http://service.tygem.com/service/gibo2/?seq=';
const ORO_URL_BEGINS = 'https://www.cyberoro.com/gibo_new/giboviewer/gibovie';

function isValidURL(url) {
  if (url.indexOf(TYGEM_URL_BEGINS) === 0) return true;
  if (url.indexOf(ORO_URL_BEGINS) === 0) return true;

  return false;
}

function httpget(url) {
  if (!isValidURL(url)) throw Error('URL not supported.');

  let sgf = httpgetraw(url);

  if (url.indexOf(TYGEM_URL_BEGINS) === 0) {
    sgf = sgf
      .replace(/\r\n/g, '')
      .replace(/.*var sgf = "/, '')
      .replace(/\).*/, ')');
  } else if (url.indexOf(ORO_URL_BEGINS) === 0) {
    sgf = sgf
      .replace(/\r\n/g, '')
      .replace(/.*"hidden" name = "gibo_txt" id = "gibo_txt"[^(]*/, '')
      .replace(/\).*/, ')');
  }

  if (
    sgf[sgf.length - 1] !== ')' ||
    (sgf.indexOf('(TE[') !== 0 && sgf.indexOf('(;GM[') !== 0)
  )
    throw Error('Invalid response from URL');

  // Fixs SGF dialect (KO/TE/RD) for other SGF editors.
  sgf = sgf.replace(/\bKO\[\]/, '').replace(/\bKM\[\]/, '');
  sgf = sgf.replace(/\bTE\[/, ';GM[1]FF[4]EV[').replace(/\bRD\[/, 'DT[');
  if (
    sgfconv.valueFromSequence(sgf, 'KO') &&
    sgfconv.valueFromSequence(sgf, 'KM') === ''
  ) {
    sgf = sgf.replace(/\bKO\[/, 'KM[');
  }

  return sgf;
}

module.exports = { isValidURL, httpget };
