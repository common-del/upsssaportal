import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { SchoolReportData } from '@/lib/reports/schoolReport';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: 'Helvetica' },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 6 },
  sub: { fontSize: 11, color: '#374151' },
  section: { marginTop: 14 },
  headerBox: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  card: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, flexGrow: 1 },
  label: { fontSize: 9, color: '#6B7280', marginBottom: 2 },
  value: { fontSize: 12, fontWeight: 700 },
  table: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, overflow: 'hidden' },
  th: { backgroundColor: '#F3F4F6', padding: 8, fontSize: 10, fontWeight: 700 },
  td: { padding: 8, fontSize: 10, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  footer: { marginTop: 18, fontSize: 9, color: '#6B7280' },
});

function fmtPct(n: number | null) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n}%`;
}

export default function SchoolReportPdf({
  data,
  locale,
}: {
  data: SchoolReportData;
  locale: 'en' | 'hi';
}) {
  const pick = (en: string | null, hi: string | null) => (locale === 'hi' ? (hi || en || '') : (en || hi || ''));

  const schoolName = pick(data.school.nameEn, data.school.nameHi);
  const blockName = pick(data.school.blockNameEn, data.school.blockNameHi);
  const districtName = pick(data.school.districtNameEn, data.school.districtNameHi);
  const location = [blockName, districtName].filter(Boolean).join(', ');

  const gradeLabel =
    data.grade.status === 'PENDING'
      ? 'Pending'
      : pick(data.grade.labelEn, data.grade.labelHi) || (data.grade.code ?? '—');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerBox}>
          <Text style={styles.title}>School Quality Report for Public Disclosure</Text>
          <Text style={styles.sub}>{schoolName}</Text>
          <Text style={styles.sub}>{location}</Text>
          <Text style={styles.sub}>{data.school.category}</Text>
        </View>

        <View style={[styles.section, styles.row]}>
          <View style={styles.card}>
            <Text style={styles.label}>School Grade</Text>
            <Text style={styles.value}>{gradeLabel}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>School Composite Score</Text>
            <Text style={styles.value}>{fmtPct(data.scores.compositePercent)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>District Average</Text>
            <Text style={styles.value}>{fmtPct(data.scores.districtAvgPercent)}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>State Average</Text>
            <Text style={styles.value}>{fmtPct(data.scores.stateAvgPercent)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Domain-wise breakdown</Text>
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={[styles.th, { flex: 1 }]}>Domain</Text>
              <Text style={[styles.th, { width: 110, textAlign: 'right' }]}>Weight (%)</Text>
            </View>
            {data.domains.map((d) => (
              <View key={d.code} style={styles.row}>
                <Text style={[styles.td, { flex: 1 }]}>{pick(d.titleEn, d.titleHi) || d.code}</Text>
                <Text style={[styles.td, { width: 110, textAlign: 'right' }]}>
                  {d.weightPercent != null ? `${d.weightPercent}%` : '—'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>
          While the grade achieved by the school is disclosed, detailed scores are only available to the school for self-improvement.
        </Text>
      </Page>
    </Document>
  );
}

