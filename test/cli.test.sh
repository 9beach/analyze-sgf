#!/usr/bin/env bash

set -e

test=$(mktemp)

echo Tests src/index.js with option -r.

cp test/ex-ren-vs-shin.sgf $test.sgf

# Creates $test-analyzed.sgf.
src/index.js -r test/ex-ren-vs-shin-responses.json $test.sgf \
	-g 'maxWinrateLossForGoodMove:2,minWinrateLossForBadMove:5,minWinrateLossForBadHotSpot:20,showVariationsAfterLastMove:false,minWinrateLossForVariations:5,showBadVariations:false,maxVariationsForEachMove:10' \
	&> /dev/null

# Strips commemnts.
cat test/ex-ren-vs-shin-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $test-expected
cat $test-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $test-result

# Compares them.
diff $test-expected $test-result

rm -f $test-*
echo Ok
