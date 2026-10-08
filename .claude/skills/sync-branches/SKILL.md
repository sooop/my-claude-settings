---
name: sync-branches
description: ~/.claude 설정 저장소(my-claude-settings)에서 한 브랜치에 커밋한 변경을 다른 브랜치들에도 체리픽해 모두 푸시할 때 쓴다. 대상 브랜치 목록, 제외 규칙, detached worktree 절차, 충돌 시 처리. "다른 브랜치에도 적용", "브랜치 동기화", "체리픽해서 푸시" 요청에 사용한다.
---

### 브랜치 동기화 (my-claude-settings 전용)

이 저장소(`C:\Users\sooop\.claude`)는 기기·용도별 브랜치에 같은 변경(mod, 스킬, 설정)을 나란히 적용한다.

#### 대상 브랜치

`main`, `sooop/home`, `sooop/work`, `sooop/home-anna`, `sooop/home-work`, `sooop/home-yepben`

- **제외:** 로컬 전용 `claude-work`(`main` 조상의 오래된 브랜치, 원격 없음 — 체리픽하면 대상 파일이 없어 충돌한다).
- 새 브랜치가 생겼는지 `git branch -r` 로 먼저 대조하고, 목록에 없는 브랜치는 사용자에게 물어본다.

#### 절차

1. **원본 커밋 만들기** — 관련 파일만 `git add <파일>` 로 올려 커밋한다. 작업 트리에는 `plugins/*`, `settings.json` 같은 무관한 변경이 상시 남아 있으므로 `git add -A` 금지. 커밋 메시지는 한국어.
2. `git fetch --all --prune` 으로 원격 최신화.
3. 원본 브랜치 푸시 (원격에 새 커밋이 있으면 먼저 `git merge origin/<브랜치>`).
4. 나머지 브랜치마다 **detached worktree** 에서 작업한다. 작업 트리가 더러워 체크아웃 전환이 어렵다.
   ```
   git worktree add -q --detach <임시경로> origin/<브랜치>
   cd <임시경로> && git cherry-pick <커밋>   # 푸시 전 원격 반영은 origin/<브랜치> 기준으로 이미 포함됨
   git push origin HEAD:<브랜치>
   git worktree remove --force <임시경로>
   ```
5. **이미 체크아웃된 브랜치**(`git worktree list` 로 확인, 현재 `sooop/home` 은 `C:/Users/sooop/claude-work`)는 detached 로 못 만든다. 그 worktree 안에서 `git merge origin/<브랜치>` → `git cherry-pick` → `git push` 한다.
6. 끝나면 `git worktree list` 로 임시 worktree 가 남지 않았는지, `git status --short` 로 원래 작업 트리 변경이 그대로인지 확인한다.

#### 충돌·실패 시

- 체리픽 충돌은 해결을 추측하지 말고 `git cherry-pick --abort` 후 해당 브랜치를 건너뛰고 보고한다.
- 푸시가 non-fast-forward 로 거부되면 `--force` 금지. fetch 후 병합하고 재시도한다.
- 결과는 브랜치별 표(커밋 해시, 푸시 여부, 건너뛴 사유)로 보고한다.

#### 이 스킬 자체의 전파

`.claude/skills/` 는 `.gitignore` 에서 예외로 추적된다. 스킬을 고치면 이 절차로 대상 브랜치 전부에 전파한다.
