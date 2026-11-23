import { z } from 'zod';

// Forbidden distributor / aggregator domains for official datasheet sourcing (AUD-03)
export const FORBIDDEN_DATASHEET_DOMAINS = [
  'digikey.com',
  'mouser.com',
  'lcsc.com',
  'alldatasheet.com',
  'datasheetcatalog.com',
  'octopart.com',
  'arrow.com',
  'farnell.com',
  'newark.com',
  'rs-online.com',
  'alibaba.com',
  'aliexpress.com',
];

export const PACKAGE_PIN_COUNTS = {
  'SOT-23-3': 3,
  'SOT-23A-3': 3,
  'SOT-89-3': 3,
  'SOT-223-3': 3,
  'TO-252-3': 3,
  'SOT-23-5': 5,
  'TSOT-23-5': 5,
  'SC-70-5': 5,
  'TO-263-5': 5,
  'SOT-23-6': 6,
  'TSOT-23-6': 6,
  'SC-70-6': 6,
  'SOT-563': 6,
  'DFN-6': 6,
  'WSON-6': 6,
  'SOIC-8': 8,
  'SOIC-8E': 8,
  'TSOT-23-8': 8,
  'DFN-8': 8,
  'VSON-10': 10,
  'VSON-14': 14,
};

export const PackageCodeEnum = z.enum([
  'SOT-23-3',
  'SOT-23A-3',
  'SOT-89-3',
  'SOT-223-3',
  'TO-252-3',
  'SOT-23-5',
  'TSOT-23-5',
  'SC-70-5',
  'TO-263-5',
  'SOT-23-6',
  'TSOT-23-6',
  'SC-70-6',
  'SOT-563',
  'DFN-6',
  'WSON-6',
  'SOIC-8',
  'SOIC-8E',
  'TSOT-23-8',
  'DFN-8',
  'VSON-10',
  'VSON-14',
]);

export const PinRoleEnum = z.enum([
  'GND',
  'VIN',
  'VOUT',
  'EN',
  'FB',
  'NC',
  'BYPASS',
  'ADJ',
  'SW',
  'BOOT',
  'COMP',
  'SS',
  'PG',
  'OUT',
  'IN_POS',
  'IN_NEG',
  'OUT_A',
  'IN_POS_A',
  'IN_NEG_A',
  'OUT_B',
  'IN_POS_B',
  'IN_NEG_B',
  'IN_POS_C',
  'IN_NEG_C',
  'OUT_C',
  'IN_POS_D',
  'IN_NEG_D',
  'OUT_D',
  'VCC',
  'VEE',
  'VREF',
  'SYNC',
  'MODE',
  'PS',
  'OTHER',
]);

export const CitedNumberSchema = z.object({
  value: z.number().finite(),
  page: z.number().int().min(1),
  condition: z.string().min(1).optional(),
  table_ref: z.string().min(1).optional(),
});

export const NullableCitedNumberSchema = CitedNumberSchema.nullable();

const OfficialUrlSchema = z
  .string()
  .url()
  .refine(
    (urlStr) => {
      const host = new URL(urlStr).hostname.toLowerCase();
      return !FORBIDDEN_DATASHEET_DOMAINS.some(
        (d) => host === d || host.endsWith(`.${d}`),
      );
    },
    {
      message:
        'Datasheet and product URLs must come from official manufacturer domains (distributor/aggregator domains forbidden per AUD-03)',
    },
  );

export const PinEntrySchema = z.object({
  pin: z.number().int().min(1).max(24),
  name: z.string().min(1).max(32),
  role: PinRoleEnum,
  description: z.string().min(3).max(240),
});

export const PackageSchema = z.object({
  code: PackageCodeEnum,
  mfg_package_code: z.string().min(1).max(32),
  pin_count: z.number().int().min(3).max(24),
  pinout_view: z.enum(['TOP_VIEW', 'BOTTOM_VIEW']),
  exposed_pad: z.object({
    present: z.boolean(),
    net: z.enum([
      'NONE',
      'GND',
      'VOUT',
      'VIN',
      'SW',
      'FLOATING',
      'THERMAL_GND_RECOMMENDED',
    ]),
    note: z.string().max(240).optional(),
  }),
  theta_ja_c_per_w: CitedNumberSchema,
  theta_jc_c_per_w: NullableCitedNumberSchema.optional().default(null),
  tj_max_c: CitedNumberSchema,
  pd_max_mw: NullableCitedNumberSchema.optional().default(null),
  pinout: z.array(PinEntrySchema).min(3).max(24),
  pinout_source_page: z.number().int().min(1),
  pinout_vision_verified: z.boolean(),
});

export const GotchaSchema = z.object({
  title: z.string().min(5).max(140),
  severity: z.enum(['CRITICAL', 'WARNING', 'INFO']),
  detail: z.string().min(20).max(600),
  page: z.number().int().min(1).optional(),
});

export const DatasheetMetaSchema = z.object({
  pdf_url: OfficialUrlSchema,
  product_page_url: OfficialUrlSchema,
  source_domain: z.string().min(3),
  revision: z.string().min(2).max(80),
  verified_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  parse_source_mode: z.enum([
    'DUAL_PATH_TEXT_VISION',
    'VISION_PRIMARY',
    'UNSUPPORTED_SCAN',
  ]),
  page_count: z.number().int().min(1),
});

export const TempGradeSchema = z.object({
  ta_min_c: z.number().min(-65).max(25),
  ta_max_c: z.number().min(50).max(175),
  grade_label: z.string().min(3).max(80),
});

export const AuditMetaSchema = z.object({
  confidence_score: z.number().min(0).max(1),
  dual_path_verified: z.boolean(),
  physics_checks_passed: z.boolean(),
  auditor_passed: z.boolean(),
  human_reviewed: z.boolean().default(false),
  needs_human_review: z.boolean().default(false),
  vision_pages_checked: z.array(z.number().int().min(1)).min(1),
  audit_notes: z.array(z.string().min(5)).min(1),
});

export const LdoSpecsSchema = z.object({
  vin_abs_max_v: CitedNumberSchema,
  vin_min_v: CitedNumberSchema,
  vin_max_v: CitedNumberSchema,
  vout_v: CitedNumberSchema,
  vout_fixed: z.boolean(),
  vout_tolerance_pct: CitedNumberSchema,
  iout_max_ma: CitedNumberSchema,
  iq_typ_ua: CitedNumberSchema,
  ishdn_typ_ua: NullableCitedNumberSchema,
  dropout_typ_mv: CitedNumberSchema,
  psrr_db: NullableCitedNumberSchema,
  output_noise_uvrms: NullableCitedNumberSchema,
  ceramic_cap_stable: z.boolean(),
  min_cout_uf: CitedNumberSchema,
  esr_min_ohm: NullableCitedNumberSchema,
  esr_max_ohm: NullableCitedNumberSchema,
  en_active_high: z.boolean().nullable(),
  reverse_current_protection: z.boolean().nullable(),
  // v2.1 optional trap fields (backwards-compatible)
  en_abs_max_v: NullableCitedNumberSchema.optional(),
  en_default_floating: z.enum(['enable', 'disable', 'forbidden']).nullable().optional(),
  max_cout_uf: NullableCitedNumberSchema.optional(),
  active_discharge: z.boolean().nullable().optional(),
});

export const DcdcSpecsSchema = z.object({
  topology: z.enum(['boost', 'buck', 'buck-boost']),
  vin_abs_max_v: CitedNumberSchema,
  vin_min_v: CitedNumberSchema,
  vin_max_v: CitedNumberSchema,
  vout_min_v: CitedNumberSchema,
  vout_max_v: CitedNumberSchema,
  vout_fixed: z.boolean(),
  vout_nom_v: NullableCitedNumberSchema,
  vref_v: NullableCitedNumberSchema,
  iout_or_isw_max_ma: CitedNumberSchema,
  is_switch_limit: z.boolean(),
  iq_typ_ua: CitedNumberSchema,
  fsw_typ_khz: CitedNumberSchema,
  efficiency_peak_pct: NullableCitedNumberSchema,
  inductor_typ_uh: CitedNumberSchema,
  synchronous: z.boolean(),
  min_cout_uf: CitedNumberSchema,
  en_active_high: z.boolean().nullable(),
  // v2.1 optional trap fields (backwards-compatible)
  en_abs_max_v: NullableCitedNumberSchema.optional(),
  en_default_floating: z.enum(['enable', 'disable', 'forbidden']).nullable().optional(),
  max_cout_uf: NullableCitedNumberSchema.optional(),
  active_discharge: z.boolean().nullable().optional(),
});

export const OpampSpecsSchema = z.object({
  device_kind: z.enum(['opamp', 'comparator']),
  channels: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  vs_abs_max_v: CitedNumberSchema,
  vs_min_v: CitedNumberSchema,
  vs_max_v: CitedNumberSchema,
  gbwp_mhz: NullableCitedNumberSchema,
  slew_rate_v_per_us: NullableCitedNumberSchema,
  prop_delay_ns: NullableCitedNumberSchema,
  vos_max_mv: CitedNumberSchema,
  ib_typ_pa: CitedNumberSchema,
  iq_per_ch_typ_ua: CitedNumberSchema,
  rail_to_rail_in: z.boolean(),
  rail_to_rail_out: z.boolean(),
  output_type: z.enum(['push-pull', 'open-collector', 'open-drain']),
  cmrr_typ_db: NullableCitedNumberSchema,
  input_noise_nv_rt_hz: NullableCitedNumberSchema,
  iout_short_ma: NullableCitedNumberSchema,
});

const BasePartSchema = z.object({
  schema_version: z.literal('2.0.0'),
  opn: z.string().min(3).max(64),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase kebab-case'),
  family: z.string().min(2).max(48),
  manufacturer: z.string().min(2).max(80),
  lifecycle_status: z.enum(['Active', 'NRND', 'EOL', 'Unknown']),
  temp_grade: TempGradeSchema,
  datasheet: DatasheetMetaSchema,
  package: PackageSchema,
  design_gotchas: z.array(GotchaSchema).min(3).max(8),
  typical_use_cases: z.array(z.string().min(8).max(160)).min(3).max(6),
  engineering_summary: z.string().min(60).max(700),
  audit: AuditMetaSchema,
});

export const LdoPartSchema = BasePartSchema.extend({
  category: z.literal('ldo'),
  sub_topology: z.enum(['fixed-ldo', 'adj-ldo']),
  specs: LdoSpecsSchema,
});

export const DcdcPartSchema = BasePartSchema.extend({
  category: z.literal('dcdc'),
  sub_topology: z.enum(['boost', 'buck', 'buck-boost']),
  specs: DcdcSpecsSchema,
});

export const OpampPartSchema = BasePartSchema.extend({
  category: z.literal('opamp'),
  sub_topology: z.enum([
    'opamp-single',
    'opamp-dual',
    'comparator-single',
    'comparator-dual',
    'opamp-quad',
    'comparator-quad',
  ]),
  specs: OpampSpecsSchema,
});

export const GoldenPartSchemaV2 = z.discriminatedUnion('category', [
  LdoPartSchema,
  DcdcPartSchema,
  OpampPartSchema,
]);

// Compatibility verdict strings mandated by AUD-04 (never claim absolute drop-in guarantee)
export const CompatibilityLevelEnum = z.enum([
  'LEVEL_1_CANDIDATE_DROP_IN',
  'LEVEL_2_TUNING_REQUIRED',
  'LEVEL_3_LAYOUT_CHANGE',
]);

export const CompatibilityBadgeEnum = z.enum([
  'Candidate Drop-In (Verify Datasheet Before Production)',
  'Functional / Tuning Required (Check Passives & Ratings)',
  'PCB Layout Change Required (Pinout or Package Mismatch)',
]);

export const LifecycleStatusEnum = z.enum(['Active', 'NRND', 'EOL', 'Unknown']);

export const AltTierTagEnum = z.enum([
  'Candidate Drop-In',
  'Ultra-Low Iq Upgrade',
  'Higher Current / Margin',
  'Higher Voltage Margin',
  'Value / Second-Source',
  'Functional Alternative (Layout Change)',
  'Lifecycle Warning (EOL/NRND)',
]);

export const VsComparisonSchema = z
  .object({
    schema_version: z.literal('2.0.0'),
    slug: z.string().regex(/^[a-z0-9-]+-vs-[a-z0-9-]+$/),
    category: z.enum(['ldo', 'dcdc', 'opamp']),
    part_a_slug: z.string().min(2),
    part_b_slug: z.string().min(2),
    part_a_opn: z.string().min(3),
    part_b_opn: z.string().min(3),
    compatibility_level: CompatibilityLevelEnum,
    compatibility_badge: CompatibilityBadgeEnum,
    package_match: z.boolean(),
    pinout_exact_match: z.boolean(),
    exposed_pad_match: z.boolean(),
    pin_diff: z.array(
      z.object({
        pin: z.number().int().min(1),
        part_a_name: z.string(),
        part_a_role: z.string(),
        part_b_name: z.string(),
        part_b_role: z.string(),
        status: z.enum(['MATCH', 'MISMATCH', 'CAUTION']),
        note: z.string(),
      }),
    ),
    parameter_matrix: z
      .array(
        z.object({
          metric: z.string(),
          unit: z.string(),
          part_a_value: z.string(),
          part_b_value: z.string(),
          winner: z.enum(['A', 'B', 'TIE', 'CONTEXT']),
          note: z.string(),
        }),
      )
      .min(6),
    swap_risks: z.array(z.string().min(12)).min(2),
    engineering_verdict: z.string().min(80),
    generated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((d) => d.part_a_slug < d.part_b_slug, {
    message: 'part_a_slug must be alphabetically smaller than part_b_slug (AUD-06)',
    path: ['part_a_slug'],
  })
  .refine((d) => d.slug === `${d.part_a_slug}-vs-${d.part_b_slug}`, {
    message: 'slug must equal "<part_a_slug>-vs-<part_b_slug>" (AUD-06)',
    path: ['slug'],
  });

export const AltCandidateSchema = z.object({
  alt_slug: z.string(),
  alt_opn: z.string(),
  manufacturer: z.string(),
  package_code: PackageCodeEnum,
  lifecycle_status: LifecycleStatusEnum.default('Active'),
  compatibility_level: CompatibilityLevelEnum,
  compatibility_badge: CompatibilityBadgeEnum,
  tier_tag: AltTierTagEnum,
  score: z.number().min(0).max(100),
  key_advantage: z.string(),
  key_tradeoff: z.string(),
  vs_slug: z.string().nullable(),
});

export const AltHubSchema = z.object({
  schema_version: z.literal('2.0.0'),
  slug: z.string().regex(/^[a-z0-9-]+-alternatives$/),
  target_slug: z.string().min(2),
  target_opn: z.string().min(3),
  category: z.enum(['ldo', 'dcdc', 'opamp']),
  summary: z.string().min(60),
  candidates: z.array(AltCandidateSchema).min(3),
  selection_checklist: z.array(z.string().min(10)).min(3),
  generated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const EngineeringGuideSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Guide slug must be lowercase kebab-case'),
  title: z.string().min(10).max(200),
  subtitle: z.string().min(10).max(400),
  category: z.enum(['ldo', 'dcdc', 'opamp', 'general']),
  reading_time_min: z.number().int().min(1).max(60),
  published_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  author_role: z.string().min(3).max(120),
  summary: z.string().min(40).max(1000),
  key_takeaways: z.array(z.string().min(10)).min(2).max(10),
  related_parts: z.array(z.string().min(2)).default([]),
  related_vs: z.array(z.string().min(5)).default([]),
  sections: z
    .array(
      z.object({
        heading: z.string().min(3).max(200),
        body: z.array(z.string().min(10)).min(1),
        callout: z
          .object({
            type: z.enum(['CRITICAL', 'WARNING', 'TIP']),
            title: z.string().min(3).max(200),
            text: z.string().min(10),
          })
          .optional(),
        table: z
          .object({
            headers: z.array(z.string().min(1)).min(2),
            rows: z.array(z.array(z.string())).min(1),
          })
          .optional(),
      }),
    )
    .min(2),
});

export const TrustPageDocSchema = z.object({
  slug: z.enum(['about', 'methodology', 'disclaimer', 'privacy', 'contact']),
  title: z.string().min(4).max(160),
  description: z.string().min(20).max(400),
  updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sections: z
    .array(
      z.object({
        heading: z.string().min(3).max(200),
        paragraphs: z.array(z.string().min(10)).min(1),
        bullets: z.array(z.string().min(5)).optional(),
      }),
    )
    .min(1),
});
