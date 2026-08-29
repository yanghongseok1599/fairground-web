# FairGround Web

FairGround 풋살 리그 공식 웹사이트입니다. Next.js 프런트엔드가 Supabase의 인증·데이터베이스·스토리지를 사용하며 Vercel에 배포됩니다.

## 기술 스택

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4 + Shadcn UI
- Supabase
- Zustand
- Vercel

## 로컬 개발

로컬 개발은 운영과 다른 Supabase 프로젝트를 사용해야 합니다.

```bash
# 1. 개발 전용 환경 변수 파일 생성
cp .env.development.example .env.development.local

# 2. 개발 Supabase URL·공개 키와 Kakao JavaScript 키 입력

# 3. 연결 안전성 확인
npm run supabase:safety

# 4. 의존성 설치 후 개발 서버 실행
npm install
npm run dev
```

`npm run dev`는 개발 환경이 운영 Supabase를 가리키면 자동으로 중단됩니다. 자세한 운영 원칙과 현재 마이그레이션 상태는 [Supabase 안전 운영 가이드](docs/supabase-safety.md)를 확인하세요.

## 검증

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Vercel 배포

```bash
npx vercel --prod
```

또는 GitHub 연동을 통해 자동 배포합니다. Vercel Production 환경에는 운영용 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY`를 설정합니다.

## 주요 페이지

| 경로 | 설명 |
|------|------|
| `/` | 홈 |
| `/live` | 실시간 경기 스코어 |
| `/standings` | 리그 순위표 |
| `/tournaments` | 대회 목록 |
| `/tournaments/[id]` | 대회 상세 |
| `/players` | 선수 카드 갤러리 |
| `/players/[id]` | 선수 상세 프로필 |
| `/teams` | 팀 목록 |
| `/teams/[id]` | 팀 상세 |
