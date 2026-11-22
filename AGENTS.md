# Pin2Pin Global — Antigravity Workspace Rules

이 프로젝트(`pin2pin-global`)에서 작업하는 모든 에이전트는 아래 핵심 규칙과 교차감사 확정 기준을 최우선으로 준수합니다.

## 1. 프로젝트 정체성 및 마스터 문서
- **목표**: 반도체·전자부품 공식 PDF 데이터시트 전수 파싱 + 적대적 교차검증 + 핀호환 대체품(Cross-Reference) B2B 비교 DB 구축.
- **필독 문서**: 작업 착수 전 `docs/01-MASTER-PLAN.md`–`docs/05-RISK-AND-KPI-AUDIT.md`를 먼저 확인합니다.

## 2. 교차감사 확정 필수 기술 규칙 (`05-RISK-AND-KPI-AUDIT.md` 반영)
1. **Dual-Path PDF 검증 필수** – 텍스트 파싱만 단독 신뢰하지 않고 핀아웃·정격 테이블 페이지는 300 DPI PNG Vision 검증을 병행하며, 스캔/OCR 불량 문서는 `UNSUPPORTED_SCAN`으로 자동 격리합니다.
2. **2계층 스키마 엄수 (`Family 1:N OPN`)** – 단일 주문코드(OPN)에 복수 패키지를 혼재하지 않으며, 서로 다른 패키지나 미특정 패밀리 간 `Level 1 Drop-In` 판정을 금지합니다.
3. **1차 시드 스코프 통제** – 1차 500종에서 1,000페이지 이상 다핀 MCU를 제외하고 LDO·DC-DC·Op-Amp·MOSFET 중심(파일럿 50종: LDO 25 + DC-DC 15 + Op-Amp 10)으로 먼저 구축합니다.
4. **무스크래핑 및 면책 의무** – DigiKey·Mouser·LCSC 스크래핑을 금지하고 제조사 공식 도메인 PDF만 사용합니다. 모든 교체 판정 문구는 `Candidate Drop-In` 등 검토 후보 표현과 안전필수 회로 면책 조항을 의무 표기합니다.
5. **스웜 최우선 병렬화** – 다중 PDF 파싱, 적대적 감사, 다국어 현지화, 대규모 구현·검증은 반드시 `swarm`으로 병렬 처리합니다.
