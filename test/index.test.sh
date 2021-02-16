#!/usr/bin/env bash

set -e

REPO_PATH="$(dirname $(cd "$(dirname "$0")" > /dev/null 2>&1; pwd -P))"
cd $REPO_PATH

######################
# Setup test fixtures.
######################
temp=$(mktemp)
cp test/t-ren-vs-shin.sgf $temp.sgf
cp test/t-ren-vs-shin-responses.json $temp.json

#########
# Test 1.
#########
echo -n Tests src/index.js with option -f.

# Creates $temp-analyzed.sgf.
src/index.js -f $temp.json \
	-g 'maxWinrateLossForGoodMove:2,minWinrateLossForBadMove:5,minWinrateLossForBadHotSpot:20,showVariationsAfterLastMove:false,minWinrateLossForVariations:5,showBadVariations:false,maxVariationsForEachMove:10' \
	&> /dev/null

# Strips commemnts.
cat test/t-ren-vs-shin-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-expected
cat $temp-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-result

# Compares them.
diff $temp-expected $temp-result

echo -e "\033[1;32m Ok \033[0m"

#########
# Test 2.
#########
echo -n Tests src/index.js with option -k and \"tail\".

# Creates $temp-analyzed.sgf.
src/index.js -k 'path:"tail",arguments:"-n +2 test/t-ren-vs-shin-responses.json"' \
	-g 'maxWinrateLossForGoodMove:2,minWinrateLossForBadMove:5,minWinrateLossForBadHotSpot:20,showVariationsAfterLastMove:false,minWinrateLossForVariations:5,showBadVariations:false,maxVariationsForEachMove:10' \
        $temp.sgf &> /dev/null

# Strips commemnts.
cat test/t-ren-vs-shin-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-expected
cat $temp-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-result

# Compares them.
diff $temp-expected $temp-result

echo -e "\033[1;32m Ok \033[0m"

#########
# Test 3.
#########
echo -n Tests src/index.js with option -k and \"katago-error.sh\".

src/index.js -k 'path:"test/katago-error.sh",arguments:""' $temp.sgf 2> $temp-result || true

grep '^{"path":"test/katago-error.sh","arguments":""}' $temp-result &> /dev/null
grep '^This is KataGo error test.' $temp-result &> /dev/null
grep '^This is error message.' $temp-result &> /dev/null

echo -e "\033[1;32m Ok \033[0m"

#########################
# Teardown test fixtures.
#########################
rm -f $temp-*
