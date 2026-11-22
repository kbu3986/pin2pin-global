# 04. Monetization & Anti-Spam SEO Strategy

## 1. 3단계 수익화 깔때기 (Monetization Stack)

단일 수익원에 의존하지 않고 트래픽 성장 단계에 맞춰 3개 수익 레이어를 순차 점화한다.

| 단계 | 수익 채널 | 적용 시점 | 기대 단가 / 구조 | 연동 방식 |
| :--- | :--- | :--- | :--- | :--- |
| **Layer 1 (즉시)** | **구글 애드센스 (B2B 고CPC)** | 런칭 1일차 | 영미권 전자/B2B RPM 15–40달러 수준 | 기존 `ca-pub-8587506565277191` 연동 (추후 독립 도메인 승인) |
| **Layer 2 (초기)** | **부품·개발보드·계측기 제휴** | 런칭 1일차 | AliExpress(3–9퍼센트), Amazon(`kbu3986-20`, 평가보드·납땜·계측기), 쿠팡(`AF2200875`) | 각 부품 페이지 하단 `"구매 및 테스트 장비"` 모듈 |
| **Layer 2.5 (중기)** | **반도체 유통사 파트너십** | 월 방문 1만+ | DigiKey / Mouser / LCSC / Arrow 제휴 및 클릭당 과금(CPC) | `"실시간 재고·단가 확인"` CTA 버튼 |
| **Layer 3 (고수익)** | **BOM CSV 대체품 진단 Micro-SaaS** | 월 방문 3만+ | 월 19달러 (Pro) / 건당 9달러 리포트 (Lemon Squeezy / Polar) | BOM 업로드 시 단종 리스크·핀호환 대체품 일괄 매칭 |

---

## 2. 검색 의도 기반 URL 및 내부 링크 아키텍처

엔지니어의 검색 쿼리와 1:1로 매칭되는 시맨틱 URL을 사용한다.

- `/en/part/xc6206p332mr` – 부품 정밀 스펙 + 핀맵 SVG + 열설계 계산기
- `/en/alt/xc6206p332mr-alternatives` – `"XC6206 alternative / equivalent / replacement"` 타깃
- `/en/vs/xc6206p332mr-vs-me6211c33` – `"XC6206 vs ME6211"` 1:1 핀아웃·스펙 승패표
- `/en/tools/ldo-thermal-calculator` – 독립 공학 계산기 (백링크 유치용 링크 마그넷)
- `/en/guides/sot23-3-ldo-pinout-traps` – 실무 함정 가이드 (Reddit r/AskElectronics, r/PrintedCircuitBoard, EEVblog 공유용)

---

## 3. 구글 Scaled Content Abuse & 색인 블로트 방어 전략

20배 요금제로 대량 페이지를 뽑을 때 가장 위험한 것은 **"저품질 대량 생성 사이트"로 오인받아 색인이 막히는 현상**이다. 이를 4중 방어막으로 차단한다.

1. **Drip-Feed 점진 배포** – 처음부터 10,000페이지를 올리지 않는다. 1주차 200페이지(초고검색량 앵커 부품 50종) 배포 → GSC 색인율 80퍼센트 이상 확인 → 2주차 1,000페이지 → 4주차 5,000페이지 순으로 증축한다.
2. **도메인 분리 전략** – 초기 파일럿은 GitHub Pages(`kbu3986.github.io/pin2pin-global`) 또는 Vercel 무료로 검증하되, 애드센스 및 B2B 브랜드 권위 확보를 위해 **연 10–15달러 수준의 독립 커스텀 도메인(예: `pin2pin.dev` 또는 `partxref.io`)** 연결을 적극 권장한다.
3. **고유 인터랙티브 요소 의무화** – 모든 페이지에 정적 텍스트만 두지 않고 **자체 렌더링 핀맵 SVG + 실시간 $T_J$/효율 계산기 + 필터 가능한 대체품 비교 테이블**을 탑재해 체류시간과 정보 이득(Information Gain)을 극대화한다.
4. **구조화 데이터(JSON-LD) 풀세팅** – `TechArticle`, `Dataset`, `FAQPage`, `BreadcrumbList` 스키마를 전 페이지 자동 삽입하여 구글 리치 스니펫과 AI Overview 인용 확률을 끌어올린다.

---

## 4. 초기 트래픽 점화 전략 (0 → 1,000 일방문자)

SEO가 자리 잡는 1–3개월 동안 방치하지 않고 엔지니어 커뮤니티에 자연스럽게 씨앗을 뿌린다.

1. **오픈 무료 도구 공유** – Reddit `r/PrintedCircuitBoard`, `r/AskElectronics`, `r/ElectricalEngineering`, Hacker News `Show HN`, 국내 전자회로 카페/블로그에 `"SOT-23-3 LDO 핀배열 실수 방지 비교표 + 자동 핀맵 뷰어 만들었습니다"` 형태로 무료 도구를 소개한다.
2. **GitHub 오픈 데이터 샘플 공개** – 50종 핵심 부품의 검증된 JSON 샘플과 KiCad/PADS BOM 체크 유틸리티를 GitHub에 공개해 자연스러운 고권위 백링크를 확보한다.
