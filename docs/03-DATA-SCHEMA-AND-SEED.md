# 03. Data Schema & Initial 500-Part Seed Strategy

## 1. Golden Part JSON 스키마 (표준 규격)

모든 부품은 카테고리 공통 필드 + 카테고리 전용 전기적 사양 + 출처 근거(`citations`) 구조를 강제한다.

```json
{
  "mpn": "XC6206P332MR-G",
  "family": "XC6206",
  "manufacturer": "Torex Semiconductor",
  "category": "ldo",
  "lifecycle_status": "Active",
  "datasheet": {
    "url": "https://product.torexsemi.com/system/files/series/xc6206.pdf",
    "revision": "Rev. 2024",
    "verified_at": "2026-11-22"
  },
  "packages": [
    {
      "code": "SOT-23-3",
      "pin_count": 3,
      "theta_ja_c_per_w": 250,
      "pinout": [
        { "pin": 1, "name": "VSS", "role": "GND" },
        { "pin": 2, "name": "VOUT", "role": "OUT" },
        { "pin": 3, "name": "VIN", "role": "IN" }
      ],
      "source_page": 3
    }
  ],
  "specs": {
    "vin_abs_max_v": { "value": 7.0, "page": 5 },
    "vin_min_v": { "value": 1.8, "page": 6 },
    "vin_max_v": { "value": 6.0, "page": 6 },
    "vout_v": { "value": 3.3, "fixed": true, "page": 6 },
    "iout_max_ma": { "value": 200, "page": 6 },
    "iq_typ_ua": { "value": 1.0, "condition": "VIN=4.3V, IOUT=0mA", "page": 6 },
    "dropout_typ_mv": { "value": 250, "condition": "IOUT=100mA", "page": 6 },
    "psrr_db": { "value": null, "note": "Not specified in standard summary" },
    "ceramic_cap_stable": { "value": true, "min_cout_uf": 1.0, "page": 11 }
  },
  "design_gotchas": [
    "SOT-23-3 핀 배열이 GND-VOUT-VIN(1-2-3) 순서이므로, 일반 GND-VIN-VOUT 배열 LDO(예: MCP1700 일부 옵션) 교체 시 쇼트 위험이 있음.",
    "최대 입력전압이 6.0 V(절대최대 7.0 V)로 낮아 9 V·12 V 레일이나 Li-ion 2S 시스템에는 사용 불가."
  ],
  "typical_use_cases": [
    "AAA/Li-ion 1S 초저전력 배터리 구동 의료·IoT 기기",
    "저전류 MCU 대기전원 레일"
  ],
  "audit": {
    "confidence_score": 0.98,
    "auditor_passed": true,
    "human_reviewed": false
  }
}
```

---

## 2. 1차 500종 시드 부품 선정 전략 (병욱님 실무 도메인 × 검색 수요 교집합)

무작위로 500종을 모으지 않고, **구글 검색량이 폭발적이면서 병욱님이 실무 경험으로 1초 만에 이상 여부를 잡아낼 수 있는 6대 핵심 부품군**부터 집중 공략한다.

| 우선순위 | 부품 카테고리 | 1차 시드 수량 | 대표 앵커 부품 (초고검색량) | 병욱님 검수 강점 |
| :--- | :--- | :--- | :--- | :--- |
| **1순위** | **저전력·범용 LDO 레귤레이터** | 120종 | AMS1117, XC6206, ME6211, HT7333, MCP1700, TPS7A02, AP2112K, MIC5219, RT9013 | 배터리 구동 슬립전류·핀배열 함정 완벽 파악 |
| **2순위** | **DC-DC Buck / Boost 컨버터** | 100종 | TPS61322, TPS63020, MT3608, MP1584, XL4015, LM2596, SY8089, TPS54302, BQ25570 | 저전력 Boost·EMC·효율 트레이드오프 실무 경험 |
| **3순위** | **범용·저전력 Op-Amp / 비교기** | 90종 | LM358, TL072, MCP6001/6002, MCP6476, OPA2134, LMV358, TLV9002, INA219, LM393 | 정전류 구동·아날로그 신호처리·Rail-to-Rail 숙련 |
| **4순위** | **소신호·파워 MOSFET** | 90종 | 2N7002, BSS138, AO3400, AO3401, SI2302, IRLZ44N, IRF540N, BSH111, DMG2305UX | $V_{GS(th)}$·$R_{DS(on)}$·로직레벨 구동 검증 가능 |
| **5순위** | **저전력 MCU / BLE / RFID / 인터페이스 IC** | 60종 | STM32F103C8, ESP32-C3/S3, nRF52840, EFM32TG11, TRF7962A, PN532, CH340G, CP2102, MAX485 | 실제 양산 적용 및 통신·레벨시프터 디버깅 경험 |
| **6순위** | **레벨시프터·ESD·전원보호·충전 IC** | 40종 | TXS0108E, LSF0102, TP4056, MCP73831, DW01A, USBLC6-2SC6, TPD2E001 | 배터리 충전·보호·I2C/LCD 레벨변환 실무 직결 |

---

## 3. 페이지 폭발 공식 (500종 시드 → 10,000+ 고부가 페이지)

1. **개별 부품 정밀 페이지** – 500종 × 4개국어(EN/KO/JA/DE) = **2,000페이지**.
2. **대체품 마스터 허브 (`alt`)** – 500종 × 4개국어 = **2,000페이지**.
3. **1:1 핵심 비교 (`vs`)** – 카테고리별 검색 수요 상위 1,500쌍 × 4개국어 = **6,000페이지**.
4. **카테고리 인터랙티브 파라메트릭 비교표** – 6대 카테고리 × 세부 조건별(예: `Ultra-Low Iq LDO under 5uA`, `SOT-23-3 3.3V LDO Pinout Map`) 100개 허브 × 4개국어 = **400페이지**.
5. **총합** – 1차 시드 500종만으로 **10,400개의 초고밀도 엔지니어링 SSG 페이지** 구축.
