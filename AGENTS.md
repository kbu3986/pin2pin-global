# Pin2Pin Global — Cross-AI Project Instructions (SSOT)

이 문서는 `pin2pin-global` 공개 저장소의 **100% 독립 완결형 단일 정본(SSOT) 지시서**입니다. Claude Code, Codex, Cursor, Gemini CLI, Antigravity 등 모든 AI 에이전트는 외부 별도 지시서 없이 이 문서만으로 작업 규칙을 준수합니다.

## 1. 프로젝트 개요 및 스택
- **목표** – 반도체·전자부품 제조사 공식 PDF 데이터시트 파싱, 적대적 교차검증, 핀호환 대체품(Cross-Reference) B2B 비교 DB 및 Zero-Upload BOM 체커 운영.
- **기술 스택** – Node.js ESM 파이프라인(`pipeline/`, Zod v3) · Python PDF 수집기(`pipeline/stage0_pdf_ingest.py`) · Next.js 15 App Router 정적 Export(`web/`, React 19, Tailwind CSS v4, TypeScript).
- **필독 문서** – 아키텍처·KPI·리스크 기준 변경 전 [`docs/01-MASTER-PLAN.md`](./docs/01-MASTER-PLAN.md)~[`docs/05-RISK-AND-KPI-AUDIT.md`](./docs/05-RISK-AND-KPI-AUDIT.md)를 먼저 확인합니다.

## 2. 필수 명령어
```bash
npm run verify:schema   # Stage 2: Zod 스키마 + 결정론적 물리 정합성 검증
npm run sync:manifest   # 검증 완료 부품 기준 매니페스트·백로그 동기화
npm run build:xref      # Stage 3: 대체품 허브 및 알파벳 순 VS 비교 재생성
npm run web:dev         # Next.js 15 로컬 개발 서버
npm run web:build       # Next.js 15 정적 빌드(web/out) + sitemap.xml / robots.txt
npm run qa:gate         # Stage 5: 7개 정적 HTML·링크·SEO QA 게이트
npm run health:check    # 공식 PDF 링크·리비전 드리프트·라이브 CDN 200 OK 점검
npm run deploy:gh-pages # GitHub Pages 프로덕션 배포
```

## 3. 도메인 필수 기술 규칙
1. **Dual-Path 공식 PDF 검증** – 텍스트 파싱만 단독 신뢰하지 않고 핀아웃·절대최대정격·열저항 테이블 페이지는 300 DPI PNG Vision 검증을 병행합니다. 판독 불가 스캔 문서는 `UNSUPPORTED_SCAN`으로 자동 격리합니다.
2. **2계층 스키마 엄수 (`Family 1:N OPN`)** – 단일 주문코드(OPN)와 단일 JEDEC 패키지를 1:1로 매핑합니다. 패키지나 패밀리가 불일치하면 `Level 1 Drop-In` 판정을 금지합니다.
3. **무스크래핑 및 공식 출처 고증** – DigiKey·Mouser·LCSC 스크래핑을 금지하며 제조사 공식 도메인 PDF와 페이지 인용만 사용합니다. 근거 없는 수치 추정이나 가짜 AI 필러 생성을 금지합니다.
4. **엔지니어링 면책 및 Zero-Upload BOM 보안** – 모든 교체 판정에는 `Candidate Drop-In — Verify Datasheet Before Production` 표현과 안전필수 회로(의료·자동차·항공·생명유지) 면책 조항을 필수 표기합니다. BOM 체커는 100% 브라우저 메모리(Zero-Upload) 처리 원칙을 지킵니다.
5. **1차 시드 스코프 통제** – LDO·DC-DC·Op-Amp·MOSFET 중심으로 확장하며 1,000페이지 이상 대형 MCU는 별도 계획 없이 혼입하지 않습니다.

## 4. 크로스-AI 공통 협업·실행·출력 원칙
### 응답 형식 및 소통
- **한국어 존댓말·고정 구조** – 항상 자연스러운 한국어 존댓말로 답하며 **설명 → `### 결론` → `### 다음 확인 사항`(2개)** 구조를 유지합니다(단순 확인·완전 종결 응답에서는 `### 다음 확인 사항` 생략 가능).
- **간결한 마크다운 규칙** – `###` / `####` 제목으로 섹션을 나누고 1단락 1–2문장, 한 줄 불릿(`- **키워드** – 요약`), 3개 이상 비교 시 마크다운 표, 파일·URL은 클릭 가능한 마크다운 링크를 사용합니다(한글 기울임꼴·취소선·과도한 느낌표 금지).
- **직설 판정 및 오류 처리** – 아부나 모호한 완곡어 대신 명확한 **Go / Pivot / Kill** 판정을 제시하며, 오류가 발생하면 변명 없이 1줄로 인정하고 즉시 수정합니다.

### 자율 완결 및 병렬/스웜 우선 실행
- **자율 완결(End-to-End)** – 로그인·패스키·CAPTCHA·결제·권한 승인 프롬프트를 제외하고 수동 복붙 작업을 떠넘기지 않으며, 구현·검증·배포·임시 프로세스/파일 정리까지 끝까지 완결합니다.
- **병렬·스웜 실행 우선** – 다중 파일 수정, 다수 데이터시트 PDF 파싱·Vision 검증, 리서치·크롤링, 복합 구현·감사 작업은 순차 처리 대신 **병렬 에이전트·스웜(`/swarm`)·서브에이전트 팬아웃을 우선 적용**합니다.

### 실물 E2E 검증 및 사실성·순수 SEO
- **실물 E2E 검증 필수** – 빌드 성공이나 `Exit Code 0`만으로 완료를 선언하지 않습니다. `npm run verify:schema`, `npm run web:build`, `npm run qa:gate` 통과와 함께 실제 실행 결과, 라이브 URL `HTTP 200`, 브라우저 콘솔 0에러, 실데이터 반영을 직접 확인한 뒤 완료를 보고합니다.
- **출처 고증 및 순수 기술 SEO** – 공식 데이터시트 1차 출처만 반영하고 AI 필러를 배제하며, 외부 커뮤니티 홍보·스팸 대신 기술적 SEO(메타데이터·사이트맵·색인·구조화 데이터·정확한 교차참조 DB)에 집중합니다.

## 5. 4대 절대 안전선
1. **공개 웹·운영 도구 분리 및 PUBLIC 0바이트 PII/비밀정보** – 방문자용 공개 산출물(`web/out`)에 관리자·디버그 UI를 절대 노출하지 않습니다. PUBLIC 저장소에는 개인 실명·소속·거주지·로컬 절대경로·API 키·토큰·`.env*`·원본 대용량 PDF(`data/raw-pdfs/`, `*.pdf`)를 0바이트로 유지합니다.
2. **100% 익명화·비식별 원칙** – 문서·데이터·로그·UI 어디에도 타인 또는 운영자의 식별 가능한 개인정보를 남기지 않고 100% 비식별 처리합니다.
3. **소유 저장소 배포 자율 vs 외부 게시 사전 승인** – 소유 저장소 커밋·GitHub Pages 배포는 자율 완결하되, 외부 커뮤니티·SNS·제3자 플랫폼 신규 게시는 반드시 사전 승인 후 진행합니다(CAPTCHA 우회 영구 금지).
4. **유료 API·과금·계정 약관 리스크 사전 승인** – 유료 API 도입, 과금·결제 발생, 계정 약관 위반 소지가 있는 작업은 실행 전 반드시 사전 확인을 받습니다.
