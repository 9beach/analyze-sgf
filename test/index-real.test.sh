#!/usr/bin/env bash

set -e

REPO_PATH="$(dirname $(cd "$(dirname "$0")" > /dev/null 2>&1; pwd -P))"
cd $REPO_PATH

######################
# Setup test fixtures.
######################
temp=$(mktemp)
cp test/t-sabaki-1.sgf $temp-1.sgf
cp test/t-sabaki-2.sgf $temp-2.sgf

#########
# Test 1.
#########
echo -n Tests src/index.js with option -a and \"t-sabaki-?.sgf\".

# Creates $temp-analyzed.sgf.
src/index.js -a 'maxVisits:1' -g 'minWinrateDropForVariations:-100,showBadVariations:true' -s \
	$temp-?.sgf &> $temp.result

wc0=$(wc < $temp.result | awk '{print $2}')
wc1="$(wc < $temp-1.json | awk '{print $2}')"
wc2="$(wc < $temp-2.json | awk '{print $2}')"

if [[ $wc0 -gt 140 ]] && [[ $wc1 -eq 5 ]] && [[ $wc2 -eq 8 ]]; then
	echo -e "\033[1;32m Ok \033[0m"
else
	echo -e "\033[1;31m Failure \033[0m"
	echo $wc0 $wc1 $wc2
	echo -----------
	cat $temp-1.json
	echo -----------
	cat $temp-2.json
	exit 1
fi

#########################
# Teardown test fixtures.
#########################
rm -f $temp-*
