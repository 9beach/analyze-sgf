#!/usr/bin/env bash

set -e

# Test 1.
echo -n Tests src/index.js with option -r.

test=$(mktemp)

cp test/t-ren-vs-shin.sgf $test.sgf

# Creates $test-analyzed.sgf.
src/index.js -f test/t-ren-vs-shin-responses.json \
	-g 'maxWinrateLossForGoodMove:2,minWinrateLossForBadMove:5,minWinrateLossForBadHotSpot:20,showVariationsAfterLastMove:false,minWinrateLossForVariations:5,showBadVariations:false,maxVariationsForEachMove:10' \
	$test.sgf &> /dev/null

# Strips commemnts.
cat test/t-ren-vs-shin-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $test-expected
cat $test-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $test-result

# Compares them.
diff $test-expected $test-result

rm -f $test-*

echo -e "\033[1;32m Ok \033[0m"

# Test 2.
echo -n Tests src/index.js with option -k.

test=$(mktemp)

cp test/t-ren-vs-shin.sgf $test.sgf

# Creates $test-analyzed.sgf. Mock-up test.
src/index.js -k 'path:"cat",arguments:"test/t-ren-vs-shin-responses.json"' \
	-g 'maxWinrateLossForGoodMove:2,minWinrateLossForBadMove:5,minWinrateLossForBadHotSpot:20,showVariationsAfterLastMove:false,minWinrateLossForVariations:5,showBadVariations:false,maxVariationsForEachMove:10' \
        $test.sgf &> /dev/null

# Strips commemnts.
cat test/t-ren-vs-shin-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $test-expected
cat $test-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $test-result

# Compares them.
diff $test-expected $test-result

rm -f $test-*

echo -e "\033[1;32m Ok \033[0m"
