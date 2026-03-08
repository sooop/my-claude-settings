# Claude Code 환경 설정

이 문서는 다른 PC에서 동일한 Claude Code 환경을 재현하기 위한 참조 가이드입니다.

## 설정 요약

### 일반 설정 (settings.json)
- **Model**: `haiku` (claude-haiku-4-5-20251001)
- **Language**: 한국어
- **Effort Level**: medium
- **Prompt Suggestion**: 비활성화
- **Auto Updates**: latest 채널

### 플러그인

#### 설치된 플러그인
- `typescript-lsp@claude-plugins-official` - TypeScript LSP 플러그인

**재설치 절차:**
1. Claude Code CLI 실행
2. `/plugin install typescript-lsp@claude-plugins-official` 또는 plugins 마켓플레이스에서 검색하여 설치

### MCP 서버

현재 활성화된 MCP 연동 서비스:
- **Google Calendar** - 캘린더 일정 관리 (`gcal_*` 함수)
- **Gmail** - 이메일 관리 (`gmail_*` 함수)
- **Claude-in-Chrome** - 브라우저 자동화 (`mcp__claude-in-chrome__*` 함수)

**참고:** MCP 서버 구성은 시스템 설정에서 관리되므로, 해당 서비스의 인증 설정이 필요할 수 있습니다.

## 주요 파일 구조

```
~/.claude/
├── CLAUDE.md                 # 전역 사용자 지침
├── settings.json             # 사용 설정
├── keybindings.json          # 키보드 단축키 설정
├── skills/                   # 커스텀 스킬 (git 버전관리)
└── setup.md                  # 이 파일
```

## 제외된 디렉토리

다음 디렉토리는 git에서 제외되며, 환경별로 자동 생성됩니다:

- `projects/` - 자동 메모리 및 프로젝트 데이터
- `plans/` - 계획 파일 (session-specific)
- `plugins/` - 플러그인 런타임 데이터 및 캐시
- `cache/`, `debug/`, `telemetry/` - 임시 데이터

## 새 PC에서 환경 복원

1. 저장소 클론:
   ```bash
   git clone <repository-url> ~/.claude
   ```

2. 플러그인 재설치:
   - Claude Code 실행
   - 위 "플러그인" 섹션의 설치 절차 참조

3. 설정 확인:
   - `settings.json`이 자동으로 로드됨
   - `CLAUDE.md` 지침이 적용됨

## 보안 참고사항

- `.credentials.json`은 절대 git에 커밋되지 않습니다
- 인증 토큰이 필요한 경우 각 PC에서 별도로 설정해야 합니다
- 새 PC에서 MCP 서비스(Gmail, Google Calendar 등) 사용 시 인증이 필요합니다
