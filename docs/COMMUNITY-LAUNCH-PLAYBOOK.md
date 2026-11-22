# Pin2Pin Global — Community Launch & Backlink Seeding Playbook

> **목적**: 구글 검색 색인 및 자연 유입(SEO)이 자리 잡는 초기 1–3개월 동안, **스팸 차단 없이(Anti-Spam)** 글로벌·국내 현업 하드웨어 엔지니어 커뮤니티에서 **고권위 백링크, GitHub Star, 계산기·BOM 체커 재방문 트래픽**을 즉각 점화하기 위한 실전 실행 매뉴얼이다.  
> **기준 URL (GitHub Pages Live)**: `https://kbu3986.github.io/pin2pin-global/en/`  
> **기준 원칙**: `AGENTS.md` 및 `docs/05-RISK-AND-KPI-AUDIT.md` (무스크래핑 `AUD-03`, `Candidate Drop-In`·안전필수 면책 `AUD-04`, Dual-Path 300 DPI PNG Vision `AUD-01`).

---

## 1. Anti-Spam 핵심 운영 원칙 (커뮤니티 밴 방지 5계명)

하드웨어 엔지니어 커뮤니티(`r/PrintedCircuitBoard`, `r/AskElectronics`, `Show HN`, `EEVblog`)는 홍보성 링크·AI 슬롭(Slop)·검증 없는 스펙 나열에 극도로 민감하다. 아래 5개 원칙을 어기면 즉시 삭제되거나 도메인 단위 스팸 필터에 걸린다.

1. **Inline Value First (클릭 전 80% 가치 제공)**: 링크를 누르지 않아도 글 본문 자체에 **실제 부품 번호(OPN), 300 DPI 비전 검증으로 잡아낸 핀아웃 표, 실무 파괴 사례**가 완결되게 담는다. 링크는 `"전체 50종 비교표와 로컬 BOM 체커"` 참고용으로 하단에 자연스럽게 배치한다.
2. **절대 동시 크로스포스팅 금지 (Staggered Cadence)**: 같은 날 여러 서브레딧·포럼에 복붙하지 않는다. 채널 간 **최소 72시간–5일 간격**을 두고, 각 커뮤니티 문화에 맞춰 각도(Angle)와 제목을 완전히 다르게 작성한다.
3. **UTM 파라미터 제거 (HN / Reddit / EEVblog)**: `?utm_source=...` 같은 추적 꼬리표는 개발자·엔지니어에게 즉시 마케팅 스팸 인상을 준다. 커뮤니티 포스트에는 **깨끗한 정규 URL(`.../en/tools/bom-checker/`)**만 쓰고, GA4의 `Referrer`(`reddit.com`, `news.ycombinator.com`, `eevblog.com`)로 유입을 추적한다.
4. **과장 금지 & 한계 먼저 공개 (`AUD-04` 투명성)**: `"100% 완벽한 대체품"`, `"AI가 다 해결"` 같은 표현을 절대 쓰지 않는다. **`Candidate Drop-In (Verify Datasheet Before Production)`** 원칙, **의료(IEC 60601)·자동차(AEC-Q100)·항공·생명유지 제외**, 그리고 **초기 50종 파일럿 범위(1,000p+ MCU 의도적 제외)**를 먼저 밝히면 오히려 신뢰도가 급상승한다.
5. **1시간 골든타임 기술 Q&A 상주**: 게시 직후 2시간 동안 모든 기술 반론("왜 AI 파서를 믿나?", "왜 1117에 MLCC를 쓰면 안 되나?", "BOM CSV 서버 저장 안 하는 거 맞나?")에 **원문 PDF 페이지 번호와 코드 근거**로 즉각 답변한다.

---

## 2. 핵심 라이브 랜딩 URL 맵 (포스트별 투입 자산)

| 용도 | 라이브 URL (Trailing Slash 준수) | 주력 타깃 커뮤니티 |
| :--- | :--- | :--- |
| **메인 허브** | `https://kbu3986.github.io/pin2pin-global/en/` | Show HN, EEVblog |
| **Zero-Upload BOM 체커** | `https://kbu3986.github.io/pin2pin-global/en/tools/bom-checker/` | Show HN, `r/PrintedCircuitBoard`, 국내 HW 카페 |
| **SOT-23-3 / SOT-223 핀아웃 함정 가이드** | `https://kbu3986.github.io/pin2pin-global/en/guides/sot23-3-ldo-pinout-traps/` | `r/PrintedCircuitBoard`, `r/AskElectronics` |
| **DC-DC VREF·EN 극성 함정 가이드** | `https://kbu3986.github.io/pin2pin-global/en/guides/dcdc-vref-en-polarity-traps/` | `r/AskElectronics`, EEVblog |
| **Op-Amp vs Comparator SOIC-8 가이드** | `https://kbu3986.github.io/pin2pin-global/en/guides/opamp-vs-comparator-soic8-traps/` | `r/AskElectronics`, EEVblog |
| **대표 1:1 Pin-Diff (SA vs SR 반전)** | `https://kbu3986.github.io/pin2pin-global/en/vs/ap7313-33sag-7-vs-ap7313-33srg-7/` | `r/PrintedCircuitBoard` |
| **대표 1:1 Pin-Diff (SOT-223 Tab 쇼트)** | `https://kbu3986.github.io/pin2pin-global/en/vs/ams1117-3-3-vs-ap7361c-33e-13/` | `r/PrintedCircuitBoard` |
| **대표 1:1 Pin-Diff (6핀 Buck VREF/EN)** | `https://kbu3986.github.io/pin2pin-global/en/vs/tps54302ddcr-vs-tps563201ddcr/` | `r/AskElectronics`, EEVblog |
| **대표 1:1 Pin-Diff (LM358 vs LM393)** | `https://kbu3986.github.io/pin2pin-global/en/vs/lm358dr-vs-lm393dr/` | `r/AskElectronics` |
| **Dual-Path 검증 방법론** | `https://kbu3986.github.io/pin2pin-global/en/methodology/` | Show HN, EEVblog |
| **오류 제보 (GitHub Issues)** | `https://github.com/kbu3986/pin2pin-global/issues/new` | 전 채널 공통 (신뢰 시그널) |

---

## 3. Ready-to-Post 커뮤니티별 공유 초안 (English & Korean)

### 3.1 Reddit `r/PrintedCircuitBoard` (PCB 레이아웃 · BOM 실수 방지 각도)

- **권장 시점**: 화요일 또는 수요일 **14:00–16:00 UTC** (한국시간 23:00–01:00, 미국 동부 오전 출근 시간대)
- **권장 Flair**: `Resource` 또는 `Discussion` (서브레딧 최신 규칙 확인 후 `Self-Promotion` 금지 문구 여부 사전 점검; 본문에 표와 실무 체크리스트를 풀로 제공해 순수 교육 리소스로 포지셔닝)
- **사전 워밍업**: 게시 전 5–7일간 `r/PrintedCircuitBoard`의 PCB 리뷰 글 3–5건에 실제 도움이 되는 LDO/Buck 레이아웃 피드백 댓글 작성

#### Ready-to-Post Title (English)
```text
Quick reference for PCB reviews: 3 conflicting SOT-23-3 LDO pinouts, SOT-223 thermal tab shorts, and a free client-side BOM trap checker
```

#### Ready-to-Post Body (English)
```markdown
After reviewing too many Rev-A boards where a last-minute BOM substitution fried a 3.3 V rail on first power-up, I compiled a small reference matrix directly from official manufacturer PDFs (TI, Diodes Inc., onsemi, AMS) by checking both the text tables and 300 DPI renders of every Top-View pinout drawing.

Here are the three pinout traps that keep showing up in PCB reviews—especially when someone swaps a part during a stockout:

### 1. SOT-23-3 has NO standard LDO pinout (3 conflicting groups across 5 common 3.3 V OPNs)

| Exact OPN | Mfg Package | Pin 1 (Bot-L) | Pin 2 (Bot-R) | Pin 3 (Top-C) | Group |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `AP7333-33SAG-7` | SOT23 (SA) | IN | OUT | GND | A (IN-OUT-GND) |
| `AP7313-33SAG-7` | SOT23 (SA) | IN | OUT | GND | A (IN-OUT-GND) |
| `AP7313-33SRG-7` | SOT23R (SR) | GND | OUT | IN | B (GND-OUT-IN) |
| `AP2210N-3.3TRG1` | SOT-23-3 | GND | VOUT | VIN | B (GND-OUT-IN) |
| `LM3480IM3-3.3/NOPB` | DBZ | OUT | IN | GND | C (OUT-IN-GND) |

The nastiest one in assembly is `AP7313-33SAG-7` vs `AP7313-33SRG-7`—a single character (`SA` vs `SR`) inside the *exact same datasheet* reverses VIN and GND.

### 2. SOT-223-3 thermal tab is NOT always Ground
- **1117 family** (`AMS1117-3.3`, `LM1117IMPX-3.3/NOPB`, `AZ1117CH-3.3TRG1`, `NCP1117ST33T3G`, `TLV1117-33IDCYR`): `1=GND/ADJ, 2=VOUT, 3=VIN`, **Tab = VOUT (+3.3 V)**.
- **78xx / 2937 / AP-E style** (`LM2937IMP-3.3/NOPB`, `AP7361C-33E-13`): `1=VIN, 2=GND, 3=VOUT`, **Tab = GND (0 V)**.
Dropping `AP7361C-33E-13` (missing the `R` in `AP7361C-33ER-13`) onto an AMS1117 copper pour shorts your 3.3 V island straight to GND.

### 3. SOT-23-6 / TSOT-23-6 Buck trap + EN abs max cliff
- `TPS54302DDCR`, `TPS563201DDCR`, and `AP62200WU-7` share `1=GND, 2=SW, 3=VIN, 4=FB, 5=EN, 6=BOOT`, **but** `AP63203WU-7` in the exact same TSOT26 package scrambles pins to `1=FB, 2=EN, 3=VIN, 4=GND, 5=SW, 6=BST`.
- Even among the three pin-identical bucks, `TPS54302DDCR` caps `EN` at **7.0 V abs max** (float = ON) and `AP62200WU-7` caps `EN` at **8.0 V abs max**, whereas `TPS563201DDCR` tolerates 19 V on `EN` with an internal **1.5 MOhm pulldown** (float = OFF)—and their `VREF` values (`0.596 V` vs `0.768 V` vs `0.800 V`) cause up to **+34% overvoltage** if resistors aren't recalculated.

---

I packaged these 50 verified LDO, DC-DC, and Op-Amp/Comparator parts into a free static reference site with side-by-side SVG pin-diff views and a **100% client-side BOM CSV checker** (zero bytes leave your browser—works with KiCad, Altium, PADS, and EasyEDA exports to flag EOL parts like `CAT6219-330TD-GT3`, ESR-sensitive 1117s, and reversed pinout traps):

- Full SOT-23-3 & SOT-223 pinout field guide: https://kbu3986.github.io/pin2pin-global/en/guides/sot23-3-ldo-pinout-traps/
- Example 1:1 Pin-Diff (`AP7313-33SAG-7` vs `AP7313-33SRG-7`): https://kbu3986.github.io/pin2pin-global/en/vs/ap7313-33sag-7-vs-ap7313-33srg-7/
- Zero-Upload Client-Side BOM Checker: https://kbu3986.github.io/pin2pin-global/en/tools/bom-checker/

*(Standard engineering disclaimer: everything is labeled as "Candidate Drop-In — verify against the latest official manufacturer datasheet before production", and is not approved for medical/automotive/aerospace safety-critical designs.)*

If you spot any datasheet edge case I missed—or have a favorite pinout trap that burned a prototype—let me know and I'll add it to the next verified batch.
```

---

### 3.2 Reddit `r/AskElectronics` (실무 트러블슈팅 · 워크벤치 리워크 각도)

- **권장 시점**: `r/PrintedCircuitBoard` 게시 후 **최소 5일 뒤** (목요일 또는 일요일 15:00–17:00 UTC)
- **차별화 전략**: `r/AskElectronics` 독자는 초·중급 엔지니어와 하드웨어 디버깅 질문자가 많으므로, **"핀아웃은 똑같은데 꽂으면 왜 보드가 망가지나? (LM358 vs LM393, TPS54302 7V EN, AMS1117 MLCC 발진)"** 관점으로 완전히 다른 글을 올린다.

#### Ready-to-Post Title (English)
```text
Why "same package + same pinout" still destroys circuits: 4 verified datasheet traps (LM358 vs LM393, 6-pin Buck VREF/EN, SOT-23-5 'U' suffix, and 1117 ESR)
```

#### Ready-to-Post Body (English)
```markdown
When you are troubleshooting a prototype or hunting for a quick replacement during a shortage, matching the package and pinout is often where the *real* traps start. I recently audited 50 common LDOs, DC-DC converters, and op-amps/comparators directly against official manufacturer PDFs (including 300 DPI PNG checks of the pinout diagrams), and four identical-footprint failure modes stood out:

1. **LM358DR / LMV358IDR vs LM393DR (identical SOIC-8 pinout, incompatible silicon)**
   All three use `1=OUT_A, 2=IN-_A, 3=IN+_A, 4=V-/GND, 5=IN+_B, 6=IN-_B, 7=OUT_B, 8=V+/VCC`.
   - Drop `LM393DR` (open-collector comparator, uncompensated) into an `LM358DR` socket -> high output floats without a pull-up resistor, and linear negative feedback oscillates at MHz because `LM393` has no internal Miller compensation.
   - Drop `LM358DR` into an `LM393DR` circuit -> slow `0.3 V/us` edges, sluggish saturation recovery, and if `LM393` was level-shifting a 12 V rail to a 3.3 V MCU GPIO via a 3.3 V pull-up, push-pull `LM358DR` slams ~10.5 V into the MCU pin.
   - Bonus trap: `LMV358IDR` has a **5.5 V absolute maximum** supply rating (zero headroom above 5.5 V), so putting it on a 12 V `LM358` board pops it instantly.

2. **SOT-23-6 Bucks (`TPS54302DDCR` vs `TPS563201DDCR` vs `AP62200WU-7`)**
   All three share `1=GND, 2=SW, 3=VIN, 4=FB, 5=EN, 6=BOOT`, yet:
   - `VREF` is `0.596 V` (`TPS54302`) vs `0.768 V` (`TPS563201`) vs `0.800 V` (`AP62200`). Reusing a 3.3 V `TPS54302` resistor divider with `AP62200WU-7` boosts output **+34.2% to 4.43 V**.
   - `TPS54302DDCR` handles 28 V on `VIN` but caps `EN` at **7.0 V abs max** (float to enable), whereas `TPS563201DDCR` allows tying `EN` directly to 12 V `VIN` and has an internal **1.5 MOhm pulldown** (floating disables it).

3. **Single-letter SOT-23-5 op-amp pin reversal (`TLV9001IDBVR` vs `TLV9001UIDBVR`)**
   Inside the *exact same* SOT-23-5 (`DBV`) package, `TLV9001IDBVR` is `1=OUT, 2=V-, 3=IN+, 4=IN-, 5=V+` (matching `TLV9061IDBVR` and `OPA333AIDBVR`), whereas adding one letter `U` (`TLV9001UIDBVR`) permutes Pins 1, 3, and 4 to `1=IN+, 2=V-, 3=IN-, 4=OUT, 5=V+` (LMV321/MCP6001 style).

4. **Legacy 1117 LDOs + MLCC ceramic capacitors**
   `LM1117IMPX-3.3/NOPB` requires `0.3–22 Ohm` ESR and `AMS1117-3.3` specifies 22 uF solid tantalum—replacing those with a `<10 mOhm` MLCC frequently causes MHz output oscillation. Meanwhile, `TLV1117-33IDCYR` ships mixed Legacy (`0.2–10 Ohm` ESR) vs New-Chip (`0.002–0.5 Ohm` ESR) silicon under the same non-M3 OPN, leaving a narrow `0.2–0.5 Ohm` safe overlap.

I wrote up the full breakdowns (with exact datasheet revision & page numbers) plus free browser-based calculators and a zero-upload BOM CSV checker here:
- Op-Amp vs Comparator SOIC-8 & SOT-23-5 traps: https://kbu3986.github.io/pin2pin-global/en/guides/opamp-vs-comparator-soic8-traps/
- DC-DC Pinout, VREF & EN Polarity traps: https://kbu3986.github.io/pin2pin-global/en/guides/dcdc-vref-en-polarity-traps/
- Zero-Upload BOM Risk Checker (runs locally in browser): https://kbu3986.github.io/pin2pin-global/en/tools/bom-checker/

Always treat cross-references as *Candidate Drop-Ins* and double-check the official manufacturer PDF before production (and never use web reference tools for safety-critical/medical/automotive systems). What other "looks identical, breaks everything" parts belong in the next 50-part batch?
```

---

### 3.3 Hacker News `Show HN` (엔지니어링 아키텍처 · Dual-Path Vision + Zero-Upload 보안 각도)

- **권장 시점**: 화요일–목요일 **13:00–15:30 UTC** (미국 동부 오전 8–10:30시, HN 프론트페이지 경쟁력과 체류시간 최적 구간)
- **HN 핵심 규칙**: 제목은 80자 이내, 마케팅 수식어(`Revolutionary`, `AI-powered`, `Ultimate`) 완전 배제, 본문 대신 **URL 제출 후 2분 내 작성자 첫 댓글(Maker Comment)**로 기술적 배경·실패 사례·아키텍처·한계를 담백하게 설명한다.

#### Submission URL
```text
https://kbu3986.github.io/pin2pin-global/en/tools/bom-checker/
```
*(대안: 전체 DB의 완성도를 먼저 보여주고 싶다면 `https://kbu3986.github.io/pin2pin-global/en/` 제출 후 첫 댓글 상단에 BOM Checker 링크 배치)*

#### Show HN Title (79 chars — strictly <= 80 chars)
```text
Show HN: Pin2Pin Global – Vision-verified IC pinout diffs and local BOM checker
```

#### Maker First Comment (English — post within 2 minutes of submission)
```markdown
Hi HN, I built Pin2Pin Global to solve a recurring hardware engineering pain point: distributor parametric search makes components look interchangeable by family name, even when a single ordering-code suffix flips power pins, shorts a thermal tab, or shifts VREF by +34%.

Live site: https://kbu3986.github.io/pin2pin-global/en/
Zero-upload BOM checker: https://kbu3986.github.io/pin2pin-global/en/tools/bom-checker/
Verification methodology: https://kbu3986.github.io/pin2pin-global/en/methodology/
Repo (open schema, pipeline, and verified JSONs): https://github.com/kbu3986/pin2pin-global

A few technical design decisions that shaped this:

1. **Dual-Path PDF verification (text + 300 DPI PNG Vision) instead of text-only parsing.**
   Standard `pymupdf`/`pdfplumber` extraction silently corrupts vector pinout drawings, rotated package diagrams, and multi-column electrical tables. Every part in the database goes through text/table chunking AND direct visual inspection of 300 DPI PNG renders of the pinout, absolute-maximum, and thermal pages, followed by a deterministic physics/schema validator (`V_abs >= V_rec`, pin count == pinout array length, strict unit normalization like `pA` vs `nA` and per-channel `Iq`). Unreadable scans are quarantined as `UNSUPPORTED_SCAN` rather than guessed.
   Real catches from the 300 DPI visual pass:
   - Caught a full-page `OBSOLETE` watermark on `CAT6219-330TD-GT3` that text extraction missed.
   - Separated SOT-23-3 single-letter reversals (`AP7313-33SAG-7` `1=IN, 3=GND` vs `AP7313-33SRG-7` `1=GND, 3=IN`).
   - Separated SOT-223 thermal tab nets (`AMS1117-3.3` Tab=VOUT vs `AP7361C-33E-13` & `LM2937IMP-3.3/NOPB` Tab=GND).
   - Caught `TPS54302DDCR` (28 V VIN, **7.0 V abs max EN**) vs pin-identical `TPS563201DDCR` (17 V VIN, 19 V EN with 1.5 MOhm pulldown, `0.768 V` vs `0.596 V` VREF).

2. **Strict `Family 1:N OPN` schema—never compare vague family names.**
   Every part page and 1:1 `/vs/` diff is locked to a single exact Orderable Part Number and JEDEC package code. Cross-package or op-amp-vs-comparator pairs (`LM358DR` vs `LM393DR`) are mechanically blocked from receiving `Candidate Drop-In` status.

3. **Zero distributor scraping, zero server BOM uploads.**
   All datasheets come strictly from official manufacturer domains (TI, Diodes Inc., onsemi, AMS—no DigiKey/Mouser/LCSC scraping). And because hardware teams won't upload proprietary BOM CSVs to a random server, the BOM checker compiles a compact lookup index at static-build time (Next.js static export) and parses KiCad/Altium/PADS/EasyEDA CSVs 100% in browser memory. Zero bytes leave your machine.

4. **Honest scope and limits.**
   The pilot intentionally starts with 50 high-traffic analog/power OPNs (25 LDOs, 15 DC-DCs, 10 Op-Amps/Comparators; 85 normalized `vs` diffs, 7 technical field guides, 3 physics calculators) and excludes 1,000-page MCUs where pin-muxing makes "drop-in" meaningless. Everything is explicitly framed as "Candidate Drop-In — verify against the official datasheet before production" and excluded from medical/automotive/aerospace safety-critical use.

I'd genuinely appreciate critical feedback from EEs and firmware folks—especially if you find any spec discrepancy (every page links straight to GitHub Issues for reporting) or have suggestions on which BOM formats or part families (MOSFETs, ESD arrays, RS-485/CAN transceivers?) should come next.
```

---

### 3.4 EEVblog Forum (시니어 EE 피어리뷰 · 깐깐한 기술 검증 각도)

- **권장 게시판**: `Electronics` -> `Projects, Designs, and Technical Stuff` (또는 `Beginners` 제외, 순수 엔지니어링 데이터 검증 토론 톤 유지)
- **권장 시점**: Show HN 게시 후 **4–5일 뒤**
- **EEVblog 톤앤매너 핵심**: EEVblog 커뮤니티는 시니어 현업 엔지니어 비중이 높아 마케팅 어조에 극도로 냉소적이지만, **실제 제조사 리비전 변경점(TI Legacy vs New Silicon, Rev W die transition)**을 정확히 짚어주고 **버그 헌팅(Peer Review)**을 요청하면 매우 깊이 있는 기술 토론과 장기 포럼 백링크를 얻을 수 있다.

#### Ready-to-Post Subject (English)
```text
Built a datasheet-verified pinout/gotcha cross-reference DB (50 common LDO/DCDC/OpAmp OPNs + local browser BOM checker) — looking for EE peer review
```

#### Ready-to-Post Body (English)
```text
Hi everyone,

After getting burned one too many times by distributor "suggested substitutes" that ignore package-specific pinout suffixes, thermal tab nets, and silent TI die transitions, I put together a static engineering cross-reference database and a 100% client-side BOM CSV checker:

- Main catalog (50 pilot OPNs: 25 LDO, 15 DC-DC, 10 Op-Amp/Comparator): https://kbu3986.github.io/pin2pin-global/en/
- Zero-upload browser BOM checker (KiCad/Altium/PADS/EasyEDA CSV): https://kbu3986.github.io/pin2pin-global/en/tools/bom-checker/
- Methodology & deterministic physics checks: https://kbu3986.github.io/pin2pin-global/en/methodology/

A few things I tried to get right that usually annoy me in online parametric tools:

1. **Exact OPN locking, not generic family names.** Every entry is bound to one exact ordering code and JEDEC package (`AP7313-33SAG-7` vs `AP7313-33SRG-7` reversed SOT-23-3, `AP7361C-33E-13` GND tab vs `AMS1117-3.3` VOUT tab, `TLV9001IDBVR` vs `TLV9001UIDBVR` DBV Pin 1/3/4 swap).
2. **Page-cited specs + 300 DPI visual verification of pinout drawings.** Every spec carries the exact datasheet revision and page number, and pinouts were checked against 300 DPI renders rather than trusting PDF text extraction alone.
3. **Documenting the sneaky datasheet revision traps**, for example:
   - `TLV1117-33IDCYR` (TI SLVS561O): mixed Legacy (`CSO:SFB`, 5 mA Iq, `0.2–10 Ohm` ESR) vs New Chip (`CSO:RFB/FFAB`, 65 uA Iq, `<= 0.5 Ohm` ESR) leaving only a `0.2–0.5 Ohm` overlap window if you get mixed reels.
   - `TL072IDR` (TI SLOS080W Rev W, Sec 9.1.1): non-H reels shipping mixed legacy SFAB (`3 MHz`, `18 nV/rtHz`) vs modern RFB silicon (`5.25 MHz`, `37 nV/rtHz` at 1 kHz, rail ESD clamps).
   - `TPS610994DRVR` (SLVSD88M, Sec 7.3.1): tying `FB` to `GND` (opposite of `TPS61221DCKR` which ties `FB` to `VOUT`) plus the mandatory `>= 400 us` `EN` low pulse on toggle so internal EEPROM trims reload.
   - `TPS54302DDCR` (SLVSDG6C): 28 V `VIN` rating paired with a **7.0 V abs max `EN` pin**—whereas pin-identical `TPS563201DDCR` tolerates 19 V on `EN` with an internal 1.5 MOhm pulldown.
   - `OPA2134UA` (SBOS058B): `4 mA/ch` Iq burning `240–300 mW` idle at +/-15 V (`38–48 C` die rise in `160 C/W` SOIC-8 before driving a load) with zero margin above `36 V` abs max.
4. **Conservative labeling (`AUD-04`).** Nothing is called a guaranteed drop-in—everything is tagged `Candidate Drop-In (Verify Datasheet Before Production)`, with explicit safety-critical exclusions.

Every page has a direct "Report Pinout/Spec Error" link to GitHub Issues (https://github.com/kbu3986/pin2pin-global/issues/new). If anyone here wants to stress-test the pin diffs, thermal/ripple/GBWP calculators, or local BOM CSV parser—or tell me what I got wrong in the DC-DC or op-amp guides—I would really value the critique:
- DC-DC VREF & EN polarity traps: https://kbu3986.github.io/pin2pin-global/en/guides/dcdc-vref-en-polarity-traps/
- Op-Amp vs Comparator SOIC-8 & SOT-23-5 traps: https://kbu3986.github.io/pin2pin-global/en/guides/opamp-vs-comparator-soic8-traps/

Cheers!
```

---

### 3.5 국내 HW 엔지니어 커뮤니티 (Korean Ready-to-Post Drafts)

#### (A) 전자회로·PCB 설계 카페 / 오픈채팅 / 하드웨어 개발자 커뮤니티용 (실무 공유형)
- **추천 채널**: 네이버 전자회로/PCB/임베디드 카페(예: 전자공작·임베디드·KiCad/Altium 사용자 모임), 기글하드웨어, 클리앙 개발한당/모두의공원, 오픈채팅 HW 설계방
- **권장 시점**: 글로벌 시딩 1–2주차 이후, 평일 오전 10:00–11:30 또는 점심 직후 13:30–14:30 KST

```markdown
제목: [무료 툴 공유] SOT-23-3 LDO·6핀 Buck 핀아웃 실수 방지 DB & 회사 보안 걱정 없는 로컬 BOM CSV 체커 만들었습니다

안녕하세요, 현업에서 회로 설계·BOM 검토하다가 부품 수급 대체(Second Source) 때 가장 많이 당하는 핀아웃/정격 함정들을 정리해서 무료 웹 DB와 로컬 BOM 체커로 만들어 공유드립니다.

실무에서 자주 터지는 함정 몇 가지만 먼저 요약해 드리면:
1. **SOT-23-3 LDO 핀배열 반전**: 같은 Diodes AP7313 데이터시트 안에서도 `AP7313-33SAG-7`(1=IN, 2=OUT, 3=GND)과 `AP7313-33SRG-7`(1=GND, 2=OUT, 3=IN)은 알파벳 한 글자 차이로 전원이 뒤집힙니다. TI `LM3480IM3-3.3/NOPB`는 또 `1=OUT, 2=IN, 3=GND`로 아예 다릅니다.
2. **SOT-223 방열 탭 전위 쇼트**: 1117 계열(`AMS1117-3.3`, `LM1117IMPX-3.3/NOPB`)은 대형 탭이 `VOUT(3.3V)`인데, `LM2937IMP-3.3/NOPB`이나 `AP7361C-33E-13`은 탭이 `GND`입니다. (`AP7361C`는 `ER` 접미사가 붙어야 1117 핀아웃)
3. **6핀 Buck (`TPS54302` vs `TPS563201` vs `AP62200` vs `AP63203`)**:
   - `TPS54302DDCR`, `TPS563201DDCR`, `AP62200WU-7`은 6핀 배열이 완전히 같지만, `VREF`가 `0.596V / 0.768V / 0.800V`로 달라 저항을 안 바꾸면 3.3V 레일이 **4.43V(+34%)**까지 튀어 MCU가 즉시 사망합니다.
   - `TPS54302DDCR`은 `VIN`이 28V인데 `EN` 절대최대정격은 **7.0V**뿐이라 12V에 직결하면 소손되고, 반대로 `TPS563201DDCR`은 내부 1.5MΩ 풀다운이 있어 `EN`을 띄우면 아예 켜지지 않습니다. `AP63203WU-7`은 같은 TSOT-23-6인데 핀배열 자체가 다릅니다.
4. **SOIC-8 `LM358DR` vs `LM393DR`**: 핀배열이 100% 같지만 오픈컬렉터 비교기(`LM393`)를 오피앰프 자리에 꽂으면 풀업 누락 + 무보상 발진이 발생합니다.

텍스트 추출만 믿으면 데이터시트 벡터 핀맵이 깨져서, 1차 파일럿 50종(LDO 25 + DC-DC 15 + Op-Amp/비교기 10)을 **제조사 공식 PDF만 사용해 300 DPI PNG 육안 비전 검증**까지 거쳐 정리했습니다.

특히 회사 BOM CSV는 보안 때문에 외부 서버에 올리기 꺼려지시잖아요? **BOM 체커는 100% 브라우저 메모리(Client-Side)에서만 동작해서 서버로 1바이트도 전송되지 않습니다.** (KiCad / Altium / PADS / EasyEDA CSV 붙여넣기·드래그앤드롭 지원, 단종품 `CAT6219-330TD-GT3`·ESR 발진·핀반전 자동 경고)

- 무료 로컬 BOM CSV 체커: https://kbu3986.github.io/pin2pin-global/en/tools/bom-checker/
- SOT-23-3 / SOT-223 핀아웃 함정 정리: https://kbu3986.github.io/pin2pin-global/en/guides/sot23-3-ldo-pinout-traps/
- DC-DC VREF · EN 극성 함정 정리: https://kbu3986.github.io/pin2pin-global/en/guides/dcdc-vref-en-polarity-traps/
- Op-Amp vs 비교기 SOIC-8 함정 정리: https://kbu3986.github.io/pin2pin-global/en/guides/opamp-vs-comparator-soic8-traps/
- 전체 카탈로그 & 계산기(LDO Tj / DC-DC 리플 / Op-Amp GBWP): https://kbu3986.github.io/pin2pin-global/en/

※ 모든 대체품은 검토 후보(`Candidate Drop-In`) 기준이며, 양산 전 반드시 제조사 최신 원문 PDF 재확인이 필요합니다(의료·자동차·항공 등 안전필수 회로 적용 제외).
써보시고 "이 부품군(MOSFET, ESD, RS-485 등)도 넣어달라"거나 오탈자·데이터시트 예외 발견하시면 댓글이나 페이지 내 Issue 버튼으로 편하게 알려주세요!
```

#### (B) GeekNews (news.hada.io) / 기술 블로그(Velog·Tistory) 투고용 짧은 요약
```markdown
제목: Show GN: 데이터시트 300 DPI 비전 검증 기반 반도체 핀호환 비교 DB & 로컬 BOM 체커 (Pin2Pin Global)
URL: https://kbu3986.github.io/pin2pin-global/en/tools/bom-checker/

요약 본문:
- 전자부품 대체품(Cross-Reference) 검토 시 텍스트 파싱만으로는 PDF 벡터 핀아웃 도면·열 밀림 오류가 생겨, 제조사 공식 PDF(TI, Diodes, onsemi, AMS)를 텍스트 추출 + 300 DPI PNG 비전 판독(Dual-Path)과 물리법칙 검증 스크립트로 이중 검증한 50종 파일럿 DB를 구축했습니다.
- 단일 패밀리명이 아닌 정확한 주문코드(OPN) 1:1 단위로 핀맵 SVG 비교(`/vs/`), LDO 열마진(Tj)·DC-DC 리플·Op-Amp GBWP 계산기, 7편의 실무 함정 가이드를 제공합니다.
- 기업 BOM 기밀 유출 우려를 없애기 위해 Next.js 정적 빌드 인덱스를 브라우저로 내려받아 **Zero-Upload 100% 클라이언트 메모리**에서 KiCad/Altium/PADS/EasyEDA BOM CSV의 단종(EOL)·ESR·핀반전 리스크를 진단하고 면책 문구가 포함된 감사 CSV를 즉시 다운로드할 수 있습니다.
- 오픈 스키마 및 검증 리포트: https://github.com/kbu3986/pin2pin-global
```

---

## 4. 4주 Anti-Spam 배포 케이던스 (Staggered Rollout Calendar)

| 주차 / 시점 | 타깃 채널 | 투입 핵심 자산 (URL) | 사전·사후 실행 체크리스트 |
| :--- | :--- | :--- | :--- |
| **Week 1 (D-5 ~ D-1)** | Reddit 워밍업 + GitHub 정리 | `github.com/kbu3986/pin2pin-global` | - `r/PrintedCircuitBoard` / `r/AskElectronics`에 비홍보성 기술 댓글 5개 이상 작성<br>- GitHub README에 라이브 배지·BOM 체커 GIF/스크린샷·Sample JSON 링크 배치<br>- GA4 & GSC 사이트맵 제출 완료 확인 |
| **Week 1 (화, D-Day)** | **Hacker News `Show HN`** | `/en/tools/bom-checker/` + 첫 댓글에 `/en/` & `/en/methodology/` | - 13:30 UTC 게시, 2분 내 Maker Comment 등록<br>- 3시간 상주하며 Vision 검증·스키마·Zero-Upload 보안 질문 즉답<br>- 접수된 오류 제보는 24시간 내 핫픽스 후 댓글로 해결 보고 |
| **Week 2 (화, D+7)** | **Reddit `r/PrintedCircuitBoard`** | `/en/guides/sot23-3-ldo-pinout-traps/` + `/en/tools/bom-checker/` | - SOT-23-3 / SOT-223 표를 본문에 인라인 완결형으로 게시<br>- 절대 `Show HN` 복붙 금지, PCB 리뷰어 관점으로 톤 조정 |
| **Week 2 (토, D+11)** | **EEVblog Forum** | `/en/` + `/en/methodology/` + DC-DC/Op-Amp 가이드 | - TI Dual-Silicon(`TLV1117`, `TL072 Rev W`) 등 시니어 EE 관심사 전면 배치<br>- 피어리뷰 피드백을 GitHub Issue로 연결해 포럼 신뢰 확보 |
| **Week 3 (수, D+15)** | **Reddit `r/AskElectronics`** | `/en/guides/opamp-vs-comparator-soic8-traps/` + `/en/guides/dcdc-vref-en-polarity-traps/` | - `LM358 vs LM393`, `TPS54302 7V EN`, `TLV9001U` 워크벤치 함정 중심 게시<br>- 댓글로 다음 Wave 2 부품 요청(MOSFET, ESD, Comparator 등) 수렴 |
| **Week 3 (금, D+17)** | **GeekNews + 국내 HW 카페/블로그** | `/en/tools/bom-checker/` + 가이드 3종 | - 한국어 실무 사례 포스트 배포(카페 공지·홍보 게시판 규칙 준수)<br>- 쿠팡 파트너스/아마존 계측기 모듈 클릭 이벤트 계측 점검 |
| **Week 4 (D+21 ~ D+28)** | **회고 및 GSC 색인 게이트 점검** | 전체 200+ 페이지 | - `docs/05-RISK-AND-KPI-AUDIT.md` Day 21 게이트 판정(GSC 색인율 >= 80% Go vs < 50% Stop)<br>- 커뮤니티에서 가장 반응이 뜨거웠던 함정 주제로 Wave 2B 신규 가이드 기획 |

---

## 5. 스켑틱 Q&A 대응 매뉴얼 (자주 나오는 비판에 대한 즉답 템플릿)

| 예상 비판 / 질문 | 권장 대응 포인트 (사실 기반, 방어적 태도 금지) |
| :--- | :--- |
| **"LLM이 파싱한 핀아웃을 어떻게 믿고 PCB를 뜨나?"** | "전적으로 동의합니다. 그래서 절대 LLM 단독 텍스트 추출을 믿지 않습니다. ① 모든 핀아웃·정격 페이지를 300 DPI PNG로 렌더링해 Dual-Path 교차확인하고, ② 결정론적 물리 검증 스크립트(`stage2_physics_verifier.mjs`)로 핀 개수·정격 역전·단위를 기계 검증하며, ③ 전 페이지에 `Candidate Drop-In (Verify Datasheet Before Production)` 원칙을 강제합니다. 직접 검증 JSON과 원문 PDF 페이지 번호를 공개해 두었으니 틀린 부분이 보이면 Issue로 잡아주세요." |
| **"회사 BOM CSV를 웹에 올리는 건 보안 위반 아닌가?"** | "정확한 지적입니다. 그래서 서버 업로드 API 자체가 없습니다. 사이트가 GitHub Pages 100% 정적 호스팅이고, 개발자 도구 Network 탭을 열어두고 CSV를 드롭해 보시면 아웃바운드 요청이 0건인 걸 직접 확인하실 수 있습니다." |
| **"왜 50개밖에 없나? STM32나 ESP32는 왜 없나?"** | "1,000페이지짜리 MCU는 핀 멀티플렉싱과 펌웨어 의존성 때문에 'Pin2Pin 대체' 개념 자체가 위험합니다. 1차로 실제 보드 소손 사고가 가장 잦은 24핀 이하 아날로그·전원 핵심 소자(LDO, Buck/Boost, Op-Amp/비교기) 50종부터 치명 오류 0건으로 검증했고, 커뮤니티 요청 순으로 MOSFET·ESD·인터페이스 소자를 확장 중입니다." |
| **"제휴 링크나 광고 붙이려는 홍보 사이트 아닌가?"** | "유지비(도메인·인프라) 충당을 위해 페이지 하단에 오실로스코프·SMD 샘플북 같은 벤치 장비 링크와 비침투 광고 슬롯을 분리 배치했지만, 핵심 기능(핀맵 SVG, 계산기 3종, 25라인 무료 로컬 BOM 체커, 오픈 JSON 스키마)은 로그인·페이월 없이 전부 무료로 열어두었습니다." |

---

## 6. 채널별 백링크 · 트래픽 · 전환 KPI 추적표 (30일 기준)

`docs/05-RISK-AND-KPI-AUDIT.md`의 Go/Hold/Kill 기준선과 연동해 매주 월요일 아래 지표표를 업데이트한다.

| 채널 | 핵심 유입 목표 (30일 세션) | 목표 평균 참여 시간 (GA4) | 계산기 / BOM 체커 조작률 | 목표 백링크 / 리퍼러 / 리드 | 중단·보정 트리거 (Red Flag) |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Hacker News (`Show HN`)** | 800 – 3,000+ | >= 90초 | >= 18% (BOM 샘플 로드 포함) | GitHub Star >= 30, 기술 블로그·뉴스레터 자연 백링크 >= 3건 | 이탈률 > 80% 또는 치명 스펙 오류 지적 1건 이상 -> 24시간 내 즉각 패치 |
| **Reddit `r/PrintedCircuitBoard`** | 400 – 1,200 | >= 110초 | >= 20% | 북마크·댓글 저장 다수, `BOM Pro` 대기열 리드 >= 3건 | 홍보성 지적/삭제 시 링크 비중 축소 및 순수 표 중심 재작성 |
| **Reddit `r/AskElectronics`** | 350 – 1,000 | >= 100초 | >= 15% | 1:1 `/vs/` 페이지 다중 페이지뷰(세션당 >= 2.2p) | 참여 시간 < 45초 -> 가이드 상단 요약표·핀Diff CTA 직배치 |
| **EEVblog Forum** | 200 – 600 | >= 150초 | >= 20% | 고권위 포럼 장기 백링크 1+건, 현업 EE 오류 제보/검수 피드백 | 기술적 정확성 이의 제기 -> `methodology` 및 해당 JSON 즉시 보완 |
| **국내 HW 커뮤니티 / GeekNews** | 300 – 900 | >= 90초 | >= 15% | 국내 블로그 인용 백링크 >= 3건, 쿠팡/아마존 계측기 클릭 측정 | 영문 UI 장벽 피드백 다수 시 Wave 3 한국어(`/ko/`) 로컬라이징 우선순위 상향 |
| **통합 SEO / GSC 게이트 (Day 21)** | 자연 검색 노출 개시 | 전체 평균 >= 90초 | 전체 >= 15% | **GSC 제출 대비 색인율 >= 80%** (`Crawled - not indexed` < 15%), Referring Domains >= 10 | **색인율 < 50% 또는 치명 오류 >= 1건** -> 신규 페이지 증축 즉각 동결 (`AUD-06`) |

---

## 7. 실행 전 최종 체크리스트 (Pre-Flight)

- [ ] GitHub Pages 배포 완료 및 모든 라이브 URL(`.../en/tools/bom-checker/`, `.../en/guides/dcdc-vref-en-polarity-traps/`, `.../en/guides/opamp-vs-comparator-soic8-traps/` 등) HTTP 200 응답 확인
- [ ] BOM 체커 브라우저 DevTools Network 탭에서 CSV 파일 로드 시 **외부 서버 전송 0바이트** 실증 스크린샷 확보(HN/Reddit 질문 대응용)
- [ ] GA4 이벤트(`bom_scan`, `bom_export`, `calc_interact`, `affiliate_click`) 실시간 디버그뷰 동작 확인
- [ ] `docs/DAY4-HW-REVIEW-15.md` 고위험 15종 최종 검수 상태 확인 및 GitHub Issues 제보 템플릿 정상 작동 확인
