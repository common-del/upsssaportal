import { DISTRICTS, SQAAF_DOMAINS, SCHOOL_TYPES } from '@/lib/public/constants';
import {
  DISTRICT_RANKINGS,
  getHeatmapData,
  heatmapCellColor,
  SCHOOLS,
} from '@/lib/public/dummyData';
import type { District } from '@/lib/public/constants';

export const UP_NAVY = '#1B2A6B';
export const UP_GOLD = '#F5B731';

export const SUBMISSION_STATUS = [
  { name: 'Approved', value: 32450, fill: '#22C55E' },
  { name: 'Under Review', value: 18320, fill: '#3B82F6' },
  { name: 'Submitted', value: 28940, fill: '#F5B731' },
  { name: 'Sent Back', value: 6180, fill: '#F97316' },
  { name: 'Draft', value: 3350, fill: '#EF4444' },
] as const;

export const MANAGEMENT_SCORES = [
  { type: 'Government', score: 52 },
  { type: 'Aided', score: 61 },
  { type: 'Private', score: 67 },
];

export const DISTRICT_MONITORING = [
  { district: 'Lucknow', submitted: 12450, underReview: 2840, approved: 5120, sentBack: 890 },
  { district: 'Kanpur', submitted: 11200, underReview: 2510, approved: 4680, sentBack: 720 },
  { district: 'Agra', submitted: 9800, underReview: 2180, approved: 3950, sentBack: 640 },
  { district: 'Varanasi', submitted: 10500, underReview: 2340, approved: 4210, sentBack: 710 },
  { district: 'Prayagraj', submitted: 9200, underReview: 2050, approved: 3680, sentBack: 580 },
];

const BLOCK_NAMES = ['Block A', 'Block B', 'Block C', 'Block D', 'Block E'];
const CLUSTER_NAMES = ['Cluster 1', 'Cluster 2', 'Cluster 3', 'Cluster 4', 'Cluster 5'];

function seed(base: string, offset: number): number {
  return 45 + ((base.length * 7 + offset * 11) % 40);
}

export function getBlocksForDistrict(district: District) {
  return BLOCK_NAMES.map((block, i) => ({
    block,
    totalSchools: 800 + i * 120 + district.length * 10,
    submitted: 520 + i * 80,
    avgScore: seed(district + block, i),
    topPerformer: `${district} Model School ${i + 1}`,
  }));
}

export function getBlockChartData(district: District) {
  return getBlocksForDistrict(district).map((b) => ({
    name: b.block,
    score: b.avgScore,
  }));
}

export function getClustersForBlock(district: District, block: string) {
  return CLUSTER_NAMES.map((cluster, i) => ({
    cluster,
    schools: 45 + i * 12,
    submitted: 32 + i * 8,
    avgScore: seed(district + block + cluster, i),
  }));
}

export function getClusterChartData(district: District, block: string) {
  return getClustersForBlock(district, block).map((c) => ({
    name: c.cluster,
    score: c.avgScore,
  }));
}

export function getSchoolsInCluster(district: District, block: string, cluster: string) {
  const statuses = ['Approved', 'Pending', 'Sent Back'] as const;
  return Array.from({ length: 8 }, (_, i) => ({
    name: `${district} School ${cluster} #${i + 1}`,
    udise: `09${10000000 + district.length * 1000 + i}`,
    submitted: i % 3 !== 2,
    score: seed(district + block + cluster, i + 5),
    status: statuses[i % 3],
  }));
}

export const HEATMAP_DATA = getHeatmapData();
export { DISTRICT_RANKINGS, DISTRICTS, SQAAF_DOMAINS, SCHOOL_TYPES, heatmapCellColor, SCHOOLS };

export const SCHOOL_SEARCH_LIST = SCHOOLS.map((s) => ({
  id: s.id,
  name: s.name,
  udise: s.udise,
  district: s.district,
  block: s.block,
  type: s.type,
  overallScore: s.overallScore,
  domainScores: s.domainScores,
  status: s.accreditation === 'SQAAF Verified' ? 'Approved' : 'Pending',
}));
