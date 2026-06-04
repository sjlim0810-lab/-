# 해외법인 시장동향 대시보드

## 배포 절차 (약 20분)

### 1. GitHub에 올리기
```bash
git init
git add .
git commit -m "초기 배포"
# GitHub에서 새 레포 생성 후:
git remote add origin https://github.com/[계정명]/[레포명].git
git push -u origin main
```

### 2. Vercel 배포
1. vercel.com 접속 → GitHub 계정으로 로그인
2. "Add New Project" → 위에서 만든 레포 선택
3. **Environment Variables** 추가:
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...` (발급받은 키)
4. "Deploy" 클릭 → 완료 (약 2~3분)

### 3. Python 의존성 (Vercel용)
루트에 `requirements.txt` 포함되어 있음. Vercel이 자동 설치.

### 로컬 실행 (테스트용)
```bash
cp .env.local.example .env.local
# .env.local에 API 키 입력

npm install
npm run dev
# http://localhost:3000 접속
```

## 법인 컨텍스트 업데이트
`lib/context.ts` 파일의 `ENTITY_CONTEXT` 수정 후 재배포.
Vercel은 GitHub push 시 자동 재배포됨.

## 소스 추가/변경
`lib/context.ts` 파일의 `SOURCES` 수정.
