# GEMINI.md — Pin2Pin Global

작업 시작 전 루트 [AGENTS.md](./AGENTS.md)를 먼저 읽고 모든 규칙을 준수합니다.

## 핵심 절대 안전선 (요약)
- **공식 PDF Dual-Path 검증만 허용**: DigiKey/Mouser/LCSC 스크래핑 금지, 핀아웃·정격은 300 DPI Vision 교차검증 및 `Family 1:N OPN` 스키마 엄수.
- **필수 면책·Zero-Upload**: 모든 대체품은 `Candidate Drop-In` 후보 표기 및 안전필수 회로 면책 필수, BOM 체커는 100% 브라우저 메모리 처리.
- **실물 게이트 통과 후 완료**: `npm run verify:schema`, `npm run web:build`, `npm run qa:gate` 통과 및 실물 확인 없이 완료 보고 금지.
- **PUBLIC 비식별·비밀정보 0건**: API 키·토큰·`.env*`·로컬 절대경로·개인 신상정보를 절대 커밋하지 않습니다.
