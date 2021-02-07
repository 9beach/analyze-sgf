#!/usr/bin/env bash

set -e

sample=$(mktemp)

echo Tests src/cli.sh with option -r.

cp test/ex-ren-vs-shin.sgf $sample.sgf

# Creates $sample-analyzed.sgf.
src/cli.js -r test/ex-ren-vs-shin-responses.json $sample.sgf &> /dev/null

# Strips commemnts.
cat test/ex-ren-vs-shin-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $sample-expected
cat $sample-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $sample-result

# Compares them.
diff $sample-expected $sample-result

rm -f $sample-*
echo Got it.
