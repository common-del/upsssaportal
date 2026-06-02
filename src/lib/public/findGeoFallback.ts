import { DISTRICTS } from './constants';

export type GeoOption = {
  code: string;
  nameEn: string;
  nameHi: string;
  districtCode?: string;
};

export function getFallbackGeo(): { districts: GeoOption[]; blocks: GeoOption[] } {
  const districts: GeoOption[] = DISTRICTS.map((name, i) => ({
    code: `FD${String(i + 1).padStart(3, '0')}`,
    nameEn: name,
    nameHi: name,
  }));

  const blocks: GeoOption[] = [];
  districts.forEach((d, di) => {
    ['North', 'South', 'Central'].forEach((part, bi) => {
      blocks.push({
        code: `FB${di}${bi}`,
        districtCode: d.code,
        nameEn: `${d.nameEn} ${part} Block`,
        nameHi: `${d.nameHi} ${part}`,
      });
    });
  });

  return { districts, blocks };
}
