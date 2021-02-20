#!/usr/bin/env bash

set -e

REPO_PATH="$(dirname $(cd "$(dirname "$0")" > /dev/null 2>&1; pwd -P))"
cd $REPO_PATH

# Setup test fixtures.
temp=$(mktemp)
cp test/t-ren-vs-shin.sgf $temp-1.sgf
cp test/t-ren-vs-shin.json $temp-1.json
cp test/t-sabaki-1.sgf $temp-2.sgf
cp test/t-sabaki-1.json $temp-2.json

echo -e "\033[1;32mMockup testing\033[0m"
### New testing.
echo -n Tests src/index.js with option -f and multiple files.

src/index.js -g 'maxWinrateDropForGoodMove:2,minWinrateDropForBadMove:5,minWinrateDropForBadHotSpot:20,showVariationsAfterLastMove:false,minWinrateDropForVariations:5,showBadVariations:false,maxVariationsForEachMove:10' \
	-f $temp-1.json $temp-2.json &> /dev/null

cat test/t-ren-vs-shin-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-1-expected
cat $temp-1-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-1-result
diff $temp-1-expected $temp-1-result > /dev/null

cat test/t-sabaki-1-default.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-2-expected
cat $temp-2-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-2-result
diff $temp-2-expected $temp-2-result > /dev/null

echo -e "\033[1;32m Ok \033[0m"

### New testing.
echo -n Tests src/index.js with option -f, -a analyzeTurns and -g showVariationsAfterLastMove.

src/index.js -g 'maxWinrateDropForGoodMove:2,minWinrateDropForBadMove:5,minWinrateDropForBadHotSpot:20,showVariationsAfterLastMove:true,minWinrateDropForVariations:5,showBadVariations:false,maxVariationsForEachMove:10' \
	-a 'analyzeTurns:[0,1,2,3,4,5]' \
	-f $temp-2.json &> /dev/null

cat test/t-sabaki-1-turns-lastmove.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-2-expected
cat $temp-2-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-2-result
diff $temp-2-expected $temp-2-result > /dev/null

echo -e "\033[1;32m Ok \033[0m"

### New testing.
echo -n Tests src/index.js with option -f, -a analyzeTurns.

src/index.js -g 'maxWinrateDropForGoodMove:2,minWinrateDropForBadMove:5,minWinrateDropForBadHotSpot:20,showVariationsAfterLastMove:false,minWinrateDropForVariations:5,showBadVariations:false,maxVariationsForEachMove:10' \
	-a 'analyzeTurns:[0,1,2,3,4,5]' \
	-f $temp-2.json &> /dev/null

cat test/t-sabaki-1-turns.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-2-expected
cat $temp-2-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-2-result
diff $temp-2-expected $temp-2-result > /dev/null

echo -e "\033[1;32m Ok \033[0m"

### New testing.
echo -n Tests src/index.js with option -k and \"tail\".

src/index.js -k 'path:"test/tail.sh",arguments:"test/t-ren-vs-shin.json"' \
	-g 'maxWinrateDropForGoodMove:2,minWinrateDropForBadMove:5,minWinrateDropForBadHotSpot:20,showVariationsAfterLastMove:false,minWinrateDropForVariations:5,showBadVariations:false,maxVariationsForEachMove:10' \
	$temp-1.sgf &> /dev/null

cat test/t-ren-vs-shin-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-1-expected
cat $temp-1-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-1-result

diff $temp-1-expected $temp-1-result > /dev/null

echo -e "\033[1;32m Ok \033[0m"

### New testing.
echo -n Tests src/index.js with option -k,  -a analyzeTurns, -g showVariatiosAfterLastMove, and \"tail\".

src/index.js -k 'path:"test/tail.sh",arguments:"test/t-sabaki-1.json"' \
	-a 'analyzeTurns:[0,1,2,3,4,5]' \
	-g 'maxWinrateDropForGoodMove:2,minWinrateDropForBadMove:5,minWinrateDropForBadHotSpot:20,showVariationsAfterLastMove:true,minWinrateDropForVariations:5,showBadVariations:false,maxVariationsForEachMove:10' \
	$temp-2.sgf &> /dev/null

cat test/t-sabaki-1-turns-lastmove.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-2-expected
cat $temp-2-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-2-result

diff $temp-2-expected $temp-2-result > /dev/null

echo -e "\033[1;32m Ok \033[0m"

### New testing.
echo -n Tests src/index.js with option -k,  -a analyzeTurns, and \"tail\".

src/index.js -k 'path:"test/tail.sh",arguments:"test/t-sabaki-1.json"' \
	-a 'analyzeTurns:[0,1,2,3,4,5]' \
	-g 'maxWinrateDropForGoodMove:2,minWinrateDropForBadMove:5,minWinrateDropForBadHotSpot:20,showVariationsAfterLastMove:false,minWinrateDropForVariations:5,showBadVariations:false,maxVariationsForEachMove:10' \
	$temp-2.sgf &> /dev/null

cat test/t-sabaki-1-turns.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-2-expected
cat $temp-2-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $temp-2-result

diff $temp-2-expected $temp-2-result > /dev/null

echo -e "\033[1;32m Ok \033[0m"

### New testing.
echo -n Tests src/index.js with option -k and \"katago-error.sh\".

! src/index.js -k 'path:"test/katago-error.sh",arguments:""' $temp-1.sgf 2> /dev/null

echo -e "\033[1;32m Ok \033[0m"

# Teardown test fixtures.
rm -f $temp*
