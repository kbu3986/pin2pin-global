# Pin2Pin Global — Cross-AI Project Instructions (SSOT)

이 문서는 `pin2pin-global` 저장소의 단일 정본 지시서입니다. Claude Code, Codex, Cursor, Gemini CLI 등 모든 AI 에이전트는 작업 전 이 규칙을 따릅니다.

## 1. 프로젝트 개요 및 스택
- **목표**: 반도체·전자부품 제조사 공식 PDF 데이터시트 파싱, 적대적 교차검증, 핀호환 대체품(Cross-Reference) B2B 비교 DB 및 Zero-Upload BOM 체커 운영.
- **기술 스택**: Node.js ESM 파이프라인(`pipeline/`, Zod v3) · Python PDF 수집기(`pipeline/stage0_pdf_ingest.py`) · Next.js 15 App Router 정적 Export(`web/`, React 19, Tailwind CSS v4, TypeScript).
- **필독 문서**: 아키텍처·KPI 변경 전 `docs/01-MASTER-PLAN.md`~`docs/05-RISK-AND-KPI-AUDIT.md`를 먼저 확인합니다.

## 2. 필수 명령어
```bash
npm run verify:schema   # Stage 2: Zod v2 스키마 + 결정론적 물리 정합성 검증
npm run sync:manifest   # 검증 완료 부품 기준 매니페스트·백로그 동기화
npm run build:xref      # Stage 3: 대체품 허브 및 알파벳 순 VS 비교 재생성
npm run web:build       # Next.js 15 정적 빌드(web/out) + sitemap.xml / robots.txt
npm run qa:gate         # Stage 5: 7개 정적 HTML·링크·SEO QA 게이트
npm run health:check    # 공식 PDF 링크·리비전 드리프트·라이브 CDN 200 OK 점검
npm run deploy:gh-pages # GitHub Pages 프로덕션 배포
```

## 3. 도메인 필수 기술 규칙
1. **Dual-Path 공식 PDF 검증** – 텍스트 파싱만 단독 신뢰하지 않고 핀아웃·절대최대정격·열저항 테이블 페이지는 300 DPI PNG Vision 검증을 병행합니다. 판독 불가 스캔 문서는 `UNSUPPORTED_SCAN`으로 자동 격리합니다.
2. **2계층 스키마 엄수 (`Family 1:N OPN`)** – 단일 주문코드(OPN)와 단일 JEDEC 패키지를 1:1로 매핑합니다. 패키지나 패밀리가 불일치하면 `Level 1 Drop-In` 판정을 금지합니다.
3. **무스크래핑 및 공식 출처 고증** – DigiKey·Mouser·LCSC 스크래핑을 금지하며 제조사 공식 도메인 PDF와 페이지 인용만 사용합니다. 가짜 AI 필러 생성을 금지합니다.
4. **엔지니어링 면책 및 BOM 보안** – 모든 교체 판정에는 `Candidate Drop-In — Verify Datasheet Before Production` 표현과 안전필수 회로(의료·자동차·항공·생명유지) 면책 조항을 필수 표기합니다. BOM 체커는 100% 브라우저 메모리(Zero-Upload) 처리 원칙을 지킵니다.
5. **1차 시드 스코프 통제** – LDO·DC-DC·Op-Amp·MOSFET 중심으로 확장하며 1,000페이지 이상 대형 MCU는 별도 계획 없이 혼입하지 않습니다.

## 4. 공통 AI 협업·출력·실물 검증 원칙
- **소통·형식** – 한국어 존댓말을 사용하며 **설명 → `### 결론` → `### 다음 확인 사항`(2개)** 구조, 1단락 1–2문장, 클릭 가능한 마크다운 링크, 3개 이상 비교 시 표를 유지합니다. 단순 확인·완전 종결 시 다음 확인 사항은 생략할 수 있습니다.
- **자율 완결·병렬화** – 수동 복붙을 떠넘기지 않고 구현·검증·배포·임시 프로세스 정리까지 완결합니다. 다중 PDF 파싱·감사·구현은 병렬 에이전트/서브태스크로 처리합니다.
- **실물 E2E 검증** – Exit Code 0만으로 완료 보고하지 않고 `verify:schema`, `web:build`, `qa:gate`, 실제 렌더링·HTTP 200·콘솔 0에러를 확인한 뒤 완료를 선언합니다.
- **직설 판정·무홍보 SEO** – 오류는 변명 없이 1줄 인정 후 즉시 수정하며, 커뮤니티 홍보 대신 기술적 SEO·사이트맵·색인·데이터 정확도에 집중합니다.

## 5. 절대 안전선
- **공개 웹·운영 도구 분리**: 방문자용 `web/out`에 관리자 UI·디버그 경로·로컬 절대경로·개인정보를 절대 포함하지 않습니다.
- **비밀정보 차단**: API 키·토큰·`.env*`·원본 대용량 PDF(`data/raw-pdfs/`, `*.pdf`)를 커밋하지 않습니다.
- **외부 게시 및 과금 확인**: 소유 저장소 배포는 자율 진행하되 외부 커뮤니티·SNS 신규 게시, 유료 API·과금 신설, 계정 약관 리스크는 반드시 사전 확인합니다.
