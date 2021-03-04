# analyze-sgf

[![Build Status](https://travis-ci.org/9beach/analyze-sgf.svg?branch=master)](https://travis-ci.org/9beach/analyze-sgf)
[![npm version](https://badge.fury.io/js/analyze-sgf.svg)](https://badge.fury.io/js/analyze-sgf)

한국어 | [English](README.en-US.md)

`analyze-sgf`는 [카타고 분석 엔진](https://github.com/lightvector/KataGo/blob/master/docs/Analysis_Engine.md)으로
[SGF](https://en.wikipedia.org/wiki/Smart_Game_Format) 및 타이젬 파일(GIB)을
분석해서 승률 그래프, 좋은 수, 나쁜 수를 표시하고 변화도를 제안하여 새로운 기보 파일로
저장합니다.

[사바키](https://sabaki.yichuanshen.de/)나
[리지](https://github.com/featurecat/lizzie)와 카타고를 연동해서 한 수 한 수
실시간으로 기보를 분석할 수도 있지만, `analyze-sgf`를 이용하면 여러 개의 기보를 한꺼번에
분석해서 결과를 자동으로 저장할 수 있습니다. 이렇게 분석된 기보를 사바키로 열면, 전체 승률
그래프와 변화도를 보면서 중요 부분만 카타고로 분석할 수 있어 편리합니다.

`analyze-sgf`는 아주 큰 탐색 숫자를 지정해서 카타고에게 몇 시간을 분석하게 한 뒤,
그 결과를 저장해서 재활용하는 방법도 제공합니다. 이것은 실시간으로 카타고를 이용하는 것과는
차원이 다른 깊이를 제공합니다.

## 설치

먼저 [Node.js](https://nodejs.org/)와
[카타고](https://github.com/lightvector/KataGo/releases)를 설치한 뒤
`analyze-sgf`를 설치합니다.

맥이나 리눅스 환경에서는 터미널에서 다음을 실행합니다.

```console
npm install -g analyze-sgf
```

마이크로소프트 윈도우 환경에서는 명령 프롬프트나 PowerShell에서 다음을 실행합니다.

```console
C:\Users\hcho> npm install -g analyze-sgf
```

업데이트 명령어는 설치 명령어와 동일합니다.

## 사용법

`analyze-sgf`를 처음 실행하면 다음과 같이, 홈 디렉터리에 `.analyze-sgf.yml` 파일을
만들고 기본 사용법을 출력합니다. 윈도우 환경에서는 `analyze-sgf`가 아닌
`analyze-sgf.cmd`로 실행해야 하지만 편의상 모두 `analyze-sgf`로 표시하겠습니다. 이제
사용법을 하나씩 알아봅시다.

```console
$ analyze-sgf
generated: /Users/hcho/.analyze-sgf.yml
Please specify SGF/GIB files.
Usage: analyze-sgf [-a=OPTS] [-g=OPTS] [-k=OPTS] [-s] [-f] FILE ...

Option:
  -a, --analysis=OPTS     Options for KataGo Parallel Analysis Engine query
  -g, --sgf=OPTS          Options for making reviewed SGF files
  -k, --katago=OPTS       Options for path and arguments of KataGo
  -r, --revisit=N         For variation cases, Analyze again with maxVisits N
  -s                      Save KataGo analysis as JSON files
  -f                      Analyze by KataGo JSON files
  -h, --help              Display this help and exit

Examples:
  analyze-sgf baduk-1.sgf baduk-2.gib
  analyze-sgf 'https://www.cyberoro.com/gibo_new/giboviewer/......'
  analyze-sgf -a 'maxVisits:16400,analyzeTurns:[197,198]' baduk.sgf
  analyze-sgf -f baduk.json
  analyze-sgf -g 'maxVariationsForEachMove:15' -r 20000 baduk.sgf

Edit ~/.analyze-sgf.yml for default options
Report analyze-sgf bugs to <https://github.com/9beach/analyze-sgf/issues>
analyze-sgf home page: <https://github.com/9beach/analyze-sgf/>
```

`analyze-sgf`를 사용하려면 홈 디렉터리에 있는 `.analyze-sgf.yml` 파일에 카타고 경로를
설정해야 합니다. `.analyze-sgf.yml` 파일의 내용은 아래와 같습니다. 이 중에서
`"KataGo path here"`, `"KataGo arguments here"` 두 값을 설치된 카타고에 맞게
수정해야 합니다. 예시(e.g.)를 참고하세요.

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

이제 기보 파일, 가령 `신진서-렌샤오.sgf`로 `analyze-sgf`를 실행하면 간단한 분석 결과가
출력되고 `신진서-렌샤오-analyzed.sgf`라는 파일이 생깁니다.

```console
$ analyze-sgf 신진서-렌샤오.sgf
generated: 신진서-렌샤오-analyzed.sgf
# Analyze-SGF Report

제13회 춘란배 4강, Komi 7.5, 207수 흑불계승, 2021-01-20

신진서 (Black)
* Less than 2% win rate drops (75.00%, 78/104)
* Less than 5% win rate drops (88.46%, 92/104)
* More than 5% win rate drops (11.54%, 12/104): #39 ⇣6.32%, #69 ⇣7.03%, #105 ⇣18.34%, #109 ⇣18.41%, #121 ⇣6.67%, #133 ⇣5.92%, #141 ⇣20.10%, #161 ⇣15.17%, #165 ⇣5.78%, #173 ⇣17.48%, #179 ⇣15.75%, #183 ⇣13.84%
* More than 20% win rate drops (0.96%, 1/104): #141 ⇣20.10%
* Top 10 win rate drops: #141 ⇣20.10%, #109 ⇣18.41%, #105 ⇣18.34%, #173 ⇣17.48%, #179 ⇣15.75%, #161 ⇣15.17%, #183 ⇣13.84%, #69 ⇣7.03%, #121 ⇣6.67%, #39 ⇣6.32%
* Top 10 score drops: #141 ⇣35.84, #143 ⇣10.06, #173 ⇣4.93, #171 ⇣3.14, #145 ⇣1.49, #105 ⇣1.43, #179 ⇣1.25, #109 ⇣1.20, #165 ⇣1.14, #69 ⇣0.88

롄샤오 (White)
* Less than 2% win rate drops (74.76%, 77/103)
* Less than 5% win rate drops (81.55%, 84/103)
* More than 5% win rate drops (18.45%, 19/103): #64 ⇣11.43%, #96 ⇣5.20%, #102 ⇣7.88%, #104 ⇣8.71%, #106 ⇣9.51%, #108 ⇣6.93%, #114 ⇣9.05%, #116 ⇣11.45%, #120 ⇣8.97%, #138 ⇣7.90%, #146 ⇣15.73%, #150 ⇣9.34%, #166 ⇣5.62%, #172 ⇣14.41%, #174 ⇣54.39%, #176 ⇣20.59%, #180 ⇣14.40%, #184 ⇣19.62%, #190 ⇣6.76%
* More than 20% win rate drops (1.94%, 2/103): #174 ⇣54.39%, #176 ⇣20.59%
* Top 10 win rate drops: #174 ⇣54.39%, #176 ⇣20.59%, #184 ⇣19.62%, #146 ⇣15.73%, #172 ⇣14.41%, #180 ⇣14.40%, #116 ⇣11.45%, #64 ⇣11.43%, #106 ⇣9.51%, #150 ⇣9.34%
* Top 10 score drops: #146 ⇣52.72, #174 ⇣7.14, #172 ⇣4.61, #176 ⇣1.93, #116 ⇣1.38, #64 ⇣1.25, #140 ⇣1.21, #186 ⇣1.13, #166 ⇣1.13, #102 ⇣0.99

Analyzed by KataGo Parallel Analysis Engine (6415 max visits).
```

사이버오로의 [기보 감상](https://www.cyberoro.com/bcast/gibo.oro?Tdiv=B)과 타이젬
바둑의 [최신기보](http://news.tygem.com/news/tnews/gibo.asp)에서 원하는 기보를 골라
그 인터넷 주소를 `analyze-sgf`에 입력하면 자동으로 기보를 받아서 분석합니다.

```console
$ analyze-sgf 'https://www.cyberoro.com/gibo_new/giboviewer/......'
generated: [제22회 농심배 12국, 2021-02-24] 이치리키 료 vs 신진서 (135수 흑불계승).sgf
generated: [제22회 농심배 12국, 2021-02-24] 이치리키 료 vs 신진서 (135수 흑불계승)-analyzed.sgf
# Analyze-SGF Report
```

```console
$ analyze-sgf 'http://service.tygem.com/service/gibo2/?seq=......'
generated: [제22회 농심배 12국, 2021-02-24] 이치리키 료 vs 신진서 (135수 흑불계승).sgf
generated: [제22회 농심배 12국, 2021-02-24] 이치리키 료 vs 신진서 (135수 흑불계승)-analyzed.sgf
# Analyze-SGF Report
```

아래의 스크린숏은 `신진서-렌샤오-analyzed.sgf` 파일을 사바키로 연 모습입니다.

![Sabaki Variations Screenshot](./sabaki-variations.png?raw=true "Sabaki Variations Screenshot")
**사바키로 변화도를 탐색하는 모습**

승률이 5% 이상 하락하면 빨간색 점으로, 20% 이상 하락하면 빨간색 리본으로, 2% 이내로
하락하면 초록색 점으로 착수를 표시합니다. 이 기준은 `.analyze-sgf.yml`에서 `minWinrateDropForBadMove`, `minWinrateDropForBadHotSpot`,
`maxWinrateDropForGoodMove` 설정 값을 지정해서 변경할 수 있습니다.

매 수마다 승률 및 집 변동에 관한 정보와 승률 하락이 큰 수에 대한 링크를 포함하고 있어서
빠르게 승부처를 분석할 수 있습니다. 사바키에서 색깔이 반전된 변화도 수순 위에 마우스를
올리면 위의 스크린숏에서와 같이 자동으로 수순이 진행됩니다.

## 설정

`.analyze-sgf.yml` 파일은 `analyze-sgf`의 모든 기본 설정을 저장합니다. 기본 설정을
수정하기 위해 `.analyze-sgf.yml` 파일을 수정할 수도 있고 `analyze-sgf`를 실행할 때
지정할 수도 있습니다. 예를 들어, 카타고 분석 엔진의 탐색 숫자를 조절하기 위해서는
`analysis` 섹션의 `maxVisits` 값을 변경해야 하는데 다음과 같이, 실행할 때 지정할 수도
있습니다.

```console
C:\Users\hcho>analyze-sgf.cmd -a 'maxVisits:600' baduk.sgf
```

한 수를 분석할 때 카타고 분석 엔진이 얼마나 많은 탐색을 할지는 `maxVisits` 값으로
설정합니다. 크면 클수록 분석은 더 정확해지지만 시간도 더 많이 걸립니다. 만약
`maxVisits`을 10000으로 두고, 174, 176 수에 대해 최대 20개의 변화도를 분석하려면
다음을 실행합니다.

```console
analyze-sgf -a 'maxVisits:10000,analyzeTurns:[173,175]' -g 'maxVariationsForEachMove:20,showBadVariations:true' baduk.sgf
```

`-a`, `-g` 옵션은 각각 `analysis`, `sgf`를 뜻합니다. 카타고는 0부터 순서를 세기 때문에
174번째 수를 분석하기 위해서는 173을 요청해야 합니다.

`analyzeTurns`을 지정하면 지정된 수의 변화도만 보여 줍니다. 그러나 `analyzeTurns`을
지정하지 않으면 승률 하락이 `minWinrateDropForVariations`보다 큰 모든 수의 변화도를
보여 줍니니다.

이와 같이 `.analyze-sgf.yml` 파일의 모든 설정은 직접 수정할 수도, 실행할 때 지정할 수도
있습니다.

참고로 덤은, `-a 'komi:6.5'` 옵션을 따로 주지 않아도 기보 파일의 정보를 이용해서
자동으로 설정합니다.

`.analyze-sgf.yml` 설정값에 따옴표가 있는 것은 실행 시에도 따옴표를 붙여야 합니다. 즉
아래와 같이 실행해야 합니다.

```console
analyze-sgf -a 'rules:"korean"' baduk.sgf
```

## 고급 설정

### 분석 데이터 저장

카타고로 분석하는 데는 꽤 긴 시간이 걸립니다. 그런데 분석된 기보에는 승률 하락이
`minWinrateDropForVariations`보다 큰 수의 변화도만 수록되며 분석 이후에 이를 바꿀 수
없습니다. 이것을 바꾸려고 시간을 들여 새로 분석해야 한다면 많이 실망스러울 것입니다.
그래서 `-s` 옵션으로 카타고 분석 데이터를 저장해 두고 이를 재활용하는 기능이 있습니다.

```console
$ analyze-sgf -s -a 'maxVisits:30000' baduk.sgf
generated: baduk.json
generated: baduk-analyzed.sgf
```

위와 같이 `maxVisits`에 큰수를 지정하면 긴 시간을 들여 많은 것을 분석합니다. 그리고 그
결과는 `-s`에 의해 `baduk.json`으로 저장되었습니다. 아래와 같이 실행하면 카타고가 아닌
`baduk.json`을 이용해서 실행과 동시에 분석을 끝마칩니다.

```console
analyze-sgf -a 'analyzeTurns:[170,171]' -g 'maxVariationsForEachMove:20,showBadVariations:true' -f baduk.json
```

이제 171, 172 번째 수의 변화도를 나쁜 변화도까지 포함해서 최대 20개까지 볼
수 있습니다. 저장된 분석 정보를 이용하기 때문에 `analyzeTurns`를 제외한 `maxVisits`,
`komi` 등의 `-a` 옵션 값은 무시됩니다.

몇 시간을 기다릴 수 있다면 `-s -a 'maxVisits:100000'`과 같이 아주 큰 탐색 숫자를 주고
분석 데이터를 저장하세요. 실시간으로 카타고를 이용하는 것과는 차원이 다른 깊이를
제공합니다.

카타고 분석 데이터에 존재하는 모든 변화도를 보고 싶다면 다음을 실행합니다.

```console
analyze-sgf -g 'minWinrateDropForVariations:-100,showBadVariations:true,maxVariationsForEachMove:100 -f baduk.json'
```

### 가변 탐색

`maxVisits`에 큰 수를 지정하면 분석의 정확도를 높일 수 있지만, 중요하지 않은 착수에도
많은 시간을 들인다는 단점이 있습니다. 이때 가변 탐색을 이용하면 승률 변동이
`minWinrateDropForVariations`보다 작은 수순의 변화도는 낮게 설정된 `maxVisits`에
맞춰 분석하고, 큰 수순의 변화도는 별도로 지정한 높은 탐색수에 맞춰 분석할 수 있습니다.
즉, 다음을 실행하면, 승률 변동 5%를 기준으로 그 이상은 50000 방문수로, 그 이하는 1000
탐색수로 분석합니다.

```console
analyze-sgf -a 'maxVisits:1000' -g 'minWinrateDropForVariations:5' --revisit 50000 baduk.sgf
```

주의할 것은 가변 탐색으로 변하는 것은 문제가 된 수의 탐색수가 아니라 그 이전 수의
탐색수라는 점입니다. 그래야 해당 수의 변화도들을 더 폭넓게 탐색할 수 있기 때문입니다.

`analyze-sgf --revisit 50000 baduk.sgf`로 실행하면 `.analyze-sgf.yml`에
설정된 `maxVisits`, `minWinrateDropForVariations` 값을 이용합니다.
