#!/usr/bin/env node

/**
 * @fileOverview Downloads SGF from URL (Tygem and CyberORO).
 */

const { XMLHttpRequest } = require('xmlhttprequest');

const TYGEM_URL_BEGINS = 'http://service.tygem.com/service/gibo2/?seq=';
const ORO_URL_BEGINS = 'https://www.cyberoro.com/gibo_new/giboviewer/gibovie';

const isValidURL = (url) =>
  url.indexOf(TYGEM_URL_BEGINS) === 0 || url.indexOf(ORO_URL_BEGINS) === 0;

function httpgetRawSGF(url) {
  if (!isValidURL(url)) throw Error('URL not supported.');

  const http = new XMLHttpRequest();
  http.open('GET', url, false);
  http.send(null);

  return url.indexOf(TYGEM_URL_BEGINS) === 0
    ? http.responseText
        .replace(/\r\n/g, '')
        .replace(/.*var sgf = "/, '')
        .replace(/\).*/, ')')
    : http.responseText
        .replace(/\r\n/g, '')
        .replace(/.*"hidden" name = "gibo_txt" id = "gibo_txt"[^(]*/, '')
        .replace(/\).*/, ')');
}

function httpgetSGF(url) {
  const sgf = httpgetRawSGF(url);
  if (
    sgf[sgf.length - 1] !== ')' ||
    (sgf.indexOf('(TE[') !== 0 && sgf.indexOf('(;GM[') !== 0)
  )
    throw Error('Invalid response from URL');

  // Fixes SGF dialects (KO/TE/RD) for other SGF editors.
  // Fixes bad Tygem SGF. e.g., '대주배 16강 .'
  // Fixes bad Tygem SGF. e.g., '신진서  '
  // Fixes bad Tygem SGF. e.g., '김미리:김미리:4단'.
  return sgf
    .replace(/\([;]*TE\[/, '(;GM[1]FF[4]EV[')
    .replace(/\bRD\[/, 'DT[')
    .replace(/\bK[OM]\[\]/, '')
    .replace(/\bKO\[/, 'KM[')
    .replace(/\bKM\[/, 'CA[UTF-8]KM[')
    .replace(/ \.\]/g, ']')
    .replace(/ *\]/g, ']')
    .replace(/\[ */g, '[')
    .replace(/(P[BW]\[[^\]:]*):[^\]]*\]/g, '$1]');
}

module.exports = { isValidURL, httpgetSGF };

if (require.main === module) {
  try {
    if (process.argv.length !== 3)
      console.log('Usage: httpget-sgf URL > FILE');
    else console.log(httpgetSGF(process.argv[2]));
  } catch (error) {
    console.log(error.message);
  }
}
