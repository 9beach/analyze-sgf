# analyze-sgf

[![Build Status](https://travis-ci.org/9beach/analyze-sgf.svg?branch=master)](https://travis-ci.org/9beach/analyze-sgf)
[![npm version](https://badge.fury.io/js/analyze-sgf.svg)](https://badge.fury.io/js/analyze-sgf)

한국어 | [English](README.en-US.md)

`analyze-sgf`는 [카타고 분석 엔진](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md)으로
[기보](https://en.wikipedia.org/wiki/Smart_Game_Format) 파일을 분석해서 승률 그래프, 좋은 수, 나쁜 수를
표시하고 변화도를 제안하여 새로운 기보 파일로 저장합니다.

[사바키](https://sabaki.yichuanshen.de/)나 [리지](https://github.com/featurecat/lizzie)와 카타고를
연동해서 한 수 한 수 실시간으로 기보를 분석할 수도 있지만, `analyze-sgf`를 이용하면 여러 개의 기보를
한꺼번에 분석해서 결과를 자동으로 저장할 수 있습니다. 이렇게 분석된 기보를 사바키로 열면, 전체 승률
그래프와 변화도를 보면서 중요 부분만 카타고로 분석할 수 있어 편리합니다.

`analyze-sgf`는 아주 큰 탐색 숫자를 지정해서 카타고에게 몇 시간을 분석하게 한 뒤, 그 결과를 저장해서
재활용하는 방법도 제공합니다. 이것은 실시간으로 카타고를 이용하는 것과는 차원이 다른 깊이를 제공합니다.

## 설치

먼저 [Node.js](https://nodejs.org/)와 [카타고](https://github.com/lightvector/KataGo/releases)를
설치한 뒤 `analyze-sgf`를 설치합니다.

맥이나 리눅스 환경에서는 터미널에서 다음을 실행합니다.

```console
sudo npm install -g analyze-sgf
```

마이크로소프트 윈도우 환경에서는 명령 프롬프트나 PowerShell에서 다음을 실행합니다.

```console
C:\Users\hcho> npm install -g analyze-sgf
```

## 사용법

`analyze-sgf`를 처음 실행하면 다음과 같이, 홈 디렉터리에 `.analyze-sgf.yml` 파일을 만들고 기본 사용법을
출력합니다. 윈도우 환경에서는 `analyze-sgf`가 아닌 `analyze-sgf.cmd`로 실행해야 하지만 편의상 모두
`analyze-sgf`로 표시하겠습니다. 이제 사용법을 하나씩 알아봅시다.

```console
$ analyze-sgf
/Users/hcho/.analyze-sgf.yml generated.
Please specify SGF files.
Usage: analyze-sgf [-a=OPTS] [-g=OPTS] [-k=OPTS] [-s] [-f] FILE ...

Option:
  -a, --analysis=OPTS     Options for KataGo Parallel Analysis Engine query
  -g, --sgf=OPTS          Options for making reviewed SGF file
  -k, --katago=OPTS       Options for path and arguments of KataGo
  -s                      Save KataGo analysis as JSON file
  -f                      Analyze by KataGo JSON file
  -h, --help              Display this help and exit

Examples:
  analyze-sgf baduk-1.sgf baduk-2.sgf
  analyze-sgf -a 'rules:"korean",komi:6.5' baduk-1.sgf baduk-2.sgf
  analyze-sgf -a 'maxVisits:16400,analyzeTurns:[197,198]' baduk.sgf
  analyze-sgf -s baduk-1.sgf baduk-2.sgf
  analyze-sgf -f baduk-1.json baduk-2.json
  analyze-sgf -g 'maxVariationsForEachMove:15' baduk.sgf
  analyze-sgf -k 'path:"C:\\katago.exe"' baduk.sgf

Edit ~/.analyze-sgf.yml for default options
Report analyze-sgf bugs to <https://github.com/9beach/analyze-sgf/issues>
analyze-sgf home page: <https://github.com/9beach/analyze-sgf/>
```

`analyze-sgf`를 사용하려면 홈 디렉터리에 있는 `.analyze-sgf.yml` 파일에 카타고 경로를 설정해야 합니다.
`.analyze-sgf.yml` 파일의 내용은 아래와 같습니다. 이 중에서 `"KataGo path here"`, `"KataGo arguments here"`
두 값을 설치된 카타고에 맞게 수정해야 합니다. 예시(e.g.)를 참고하세요.

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

# Options for making reviewed SGF files.
sgf:
  # SGF can put good/bad/hotspot labels on moves for coloring game tree.
  # When you open output SGF in applications like Sabaki, you can check them.
  # Please visit <https://sabaki.yichuanshen.de/>.
  #
  # If win rate drops by less than maxWinrateDropForGoodMove for a move, that
  # move is good.
  maxWinrateDropForGoodMove: 2.0
  # If win rate drops by more than minWinrateDropForBadMove for a move, that
  # move is bad.
  minWinrateDropForBadMove: 5.0
  # If win rate drops by more than minWinrateDropForBadHotSpot for a move, that
  # move is a bad hotspot.
  minWinrateDropForBadHotSpot: 20.0
  # In SGF, the last move can't have variations. So we add a passing move
  # after the last move, and then add the proposed variations to that move.
  showVariationsAfterLastMove: false
  # If `-a 'analyzeTurns:[0,5,10]'` option given, analyze-sgf analyzes the
  # move 1, move 6, and move 11, and then add the variations for those moves.
  # But 'analyzeTurns' is not given, analyze-sgf analyzes all the moves, and
  # adds the variations for the moves whose win rate drops more than
  # minWinrateDropForVariations.
  minWinrateDropForVariations: 5
  showBadVariations: false
  maxVariationsForEachMove: 10
  # If input file is "baduk.sgf" and fileSuffix is "-analyzed", then writes
  # analysis to "baduk-analyzed.sgf"
  fileSuffix: "-analyzed"
```

이제 기보 파일, 가령 `신진서-렌샤오.sgf`로 `analyze-sgf`를 실행하면 간단한 분석 결과가
출력되고 `신진서-렌샤오-analyzed.sgf`라는 파일이 생깁니다.

```console
$ analyze-sgf 신진서-렌샤오.sgf
신진서-렌샤오-analyzed.sgf generated.
# Analyze-SGF Report

제13회 춘란배 4강, Komi 7.5, 207수 흑불계승, 2021-01-20

신진서 (Black):
* Good moves (75.00%, 78/104)
* Bad moves (11.54%, 12/104): move 39, move 69, move 105, move 109, move 121, move 133, move 141, move 161, move 165, move 173, move 179, move 183
* Bad hot spots (0.96%, 1/104): move 141

롄샤오 (White):
* Good moves (74.76%, 77/103)
* Bad moves (18.45%, 19/103): move 64, move 96, move 102, move 104, move 106, move 108, move 114, move 116, move 120, move 138, move 146, move 150, move 166, move 172, move 174, move 176, move 180, move 184, move 190
* Bad hot spots (1.94%, 2/103): move 174, move 176

Good move: less than 2% win rate drop
Bad move: more than 5% win rate drop
Bad hot spot: more than 20% win rate drop

Variations added for the moves having more than 5% win rate drop.
The maximum variation number for each move is 10.

Analyzed by KataGo Parallel Analysis Engine (6415 max visits).
```

아래의 두 스크린숏은 `신진서-렌샤오-analyzed.sgf` 파일을 사바키로 연 모습입니다.

**사바키로 분석 파일을 연 모습**
![Sabaki Root Screenshot](./sabaki-root.png?raw=true "Sabaki Root Screenshot")

**사바키로 변화도를 탐색하는 모습**
![Sabaki Variations Screenshot](./sabaki-variations.png?raw=true "Sabaki Variations Screenshot")

승률이 5% 이상 하락하면 빨간색 점으로, 20% 이상 하락하면 빨간색 리본으로, 2% 이내로 하락하면 초록색 점으로
착수를 표시합니다. 이 기준은 `.analyze-sgf.yml`에서 `minWinrateDropForBadMove`, `minWinrateDropForBadHotSpot`,
`maxWinrateDropForGoodMove` 설정 값을 지정해서 변경할 수 있습니다. 다음 섹션에서 더 자세히 살펴보겠습니다.

## 설정

`.analyze-sgf.yml` 파일은 `analyze-sgf`의 모든 기본 설정을 저장합니다. 기본 설정을 수정하기 위해
`.analyze-sgf.yml` 파일을 수정할 수도 있고 `analyze-sgf`를 실행할 때 지정할 수도 있습니다. 예를 들어, 카타고
분석 엔진의 탐색 숫자를 조절하기 위해서는 `analysis` 섹션의 `maxVisits` 값을 변경해야 하는데 다음과 같이,
실행할 때 지정할 수도 있습니다.

```console
C:\Users\hcho>analyze-sgf.cmd -a 'maxVisits:600' baduk.sgf
```

한 수를 분석할 때 카타고 분석 엔진이 얼마나 많은 탐색을 할지는 `maxVisits` 값으로 설정합니다. 크면 클수록 분석은 더
정확해지지만 시간도 더 많이 걸립니다. 만약 `maxVisits`을 10000으로 두고, 위에서 문제가 된 174, 176 수에 대해
최대 20개의 변화도를 분석하려면 다음을 실행합니다.

```console
analyze-sgf -a 'maxVisits:10000,analyzeTurns:[173,175]' -g 'maxVariationsForEachMove:20,showBadVariations:true' baduk.sgf
```

`-a`, `-g` 옵션은 각각 `analysis`, `sgf`를 뜻합니다. 카타고는 변화도가 아닌 예상도라는 개념으로 분석하기 때문에
174번째 수를 분석하기 위해서는 173을 요청해야 합니다. `analyzeTurns`을 지정하면, 지정된 수의 변화도만 보여 주며
분석 결과를 요약해서 화면에 출력하지는 않습니다. `analyzeTurns`을 지정하지 않으면 승률 하락이
`minWinrateDropForVariations`보다 큰 모든 수의 변화도를 보여 주며 분석 결과를 요약해서 화면에 출력합니다.

이와 같이 `.analyze-sgf.yml` 파일의 모든 설정은 직접 수정할 수도, 실행할 때 지정할 수도 있습니다.

참고로 덤은, `-a 'komi:6.5'` 옵션을 따로 주지 않아도 기보 파일의 정보를 이용해서 자동으로 설정합니다.

`.analyze-sgf.yml` 설정값에 따옴표가 있는 것은 실행 시에도 따옴표를 붙여야 합니다. 즉 아래와 같이 실행해야
합니다.

```console
analyze-sgf -a 'rules:"korean"' baduk.sgf
```

## 고급 설정

카타고로 분석하는 데는 꽤 긴 시간이 걸립니다. 그런데 분석된 기보에는 승률 하락이 `minWinrateDropForVariations`보다
큰 수의 변화도만 수록되며, 좋은 수, 나쁜 수의 기준 또한 분석 이후에는 바꿀 수 없습니다. 이런 설정을 바꾸려고
시간을 들여 새로 분석해야 한다면 많이 실망스러울 것입니다. 그래서 `analyze-sgf`에는 `-s` 옵션으로 카타고
분석 데이터를 저장해 두고 이를 재활용하는 기능이 있습니다.

```console
$ analyze-sgf -s -a 'maxVisits:30000' baduk.sgf
baduk.json generated.
baduk-analyzed.sgf generated.
...
```

위와 같이 `maxVisits`에 큰수를 지정하면 긴 시간을 들여 많은 것을 분석합니다. 그리고 그 결과는 `-s`에 의해
`baduk.json`으로 저장되었습니다. 아래와 같이 실행하면 카타고가 아닌 `baduk.json`을
이용해서 실행과 동시에 분석을 끝마칩니다.

```console
analyze-sgf -a 'maxVisits:10000,analyzeTurns:[173,175]' -g 'maxVariationsForEachMove:20,showBadVariations:true' -f baduk.json
```

이제 기존에 없었던 169, 170 번째 수의 변화도를 나쁜 변화도까지 포함해서 최대 20개까지 볼 수 있습니다. 저장된
분석 정보를 이용하기 때문에 `analyzeTurns`를 제외한 `maxVisits` 등의 `-a` 옵션 값은 무시됩니다.

몇 시간을 기다릴 수 있다면 `-s -a 'maxVisits:100000'`과 같이 아주 큰 탐색 숫자를 주고 분석 데이터를 저장하세요.
실시간으로 카타고를 이용하는 것과는 차원이 다른 깊이를 제공합니다.

카타고 분석 데이터에 존재하는 모든 변화도를 보고 싶다면 다음을 실행합니다.

```console
analyze-sgf -g 'minWinrateDropForVariations:-100,showBadVariations:true,maxVariationsForEachMove:100 -f baduk.json'
```

## 남은 일

* 타이젬 기보 파일(`.gib`) 인식
* 국제화
