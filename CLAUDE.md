# investfeed-frontend
주식/코인 투자 정보 및 매매 서비스 - React + TypeScript 프론트엔드

## 기술 스택
- React 19, TypeScript 5.7, Vite
- UI: Material UI 7
- API 통신: Axios (src/axios.ts 의 공통 인스턴스, baseURL `/api`, 쿠키 인증·토큰 재발급 인터셉터)
- 서버 상태: TanStack Query (src/lib/queryClient.ts)
- 라우팅: react-router-dom 7

## 명령어
- 개발 서버: npm run dev (사용자 확인 후)
- 빌드: npm run build
- 린트: npm run lint
- 타입 체크: npx tsc --noEmit -p tsconfig.app.json

## 파일 구조
- src/type/: 도메인별 타입 (`XxxType.ts`). 백엔드 DTO 구조에 맞춰 정의
- src/api/<도메인>/: API 호출 함수 (`XxxApi.ts`)
- src/pages/<도메인>/: 화면
- src/components/: 공통 컴포넌트 / src/context/: 전역 Context / src/hooks/: 공통 훅 / src/lib/: 공통 로직
- src/types/: 라이브러리 타입 보강(.d.ts) 전용. 도메인 타입은 type/ 에 둘 것

## 백엔드 연동
- 백엔드 DTO: ../investfeed-backend/src/main/kotlin/com/example/investfeed/domain/<도메인>/dto/
- 타입을 새로 만들거나 바꿀 때는 해당 DTO를 먼저 읽고 필드명·nullable 여부를 맞출 것

## TypeScript 코드 스타일
- 최신 TypeScript 문법 적용 (람다, optional chaining 등)
- 자주 쓰이는 함수/컴포넌트는 공통 모듈로 분리
- 기존 코드 스타일 유지, 개선점은 제안으로 알릴 것

## 검증
- 로그인이 필요한 프로세스이므로 화면 검증은 사용자가 직접 수행
- Claude는 린트, 타입 에러 검증까지만 수행
- 파일을 수정하면 hook이 그 파일만 eslint로 검사하고, 작업 종료 시 Stop hook이 tsc 타입 체크를 실행함

## Git
- git/gh 명령은 hook으로 차단되어 있음. 커밋·브랜치·push는 사용자가 직접 수행
- 작업이 끝나면 변경 파일 목록과 커밋 메시지 초안을 제시할 것

## 필수 규칙
- 소스 파일은 Edit/Write 도구로만 수정할 것. sed·cp·heredoc 등 Bash로 수정하면 lint·Stop hook 검증에서 빠짐
- 기능 구현 지시가 없으면 질문에 대한 답변이나 제안만 할 것
