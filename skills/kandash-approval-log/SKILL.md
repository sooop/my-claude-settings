---
name: kandash-approval-log
description: Smart Warehouse 칸닷슈(도착보장) 승인 시 Qoo10 API(CreateCertificationKey_Logistics, EFA Connect) 요청·응답 전문과 실패 원인(권한없음 -90002 등)을 cust_no 로 조회한다. Use when asked "칸닷슈 승인 실패 로그", "Qoo10 Connect 응답 확인", "kandash approval log", "권한없음 케이스 전문", or when a cust_no/api_id comes in from /tg-get for a kandash approval failure.
---

# 칸닷슈 승인 로그 조회

smart-warehouse 의 ES 앱 로그(`AdminES.SearchLogByKeyword`, app_no=73)를 **읽기 전용**으로 조회해 승인 시도별 Qoo10 요청/응답 전문을 출력한다. 운영 ES 에 접속하므로 응답에 API ID·인증키가 평문으로 들어 있다 — 외부 전달 시 필요한 필드만 추린다.

## 실행

```bash
node C:/projects/smart-warehouse/scripts/kandash-log.mjs <cust_no> [--attempt N|all] [--days 90] [--json out.json]
# 또는 smart-warehouse 루트에서: npm run kandash-log -- <cust_no> ...
```

- 스크립트 정본은 smart-warehouse 저장소의 `scripts/kandash-log.mjs` 다(어느 폴더에서 실행해도 스스로 저장소 루트로 이동한다). 약 15초 걸린다.

- 기본 출력: 시도별 요약표 + 최신 시도(#1) 전문. `--attempt 3` 은 3번째, `all` 은 전부.
- cust_no 가 없고 api_id 만 있으면 `tg_get` 메시지의 cust no 를 쓴다.

## 출력 읽는 법

- 요약표의 ①발급·②Connect·최종은 TX 가 기록한 `ResultCode`(0=성공). 실패 시 ②응답 열에 Qoo10 원문 응답이 나온다.
- `-10003` = RequestEOTService(Qoo10 EFA Connect) 실패. 응답 `ErrorCode -90002 / 権限がありません。` 은 Qoo10 측 권한 없음으로, 셀러의 EFA 이용 자격 또는 `company_code=TX` 연결을 Qoo10 에서 확인해야 한다.
- `-10001` 셀러 정보 조회 실패, `-10002` 인증키 발급 실패, `-10005` 상위 예외(FRONT 로그 확인).
- AutoRefreshToken 배치(`cust_no:` 공백 없음 포맷)는 매칭에서 빠진다.
