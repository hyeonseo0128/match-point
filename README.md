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
3. 브라우저에서 `http://localhost:3000` 접속  
   - 모든 사용자가 같은 서버 주소로 접속하면 SQLite에 저장된 동일한 상태를 공유하게 됩니다.
4. **초기화**는 UI의 “전체 초기화” 버튼을 사용하거나 서버 측에서 `server/data/app-state.db`를 삭제하면 됩니다. (삭제 시 서버를 재시작하세요.)
