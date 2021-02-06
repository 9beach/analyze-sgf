#!/usr/bin/env bash

set -e

sample=$(mktemp)

echo Tests src/cli.sh with option -r.

cp test/ren-vs-shin.sgf $sample.sgf
src/cli.js -r test/ren-vs-shin-responses.json $sample.sgf &> /dev/null
# Now $sample-analyzed.sgf created.
cat test/ren-vs-shin-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $sample-expected
cat $sample-analyzed.sgf | tr -d '\n' | sed -e 's:C\[[^]]*\]::g' > $sample-result

diff $sample-expected $sample-result
echo Got it.
