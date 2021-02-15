# analyze-sgf

[![Build Status](https://travis-ci.org/9beach/analyze-sgf.svg?branch=master)](https://travis-ci.org/9beach/analyze-sgf) [![npm version](https://badge.fury.io/js/analyze-sgf.svg)](https://badge.fury.io/js/analyze-sgf)

`analyze-sgf`는 [카타고 분석 엔진](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md)으로 [기보](https://en.wikipedia.org/wiki/Smart_Game_Format) 파일을 분석해서 승률 그래프, 좋은 수, 나쁜 수를 표시하고 변화도를 제안합니다. 제안 내용은 새로운 기보 파일로 저장됩니다.

[사바키](https://sabaki.yichuanshen.de/)나 [리지](https://github.com/featurecat/lizzie)로 한 수 한 수 실시간으로 기보를 분석할 수도 있지만, `analyze-sgf`를 이용하면, 수 십 개의 기보를 한꺼번에 분석해서 결과를 자동으로 저장할 수 있습니다. 이렇게 분석된 기보를 다시 사바키로 열면, 전체 승률 그래프와 변화도를 보면서 중요 부분만 실시간으로 분석할 수 있어 편리합니다.

## 설치
먼저 [Node.js](https://nodejs.org/)를 설치합니다.

그다음, 맥이나 리눅스 환경에서는 터미널에서 다음을 실행하여 설치합니다.
```console
$ sudo npm install -g analyze-sgf
```

마이크로소프트 윈도우 환경에서는 명령 프롬프트 또는 PowerShell에서 다음을 실행하여 설치합니다.
```console
C:\Users\hcho> npm install -g analyze-sgf
```

## 기본 사용법

설치한 뒤 `analyze-sgf`를 처음 실행하면 다음과 같이 사용법이 출력되고 홈 디렉터리에 `.analyze-sgf.yml` 파일이 생성됩니다. 윈도우 환경에서는 `analyze-sgf`가 아닌 `analyze-sgf.cmd`로 실행해야 하지만 편의상 모두 `analyze-sgf`로 표시하겠습니다. 이제 사용법을 하나씩 알아봅시다.

```console
$ analyze-sgf
/Users/hcho/.analyze-sgf.yml created.
Usage: analyze-sgf [-a=options] [-g=options] [-k=options] [-s] [-f=path] sgf

Option:
  -a, --analysis          Options for KataGo Parallel Analysis Engine query
  -g, --sgf               Options for making reviewed SGF file
  -k, --katago            Options for path and arguments of KataGo
  -s,                     Save KataGo analysis as JSON file
  -f,                     Analyze KataGo JSON file

Examples:
  analyze-sgf baduk.sgf
  analyze-sgf -a 'rules:"korean",komi:6.5' baduk.sgf
  analyze-sgf -a 'maxVisits:600' baduk.sgf
  analyze-sgf -a 'maxVisits:16400,analyzeTurns:[197,198]' baduk.sgf
  analyze-sgf -s baduk.sgf
  analyze-sgf -f baduk-responses.json baduk.sgf
  analyze-sgf -g 'maxVariationsForEachMove:15' baduk.sgf
  analyze-sgf -k 'path:"C:\\katago.exe"' baduk.sgf

Edit ~/.analyze-sgf.yml for default options
Report analyze-sgf bugs to <https://github.com/9beach/analyze-sgf/issues>
analyze-sgf home page: <https://github.com/9beach/analyze-sgf/>
```

`analyze-sgf`를 사용하기 위해서는 홈 디렉터리에 있는 `.analyze-sgf.yml` 파일에 카타고 경로를 설정해야 합니다. `.analyze-sgf.yml` 파일의 내용은 다음과 같습니다.

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
`.analyze-sgf.yml` 파일에서 `"KataGo path here"`, `"KataGo arguments here"` 두 항목을 설치된 카타고에 맞게 수정하세요. 카타고는 따로 설치해야 합니다. 그다음 아래와 같이 `analyze-sgf ren-vs-shin.sgf`로 실행하면 간단한 분석 결과가 출력되고 `ren-vs-shin-analyzed.sgf`라는 파일이 생깁니다.

**실행 화면**
```console
$ analyze-sgf ren-vs-shin.sgf
ren-vs-shin-analyzed.sgf created.
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

아래의 두 스크린 숏은 `ren-vs-shin-analyzed.sgf` 파일을 사바키로 연 모습입니다.

**사바키로 분석 파일을 연 화면**
![Sabaki Root Screenshot](./sabaki-root.png?raw=true "Sabaki Root Screenshot")

**사바키로 변화도를 탐색하는 화면**
![Sabaki Variations Screenshot](./sabaki-variations.png?raw=true "Sabaki Variations Screenshot")

승률이 5% 이상 하락하면 빨간색으로, 20% 이상 하락하면 빨간색 리본으로, 2% 이내로 하락하면 초록색으로 착수를 표시합니다. 물론 이 설정은 모두 `.analyze-sgf.yml` 파일에서 변경할 수 있습니다. 다음 섹션에서 이런 설정들을 더 자세히 살펴보겠습니다.

## 기본 설정

`.analyze-sgf.yml` 파일은 `analyze-sgf`의 모든 기본 설정을 저장합니다. 기본 설정들을 수정하기 위해서는 `.analyze-sgf.yml` 파일을 고칠 수도 있고 `analyze-sgf` 실행 시 전달할 수도 있습니다. 예를 들어, 카타고 분석 엔진의 탐색 숫자를 조절하기 위해서는 `analysis` 항목의 `maxVisits` 값을 변경해야 하는데, 파일을 변경할 수도 있고 다음과 같이 실행 시 지정할 수도 있습니다.

```console
C:\Users\hcho>analyze-sgf.cmd -a 'maxVisits:600' baduk.sgf
```

`maxVisits`은 한 수를 분석할 때 카타고 분석 엔진 탐색 수의 총합으로, 분석의 정확도와 시간을 좌우합니다. 만약 `maxVisits`을 10000으로 두고, 나쁜 수의 기준을 3%로 줄인 뒤, 위에서 문제가 된 174, 176 수만을 분석하기 위해서는 다음과 같이 실행합니다.

```console
$ analyze-sgf -a 'maxVisits:10000,analyzeTurns[173,175]' -g 'minWinrateLossForBadMove:3' baduk.sgf
```

`-a`, `-g` 옵션은 각각 `analysis`, `sgf`를 뜻합니다. 카타고는 분석 대상을 변화도가 아닌 이후 예상도로 보기 때문에 174번째 수를 분석하기 위해서는 173을 요청해야 합니다. 이와 같이 `analyzeTurns`을 지정하면, 지정된 변화도만을 보여 주며 분석 결과를 요약해서 화면에 출력하지는 않습니다. `analyzeTurns`을 지정하지 않으면 `minWinrateLossForVariations`보다 큰 승률 하락을 보인 모든 수의 변화도를 보여 주며 분석 결과 또한 요약해서 화면에 출력합니다.

`.analyze-sgf.yml` 파일의 모든 옵션을 이와 같이 변경할 수 있습니다. 한국식으로 계가를 하기 위해 `-a 'komi:6.5'` 옵션을 따로 주지 않아도 기보 파일의 정보를 이용해서 자동으로 설정되니 참고하세요.

`.analyze-sgf.yml` 설정값에 따옴표가 있는 것은 실행 시에도 따옴표를 붙여야 합니다. 즉 아래와 같이 실행해야 합니다.
```console
$ analyze-sgf -a 'rules:"korean"' baduk.sgf
```

## 고급 설정

카타고를 통해 분석하는 데는 꽤 긴 시간이 필요합니다. 그런데 분석된 기보에는 수행 당시의 `minWinrateLossForVariations` 설정값 이상의 승률 하락을 보인 수의 변화도만 존재하며, 좋은 수, 나쁜 수 기준 또한 수행 당시의 설정에 종속됩니다. 이런 설정을 바꾸려면 시간을 들여 새로 분석해야 합니다. 그래서 `analyze-sgf`에는 `-s` 옵션으로 카타고 분석 데이터를 저장해 두고 이를 활용하는 기능이 있습니다.

```console
$ analyze-sgf -s -a 'maxVisits:30000' baduk.sgf
"komi" is set to 7.5 from SGF.
baduk-responses.json created.
baduk-analyzed.sgf created.
# Analyze-SGF Report
...
```
위와 같이 `maxVisits:30000`으로 실행하면 아주 긴 시간을 들여 많은 것을 분석합니다. 이 정보는 `-s`에 의해  `baduk-responses.json`으로 저장되었습니다. 다음과 같이 수행하면 카타고를 이용하지 않고 `baduk-responses.json`를 이용해서 실행과 동시에 분석을 끝마칩니다.

```console
$ analyze-sgf -f baduk-responses.json -a 'analyzeTurns[168,169]' -g 'maxVariationsForEachMove:20, showBadVariations:true'
```

이제 기존에 없었던 169, 170 번째 수의 변화도를 나쁜 변화도까지 포함해서 20개까지 볼 수 있습니다.

다음과 같이 실행하면 169, 170 번째 수의 변화도만 10만회 탐방을 통해 분석합니다.

```console
$ analyze-sgf -a 'analyzeTurns[168,169],maxVisits:100000' -g 'maxVariationsForEachMove:20, showBadVariations:true'
```

다음과 같이 실행하면, 모든 수의 변화도를 볼 수 있습니다.

```console
$ analyze-sgf -f baduk-responses.json -g 'minWinrateLossForVariations:-100'
```
```console
$ analyze-sgf -g 'minWinrateLossForVariations:-100' baduk.sgf
```
