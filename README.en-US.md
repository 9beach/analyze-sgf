# analyze-sgf

[![Build Status](https://travis-ci.org/9beach/analyze-sgf.svg?branch=master)](https://travis-ci.org/9beach/analyze-sgf)
[![npm version](https://badge.fury.io/js/analyze-sgf.svg)](https://badge.fury.io/js/analyze-sgf)

[한국어](README.md) | English

`analyze-sgf` analyzes [SGF](https://en.wikipedia.org/wiki/Smart_Game_Format)
files by [KataGo Parallel Analysis Engine](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md)
to generate the win rate graphs, and label good and bad moves, and propose
the variations, and save them as new SGF files.

With [Sabaki](https://sabaki.yichuanshen.de/) or
[Lizzie](https://github.com/featurecat/lizzie) with
KataGo, you can analyze a SGF file in real time. But with `analyze-sgf`, you
can analyze many SGF files all at once, and save the KataGo reviewed SGF files
automatically. If you open this reviewed SGF files with Sabaki, you can
analyze them with the help of the overall win rate, good and bad move
labes, and proposed variations.

`analyze-sgf` also gives you a way to specify a very large number of visits
and let KataGo analyze several hours, then save and recycle the 
KataGo analysis data (not reviewed SGF). This provides a whole new level of
depth compared to using KataGo in real time.

## Installation

First install [Node.js] and [https://github.com/lightvector/KataGo/releases)],
then install `analyze-sgf`.

On a Mac or Linux environment, run the following from a terminal.

```console
sudo npm install -g analyze-sgf
```

In Microsoft Windows environment, run the following from a `Command Prompt` or
`PowerShell`.
```console
C:\Users\hcho> npm install -g analyze-sgf
```

## Usage

The first time you run `analyze-sgf`, it creates a `.analyze-sgf.yml` file in
your home directory and prints out the default usage as follows: In a Windows
environment, it should be run with `analyze-sgf.cmd` rather than `analyze-sgf`,
but for convenience, we'll term all as `analyze-sgf`. Now let's look at how
to use them one by one.

```console
$ analyze-sgf
/Users/hcho/.analyze-sgf.yml generated.
Please specify SGF files or `-f` option.
Usage: analyze-sgf [-a=OPTS] [-g=OPTS] [-k=OPTS] [-s] [-f=FILE] [FILE ...]

Option:
  -a, --analysis=OPTS     Options for KataGo Parallel Analysis Engine query
  -g, --sgf=OPTS          Options for making reviewed SGF file
  -k, --katago=OPTS       Options for path and arguments of KataGo
  -s                      Save KataGo analysis as JSON file
  -f FILE                 Analyze by KataGo JSON file
  -h, --help              Display this help and exit

Examples:
  analyze-sgf baduk-1.sgf baduk-2.sgf
  analyze-sgf -a 'rules:"korean",komi:6.5' baduk-1.sgf baduk-2.sgf
  analyze-sgf -a 'maxVisits:16400,analyzeTurns:[197,198]' baduk.sgf
  analyze-sgf -s baduk.sgf
  analyze-sgf -f baduk.json
  analyze-sgf -g 'maxVariationsForEachMove:15' baduk.sgf
  analyze-sgf -k 'path:"C:\\katago.exe"' baduk.sgf

Edit ~/.analyze-sgf.yml for default options
Report analyze-sgf bugs to <https://github.com/9beach/analyze-sgf/issues>
analyze-sgf home page: <https://github.com/9beach/analyze-sgf/>
```

To run `analyze-sgf`, you need to set the KataGo path in the
`.analyze-sgf.yml` file in your home directory. The contents of the
`.analyze-sgf.yml` file are as follows. Among these, you need to modify the
two values ​​"KataGo path here" and "KataGo arguments here" to suit your
installed KataGo. Please refer to the example.

```yml
# Path and arguments of KataGo Parallel Analysis Engine.
#
# Please visit <https://github.com/9beach/analyze-sgf>.
katago:
  # e.g. "C:\\Users\\hcho\\KataGo\\katago.exe"
  path: "KataGo path here"
  # e.g.
  # "analysis -model C:\\Users\\hcho\\KataGo\\katago-best-network.bin.gz -config C:\\Users\\hcho\\KataGo\\analysis_example.cfg"
  arguments: "KataGo arguments here"

# Analysis query options for KataGo Parallel Analysis Engine.
#
# Please see <https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md>.
analysis:
  # e.g. "korean", "tromp-taylor", "chinese", ...
  rules: "tromp-taylor"
  # If input SGF has no komi field (KM), then uses below.
  komi: 7.5
  boardXSize: 19
  boardYSize: 19
  # Maximum number of root visits.
  maxVisits: 1600

# Options for making reviewed SGF file.
sgf:
  # SGF can put good/bad/hotspot labels on moves for coloring game tree.
  # When you open output SGF in applications like Sabaki, you can check them.
  # Please visit <https://sabaki.yichuanshen.de/>.
  #
  # If less than maxWinrateLossForGoodMove percents down with a move, that 
  # move is good.
  maxWinrateLossForGoodMove: 2.0
  # If more than maxWinrateLossForGoodMove percents down with a move, that 
  # move is bad.
  minWinrateLossForBadMove: 5.0
  # If more than minWinrateLossForBadHotSpot percents down with a move, that 
  # move is a bad hotspot, and it's really bad.
  minWinrateLossForBadHotSpot: 20.0
  # In SGF, the last move can't have variations. So we add a pass move after 
  # the last move, and then add the proposed variations to that pass move.
  showVariationsAfterLastMove: false
  # If `-a 'analyzeTurns:[0,5,10]'` option given, analyze-sgf analyzes the
  # move 1, move 6, and move 11, and then add the variations for those moves.
  # But 'analyzeTurns' is not given, analyze-sgf analyzes all the moves, and 
  # adds the variations for the moves whose win rate loss are larger than 
  # minWinrateLossForVariations.
  minWinrateLossForVariations: 5
  showBadVariations: false
  maxVariationsForEachMove: 10
  # If input file is "baduk.sgf" and fileSuffix is "-analyzed", then writes 
  # analysis to "baduk-analyzed.sgf"
  fileSuffix: "-analyzed"
```

Now, run `analyze-sgf` with a SGF file, for example `신진서-렌샤오.sgf`, a
simple analysis result will be printed out, and a file `신진서-렌샤오-analized.sgf`
is generated.

```console
$ analyze-sgf 신진서-렌샤오.sgf
신진서-렌샤오-analyzed.sgf generated.
# Analyze-SGF Report

신진서 (Black):
* Good moves (75.00%, 78/104)
* Bad moves (11.54%, 12/104): move 39, move 69, move 105, move 109, move 121, move 133, move 141, move 161, move 165, move 173, move 179, move 183
* Bad hot spots (0.96%, 1/104): move 141

롄샤오 (White):
* Good moves (74.76%, 77/103)
* Bad moves (18.45%, 19/103): move 64, move 96, move 102, move 104, move 106, move 108, move 114, move 116, move 120, move 138, move 146, move 150, move 166, move 172, move 174, move 176, move 180, move 184, move 190
* Bad hot spots (1.94%, 2/103): move 174, move 176

Good move: less than 2% win rate loss
Bad move: more than 5% win rate loss
Bad hot spot: more than 20% win rate loss

Variations added for the moves of more then 5% win rate loss.
Maximum variations number for each move is 10.

Analyzed by KataGo Parallel Analysis Engine (6415 max visits).
```

The two screenshots below show the file opened in Sabaki.

**Opening the result file with Sabaki**
![Sabaki Root Screenshot](./sabaki-root.png?raw=true "Sabaki Root Screenshot")

**Navigating the variations with Sabaki**
![Sabaki Variations Screenshot](./sabaki-variations.png?raw=true "Sabaki Variations Screenshot")

If the win rate falls by more than 5%, a node of game tree turns to a
red dot, if more than 20%, turns to a red ribbon, and if within 2%,
turns to a green dot. This criterion can be changed by specifying the
`minWinrateLossForBadMove`, `minWinrateLossForBadHotSpot`, and
`maxWinrateLossForGoodMove` settings in `.analyze-sgf.yml` file.
We'll take a closer look in the next section.

## Settings

The `.analyze-sgf.yml` file saves all the default settings for `analyze-sgf`.
You can either modify the `.analyze-sgf.yml` file to modify the default
settings, or specify it when running `analyze-sgf`. For example, to adjust
`maxVisits` of KataGo Parallel Analysis Engine, you need to change the
`maxVisits` value in the analysis section, which can also be specified
at run time, as follows:

```console
C:\Users\hcho>analyze-sgf.cmd -a 'maxVisits:600' baduk.sgf
```

The `maxVisits` value determines how many visits the KataGo Parallel
Analysis Engine will do when analyzing a move. The larger it is, the more
accurate the analysis, but it takes more time. If you have `maxVisits` set
to 10000, and want to analyze up to 20 variations for the moves of 174 and
176, run:

```console
analyze-sgf -a 'maxVisits:10000,analyzeTurns:[173,175]' -g 'maxVariationsForEachMove:20,showBadVariations:true' baduk.sgf
```

The `-a` and `-g` options stand for `analysis` and `sgf`, respectively.
Because KataGo analyzes with the concept of the proposed variations, in
order to analyze the 174th move, we need to request 173.

If `analyzeTurns` is specified, only the variations of specified moves are
saved. The analysis results are not summarized on terminal. If `analyzeTurns`
is not specified, all the variations of the moves with win rate drops greater
than `minWinrateLossForVariations` are saved, and the analysis results are
summarized on terminal.

Komi is automatically set using the information in the SGF file even if the
`-a 'komi:6.5'` option is not specified.

Anything with quotes in the `.analyze-sgf.yml` setting must be quoted at
runtime. That is, you should run it like this:

```console
analyze-sgf -a 'rules:"korean"' baduk.sgf
```

## Advanced settings

It takes quite a long time to analyze with KataGo. However, in the reviewed
SGF, not all informations of KataGo analysis are stored. It would be very
frustrating if you had to take the time to analyze it again with different
settings. So `analyze-sgf` has the ability to save and recycle the KataGo
analysis data with the `-s` option.

```console
$ analyze-sgf -s -a 'maxVisits:30000' baduk.sgf
baduk.json generated.
baduk-analyzed.sgf generated.
...
```

If you specify a large number in `maxVisits` as above, it takes a long time
to analyze a lot. And the result is saved as `baduk.json` by `-s` option.
If you run it as below, the analysis is finished at the same time as it is
executed using `baduk.json`, not KataGo.

```console
analyze-sgf -a 'maxVisits:10000,analyzeTurns:[173,175]' -g 'maxVariationsForEachMove:20,showBadVariations:true' -f baduk.json
```

Now you can see up to 20 variations of the 169th and 170th moves that did not
exist before, including the variations of bad win rates. Saved analysis
information is used, so values for `-a` options such as `maxVisits`
other than `analyzeTurns` are ignored.

If you can wait a few hours, give it a very large visits and save the analysis
data with `-s -a 'maxVisits:100000'`. This provides a whole new level of depth
compared to using KataGo in real time.

If you want to see all the variations that exist in your KataGo analysis
data, do the following:

```console
analyze-sgf -f baduk.json -g 'minWinrateLossForVariations:-100,showBadVariations:true,maxVariationsForEachMove:100'
```

## TODO

* Support Tygem file (`.gib`)
* Internationalization
