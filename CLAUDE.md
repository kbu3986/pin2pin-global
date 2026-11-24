# CLAUDE.md — Pin2Pin Global

작업 시작 전 루트 [`AGENTS.md`](./AGENTS.md)를 먼저 읽고 모든 도메인 규칙·실행 명령·협업 원칙을 준수합니다.

## 핵심 절대 규칙 (요약)
- **공식 PDF Dual-Path 검증 & `Family 1:N OPN`** – DigiKey·Mouser·LCSC 스크래핑 금지. 핀아웃·정격·열저항은 300 DPI Vision 교차검증을 병행하고 단일 OPN-패키지 1:1 매핑을 엄수합니다(`UNSUPPORTED_SCAN` 자동 격리).
- **엔지니어링 면책 & Zero-Upload BOM** – 모든 대체품에 `Candidate Drop-In — Verify Datasheet Before Production` 및 안전필수 회로 면책을 표기하고, BOM 체커는 100% 브라우저 메모리 처리만 허용합니다.
- **병렬·스웜 우선 & 자율 완결** – 다중 파일·PDF 검증·감사는 병렬/스웜 실행을 우선하고, 로그인·결제·CAPTCHA·권한 프롬프트 외 수동 작업을 떠넘기지 않습니다.
- **실물 E2E 검증 & 직설 보고** – Exit Code 0만으로 완료 보고 금지. `npm run verify:schema`, `npm run web:build`, `npm run qa:gate` 통과와 실제 실행·라이브 HTTP 200·콘솔 0에러·실데이터 확인 후 한국어 존댓말(설명 → `### 결론` → `### 다음 확인 사항`)로 Go/Pivot/Kill을 명확히 보고합니다.
- **4대 안전선(PUBLIC 0 PII/비밀정보)** – `web/out` 공개 웹과 운영 도구를 분리하고 개인 실명·소속·거주지·로컬 절대경로·API 키·`.env*`·원본 PDF 커밋을 0건으로 유지하며, 외부 게시·유료 과금·계정 리스크는 반드시 사전 승인받습니다.
