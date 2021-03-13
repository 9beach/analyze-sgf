#!/usr/bin/env bash

set -e

REPO_PATH="$(dirname $(cd "$(dirname "$0")" > /dev/null 2>&1; pwd -P))"
cd $REPO_PATH

src/index.js -a 'analyzeTurns:[0,1,2,3,4]' -g 'minWinrateDropForVariations:-100,showBadVariations:true,maxVariationsForEachMove:20,showVariationsAfterLastMove:true' \
	-f test/examples/t-sabaki-2.json
