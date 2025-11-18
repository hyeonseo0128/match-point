# match-point

## 설치 방법

1. **필수 요건**  
   - Node.js 18 이상 (npm 포함)

2. **의존성 설치**  
   ```bash
   npm install
   ```
   명령은 프로젝트 루트(`match-point`)에서 실행하세요.

## 실행 방법

1. SQLite 상태 파일은 `server/data/app-state.db`에 자동으로 생성됩니다. 별도 설정이 없다면 기본 경로를 그대로 사용하면 됩니다.
2. 서버 실행:
   ```bash
   npm start
   ```
3. 브라우저에서 접속  
   - 편집 권한: `http://localhost:2580`  
   - 보기 전용: `http://localhost:9999`  
   - 두 포트 모두 같은 SQLite 상태를 공유하며, 서버에서 SSE를 사용해 실시간으로 변경 사항을 푸시하므로 새로고침 없이도 반영됩니다.
   - 필요 시 `EDITOR_PORT`, `VIEWER_PORT` 환경 변수를 설정해 포트를 변경할 수 있습니다.
4. **초기화**는 UI의 “전체 초기화” 버튼을 사용하거나 서버 측에서 `server/data/app-state.db`를 삭제하면 됩니다. (삭제 시 서버를 재시작하세요.)
