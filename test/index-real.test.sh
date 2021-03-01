#!/usr/bin/env bash

set -e

REPO_PATH="$(dirname $(cd "$(dirname "$0")" > /dev/null 2>&1; pwd -P))"
cd $REPO_PATH

# Setup test fixtures.
######################
temp=$(mktemp)
cp test/examples/t-sabaki-1.sgf $temp-1.sgf
cp test/examples/t-sabaki-2.sgf $temp-2.sgf

echo -e "\033[1;32mKataGo testing\033[0m"

# Test 1.
#########
echo -n Tests src/index.js with option -a and \"t-sabaki-?.sgf\".

# Creates $temp-analyzed.sgf.
src/index.js -a 'maxVisits:40' -g 'minWinrateDropForVariations:-100,showBadVariations:true,maxVariationsForEachMove:3' -s \
	$temp-?.sgf &> $temp.result

wc0=$(wc < $temp.result | awk '{print $1}')
wc1=$(wc < $temp-1.json | awk '{print $1}')
wc2=$(wc < $temp-2.json | awk '{print $1}')
wc3=$(cat $temp-1-analyzed.sgf | sed -e 's:(;[BW]:|__:g' | tr '|' '\n' | grep '__'  | wc -l)
wc4=$(cat $temp-2-analyzed.sgf | sed -e 's:(;[BW]:|__:g' | tr '|' '\n' | grep '__'  | wc -l)

if [[ $wc0 -gt 30 ]] && [[ $wc1 -eq 5 ]] && [[ $wc2 -eq 6 ]] && [[ $wc3 -eq 12 ]] && [[ $wc4 -eq 16 ]]; then
	echo -e "\033[1;32m Ok \033[0m"
else
	echo -e "\033[1;31m Failure \033[0m"
	echo $wc0 $wc1 $wc2 $wc3 $wc4
	echo -----------
	cat $temp-1.json
	echo -----------
	cat $temp-2.json
	exit 1
fi

# Test 2.
#########
echo -n Tests src/index.js with option -a \"analyzeTurns\" and \"t-sabaki-?.sgf\".

# Creates $temp-analyzed.sgf.
src/index.js -a 'maxVisits:40,analyzeTurns:[0,3]' -g 'minWinrateDropForVariations:-100,showBadVariations:true,maxVariationsForEachMove:3,showVariationsAfterLastMove:true' \
	$temp-?.sgf &> $temp.result

wc0=$(cat $temp-1-analyzed.sgf | sed -e 's:(;[BW]:|__:g' | tr '|' '\n' | grep '__'  | wc -l)
wc1=$(cat $temp-2-analyzed.sgf | sed -e 's:(;[BW]:|__:g' | tr '|' '\n' | grep '__'  | wc -l)

if [[ $wc0 -eq 8 ]] && [[ $wc1 -eq 8 ]]; then
	echo -e "\033[1;32m Ok \033[0m"
else
	echo -e "\033[1;31m Failure \033[0m"
fi

# Teardown test fixtures.
#########################
rm -f $temp-*
