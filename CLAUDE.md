CLAUDE.md


## CLI 도구 사용 지침

- git-bash의 CLI 도구 사용
- shell에 맞는 문법을 사용할 것: 예를 들어 Powershell은 heredoc을 사용할 수 없음
- 가능한 경우 향상된 모던 CLI 대체 도구 사용: ag,bc,curl,duf,dust,f2,fd,ffmpeg,fselect,fzf,imagemagick,jq,lua,node,nu,pandoc,python,rg,sd,xsv



## 프로젝트 내 파일 이동 및 복사

- **파일 이동 및 복사에는  Read/Write 도구 사용 금지**
- mv, xcopy, copy 와 같은 복사 CLI 도구를 사용해야 한다.
- **복사 후에는 fd를 사용하여 파일이 목적지에 있는지 반드시 검증**
- 이동 시에는 복사, 확인 후 원본을 삭제한다.
- 수정하면서 복사해야하는 경우, 복사 후 사본을 편집한다.
