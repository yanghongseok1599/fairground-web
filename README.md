# FairGround Web

FairGround 풋살 리그 공식 홈페이지. 앱과 동일한 Firebase RTDB에 연결되는 공개 웹사이트.

## 기술 스택
- Next.js 16 + React 19 + TypeScript
- TailwindCSS 4 + Shadcn UI
- Firebase Realtime Database (읽기 전용)
- Zustand
- Vercel 배포

## 로컬 개발

```bash
# 1. 환경 변수 설정
cp .env.example .env.local
# .env.local에 Firebase 설정 입력

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행
npm run dev
```

## Vercel 배포

```bash
npx vercel --prod
```

또는 GitHub 연동 후 자동 배포.

Vercel 환경 변수에 `.env.example`의 모든 키를 추가해야 합니다.

## 페이지

| 경로 | 설명 |
|------|------|
| `/` | 홈 (히어로, 라이브, 순위, 카드 쇼케이스) |
| `/live` | 실시간 경기 스코어 |
| `/standings` | 리그 순위표 |
| `/tournaments` | 대회 목록 |
| `/tournaments/[id]` | 대회 상세 (조별 순위, 경기 결과) |
| `/players` | 선수 카드 갤러리 |
| `/players/[id]` | 선수 상세 프로필 |
| `/teams` | 팀 목록 |
| `/teams/[id]` | 팀 상세 (로스터, 시즌 성적) |

## Firebase 보안 규칙

공개 사이트이므로 Firebase RTDB 규칙에서 읽기를 허용해야 합니다:

```json
{
  "rules": {
    ".read": true,
    ".write": "auth != null"
  }
}
```
