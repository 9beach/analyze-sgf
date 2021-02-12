#!/usr/bin/env bash

set -e

######################
# Setup test fixtures.
######################
test=$(mktemp)
cp test/t-ren-vs-shin.sgf $test.sgf

#########
# Test 1.
#########
echo -n Tests src/index.js with option -r.

# Creates $test-analyzed.sgf.
src/index.js -f test/t-ren-vs-shin-responses.json \
	-g 'maxWinrateLossForGoodMove:2,minWinrateLossForBadMove:5,minWinrateLossForBadHotSpot:20,showVariationsAfterLastMove:false,minWinrateLossForVariations:5,showBadVariations:false,maxVariationsForEachMove:10' \
	$test.sgf &> /dev/null

# Strips commemnts.
cat test/t-ren-vs-shin-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $test-expected
cat $test-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $test-result

# Compares them.
diff $test-expected $test-result

echo -e "\033[1;32m Ok \033[0m"

#########
# Test 2.
#########
echo -n Tests src/index.js with option -k and \"cat\".

# Creates $test-analyzed.sgf.
src/index.js -k 'path:"cat",arguments:"test/t-ren-vs-shin-responses.json"' \
	-g 'maxWinrateLossForGoodMove:2,minWinrateLossForBadMove:5,minWinrateLossForBadHotSpot:20,showVariationsAfterLastMove:false,minWinrateLossForVariations:5,showBadVariations:false,maxVariationsForEachMove:10' \
        $test.sgf &> /dev/null

# Strips commemnts.
cat test/t-ren-vs-shin-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $test-expected
cat $test-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $test-result

# Compares them.
diff $test-expected $test-result

echo -e "\033[1;32m Ok \033[0m"

#########
# Test 3.
#########
echo -n Tests src/index.js with option -k and \"katago-error.sh\".

src/index.js -k 'path:"test/katago-error.sh",arguments:""' $test.sgf 2> $test-result || true

grep '  path: "test/katago-error.sh"' $test-result &> /dev/null
grep '  arguments: "' $test-result &> /dev/null
grep 'This is test response of KataGo error' $test-result &> /dev/null
grep 'This is error text' $test-result &> /dev/null

echo -e "\033[1;32m Ok \033[0m"

#########################
# Teardown test fixtures.
#########################
rm -f $test-*
