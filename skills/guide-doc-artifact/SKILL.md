---
name: guide-doc-artifact
description: 가이드·설명·분석 문서를 아티팩트(HTML 페이지)로 만들 때 적용하는 작성 기준과 노션 스타일 표준 CSS. 멘탈모델을 세우는 내러티브 구조(도입→개념 등장 배경→메커니즘→예시→오해 교정→판단 규칙)와 본문 폭 120ch·브라우저 기본 글꼴(sans-serif)·무장식 디자인 토큰을 고정한다. Use when the user asks for a guide document, 가이드 문서, 설명 문서, 조사 결과 문서, 문서 페이지, 노션 스타일 문서, document artifact, or wants to publish an analysis as a readable page.
---

# 가이드 문서 아티팩트

조사 결과·설계 분석·개념 설명을 **읽는 사람의 멘탈모델을 세우는 문서**로 발행할 때 쓴다.
`artifact-design` 스킬을 먼저 로드한 뒤, 그 위에 이 스킬의 규칙을 적용한다. 충돌하면 이 스킬이 우선한다.

## 1. 글의 목적과 기준

가이드는 정보 전달이 아니라 **독자가 새 상황에서도 스스로 예측·판단할 수 있는 사고의 틀**을 만드는 글이다. 다음을 지킨다.

- **내러티브 흐름.** 도입부·전개부·마무리가 각각 제 역할을 한다. 독자가 지금 어디를 읽고 있고 왜 이 절이 다음에 오는지 알 수 있어야 한다.
- **개념은 등장 배경부터.** 새 개념을 소개할 때 그것이 어떤 문제를 풀거나 어떤 필요로 생겼는지 먼저 밝힌다. 맥락 없는 개념 나열 금지.
- **이전 개념과 명시적으로 연결.** "2절의 연결 모양 때문에", "규칙 4에 비추면"처럼 앞 개념을 호출해 관계와 발전을 보여 준다.
- **메커니즘을 덧붙인다.** "X가 Y한다"에서 멈추지 않고 "X가 Y하는 이유는 Z가 그렇게 해석하기 때문"까지 쓴다.
- **구체 예시·비유로 받친다.** 실제 데이터 사례, 실제 호출 순서, 실측 수치.
- **흔한 오해를 선제적으로 교정한다.** 독자가 갖고 올 법한 틀린 믿음을 그 개념 바로 옆에서 언급하고 바로잡는다.
- **마무리는 판단 규칙.** 본문을 몇 개의 규칙으로 접고, 그 규칙으로 새 상황을 예측해 보이는 절을 둔다.

## 2. 권장 구조

```
제목 (짧은 명사구, 설명어 붙이지 않음)
메타 줄 (날짜 · 근거 범위 · 도메인)
리드 문단 (이 글이 무엇을 설명하고, 다 읽으면 무엇을 할 수 있게 되는지)
차례
1. 왜 이것이 존재하는가 (문제·필요)
2~N. 개념 → 메커니즘 → 예시 → [흔한 오해] 순으로 전개, 각 절이 앞 절을 호출
N+1. 이 틀로 사례 읽기 (실제 사례 재구성 + 다른 상황 예측)
N+2. 데이터·근거 (표)
N+3. 판단 규칙 + 개선 방향 평가
각주 (근거 파일·SP·소스 위치)
```

- 절 번호는 순서가 의미를 가질 때만 붙인다(내러티브 문서는 대체로 붙인다).
- "흔한 오해" 블록은 그 오해가 생기는 개념 바로 아래에 둔다. 모아서 뒤에 두지 않는다.
- 순서가 있는 판단·호출 사슬은 `.chain` 리스트로, 각 단계에 "왜"를 한 줄 덧붙인다.

## 3. 디자인 규칙

- **노션 스타일 단일 칼럼, 무장식.** 아이콘·이모지·색 띠·카드 그림자·그라데이션·히어로 금지. 위계는 크기와 굵기로만 만든다.
- **본문 최대 폭 `120ch`.** 720px 같은 픽셀 고정 폭을 쓰지 않는다.
- **글꼴은 브라우저 기본.** `body { font-family: sans-serif; }` 만 지정한다. 시스템 폰트 스택·Google Fonts·웹폰트 금지. 코드는 `font-family: monospace;` 만.
- **양쪽 테마.** 아래 토큰을 `:root`(라이트) → `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` → `:root[data-theme="dark"]` 세 겹으로 정의하고, 컴포넌트는 토큰만 참조한다. `body` 배경은 반드시 토큰으로 명시한다.
- **표는 `.table-wrap` 안에.** 숫자 칼럼은 `.num`(우측 정렬·tabular-nums).
- **식별자는 `<code>`.** 문장 안 식별자는 한 문장에 하나 정도로 절제한다.
- **강조는 `<strong>`만.** 색으로 강조하지 않는다. "흔한 오해" 블록만 옅은 경고색 배경을 쓴다.

## 4. 표준 CSS (그대로 복사해 `<title>` 아래에 둔다)

```html
<title>문서 이름</title>
<style>
  :root {
    --bg: #ffffff;
    --ink: #37352f;
    --muted: #6f6e69;
    --rule: #e6e4df;
    --block: #f6f5f2;
    --code-bg: #f1efeb;
    --accent: #2b5fb8;
    --warn: #8a5a1c;
    --warn-bg: #fbf5ea;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #191919; --ink: #d6d4cf; --muted: #9b9994; --rule: #333230;
      --block: #232221; --code-bg: #2a2927; --accent: #7aa2e8;
      --warn: #d9b26f; --warn-bg: #2a251b;
    }
  }
  :root[data-theme="dark"] {
    --bg: #191919; --ink: #d6d4cf; --muted: #9b9994; --rule: #333230;
    --block: #232221; --code-bg: #2a2927; --accent: #7aa2e8;
    --warn: #d9b26f; --warn-bg: #2a251b;
  }

  body {
    background: var(--bg);
    color: var(--ink);
    font-family: sans-serif;
    font-size: 16px;
    line-height: 1.75;
    -webkit-font-smoothing: antialiased;
  }
  main { max-width: 120ch; margin: 0 auto; padding: 72px 24px 120px; }

  h1 { font-size: 40px; line-height: 1.2; font-weight: 700; letter-spacing: -0.01em; margin: 0 0 12px; text-wrap: balance; }
  .meta { color: var(--muted); font-size: 14px; margin: 0 0 40px; padding-bottom: 20px; border-bottom: 1px solid var(--rule); }
  .meta span + span::before { content: "·"; margin: 0 8px; }
  h2 { font-size: 26px; line-height: 1.3; font-weight: 600; margin: 64px 0 16px; text-wrap: balance; }
  h3 { font-size: 19px; line-height: 1.4; font-weight: 600; margin: 40px 0 10px; text-wrap: balance; }
  p { margin: 0 0 16px; }
  p.lead { font-size: 18px; }
  ul, ol { margin: 0 0 16px; padding-left: 24px; }
  li { margin: 4px 0; }
  li > ul, li > ol { margin-top: 4px; margin-bottom: 4px; }
  strong { font-weight: 600; }
  a { color: var(--accent); text-decoration: none; }
  a:hover, a:focus-visible { text-decoration: underline; }

  code { font-family: monospace; font-size: 0.86em; background: var(--code-bg); padding: 1px 5px; border-radius: 3px; }
  pre { font-family: monospace; font-size: 13px; line-height: 1.6; background: var(--block); padding: 16px 18px; border-radius: 4px; overflow-x: auto; margin: 0 0 20px; }
  pre code { background: none; padding: 0; font-size: inherit; }

  .toc { background: var(--block); border-radius: 4px; padding: 16px 20px; margin: 0 0 8px; font-size: 15px; }
  .toc .label { color: var(--muted); font-size: 13px; margin-bottom: 6px; }
  .toc ol { margin: 0; padding-left: 20px; }
  .toc li { margin: 2px 0; }

  .callout { background: var(--block); border-radius: 4px; padding: 14px 18px; margin: 20px 0 24px; }
  .callout .label { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
  .callout p:last-child { margin-bottom: 0; }
  .callout.misread { background: var(--warn-bg); }
  .callout.misread .label { color: var(--warn); }

  .table-wrap { overflow-x: auto; margin: 0 0 24px; }
  table { border-collapse: collapse; width: 100%; font-size: 14.5px; line-height: 1.55; }
  th, td { text-align: left; vertical-align: top; padding: 9px 12px; border-bottom: 1px solid var(--rule); }
  th { font-weight: 600; color: var(--muted); font-size: 13px; border-bottom: 1px solid var(--ink); }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tbody tr:last-child td { border-bottom: none; }

  .chain { list-style: none; padding: 0; margin: 0 0 20px; counter-reset: step; }
  .chain li { display: grid; grid-template-columns: 28px 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--rule); margin: 0; }
  .chain li:last-child { border-bottom: none; }
  .chain li::before { counter-increment: step; content: counter(step); color: var(--muted); font-variant-numeric: tabular-nums; font-size: 14px; padding-top: 2px; }
  .chain .why { display: block; color: var(--muted); font-size: 14px; }

  hr { border: 0; border-top: 1px solid var(--rule); margin: 56px 0; }
  .footnote { color: var(--muted); font-size: 14px; }

  @media (max-width: 600px) {
    main { padding: 40px 18px 80px; }
    h1 { font-size: 32px; }
    h2 { font-size: 23px; margin-top: 48px; }
  }
</style>
```

## 5. HTML 골격과 구성요소

```html
<main>
  <h1>문서 이름</h1>
  <p class="meta"><span>2026-01-01</span><span>근거 범위</span><span>도메인</span></p>
  <p class="lead">리드 문단.</p>

  <div class="toc">
    <div class="label">차례</div>
    <ol><li><a href="#s1">1. …</a></li></ol>
  </div>

  <h2 id="s1">1. 절 제목</h2>
  <p>본문.</p>

  <div class="callout misread">
    <div class="label">흔한 오해</div>
    <p>"오해 문장." 왜 틀렸는지와 실제 동작.</p>
  </div>

  <ol class="chain">
    <li><div>단계 설명<span class="why">이 단계가 있는 이유·조건.</span></div></li>
  </ol>

  <div class="table-wrap">
    <table>
      <thead><tr><th>항목</th><th class="num">건수</th></tr></thead>
      <tbody><tr><td>…</td><td class="num">1,234</td></tr></tbody>
    </table>
  </div>

  <hr>
  <p class="footnote">근거 파일·SP·소스 위치.</p>
</main>
```

`.callout`(라벨 임의)은 보충 설명, `.callout.misread`는 오해 교정 전용이다. 다른 색 변형을 만들지 않는다.

## 6. 발행 절차

1. `<title>`은 두세 단어의 이름으로 짓는다. 설명어를 대시·콜론으로 덧붙이지 않는다.
2. 파일은 세션 스크래치패드에 `<주제>.html`로 쓴다(`<!doctype>`·`<html>`·`<head>`·`<body>` 태그는 쓰지 않는다).
3. `Artifact` 도구로 발행한다. 첫 발행에만 `favicon`(이모지 1개)을 주고, 재발행은 같은 파일 경로로 하되 `favicon`을 생략한다. `description`에 한 문장 설명을 넣는다.
4. 내용 수정 요청이 오면 해당 절만 고쳐 같은 경로로 재발행한다. 내러티브 문서이므로 새 내용을 절 끝에 덧붙이지 말고 흐름 안의 맞는 자리에 끼우고, 앞뒤 절의 참조("N절에서 보듯")가 여전히 맞는지 확인한다.
5. 사실 정정이 들어오면 그 사실을 언급한 모든 절(본문·표·사례·판단 규칙)을 함께 고친다. 한 곳만 고치면 문서 안에서 서로 모순된다.
