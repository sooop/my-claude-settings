# 적용 점검표

## 인프라
- [ ] 앵커 레지스트리·컨트롤러·`FeedbackHost`·`PanelNotice` 이식, 앱 최상단에 Host 한 번만 장착
- [ ] `feedback.css`(+ React 는 `feedback-components.css`) 전역 로드, CSS 변수 18개 정의(`references/svelte5/README.md`)
- [ ] `--z-feedback` 가 모달·다이얼로그·메뉴보다 높음. 모달을 연 채 오류를 내서 팝오버가 보이는지 확인
- [ ] 라이트·다크 테마 양쪽에서 error/warn/info 색, 빨간 점, "✓" 오버레이 확인
- [ ] 앵커 부착 버튼은 `position` 이 static 이어도 표식이 그려짐(레지스트리가 `relative` 로 올림) — 레이아웃이 밀리지 않는지 확인
- [ ] 앵커 id 는 `scope.name`, 패널은 `scope.panel`(`PanelNotice scope` 와 일치)

## 호출처 분류표
- [ ] `rg "toast|snackbar|alert\("` 전수 표: 메시지 / kind / 트리거 / 그 시점에 남는 앵커 후보
- [ ] 모든 호출이 4순위(원인 → 패널 → 트리거 → 트레이) 중 하나로 분류됨, anchors 배열이 순서대로 적힘
- [ ] 메뉴·다이얼로그·드롭 영역에서 시작된 동작은 같은 상시 버튼 앵커를 씀(메뉴 항목 자체를 앵커로 쓰지 않음)
- [ ] 오류마다 `key` 가 있고, 같은 동작의 성공 경로에 `clear(key)`, 입력 경로에 `clearScope(prefix)` 가 있음
- [ ] 오류에 안심 문구(`reassure`)와 복구 동작(`actions`)이 가능한 곳마다 붙음
- [ ] 성공 확인은 `ok(anchorId, label)`; 버튼이 사라지는 경우만 패널 배너·트레이

## 실패를 삼키는 함수
- [ ] 저장·내보내기·복사·불러오기 함수가 예외를 `catch` 로 삼키고 호출자가 "성공"을 띄우지 않는지(반환값 `boolean`/throw 로 바꾸고 호출자가 분기)
- [ ] 실패 메시지를 성공 kind 로 보내는 곳 없음(빈 데이터 내보내기 등)
- [ ] 자동 실행(입력 시 재실행)이 같은 key 로 오류를 합치는지(쌓이지 않음), 성공 시 해제되는지
- [ ] 부분 성공(여러 파일)은 한 묶음: 실패만 펼치고 성공은 한 줄, 실패 항목 때문에 기존 데이터를 덮어쓰지 않음
- [ ] 입력이 잘못돼 결과가 낡았을 때 결과를 비우지 않고 흐리게 + "갱신 안 됨" 표시

## 동작·접근성
- [ ] error/warn 은 시간으로 닫히지 않음, 트레이 info 만 몇 초 뒤 사라짐
- [ ] 트리거 팝오버를 닫아도 빨간 점이 다음 성공까지 남음
- [ ] 같은 key 반복 시 `×N`·시각 갱신·흔들림, 패널당 한 줄
- [ ] error 는 `role="alert"`, 나머지는 `aria-live="polite"`/`role="status"`. 색만으로 구분하지 않음(아이콘·문구)
- [ ] `prefers-reduced-motion` 에서 흔들림·등장 애니메이션 감소
- [ ] 백드롭·화면 모서리 고정 하단 중앙 토스트 없음, 비모달

## 테스트
- [ ] 앵커 resolve: 우선순위 순서, 요소가 사라지면 다음 후보, 전부 없으면 null → 트레이
- [ ] 합치기: 같은 key 는 count 증가·항목 1개, 다른 key 는 별개
- [ ] 해제: error 는 타이머로 안 닫힘, `clear`/`clearScope`/`dismiss` 의미 구분, 트레이 info 는 시간 후 해제
- [ ] 표식: error 는 trigger 배치일 때만 `data-fb-error`, 마지막 error 가 사라지면 제거, `ok` 는 1.5초 뒤 제거, 버튼 교체 후에도 재적용
- [ ] 오류 위치 추출 유닛 테스트(`errorPosition`)
- [ ] 구 토스트 삭제 후 `rg "toast|snackbar|alert\("` 잔존 0건, `tsc`·테스트 통과
