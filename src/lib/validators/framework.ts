export type ValidationError = {
  code: string;
  message: string;
  target?: string; // e.g. "Domain D1", "Parameter P1_1_01"
};

type FullFramework = {
  id: string;
  status: string;
  domains: {
    id: string;
    code: string;
    titleEn: string;
    titleHi: string;
    order: number;
    weightPercent: number | null;
    isActive: boolean;
    subDomains: {
      id: string;
      code: string;
      titleEn: string;
      titleHi: string;
      order: number;
      isActive: boolean;
      parameters: {
        id: string;
        code: string;
        titleEn: string;
        titleHi: string;
        order: number;
        applicability: unknown;
        isActive: boolean;
        options: {
          id: string;
          key: string;
          labelEn: string;
          labelHi: string;
          isActive: boolean;
        }[];
        rubricMappings: {
          id: string;
          optionKey: string;
          score: number;
        }[];
      }[];
    }[];
  }[];
  levels: {
    id: string;
    key: string;
    labelEn: string;
    labelHi: string;
  }[];
  gradeBands: {
    id: string;
    key: string;
    labelEn: string;
    labelHi: string;
    minPercent: number;
    maxPercent: number;
    order: number;
  }[];
};

const VALID_APPLICABILITY = ['PRIMARY', 'UPPER_PRIMARY', 'SECONDARY'];

export function validateFramework(fw: FullFramework): ValidationError[] {
  const errors: ValidationError[] = [];

  // ── Already published ──
  if (fw.status === 'PUBLISHED') {
    errors.push({ code: 'LOCK_01', message: 'Framework is already published.' });
    return errors;
  }

  const activeDomains = fw.domains.filter((d) => d.isActive);

  // ── Structure: at least 1 active domain ──
  if (activeDomains.length === 0) {
    errors.push({ code: 'STR_01', message: 'At least 1 active domain is required.' });
  }

  // Check each active domain
  let totalActiveParams = 0;

  for (const domain of activeDomains) {
    // Bilingual titles
    if (!domain.titleEn.trim()) {
      errors.push({ code: 'BIL_01', message: `Domain "${domain.code}" is missing English title.`, target: `Domain ${domain.code}` });
    }
    if (!domain.titleHi.trim()) {
      errors.push({ code: 'BIL_02', message: `Domain "${domain.code}" is missing Hindi title.`, target: `Domain ${domain.code}` });
    }

    // Domain weight must be present
    if (domain.weightPercent === null || domain.weightPercent === undefined) {
      errors.push({ code: 'WGT_01', message: `Domain "${domain.code}" weight is not set.`, target: `Domain ${domain.code}` });
    }

    const activeSubDomains = domain.subDomains.filter((sd) => sd.isActive);

    // Disabled domain must not have active parameters
    if (!domain.isActive) continue;

    if (activeSubDomains.length === 0) {
      errors.push({ code: 'STR_02', message: `Domain "${domain.code}" has no active subdomains.`, target: `Domain ${domain.code}` });
    }

    // Subdomain order consecutive
    for (let i = 0; i < activeSubDomains.length; i++) {
      if (activeSubDomains[i].order !== i + 1) {
        errors.push({
          code: 'STR_03',
          message: `SubDomain "${activeSubDomains[i].code}" order is ${activeSubDomains[i].order}, expected ${i + 1}.`,
          target: `SubDomain ${activeSubDomains[i].code}`,
        });
      }
    }

    for (const sd of activeSubDomains) {
      // Bilingual subdomain titles
      if (!sd.titleEn.trim()) {
        errors.push({ code: 'BIL_03', message: `SubDomain "${sd.code}" is missing English title.`, target: `SubDomain ${sd.code}` });
      }
      if (!sd.titleHi.trim()) {
        errors.push({ code: 'BIL_04', message: `SubDomain "${sd.code}" is missing Hindi title.`, target: `SubDomain ${sd.code}` });
      }

      const activeParams = sd.parameters.filter((p) => p.isActive);
      totalActiveParams += activeParams.length;

      // Parameter order consecutive within subdomain
      for (let i = 0; i < activeParams.length; i++) {
        if (activeParams[i].order !== i + 1) {
          errors.push({
            code: 'STR_04',
            message: `Parameter "${activeParams[i].code}" order is ${activeParams[i].order}, expected ${i + 1}.`,
            target: `Parameter ${activeParams[i].code}`,
          });
          break; // one error per subdomain is enough
        }
      }

      for (const param of activeParams) {
        // Bilingual parameter titles
        if (!param.titleEn.trim()) {
          errors.push({ code: 'BIL_05', message: `Parameter "${param.code}" is missing English title.`, target: `Parameter ${param.code}` });
        }
        if (!param.titleHi.trim()) {
          errors.push({ code: 'BIL_06', message: `Parameter "${param.code}" is missing Hindi title.`, target: `Parameter ${param.code}` });
        }

        // Applicability validation
        const app = param.applicability as string[];
        if (!Array.isArray(app) || app.length === 0) {
          errors.push({ code: 'PAR_01', message: `Parameter "${param.code}" has no applicability set.`, target: `Parameter ${param.code}` });
        } else {
          for (const a of app) {
            if (!VALID_APPLICABILITY.includes(a)) {
              errors.push({ code: 'PAR_02', message: `Parameter "${param.code}" has invalid applicability "${a}".`, target: `Parameter ${param.code}` });
            }
          }
        }

        // Must have exactly 3 active options
        const activeOpts = param.options.filter((o) => o.isActive);
        if (activeOpts.length !== 3) {
          errors.push({
            code: 'OPT_01',
            message: `Parameter "${param.code}" has ${activeOpts.length} active options, expected 3.`,
            target: `Parameter ${param.code}`,
          });
        }

        // Check each option has required keys and bilingual labels
        for (const expectedKey of ['LEVEL_1', 'LEVEL_2', 'LEVEL_3']) {
          const opt = param.options.find((o) => o.key === expectedKey && o.isActive);
          if (!opt) {
            errors.push({ code: 'OPT_02', message: `Parameter "${param.code}" is missing option "${expectedKey}".`, target: `Parameter ${param.code}` });
          } else {
            if (!opt.labelEn.trim()) {
              errors.push({ code: 'OPT_03', message: `Parameter "${param.code}" option "${expectedKey}" is missing English label.`, target: `Parameter ${param.code}` });
            }
            if (!opt.labelHi.trim()) {
              errors.push({ code: 'OPT_04', message: `Parameter "${param.code}" option "${expectedKey}" is missing Hindi label.`, target: `Parameter ${param.code}` });
            }
          }
        }

        // Rubric mappings: every active option must have a score
        for (const expectedKey of ['LEVEL_1', 'LEVEL_2', 'LEVEL_3']) {
          const mapping = param.rubricMappings.find((m) => m.optionKey === expectedKey);
          if (!mapping) {
            errors.push({ code: 'RUB_01', message: `Parameter "${param.code}" is missing rubric for "${expectedKey}".`, target: `Parameter ${param.code}` });
          } else if (typeof mapping.score !== 'number' || mapping.score < 0 || mapping.score > 3) {
            errors.push({
              code: 'RUB_02',
              message: `Parameter "${param.code}" rubric "${expectedKey}" score ${mapping.score} is out of range (0-3).`,
              target: `Parameter ${param.code}`,
            });
          }
        }
      }
    }
  }

  // At least 1 active parameter
  if (totalActiveParams === 0) {
    errors.push({ code: 'STR_05', message: 'At least 1 active parameter is required.' });
  }

  // ── Domain weights: all present and sum to 100 ──
  const weights = activeDomains.map((d) => d.weightPercent).filter((w) => w !== null && w !== undefined) as number[];
  if (weights.length === activeDomains.length && activeDomains.length > 0) {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 0.01) {
      errors.push({ code: 'WGT_02', message: `Domain weights sum to ${sum.toFixed(1)}%, must equal 100%.` });
    }
  }

  // ── Grade bands ──
  if (fw.gradeBands.length < 2) {
    errors.push({ code: 'GRD_01', message: 'At least 2 grade bands are required.' });
  }

  for (const band of fw.gradeBands) {
    if (!band.labelEn.trim()) {
      errors.push({ code: 'GRD_02', message: `Grade band "${band.key}" is missing English label.`, target: `GradeBand ${band.key}` });
    }
    if (!band.labelHi.trim()) {
      errors.push({ code: 'GRD_03', message: `Grade band "${band.key}" is missing Hindi label.`, target: `GradeBand ${band.key}` });
    }
  }

  // Check coverage 0-100 without gaps or overlaps
  if (fw.gradeBands.length >= 2) {
    const sorted = [...fw.gradeBands].sort((a, b) => a.order - b.order);
    if (sorted[0].minPercent !== 0) {
      errors.push({ code: 'GRD_04', message: `Grade bands must start at 0%. First band starts at ${sorted[0].minPercent}%.` });
    }
    if (sorted[sorted.length - 1].maxPercent !== 100) {
      errors.push({ code: 'GRD_05', message: `Grade bands must end at 100%. Last band ends at ${sorted[sorted.length - 1].maxPercent}%.` });
    }
    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(sorted[i].minPercent - sorted[i - 1].maxPercent) > 0.01) {
        errors.push({
          code: 'GRD_06',
          message: `Gap or overlap between "${sorted[i - 1].key}" (max ${sorted[i - 1].maxPercent}%) and "${sorted[i].key}" (min ${sorted[i].minPercent}%).`,
        });
      }
    }
  }

  // ── Framework levels ──
  for (const lv of fw.levels) {
    if (!lv.labelEn.trim()) {
      errors.push({ code: 'LVL_01', message: `Framework level "${lv.key}" is missing English label.`, target: `Level ${lv.key}` });
    }
    if (!lv.labelHi.trim()) {
      errors.push({ code: 'LVL_02', message: `Framework level "${lv.key}" is missing Hindi label.`, target: `Level ${lv.key}` });
    }
  }

  return errors;
}
