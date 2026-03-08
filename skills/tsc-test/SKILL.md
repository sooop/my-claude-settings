---
name: tsc-fixer
description: typescript 프로젝트를 tsc를 사용하여 컴파일하고 정적 에러를 발견 및 수정한다
---

tsc로 컴파일하고 사용자가 지정한 특정한 경로 이하에서 발생하는 오류를 찾고, 해당 오류를 수정합니다.

**예시**

```.bash
npx tsc --noEmit --pretty 2>&1 | rg $ARGUMENT
```

** 주요오류코드**

* TS2322
* TS2345
* TS2339
* TS2304
* TS2531
* TS2532
* TS2533
* TS2722
* TS2448
* TS2449
* TS2300
* TS2527
* TS1005
* TS1109
* TS1110
* TS1003
