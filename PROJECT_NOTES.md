# 대나무숲 프로젝트 노트

다른 대화에서 이어갈 수 있도록 지금까지 작업 내용 정리.

---

## 프로젝트 개요

한국의 "대나무숲" 스타일 **완전 익명 텍스트 게시판**. 도트/8비트 감성의 귀엽고 심플한 디자인.

- **로컬 경로**: `C:\Users\user\Downloads\엘나무숲`
- **GitHub**: https://github.com/dlstlf728/elnamu-forest
- **배포**: Render.com (예정, 사용자가 직접 배포)
- **로컬 실행**: `node server.js` → http://localhost:3000

---

## 핵심 원칙: 완전 익명

- IP, 쿠키, 세션, User-Agent **어떤 식별 정보도 저장 안함**
- DB에 저장하는 건 **글 내용 + 분 단위 시각**만
- 삭제 토큰도 JS 메모리(Map)에만 저장 → 새로고침하면 사라짐 → 작성자 추적 불가

---

## 기술 스택

- **Backend**: Node.js + Express
- **DB**: JSON 파일 (`posts.json`) — SQLite 안 쓴 이유: Windows 빌드 도구 없음
- **Frontend**: Vanilla HTML/CSS/JS (No framework)
- **Font**: Mona (https://cdn.jsdelivr.net/gh/MonadABXY/mona-font/web/mona.css)
  - `'Mona12 Text KR'` — 한글 텍스트
  - `'Mona12 Color Emoji'` / `'Mona12 Emoji'` — 이모지
- **Audio**: Pixabay 무료 음원 (`bgm.mp3`, `rain.mp3`, `wind.mp3`)
- **Weather API**: wttr.in (서울, 10분 캐시)

---

## 파일 구조

```
엘나무숲/
├── server.js              # Express 서버 + API
├── db.js                  # JSON DB 레이어
├── package.json           # express만 의존
├── posts.json             # DB 파일 (.gitignore)
├── .gitignore             # node_modules, posts.json
└── public/
    ├── index.html         # SPA (숲/로그 페이지 토글)
    ├── style.css          # 다크/라이트 모드 + 날씨 파티클
    ├── app.js             # 메인 로직
    ├── audio.js           # BGM + 날씨 효과음 재생 엔진
    ├── bgm.mp3            # 8비트 BGM (Wood Chapter - Whispers of the Grove)
    ├── rain.mp3           # 빗소리
    └── wind.mp3           # 바람 소리
```

---

## 구현된 기능

### 1. 글 작성/조회
- 500자 제한, 완전 익명
- Ctrl+Enter로 제출
- 토스트 알림

### 2. 숲 메인 페이지 (에코)
- 🌲🌳🌴🌵🪾 이모지 나무 15개 배경 배치
- 오늘(00~24시) 작성된 메시지가 나무 사이에서 랜덤 위치에 fade-in/fade-out 순환
- 3~5초 간격, 8초 수명
- **겹침 방지**: 현재 화면 활성 메시지 위치 추적하여 최대 20회 시도로 겹치지 않는 위치 찾음
- 긴 글은 60자에서 자름
- 메시지 클릭 → 모달 팝업

### 3. 모달 팝업
- 전문 표시
- 이모지 반응 6종: ❤️ 😂 😢 👍 🔥 🍃
- **토글 가능** (같은 이모지 다시 클릭 시 취소)
- 활성 상태는 `.active` 클래스로 테두리 구분
- 답글 기능 (200자 제한, 익명)
- 5분 이내면 삭제 버튼 표시

### 4. 로그 페이지 (전체 기록)
- 날짜별 조회 (< > 버튼으로 이동)
- "오늘", "어제", "4월 N일" 라벨
- 각 카드에 반응 카운트, 답글 수 미리보기
- 카드 클릭 → 모달
- `#logPage.active`만 스크롤 허용

### 5. 5분 내 삭제
- 서버: POST /api/posts 응답에 `delete_token` 반환
- 클라: JS `Map`에 저장 (새로고침 시 사라짐)
- DELETE 엔드포인트에서 토큰 + 5분 이내 검증
- 삭제 버튼은 에코, 모달, 로그 카드에 모두 표시

### 6. 날씨 효과 (실시간)
- `/api/weather` → wttr.in 서울 날씨 프록시 (10분 캐시)
- 날씨 종류: `clear`, `cloudy`, `rain`, `snow`, `thunder`
- **비**: 💧🌧️ 이모지가 위에서 떨어짐 (1.2초, 30~40개)
- **눈**: ❄️⛄ 이모지가 좌우로 흔들리며 떨어짐 (5초, 15개)
- **천둥**: 비 효과 + 번쩍임 애니메이션 (`.weather-lightning`, 4~10초 간격)
- 날씨 레이어는 `body` 직속 `position: fixed` (스크롤 영향 없음)
- 타이틀 아래 날씨 뱃지 표시: "🌧️ Light rain 12°C"

### 7. 낮/밤 자동 모드
- wttr.in의 일출/일몰 시각 기준
- 일출~일몰: `.light` 클래스 (배경 #f0efe8, 텍스트 #1a1a1a)
- 그 외: 다크 (배경 #0a0a0a, 텍스트 #e0e0e0)
- `transition: background-color 0.5s` 부드럽게 전환

### 8. 사운드 시스템 (audio.js)
- 🔇/🔊 네비게이션 토글 버튼 (브라우저 정책상 사용자 클릭 필요)
- **BGM**: `bgm.mp3` 루프, 볼륨 25%
- **비/천둥**: `rain.mp3` 페이드인 (볼륨 35%)
- **눈**: `wind.mp3` 페이드인 (볼륨 30%)
- 날씨 바뀌면 자연스럽게 크로스페이드

---

## API 엔드포인트

```
GET    /api/posts/today       # 오늘 글 (에코용)
GET    /api/posts/dates       # 사용 가능한 날짜 목록
GET    /api/posts/:id         # 단일 글 조회
GET    /api/posts?date=YYYY-MM-DD  # 날짜별 조회
GET    /api/posts?page=N      # 페이지네이션 조회

POST   /api/posts             # 글 작성 → { ok, id, delete_token }
DELETE /api/posts/:id         # body: { delete_token }

POST   /api/posts/:id/react   # body: { emoji } — 반응 추가
DELETE /api/posts/:id/react   # body: { emoji } — 반응 취소
POST   /api/posts/:id/reply   # body: { content } — 답글

GET    /api/weather           # 서울 현재 날씨 (wttr.in 프록시, 10분 캐시)
```

---

## UI 텍스트 (주요)

- 타이틀: **대나무숲**
- 플레이스홀더: **"대표님 귀는 당나귀 귀"**
- 제출 버튼: **"소리치기"**
- 히어로 설명: "완전 익명 · IP 추적 없음 · 쿠키 없음 / 작성 후 5분 이내 삭제 가능 · 페이지를 떠나면 삭제 불가"

---

## 디자인 테마

### 다크 모드 (기본)
```css
--bg: #0a0a0a;
--bg-card: #141414;
--text: #e0e0e0;
--border: #333;
```

### 라이트 모드 (body.light)
```css
--bg: #f0efe8;
--bg-card: #e8e7e0;
--text: #1a1a1a;
--border: #ccc;
```

### 나무 위치
- 앞줄: `bottom: 50~60px` (`tree-1 ~ tree-10`, `tree-15`)
- 뒷줄: `bottom: 110~125px` (`tree-11 ~ tree-14`)
- 라이트 모드에선 `grayscale(0.3)`로 살짝 컬러 보임

---

## Git/배포

### Git 설정
- 사용자: `dlstlf728` / `dlstlf728@gmail.com`
- 브랜치: `master`
- 원격: `https://github.com/dlstlf728/elnamu-forest`

### Render.com 배포 가이드
1. https://render.com → GitHub 로그인
2. New + → Web Service → `elnamu-forest` 선택
3. 설정:
   - Name: `elnamu-forest`
   - Region: Singapore
   - Branch: `master`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free
4. Deploy → `https://elnamu-forest.onrender.com`

### 배포 흐름
```
코드 수정 → git push → Render 자동 재배포 (2~3분)
```

---

## 알려진 이슈/주의사항

1. **Render 무료 티어**: 15분 미사용 시 슬립, 재접속 시 ~30초 콜드 스타트
2. **posts.json은 .gitignore**: Render 서버에서 빈 상태로 시작
3. **Windows EADDRINUSE**: 서버 재시작 시 이전 프로세스가 포트 점유 중일 수 있음 → `taskkill //F //IM node.exe`
4. **better-sqlite3 설치 실패**: Windows에서 VC++ 빌드 도구 없음 → JSON 파일 방식으로 대체됨
5. **미리보기 패널 안 됨**: API 서버가 필요해서 정적 HTML 미리보기로는 안 보임 → 브라우저에서 http://localhost:3000 접속 필수
6. **한글 curl 테스트 인코딩 깨짐**: Node.js http 모듈로 테스트해야 정상

---

## 사용자 선호/피드백 정리

- **언어**: 한국어로 소통
- **스타일**: 간결하고 직접적인 응답 선호
- **텍스트 크기**: 에코는 크게(18px), 설명은 작게(11px)
- **사운드**: 절차적 생성보다 실제 음원 파일 선호 (Web Audio API로 만든 8비트는 "애매"하다고 평가)
- **변경 이력**:
  - 초록 테마 → 흑백
  - ASCII 나무 → 이모지 나무
  - 엘나무숲 → 대나무숲
  - "속삭이기" → "소리치기"
  - 나무들 `bottom: 0` → 위로 올림 (50px+)

---

## 현재 상태 (2026-04-09)

- ✅ 모든 핵심 기능 구현 완료
- ✅ GitHub master 브랜치에 push됨 (커밋: `c3475a4 대나무숲 v2`)
- ⏳ Render.com 배포는 사용자가 직접 진행 예정
- 📝 더미 데이터 4/1~4/8 추가되어 있음 (로그 페이지 확인용)

---

## 다음에 이어갈 때 참고

- 서버 실행: `cd "C:/Users/user/Downloads/엘나무숲" && node server.js`
- 포트: 3000
- GitHub CLI 경로: `/c/Program Files/GitHub CLI/gh`
- Git 푸시: `git add . && git commit -m "..." && git push`
