'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Download, TrendingUp, TrendingDown } from 'lucide-react';
import { DISTRICTS, UP_NAVY } from '@/lib/public/constants';
import {
  DOMAIN_AVERAGES,
  PERFORMANCE_DISTRIBUTION,
  DISPUTE_CATEGORIES,
  SQAAF_DISTRICT_TABLE,
} from '@/lib/public/dummyData';

export function ReportsContent() {
  const [district, setDistrict] = useState('All Districts');
  const schoolCount = district === 'All Districts' ? 99 : 12;

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
        <h2 className="text-lg font-semibold text-[#1B2A6B]">Domain Performance Analytics</h2>
        <div className="print:hidden mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-600">District</label>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option>All Districts</option>
            {DISTRICTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" defaultValue="">
            <option value="">Select District</option>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          <span className="font-semibold">{schoolCount} Schools</span> · District filter
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-700">
              Domain-wise Average Score
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={DOMAIN_AVERAGES}
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="domain"
                    width={140}
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip />
                  <Bar dataKey="score" fill={UP_NAVY} radius={[0, 4, 4, 0]} name="Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-700">
              Performance Distribution
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={PERFORMANCE_DISTRIBUTION}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={90}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {PERFORMANCE_DISTRIBUTION.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <TrendingUp size={18} className="text-[#F5B731]" />
            Top Performing Domain
          </p>
          <p className="mt-2 text-xl font-bold text-[#1B2A6B]">School Management</p>
          <p className="mt-1 text-3xl font-bold text-[#F5B731]">61%</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <TrendingDown size={18} className="text-red-500" />
            Least Performing Domain
          </p>
          <p className="mt-2 text-xl font-bold text-[#1B2A6B]">Infrastructure</p>
          <p className="mt-1 text-3xl font-bold text-[#EF4444]">47%</p>
        </div>
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

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1B2A6B]">SQAAF Submission Analytics</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Stat label="Schools Submitted" value="42" />
          <Stat label="Schools Pending" value="78" />
          <Stat label="Evaluator Completed" value="18" />
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs font-semibold uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2">District</th>
                <th className="px-3 py-2">Total Schools</th>
                <th className="px-3 py-2">Government Schools</th>
                <th className="px-3 py-2">Private Schools</th>
                <th className="px-3 py-2">Total Students</th>
                <th className="px-3 py-2">Total Teachers</th>
                <th className="px-3 py-2">SQAAF Verified</th>
                <th className="px-3 py-2">Recognition</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {SQAAF_DISTRICT_TABLE.map((row) => (
                <tr key={row.district} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{row.district}</td>
                  <td className="px-3 py-2">{row.totalSchools.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.govt.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.private.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.students.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.teachers.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.verified.toLocaleString()}</td>
                  <td className="px-3 py-2">{row.recognition}%</td>
                </tr>
              ))}
            </tbody>
          </table>
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
