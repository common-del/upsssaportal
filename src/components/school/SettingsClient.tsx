'use client';

import { useState, useTransition } from 'react';
import { saveNotificationPreferences, savePreferredLocale } from '@/lib/actions/schoolPortal';

const NAVY = '#1B2A6B';

type Props = {
  username: string;
  preferredLocale: string | null;
  prefs: {
    emailAlerts: boolean;
    smsAlerts: boolean;
    disputeAlerts: boolean;
    cycleReminders: boolean;
  } | null;
};

export function SettingsClient({ username, preferredLocale, prefs }: Props) {
  const [locale, setLocale] = useState(preferredLocale ?? 'en');
  const [form, setForm] = useState({
    emailAlerts: prefs?.emailAlerts ?? true,
    smsAlerts: prefs?.smsAlerts ?? false,
    disputeAlerts: prefs?.disputeAlerts ?? true,
    cycleReminders: prefs?.cycleReminders ?? true,
  });
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleLocaleChange(next: 'en' | 'hi') {
    setLocale(next);
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    startTransition(async () => {
      await savePreferredLocale(next);
      window.location.reload();
    });
  }

  function handleSavePrefs() {
    startTransition(async () => {
      await saveNotificationPreferences(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your profile, language and notification preferences.
        </p>
      </header>

      {saved && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Preferences saved successfully.
        </div>
      )}

      {/* Profile */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Profile</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            { label: 'User ID', value: username },
            { label: 'Role', value: 'School' },
            { label: 'Department', value: 'School Education Department, Uttar Pradesh' },
            { label: 'Scope', value: 'School' },
          ].map((r) => (
            <div key={r.label}>
              <dt className="text-xs font-medium uppercase text-gray-500">{r.label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-gray-900">{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Language */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Language</h2>
        <p className="mb-4 text-sm text-gray-500">Choose your preferred interface language</p>
        <select
          value={locale}
          onChange={(e) => handleLocaleChange(e.target.value as 'en' | 'hi')}
          disabled={pending}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="en">EN — English</option>
          <option value="hi">हिंदी</option>
        </select>
      </section>

      {/* Notifications */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Notifications</h2>
        <div className="space-y-4">
          {([
            ['emailAlerts', 'Email alerts'],
            ['smsAlerts', 'SMS alerts'],
            ['disputeAlerts', 'New dispute / inconsistency alerts'],
            ['cycleReminders', 'Assessment cycle reminders'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                className="mt-1 rounded accent-[#1B2A6B]"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                {key === 'smsAlerts' && (
                  <p className="text-xs text-gray-500">SMS requires verified phone number</p>
                )}
              </div>
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={handleSavePrefs}
          className="mt-6 rounded-xl px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: NAVY }}
        >
          Save Preferences
        </button>
      </section>
    </div>
  );
}
