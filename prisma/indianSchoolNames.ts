// Generates UP-appropriate school names, matching the same real naming
// conventions already used in src/lib/public/dummyData.ts (Rajkiya, Saraswati
// Vidya Mandir, DAV Public School, St. Xavier's, etc.) - not invented styles,
// and not the un-localized faker.company.name() this replaces.

export type MockSchoolCategory = 'GOVT' | 'GOVT_AIDED' | 'PRIVATE_AIDED' | 'PRIVATE';

const GOVT_PREFIXES_EN = [
  'Rajkiya Prathmik Vidyalaya',
  'Rajkiya Uchch Prathmik Vidyalaya',
  'Rajkiya Inter College',
  'Rajkiya Balika Inter College',
  'Government Primary School',
  'Government Junior High School',
  'Kanya Rajkiya Vidyalaya',
] as const;
const GOVT_PREFIXES_HI = [
  'राजकीय प्राथमिक विद्यालय',
  'राजकीय उच्च प्राथमिक विद्यालय',
  'राजकीय इंटर कॉलेज',
  'राजकीय बालिका इंटर कॉलेज',
  'सरकारी प्राथमिक विद्यालय',
  'सरकारी जूनियर हाई स्कूल',
  'कन्या राजकीय विद्यालय',
] as const;

const AIDED_PREFIXES_EN = [
  'Saraswati Vidya Mandir',
  'Aided Junior High School',
  'Aided Inter College',
  'Arya Kanya Inter College',
  'Janta Inter College',
] as const;
const AIDED_PREFIXES_HI = [
  'सरस्वती विद्या मंदिर',
  'सहायता प्राप्त जूनियर हाई स्कूल',
  'सहायता प्राप्त इंटर कॉलेज',
  'आर्य कन्या इंटर कॉलेज',
  'जनता इंटर कॉलेज',
] as const;

const PRIVATE_PREFIXES_EN = [
  "St. Xavier's School",
  "St. Mary's Convent School",
  "St. Joseph's School",
  'DAV Public School',
  'Bal Bharti Public School',
] as const;
const PRIVATE_PREFIXES_HI = [
  'सेंट जेवियर्स स्कूल',
  'सेंट मैरी कॉन्वेंट स्कूल',
  'सेंट जोसेफ स्कूल',
  'डीएवी पब्लिक स्कूल',
  'बाल भारती पब्लिक स्कूल',
] as const;

// Some private/aided names are better as "<Place> Public/International School"
// rather than a fixed brand prefix - mixed in for variety.
const PLACE_SUFFIX_EN = ['Public School', 'International School', 'Academy'] as const;
const PLACE_SUFFIX_HI = ['पब्लिक स्कूल', 'इंटरनेशनल स्कूल', 'अकादमी'] as const;

/** Stable hash so a school keeps the same name across reseeds and backfill reruns.
 *  Math.random() gave a school a different name every time the script ran, which
 *  makes a name useless as something to search for or quote in an email. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** School.management values map onto the naming conventions each type follows. */
export function categoryFromManagement(m: string | null | undefined): MockSchoolCategory {
  if (m === 'PRIVATE') return 'PRIVATE';
  if (m === 'AIDED') return 'GOVT_AIDED';
  return 'GOVT';
}

export function generateSchoolName(
  category: MockSchoolCategory,
  districtNameEn: string,
  districtNameHi: string,
  blockNameEn: string,
  blockNameHi: string,
  /** Pass the UDISE so the name is stable. Omit only where no key exists. */
  seed?: string,
): { nameEn: string; nameHi: string } {
  const h = seed ? hash(seed) : Math.floor(Math.random() * 2 ** 31);

  // Roughly a third of non-government schools take a "<Place> <Suffix>" name
  // rather than a fixed brand, which is how they are actually named.
  if (category !== 'GOVT' && h % 100 < 35) {
    const suffixIdx = h % PLACE_SUFFIX_EN.length;
    return {
      nameEn: `${blockNameEn} ${PLACE_SUFFIX_EN[suffixIdx]}`,
      nameHi: `${blockNameHi} ${PLACE_SUFFIX_HI[suffixIdx]}`,
    };
  }

  const [prefixesEn, prefixesHi] =
    category === 'GOVT'
      ? [GOVT_PREFIXES_EN, GOVT_PREFIXES_HI]
      : category === 'GOVT_AIDED' || category === 'PRIVATE_AIDED'
        ? [AIDED_PREFIXES_EN, AIDED_PREFIXES_HI]
        : [PRIVATE_PREFIXES_EN, PRIVATE_PREFIXES_HI];

  const idx = h % prefixesEn.length;
  return {
    nameEn: `${prefixesEn[idx]}, ${blockNameEn}, ${districtNameEn}`,
    nameHi: `${prefixesHi[idx]}, ${blockNameHi}, ${districtNameHi}`,
  };
}

/**
 * True when a name looks like faker.company.name() output rather than a UP school.
 *
 * Positive detection on corporate markers rather than "does not match our list",
 * so a genuine name we have not seen before is never renamed. Runs against nameEn
 * only — nameHi was generated alongside it and would be replaced together.
 */
export function looksLikeFakerName(nameEn: string): boolean {
  return /(\b(Inc|LLC|PLC|Ltd|Group|Sons|Co)\b|\s-\s|,\s[A-Z][a-z]+\s+and\s+[A-Z])/.test(nameEn);
}
