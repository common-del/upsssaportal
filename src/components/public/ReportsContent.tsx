'use client';

import {
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Download } from 'lucide-react';
import { DISPUTE_CATEGORIES } from '@/lib/public/dummyData';

export function ReportsContent() {
  function handleExportPdf() {
    window.print();
  }

  return (
    <div className="reports-print-area mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-[#1B2A6B] sm:text-3xl">Reports</h1>
        <button
          type="button"
          onClick={handleExportPdf}
          className="print:hidden inline-flex items-center gap-2 rounded-lg border border-[#1B2A6B] bg-white px-4 py-2 text-sm font-medium text-[#1B2A6B] shadow-sm hover:bg-gray-50"
        >
          <Download size={16} />
          Export PDF
        </button>
      </div>

      <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1B2A6B]">Dispute Analytics</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Stat label="Total" value="47" />
          <Stat label="Resolved" value="60%" />
          <Stat label="Open" value="12" />
        </div>
        <h3 className="mt-6 mb-3 text-sm font-medium text-gray-700">Category Distribution</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={DISPUTE_CATEGORIES}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {DISPUTE_CATEGORIES.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#1B2A6B]">{value}</p>
    </div>
  );
}
