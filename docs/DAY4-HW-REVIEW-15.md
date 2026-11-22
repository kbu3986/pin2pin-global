# Day 4 High-Risk 15-Part Hardware Engineer Review Sheet

> **목적**: Phase 1 파일럿 50종 중 핀아웃 쇼트·Tab 전위·ESR 발진·VREF 오차·Active-Low EN·비교기 오사용 위험이 가장 높은 **고위험 15종**을 선별해 병욱님이 공식 PDF 원문과 1:1 육안 대조(`human_reviewed: true` 승격)할 수 있도록 정리한 검수표입니다.

| # | OPN | 제조사 | 패키지 / View | Tab/EP Net | Vision 검증 핀아웃 (`1..N`) | 검증 PDF 페이지 | 핵심 실무 함정 (원문 대조 포인트) | 공식 PDF |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| 1 | `AP7313-33SAG-7` | Diodes Incorporated | `SOT-23-3` (TOP_VIEW) | `NONE` | `1=IN, 2=OUT, 3=GND` | p.2,p.4,p.5 | Single-Letter Ordering Trap: SA vs SR/AP2210N Reverses Pins 1 & 3 (and LM3480 Differs Too) | [PDF](https://www.diodes.com/assets/Datasheets/AP7313.pdf) |
| 2 | `AP7313-33SRG-7` | Diodes Incorporated | `SOT-23-3` (TOP_VIEW) | `NONE` | `1=GND, 2=OUT, 3=IN` | p.2,p.4,p.5 | Reversed SOT23R Pinout Matches AP2210N (1=GND, 2=OUT, 3=IN), NOT AP7313-SA or LM3480 | [PDF](https://www.diodes.com/assets/Datasheets/AP7313.pdf) |
| 3 | `AP2210N-3.3TRG1` | Diodes Incorporated | `SOT-23-3` (TOP_VIEW) | `NONE` | `1=GND, 2=VOUT, 3=VIN` | p.1,p.4,p.11,p.12,p.22,p.23,p.24 | SOT-23-3 Pinout (1=GND, 2=VOUT, 3=VIN) Reversed vs AP7333-SA, AP7313-SA, and LM3480 | [PDF](https://www.diodes.com/assets/Datasheets/AP2210.pdf) |
| 4 | `LM3480IM3-3.3/NOPB` | Texas Instruments | `SOT-23-3` (TOP_VIEW) | `NONE` | `1=OUT, 2=IN, 3=GND` | p.3,p.4,p.5,p.9 | Unique SOT-23-3 Pinout (1=OUT, 2=IN, 3=GND) Incompatible With ALL Other SOT-23-3 LDOs in Batch | [PDF](https://www.ti.com/lit/ds/symlink/lm3480.pdf) |
| 5 | `AMS1117-3.3` | Advanced Monolithic Systems | `SOT-223-3` (TOP_VIEW) | `VOUT` | `1=GND, 2=VOUT, 3=VIN` | p.1,p.2,p.3 | NOT Ceramic-Cap Stable — Requires 22 uF Solid Tantalum (No Numeric ESR Window Published) | [PDF](http://www.advanced-monolithic.com/pdf/ds1117.pdf) |
| 6 | `LM1117IMPX-3.3/NOPB` | Texas Instruments | `SOT-223-3` (TOP_VIEW) | `VOUT` | `1=ADJ/GND, 2=VOUT, 3=VIN` | p.3,p.4 | Strict 0.3–22 Ohm ESR Window — Unstable With Direct MLCC Ceramic Output Capacitors | [PDF](https://www.ti.com/lit/ds/symlink/lm1117.pdf) |
| 7 | `LM2937IMP-3.3/NOPB` | Texas Instruments | `SOT-223-3` (TOP_VIEW) | `GND` | `1=INPUT, 2=GND, 3=OUTPUT` | p.3,p.4,p.9,p.10,p.14 | CRITICAL Pinout & Tab Reversal vs. 1117 Family — Installing on 1117 Pads Shorts VOUT to GND | [PDF](https://www.ti.com/lit/ds/symlink/lm2937.pdf) |
| 8 | `AP7361C-33E-13` | Diodes Incorporated | `SOT-223-3` (TOP_VIEW) | `GND` | `1=IN, 2=GND, 3=OUT` | p.1,p.4,p.6,p.12,p.15 | CRITICAL E vs. ER Suffix Pinout Trap — AP7361C-33E-13 is INCOMPATIBLE with 1117 Pads | [PDF](https://www.diodes.com/assets/Datasheets/AP7361C.pdf) |
| 9 | `TPS70933DBVR` | Texas Instruments | `SOT-23-5` (TOP_VIEW) | `NONE` | `1=IN, 2=GND, 3=EN, 4=NC, 5=OUT` | p.3,p.4 | CRITICAL EN Pin Destruction Trap — 6.5 V Zener Clamp & 7 V Abs Max | [PDF](https://www.ti.com/lit/ds/symlink/tps709.pdf) |
| 10 | `TPS54302DDCR` | Texas Instruments | `SOT-23-6` (TOP_VIEW) | `NONE` | `1=GND, 2=SW, 3=VIN, 4=FB, 5=EN, 6=BOOT` | p.1,p.3,p.4 | CRITICAL: EN Pin Abs Max Is ONLY 7.0 V (Rec 5.5 V) — NEVER Tie Directly to 12 V / 24 V VIN | [PDF](https://www.ti.com/lit/ds/symlink/tps54302.pdf) |
| 11 | `AP63203WU-7` | Diodes Incorporated | `TSOT-23-6` (TOP_VIEW) | `NONE` | `1=FB, 2=EN, 3=VIN, 4=GND, 5=SW, 6=BST` | p.1,p.2,p.3,p.4 | CRITICAL PINOUT TRAP: Completely Incompatible With TPS54302DDCR, TPS563201DDCR & AP62200WU-7! | [PDF](https://www.diodes.com/assets/Datasheets/AP63200-AP63201-AP63203-AP63205.pdf) |
| 12 | `LM2596SX-5.0/NOPB` | Texas Instruments | `TO-263-5` (TOP_VIEW) | `GND` | `1=VIN, 2=Output, 3=Ground, 4=Feedback, 5=ON/OFF` | p.4,p.5 | INVERTED LOGIC: Pin 5 (ON/OFF) Is ACTIVE-LOW Enable (Opposite of Modern Bucks!) | [PDF](https://www.ti.com/lit/ds/symlink/lm2596.pdf) |
| 13 | `LM358DR` | Texas Instruments | `SOIC-8` (TOP_VIEW) | `NONE` | `1=OUT1, 2=IN1-, 3=IN1+, 4=V-, 5=IN2+, 6=IN2-, 7=OUT2, 8=V+` | p.3,p.4,p.5,p.10 | Non-Rail-to-Rail Upper Input and Output Headroom Ceiling | [PDF](https://www.ti.com/lit/ds/symlink/lm358.pdf) |
| 14 | `LM393DR` | Texas Instruments | `SOIC-8` (TOP_VIEW) | `NONE` | `1=1OUT, 2=1IN-, 3=1IN+, 4=GND, 5=2IN+, 6=2IN-, 7=2OUT, 8=VCC` | p.3,p.4,p.5,p.8,p.10 | Classic LM358DR / LMV358IDR Identical SOIC-8 Pinout Trap (Missing Pull-Up & Oscillation) | [PDF](https://www.ti.com/lit/ds/symlink/lm393.pdf) |
| 15 | `TLV9001IDBVR` | Texas Instruments | `SOT-23-5` (TOP_VIEW) | `NONE` | `1=OUT, 2=V-, 3=IN+, 4=IN-, 5=V+` | p.7,p.14,p.15,p.17,p.18 | Critical SOT-23-5 Suffix Trap: TLV9001IDBVR vs TLV9001UIDBVR Pinout Swap | [PDF](https://www.ti.com/lit/ds/symlink/tlv9001.pdf) |

---

## 검수 완료 기준 (AUD-01 / KPI Zero-Tolerance)

1. 위 15종 전원에서 핀아웃 번호·Tab/EP 전위·절대최대정격·단위(`mV` vs `V`, `µA` vs `mA`, `pA` vs `nA`) **치명 오류 0건** 확인.
2. 검수 통과 후 각 JSON의 `audit.human_reviewed`를 `true`로 갱신하면 `/methodology` 및 각 부품 페이지에 수석 HW 엔지니어 검수 완료 배지가 반영됩니다.
