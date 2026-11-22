export type PackageCode =
  | 'SOT-23-3'
  | 'SOT-23A-3'
  | 'SOT-89-3'
  | 'SOT-223-3'
  | 'TO-252-3'
  | 'SOT-23-5'
  | 'TSOT-23-5'
  | 'SC-70-5'
  | 'TO-263-5'
  | 'SOT-23-6'
  | 'TSOT-23-6'
  | 'SC-70-6'
  | 'SOT-563'
  | 'DFN-6'
  | 'WSON-6'
  | 'SOIC-8'
  | 'SOIC-8E'
  | 'TSOT-23-8'
  | 'DFN-8'
  | 'VSON-10'
  | 'VSON-14';

export type PinRole =
  | 'GND'
  | 'VIN'
  | 'VOUT'
  | 'EN'
  | 'FB'
  | 'NC'
  | 'BYPASS'
  | 'ADJ'
  | 'SW'
  | 'BOOT'
  | 'COMP'
  | 'SS'
  | 'PG'
  | 'OUT'
  | 'IN_POS'
  | 'IN_NEG'
  | 'OUT_A'
  | 'IN_POS_A'
  | 'IN_NEG_A'
  | 'OUT_B'
  | 'IN_POS_B'
  | 'IN_NEG_B'
  | 'VCC'
  | 'VEE'
  | 'VREF'
  | 'SYNC'
  | 'MODE'
  | 'PS'
  | 'OTHER';

export interface CitedNumber {
  value: number;
  page: number;
  condition?: string;
  table_ref?: string;
}

export interface PinEntry {
  pin: number;
  name: string;
  role: PinRole;
  description: string;
}

export interface PackageInfo {
  code: PackageCode;
  mfg_package_code: string;
  pin_count: number;
  pinout_view: 'TOP_VIEW' | 'BOTTOM_VIEW';
  exposed_pad: {
    present: boolean;
    net:
      | 'NONE'
      | 'GND'
      | 'VOUT'
      | 'VIN'
      | 'SW'
      | 'FLOATING'
      | 'THERMAL_GND_RECOMMENDED';
    note?: string;
  };
  theta_ja_c_per_w: CitedNumber;
  theta_jc_c_per_w?: CitedNumber | null;
  tj_max_c: CitedNumber;
  pd_max_mw?: CitedNumber | null;
  pinout: PinEntry[];
  pinout_source_page: number;
  pinout_vision_verified: boolean;
}

export interface DesignGotcha {
  title: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  detail: string;
  page?: number;
}

export interface DatasheetMeta {
  pdf_url: string;
  product_page_url: string;
  source_domain: string;
  revision: string;
  verified_at: string;
  parse_source_mode:
    | 'DUAL_PATH_TEXT_VISION'
    | 'VISION_PRIMARY'
    | 'UNSUPPORTED_SCAN';
  page_count: number;
}

export interface TempGrade {
  ta_min_c: number;
  ta_max_c: number;
  grade_label: string;
}

export interface AuditMeta {
  confidence_score: number;
  dual_path_verified: boolean;
  physics_checks_passed: boolean;
  auditor_passed: boolean;
  human_reviewed: boolean;
  needs_human_review: boolean;
  vision_pages_checked: number[];
  audit_notes: string[];
}

export interface LdoSpecs {
  vin_abs_max_v: CitedNumber;
  vin_min_v: CitedNumber;
  vin_max_v: CitedNumber;
  vout_v: CitedNumber;
  vout_fixed: boolean;
  vout_tolerance_pct: CitedNumber;
  iout_max_ma: CitedNumber;
  iq_typ_ua: CitedNumber;
  ishdn_typ_ua: CitedNumber | null;
  dropout_typ_mv: CitedNumber;
  psrr_db: CitedNumber | null;
  output_noise_uvrms: CitedNumber | null;
  ceramic_cap_stable: boolean;
  min_cout_uf: CitedNumber;
  esr_min_ohm: CitedNumber | null;
  esr_max_ohm: CitedNumber | null;
  en_active_high: boolean | null;
  reverse_current_protection: boolean | null;
}

export interface DcdcSpecs {
  topology: 'boost' | 'buck' | 'buck-boost';
  vin_abs_max_v: CitedNumber;
  vin_min_v: CitedNumber;
  vin_max_v: CitedNumber;
  vout_min_v: CitedNumber;
  vout_max_v: CitedNumber;
  vout_fixed: boolean;
  vout_nom_v: CitedNumber | null;
  vref_v: CitedNumber | null;
  iout_or_isw_max_ma: CitedNumber;
  is_switch_limit: boolean;
  iq_typ_ua: CitedNumber;
  fsw_typ_khz: CitedNumber;
  efficiency_peak_pct: CitedNumber | null;
  inductor_typ_uh: CitedNumber;
  synchronous: boolean;
  min_cout_uf: CitedNumber;
  en_active_high: boolean | null;
}

export interface OpampSpecs {
  device_kind: 'opamp' | 'comparator';
  channels: 1 | 2 | 4;
  vs_abs_max_v: CitedNumber;
  vs_min_v: CitedNumber;
  vs_max_v: CitedNumber;
  gbwp_mhz: CitedNumber | null;
  slew_rate_v_per_us: CitedNumber | null;
  prop_delay_ns: CitedNumber | null;
  vos_max_mv: CitedNumber;
  ib_typ_pa: CitedNumber;
  iq_per_ch_typ_ua: CitedNumber;
  rail_to_rail_in: boolean;
  rail_to_rail_out: boolean;
  output_type: 'push-pull' | 'open-collector' | 'open-drain';
  cmrr_typ_db: CitedNumber | null;
  input_noise_nv_rt_hz: CitedNumber | null;
  iout_short_ma: CitedNumber | null;
}

interface BaseGoldenPart {
  schema_version: '2.0.0';
  opn: string;
  slug: string;
  family: string;
  manufacturer: string;
  lifecycle_status: 'Active' | 'NRND' | 'EOL' | 'Unknown';
  temp_grade: TempGrade;
  datasheet: DatasheetMeta;
  package: PackageInfo;
  design_gotchas: DesignGotcha[];
  typical_use_cases: string[];
  engineering_summary: string;
  audit: AuditMeta;
}

export interface LdoGoldenPart extends BaseGoldenPart {
  category: 'ldo';
  sub_topology: 'fixed-ldo' | 'adj-ldo';
  specs: LdoSpecs;
}

export interface DcdcGoldenPart extends BaseGoldenPart {
  category: 'dcdc';
  sub_topology: 'boost' | 'buck' | 'buck-boost';
  specs: DcdcSpecs;
}

export interface OpampGoldenPart extends BaseGoldenPart {
  category: 'opamp';
  sub_topology: 'opamp-single' | 'opamp-dual' | 'comparator-dual';
  specs: OpampSpecs;
}

export type GoldenPartV2 = LdoGoldenPart | DcdcGoldenPart | OpampGoldenPart;

export type CompatibilityLevel =
  | 'LEVEL_1_CANDIDATE_DROP_IN'
  | 'LEVEL_2_TUNING_REQUIRED'
  | 'LEVEL_3_LAYOUT_CHANGE';

export interface PinDiffRow {
  pin: number;
  part_a_name: string;
  part_a_role: string;
  part_b_name: string;
  part_b_role: string;
  status: 'MATCH' | 'MISMATCH' | 'CAUTION';
  note: string;
}

export interface ParameterMatrixRow {
  metric: string;
  unit: string;
  part_a_value: string;
  part_b_value: string;
  winner: 'A' | 'B' | 'TIE' | 'CONTEXT';
  note: string;
}

export interface VsComparisonV2 {
  schema_version: '2.0.0';
  slug: string;
  category: 'ldo' | 'dcdc' | 'opamp';
  part_a_slug: string;
  part_b_slug: string;
  part_a_opn: string;
  part_b_opn: string;
  compatibility_level: CompatibilityLevel;
  compatibility_badge:
    | 'Candidate Drop-In (Verify Datasheet Before Production)'
    | 'Functional / Tuning Required (Check Passives & Ratings)'
    | 'PCB Layout Change Required (Pinout or Package Mismatch)';
  package_match: boolean;
  pinout_exact_match: boolean;
  exposed_pad_match: boolean;
  pin_diff: PinDiffRow[];
  parameter_matrix: ParameterMatrixRow[];
  swap_risks: string[];
  engineering_verdict: string;
  generated_at: string;
}

export interface AltCandidate {
  alt_slug: string;
  alt_opn: string;
  manufacturer: string;
  package_code: PackageCode;
  compatibility_level: CompatibilityLevel;
  compatibility_badge: string;
  tier_tag:
    | 'Candidate Drop-In'
    | 'Ultra-Low Iq Upgrade'
    | 'Higher Current / Margin'
    | 'Value / Second-Source'
    | 'Functional Alternative (Layout Change)';
  score: number;
  key_advantage: string;
  key_tradeoff: string;
  vs_slug: string | null;
}

export interface AltHubV2 {
  schema_version: '2.0.0';
  slug: string;
  target_slug: string;
  target_opn: string;
  category: 'ldo' | 'dcdc' | 'opamp';
  summary: string;
  candidates: AltCandidate[];
  selection_checklist: string[];
  generated_at: string;
}

export interface EngineeringGuide {
  slug: string;
  title: string;
  subtitle: string;
  category: 'ldo' | 'dcdc' | 'opamp' | 'general';
  reading_time_min: number;
  published_at: string;
  updated_at: string;
  author_role: string;
  summary: string;
  key_takeaways: string[];
  related_parts: string[];
  related_vs: string[];
  sections: Array<{
    heading: string;
    body: string[];
    callout?: {
      type: 'CRITICAL' | 'WARNING' | 'TIP';
      title: string;
      text: string;
    };
    table?: {
      headers: string[];
      rows: string[][];
    };
  }>;
}

export interface TrustPageDoc {
  slug: 'about' | 'methodology' | 'disclaimer' | 'privacy' | 'contact';
  title: string;
  description: string;
  updated_at: string;
  sections: Array<{
    heading: string;
    paragraphs: string[];
    bullets?: string[];
  }>;
}
