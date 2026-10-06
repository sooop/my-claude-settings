---
name: cli-tools
description: CLI 도구를 고르거나 쓰기 전에 보는 지침. rg·fd·ast-grep·nu·jq·duckdb·difft·tokei·typos 등 도구별 관할과 함정, 출력 토큰 절약법, UTF-16 파일에서 sd 사용 주의, Windows 셸 루프 회피. 파일 탐색·검색·치환·diff·데이터 분석·반복 처리 작업을 시작할 때 사용한다.
---

## CLI 도구 사용 지침

- **도구를 꺼내기 전에 `package.json` 의 scripts 를 먼저 본다.** 저장소가 이미 갖춘 검증 스크립트가 거의 항상 더 빠르고 정확하다. (실측: 로케일 키 대조를 `jq` 로 재구현하면 6.6초/부분 검사, `npm run validate-i18n` 은 1.4초에 용어집 검사까지 한다.)
- **파일 탐색은 목적에 따라 나눈다.** 추적 파일만 필요하면 `git ls-files`(실측 73ms, `fd` 96ms로 1.31배 빠름·결과 동일), 무시 대상·미추적까지 훑거나 `-x`/`-X` 실행이 필요하면 `fd`.
- **파일을 항목별로 반복 처리하는 일은 `nu` 를 우선한다.** 파일마다 열어서 판정·추출·존재확인을 해야 하면 셸 루프(`for`/`while`/`fd -x`) 대신 `nu` 로 한 프로세스 안에서 끝낸다 — Windows 는 프로세스 스폰 고정비가 커서 항목 수에 그대로 비례한다(실측: 링크 1,576건 확인이 bash 루프 120초 초과 타임아웃 vs nu 2.7초, BOM 검사 4,865파일이 `fd -X file` 28.5초 vs nu 4.1초). 예외와 함정은 아래 「`nu` 를 쓰는 자리」 참고.
- **문자열 검색은 `rg`.** `git grep` 보다 1.5배 빠르다(실측 138ms vs 207ms).
- **구조적 검색·구문 인식이 필요한 코드 변경은 `ast-grep`.** 단순 문자열·정규식 치환은 코드 파일이라도 `sed`(우선)/`sd` 를 써도 된다.
- **파일 2개 이상을 고친 뒤 회귀를 검수할 때는 `git diff` 대신 `difft`를 먼저 본다.** 포맷 변경과 의미 변경이 섞이면 텍스트 diff로는 구분할 수 없다. 공백만 바뀐 경우 `difft`는 `No syntactic changes.`를 출력한다. (실측: 들여쓰기만 바뀐 492줄 파일이 `git diff` 1,016줄 → `difft` 2줄. 포맷+의미가 섞이면 1,016줄 → 40줄.)
- **`dyff between` 은 YAML·구조가 같은 설정 파일 비교에만 쓴다.** 값이 대부분 다른 파일(로케일 JSON 등)에 쓰면 출력이 오히려 늘어난다(실측 8,444줄 vs `git diff` 3,703줄).
- **`.docx`/`.pdf`/`.xlsx` 내용을 검색해야 하면 `rga`를 쓴다.** `rg`는 `binary file matches`만 출력한다.
- **`duckdb -c` 는 표 형태 데이터(CSV/Parquet/JSONL·평면 JSON) 전용이다.** 중첩 JSON에는 쓰지 않는다 — `json_keys()` 는 최상위만 본다. 5단 중첩 로케일 파일에서 `duckdb` 는 키 60개, `jq -r 'paths(scalars)'` 는 1,698개를 보고한다. **누락 0건이라는 거짓 통과**가 실제로 나왔다.
- **`typos` 는 저장소에 `_typos.toml` 허용목록이 있을 때만 돌린다.** 도메인 약어·레거시 API 필드명을 전부 오탈자로 잡는다(실측 5,451건 중 상위가 `RTO` 1,092 = Return To Origin, `PRUCHASE` 406 = 레거시 필드 `PRUCHASE_AMT`, `regist` 229). 허용목록 없이 돌리면 신호가 없다.
- **팬아웃 범위를 나눌 때는 `tokei` 로 먼저 규모를 잰다.** 서브 에이전트에 디렉터리를 배분하기 전에 코드량 편차를 확인한다(실측 0.7초/저장소 전체. `src/app/orders` 260k줄 vs `src/app/pickups` 20k줄 — 13배 차이를 모르고 균등 분배하면 한 에이전트만 오래 돈다). `--output json` 으로 기계 판독 가능.
- 위 규칙 중 세션을 멈추는 2건(인자 없는 `duckdb` / 대화형 `fzf`)은 `~/.claude/hooks/bash-guard.sh` 가 PreToolUse 에서 실제로 차단한다. 문자열 리터럴 안에 도구 이름이 데이터로만 등장하는 경우는 통과하며, 부득이하면 명령 끝에 `# guard-off` 를 붙인다.

### 기타 사용 가능 도구

**원칙: 같은 일에 두 도구를 쓰지 않는다.** 아래 표의 관할을 지킬 것.

| 용도 | 도구 | 비고 |
|---|---|---|
| 코드 대량 변경·구조적 검색 | `ast-grep` | 메타변수 `$A` / `$$$ARGS`. 주석·문자열을 오염시키지 않고 멀티라인 호출을 잡는 **유일한** 도구. **별칭 `sg` 는 0.45에서 폐기 경고를 낸다 — `ast-grep` 로 부를 것** |
| 파일·구조 데이터 반복 처리 | `nu` | 항목마다 셸 루프를 돌아야 하는 일을 한 프로세스로 끝낸다. 출력은 반드시 `\| to tsv` 등으로 압축 (아래 절 참고) |
| 텍스트 검색 | `rg` | |
| 파일 탐색 | `fd` | |
| 표 형태 데이터 분석 | `duckdb` | CSV/Parquet/JSONL·**평면** JSON에 SQL 직접 실행. 중첩 JSON은 `jq` |
| CSV 전처리·검수 | `qsv` | `headers` `stats` `validate` `excel` `sqlp`. `qsv excel <파일>` 로 xlsx 헤더 확인 |
| JSON 질의 | `jq` | 중첩 구조·키 집합 대조는 이쪽 |
| YAML 질의·수정 | `yq` | jq 문법 그대로 |
| **XML 질의** | `yq -p xml` | 속성은 `+@name` 접두. 예: `yq -p xml -o tsv '.root.object[] \| [.["+@id"]]' f.config` |
| 코드량 측정·팬아웃 범위 분할 | `tokei` | 저장소 전체 0.7초. `--sort code` / `--output json` |
| 변경 회귀 검수 | `difft` | 구문 인식 diff. 포맷 변경과 의미 변경을 구분 |
| 설정·API 응답 구조 diff (사람이 리뷰) | `dyff` | 타입 변경·순서 변경을 명시적으로 분류 |
| JSON 패치 생성·적용 (기계가 적용) | `jd` | RFC 6902 JSON Patch |
| 인코딩 정규화 | `iconv` | |
| 텍스트 치환 | `sed`(우선) / `sd` | 코드 파일에도 가능. 구문 인식이 필요하면 `ast-grep`. UTF-16 파일 주의(아래 CRITICAL) |
| docx/pdf/zip 내부 검색 | `rga` | 해당 문서가 실제로 있을 때만 — 순수 코드 저장소에서는 대상이 0건이다 |
| 오탈자 스윕 | `typos` | `_typos.toml` 허용목록이 있는 저장소에 한정 |
| 성능 비교 | `hyperfine` | Windows 에서는 `--shell=bash` 를 붙일 것(기본 셸에서 인용부호가 깨져 exit 2) |
| 컬럼 추출 | `choose` | 공백 정렬 출력(`netstat -ano` 등)에 한정 |
| 작은 JSON 경로 탐색 | `gron` | 사실상 불필요 — `jq -r 'paths(scalars)'` 가 같은 일을 1/2.5 출력으로 한다 (아래 CRITICAL) |
| GitHub 작업 | `gh` | |
| 문서 변환 | `pandoc` | |

**사용 금지 / 제거 대상**: `xsv`(→`qsv`가 상위호환), `ag`(→`rg`와 중복), `dasel`(v3에서 CLI 전면 변경, `-f` 삭제 — `yq`로 대체). `xsv`·`ag` 는 아직 설치돼 있으므로 `scoop uninstall xsv ag` 로 실제로 지운다.

**설치하지 않는 것**: `lychee`(문서 링크 검사 — 스킬 문서가 쓰는 루트 상대 경로 관행을 모르면 출력의 75%가 노이즈다. 실측 55건 중 41건. 관행을 아는 프로젝트 스크립트를 쓴다), `delta`(`difft` 와 중복), `jless`·`jnv`·`fzf` 대화형 모드(에이전트 환경에서 입력 대기로 멈춘다).

### 토큰 효율 — 도구 선택보다 출력량이 지배한다

같은 답을 얻는 데 드는 토큰은 도구 이름이 아니라 **출력 형태**로 갈린다. 아래는 같은 저장소·같은 질문에 대한 실측이다.

- **구조 검색 결과를 눈으로 읽지 말고 기계로 좁힌다.** `ast-grep` 원시 출력(210 KB)은 `rg -A 8`(253 KB) 대비 이득이 거의 없다. 이득은 `--json=compact` 를 `jq` 로 거를 때 나온다 — 같은 262건이 **17 KB(93% 감소)** 가 된다.
  ```bash
  sg -p 'showConfirm($$$A)' -l tsx --json=compact \
    | jq -r '.[] | select(.text | test("destructive") | not) | "\(.file):\(.range.start.line)"'
  ```
- **판정이 목적이면 `ast-grep` 규칙 파일로 만든다.** `sgconfig.yml` + `rules/*.yml` 로 `sg scan` 하면 산문으로만 있던 금지사항이 검사 가능해진다(실측 1.8초/`src/app`). 단, `not: has: pattern: X` 는 객체 속성 키를 놓치므로 `kind: pair` + `field: key` + `regex` 로 정밀화해야 한다(오탐 30건 → 8건).
- **회귀 검수는 `difft` 를 먼저** — 포맷 노이즈가 섞이면 `git diff` 대비 25~500배 차이가 난다.
- **Windows Git Bash 에서는 항목당 셸 루프를 만들지 않는다.** 1,576개 링크를 `[ -e ]` 루프로 검사하면 120초를 넘겨 타임아웃된다. 같은 일이 node 단일 패스 1.8초, `nu` 2.7초다. 반복이 필요하면 `fd -X`(배치)·`nu`·스크립트 한 번 실행으로 바꾼다.

### `nu` (nushell) 를 쓰는 자리

**판단 기준은 하나다 — 항목마다 프로세스를 띄워야 하는가.** Windows 에서 프로세스 스폰은 고정비가 커서, 이때만 `nu` 가 압도적이다. 그 외에는 기존 도구를 쓴다.

- **쓸 자리**: 파일마다 열어서 판정하는 일(BOM 검사 4,865파일 — nu 4.1초 vs `fd -X file` 28.5초), 파일마다 정규식 추출 후 경로 존재 확인(링크 검사 — bash 루프 120초+ vs nu 2.7초), CSV 를 바로 표로 열어 집계(`open x.csv` 로 5,179행 즉시).
- **쓰지 않을 자리**: 중첩 JSON 의 깊은 경로 추출 — nu 에 `jq` 의 `paths(scalars)` 에 해당하는 것이 없다(로케일 파일에서 jq 1,698 경로 vs nu `flatten` 996, `columns` 60). **jq 를 쓴다.** xlsx 헤더 확인도 nu 는 `column0…` 으로만 읽어 `qsv excel` 이 낫다.
- **출력은 반드시 압축한다.** 기본 박스 테이블은 같은 20행이 2,820바이트, `to csv` 는 1,165바이트로 **2.4배 차이**다. 에이전트가 읽을 출력에는 `| to tsv` / `| to csv` / `| to json -r` 을 붙인다.
- **`where` 에서 `$in` 을 쓰지 않는다.** `where ($in.text | str contains 'x') == false` 는 **오류 없이 전건을 통과시켰다**(262건 ↔ 정답 255건). 반드시 명시적 클로저 `where {|r| ... $r.text ... }` 로 쓴다.
- **인라인 `nu -c "…"` 보다 `.nu` 스크립트 파일**을 쓴다. bash 안에서 `$`·따옴표가 이중으로 escape 되어 조용히 다른 코드가 된다.
- 기동 비용은 약 60ms(bash 30ms 의 2배)다. 한 번 호출로 끝내는 일에는 무시할 수준이지만, **`nu` 를 루프 안에서 부르면 원래 문제로 돌아간다.**

<CRITICAL>
- **`sd`는 UTF-16 파일에서 경고 없이 아무 일도 하지 않고 exit 0을 반환한다.** sd에는 인코딩/바이너리 관련 플래그가 없다(1.1.0까지 확인. 바이너리는 `--version`에서 1.0.0으로 잘못 보고한다). **주로 레거시 .NET 저장소(QxFront·legacy-backend 등)에서 발생하며, Next.js 쪽 저장소는 실측 0건이었다.** 일괄 치환 전 아래로 선별·정규화한다.
  ```nu
  # 1) UTF-16 파일 색출 — nu 안에서 바이트를 직접 읽는다(외부 프로세스 스폰 0)
  ^git ls-files -- '*.ts' '*.tsx' '*.cs' '*.sql'
  | lines
  | where {|f| (try { open --raw $f | bytes at 0..2 } catch { 0x[] }) in [0x[FF FE], 0x[FE FF]] }
  ```
  ```bash
  # nu 가 없으면: 배치 실행(-X)으로 file 에 한 번에 넘긴다 (느리지만 동작함)
  fd -e ts -e tsx -e cs -e sql -X file | rg -i 'utf-16'
  # 2) UTF-8 로 정규화 (엔디언을 명시하면 BOM이 U+FEFF로 남으므로 -f UTF-16 을 쓸 것)
  iconv -f UTF-16 -t UTF-8 "$f" > "$f.u8" && mv "$f.u8" "$f"
  ```
  **`fd -x sh -c '... "$1" ...' _ {}` 형태로 쓰지 말 것.** Windows 에서 fd가 내보낸 백슬래시 경로가 `sh` 재파싱에서 뭉개져(`./src\app\x.tsx` → `./srcappx.tsx`) 전 파일이 `cannot open` 으로 실패하고, **탐지 결과가 항상 0건이 되어 "UTF-16 없음"으로 오인**하게 만든다. 4,865 파일 실측: nu 4.1초 · `fd -X file` 28.5초 · `git ls-files \| xargs file` 77초.
  BOM 검사만으로는 부족하다 — `iconv -t UTF-16LE` 처럼 엔디언을 명시해 만든 파일은 BOM이 없다. `file` 은 이 경우도 판정한다.
  인코딩 변환 커밋과 치환 커밋은 **반드시 분리**한다(변환 파일은 전체가 diff로 잡힘).
- **`duckdb`는 인자 없이 호출하면 REPL로 진입해 세션이 멈춘다.** 항상 `-c` 또는 `-f`를 붙인다.
- **`fzf`는 대화형이므로 에이전트가 그냥 실행하면 입력 대기로 멈춘다.** 쓸 경우 `--filter <query>` 비대화형 모드로만.
- **`gron`은 430KB JSON을 40,005줄로 펼친다.** 큰 JSON의 스키마 파악은 아래를 쓴다.
  ```bash
  jq -r 'paths(scalars)|map(if type=="number" then "[]" else tostring end)|join(".")' f.json | sort -u
  ```
</CRITICAL>

**도구별 함정(실측 확인)**
- `difftastic`의 실행 파일명은 **`difft`**, `miller`는 **`mlr`**, `ripgrep-all`은 **`rga`**.
- `jd`의 포맷 지정은 **`-f`**. `-o`는 출력 *파일*이라 `jd -o patch`는 `patch`라는 파일을 만들고 stdout이 빈다.
- Git Bash에 **`diff` 명령이 없다.** 텍스트 비교는 `git diff --no-index`.
- `mlr`은 부동소수 누적오차를 그대로 노출한다(`24548956.94000001`). 금액 집계는 `duckdb`의 `round()` 또는 `mlr --ofmt`.

