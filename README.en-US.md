# analyze-sgf

[![Build Status](https://travis-ci.org/9beach/analyze-sgf.svg?branch=master)](https://travis-ci.org/9beach/analyze-sgf)
[![npm version](https://badge.fury.io/js/analyze-sgf.svg)](https://badge.fury.io/js/analyze-sgf)

[한국어](README.md) | English

`analyze-sgf` analyzes [SGF](https://en.wikipedia.org/wiki/Smart_Game_Format)
and Tygem's GIB format by
[KataGo Parallel Analysis Engine](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md)
to generate the win rate graphs, label the good and bad moves, propose the
variations, and save them as new SGF files.

You can analyze an SGF/GIB file one by one in real-time by linking
[Sabaki](https://sabaki.yichuanshen.de/) or
[Lizzie](https://github.com/featurecat/lizzie) and KataGo. But with
`analyze-sgf`, you can analyze many SGF/GIB files all at once, and save the
KataGo reviewed SGF files automatically. If you open these with Sabaki, you
can analyze them with the help of the overall win rate, good and bad move
labels, and proposed variations.

`analyze-sgf` also gives you a way to specify a very large number of visits
and let KataGo analyze several hours, then save and recycle the
KataGo analysis data (not reviewed SGF). This provides a whole new level of
depth compared to using KataGo in real-time.

## Installation

First install  [Node.js](https://nodejs.org/) and
[KataGo](https://github.com/lightvector/KataGo/releases), then install
`analyze-sgf`.

In Mac or Linux, run the following from the terminal.

```console
npm install -g analyze-sgf
```

In Microsoft Windows, run the following from the `Command Prompt`
or `PowerShell`.
```console
C:\Users\hcho> npm install -g analyze-sgf
```

Notice that the upgrade command is the same as the install command.

## Usage

The first time you run `analyze-sgf`, it generates a `.analyze-sgf.yml` file
in your home directory and prints out the usage as follows:

```console
$ analyze-sgf
/Users/hcho/.analyze-sgf.yml generated.
Please specify SGF/GIB files.
Usage: analyze-sgf [-a=OPTS] [-g=OPTS] [-k=OPTS] [-s] [-f] FILE ...

Option:
  -a, --analysis=OPTS     Options for KataGo Parallel Analysis Engine query
  -g, --sgf=OPTS          Options for making reviewed SGF files
  -k, --katago=OPTS       Options for path and arguments of KataGo
  -s                      Save KataGo analysis as JSON files
  -f                      Analyze by KataGo JSON files
  -h, --help              Display this help and exit

Examples:
  analyze-sgf baduk-1.sgf baduk-2.gib
  analyze-sgf 'https://www.cyberoro.com/gibo_new/giboviewer/......'
  analyze-sgf -a 'maxVisits:16400,analyzeTurns:[197,198]' baduk.sgf
  analyze-sgf -f baduk.json
  analyze-sgf -g 'maxVariationsForEachMove:15' baduk.sgf
  analyze-sgf -k 'path:"C:\\katago.exe"' baduk.sgf

Edit ~/.analyze-sgf.yml for default options
Report analyze-sgf bugs to <https://github.com/9beach/analyze-sgf/issues>
analyze-sgf home page: <https://github.com/9beach/analyze-sgf/>
```

In Microsoft Windows, it should be run with `analyze-sgf.cmd` rather than
`analyze-sgf`, but for convenience, we'll call it `analyze-sgf`. Now let's look
at how to use them one by one.

To run `analyze-sgf`, you need to set the KataGo path in the
`.analyze-sgf.yml` file in your home directory. The contents of the
`.analyze-sgf.yml` file is as follows. Among these, you need to modify the
two values "KataGo path here" and "KataGo arguments here" to suit your
installed KataGo. Please refer to the example.

```yml
# Please visit <https://github.com/9beach/analyze-sgf>.
#
# Options for path and arguments of KataGo.
katago:
  # e.g. "C:\\Users\\hcho\\KataGo\\katago.exe"
  path: "KataGo path here"
  # e.g. "analysis -model C:\\Users\\hcho\\KataGo\\katago-best-network.bin.gz -config C:\\Users\\hcho\\KataGo\\analysis_example.cfg"
  arguments: "KataGo arguments here"

# Options for KataGo Parallel Analysis Engine query.
#
# <https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md>.
analysis:
  # e.g. "korean", "tromp-taylor", "chinese", ...
  rules: "tromp-taylor"
  # If input SGF/GIB has no komi field (KM), then uses below.
  komi: 7.5
  boardXSize: 19
  boardYSize: 19
  # Maximum number of root visits.
  maxVisits: 1600

# Options for making reviewed SGF files.
sgf:
  # SGF can put good/bad/hotspot labels on moves for coloring game tree.
  # ......
```

Now, run `analyze-sgf` with SGF/GIB files, for example, `shin-vs-lian.sgf`,
the simple analysis result will be printed out, and a file
`shin-vs-lian-analized.sgf` is generated.

```console
$ analyze-sgf shin-vs-lian.sgf
shin-vs-lian-analyzed.sgf generated.
# Analyze-SGF Report

13th Chunlan Cup, semi-final, Komi 7.5, B+R, 2021-01-20

Shin Jinseo (Black)
* Less than 2% win rate drops (75.00%, 78/104)
* Less than 5% win rate drops (88.46%, 92/104)
* More than 5% win rate drops (11.54%, 12/104): #39 ⇣6.32%, #69 ⇣7.03%, #105 ⇣18.34%, #109 ⇣18.41%, #121 ⇣6.67%, #133 ⇣5.92%, #141 ⇣20.10%, #161 ⇣15.17%, #165 ⇣5.78%, #173 ⇣17.48%, #179 ⇣15.75%, #183 ⇣13.84%
* More than 20% win rate drops (0.96%, 1/104): #141 ⇣20.10%
* Top 10 win rate drops: #141 ⇣20.10%, #109 ⇣18.41%, #105 ⇣18.34%, #173 ⇣17.48%, #179 ⇣15.75%, #161 ⇣15.17%, #183 ⇣13.84%, #69 ⇣7.03%, #121 ⇣6.67%, #39 ⇣6.32%
* Top 10 score drops: #141 ⇣35.84, #143 ⇣10.06, #173 ⇣4.93, #171 ⇣3.14, #145 ⇣1.49, #105 ⇣1.43, #179 ⇣1.25, #109 ⇣1.20, #165 ⇣1.14, #69 ⇣0.88

Lian Xiao (White)
* Less than 2% win rate drops (74.76%, 77/103)
* Less than 5% win rate drops (81.55%, 84/103)
* More than 5% win rate drops (18.45%, 19/103): #64 ⇣11.43%, #96 ⇣5.20%, #102 ⇣7.88%, #104 ⇣8.71%, #106 ⇣9.51%, #108 ⇣6.93%, #114 ⇣9.05%, #116 ⇣11.45%, #120 ⇣8.97%, #138 ⇣7.90%, #146 ⇣15.73%, #150 ⇣9.34%, #166 ⇣5.62%, #172 ⇣14.41%, #174 ⇣54.39%, #176 ⇣20.59%, #180 ⇣14.40%, #184 ⇣19.62%, #190 ⇣6.76%
* More than 20% win rate drops (1.94%, 2/103): #174 ⇣54.39%, #176 ⇣20.59%
* Top 10 win rate drops: #174 ⇣54.39%, #176 ⇣20.59%, #184 ⇣19.62%, #146 ⇣15.73%, #172 ⇣14.41%, #180 ⇣14.40%, #116 ⇣11.45%, #64 ⇣11.43%, #106 ⇣9.51%, #150 ⇣9.34%
* Top 10 score drops: #146 ⇣52.72, #174 ⇣7.14, #172 ⇣4.61, #176 ⇣1.93, #116 ⇣1.38, #64 ⇣1.25, #140 ⇣1.21, #186 ⇣1.13, #166 ⇣1.13, #102 ⇣0.99

Analyzed by KataGo Parallel Analysis Engine (6415 max visits).
```

Cyber ORO's [기보 감상](https://www.cyberoro.com/bcast/gibo.oro?Tdiv=B) and Tygem's
[최신기보](http://news.tygem.com/news/tnews/gibo.asp) provides SGFs of almost all Korean Go professionals.
`analyze-sgf` automatically downloads and analyzes the SGFs from the URLs of the matches.

```console
$ analyze-sgf 'https://www.cyberoro.com/gibo_new/giboviewer/......'
제22회 농심배 12국, 이치리키 료-신진서, 2021-02-24.sgf generated.
# Analyze-SGF Report
```

```console
$ analyze-sgf 'http://service.tygem.com/service/gibo2/?seq=......'
제22회 농심배 12국, 이치리키 료-신진서, 2021-02-24.sgf generated.
# Analyze-SGF Report
```

The screenshot below shows the file opened in Sabaki.

![Sabaki Variations Screenshot](./sabaki-variations.png?raw=true "Sabaki Variations Screenshot")
**Navigating the variations with Sabaki**

If the win rate drops by more than 5%, the node of the game tree turns to a
red dot, if more than 20%, turns to a red ribbon, and if within 2%, turns to a
green dot. This criterion can be changed by specifying the
`minWinrateDropForBadMove`, `minWinrateDropForBadHotSpot`, and
`maxWinrateDropForGoodMove` settings in `.analyze-sgf.yml` file.

The comment of each move contains information about win rate and score, as well
as links to the moves with huge win rate drop, so you can quickly analyze your
game.

If you hover your mouse over a proposed variation in Sabaki, the sequence of
the variation is automatically played as shown in the screenshot above.

## Options

The `.analyze-sgf.yml` file saves all the default settings for `analyze-sgf`.
You can either modify the `.analyze-sgf.yml` file to modify the default
settings or specify it when running `analyze-sgf`. For example, to adjust
`maxVisits` of KataGo Parallel Analysis Engine, you need to change the
`maxVisits` value in the analysis section, which can also be specified at run
time, as follows:

```console
C:\Users\hcho>analyze-sgf.cmd -a 'maxVisits:600' baduk.sgf
```

The `maxVisits` value determines how many visits the KataGo Parallel
Analysis Engine will do when analyzing a move. The larger it is, the more
accurate the analysis, but it takes more time. If you have `maxVisits` set
to 10000, and want to analyze up to 20 variations for 174th and 176th moves,
run:

```console
analyze-sgf -a 'maxVisits:10000,analyzeTurns:[173,175]' -g 'maxVariationsForEachMove:20,showBadVariations:true' baduk.sgf
```

The `-a` and `-g` options stand for `analysis` and `sgf`, respectively.
Because KataGo analyzes with the concept of the proposed variations, to
analyze the 174th move, we need to request 173.

If `analyzeTurns` is specified, only the variations of specified moves are
saved. If `analyzeTurns` is not specified, all the variations of the moves
whose win rates drop greater than `minWinrateDropForVariations` are saved.

Komi is automatically set using the information in the SGF/GIB file even if the
`-a 'komi:6.5'` option is not specified.

Anything with quotes in the `.analyze-sgf.yml` setting must be quoted at
runtime. That is, you should run it like this:

```console
analyze-sgf -a 'rules:"korean"' baduk.sgf
```

## Advanced Options

It takes quite a long time to analyze with KataGo. However, in the reviewed
SGF, not all pieces of information of KataGo analysis are stored. It would be
very frustrating if you had to take the time to analyze it again with different
settings. So `analyze-sgf` can save and recycle the KataGo analysis data with
the `-s` option.

```console
$ analyze-sgf -s -a 'maxVisits:30000' baduk.sgf
baduk.json generated.
baduk-analyzed.sgf generated.
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

If you can wait a few hours, give it a very large number of visits and save the
analysis data with `-s -a 'maxVisits:100000'`. This provides a whole new level
of depth compared to using KataGo in real-time.

If you want to see all the variations that exist in your KataGo analysis data,
do the following:

```console
analyze-sgf -g 'minWinrateDropForVariations:-100,showBadVariations:true,maxVariationsForEachMove:100 -f baduk.json'
```
