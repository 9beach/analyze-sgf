/**
 * @fileOverview Downloads SGF from URL.
 */

const { XMLHttpRequest } = require('xmlhttprequest');

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

  // Fixes SGF dialects (KO/TE/RD) for other SGF editors.
  // Fixes bad Tygem SGF. e.g., '대주배 16강 .'
  // Fixes bad Tygem SGF. e.g., '김미리:김미리:4단'.
  return sgf
    .replace(/\([;]*TE\[/, '(;GM[1]FF[4]EV[')
    .replace(/\bRD\[/, 'DT[')
    .replace(/\bK[OM]\[\]/, '')
    .replace(/\bKO\[/, 'KM[')
    .replace(/ \.\]/, ']')
    .replace(/(P[BW]\[[^\]:]*):[^\]]*\]/g, '$1]');
}

module.exports = { isValidURL, httpget };
