import React, { useEffect, useState } from 'react';
import { apiClient } from '@/api/client';
import { useBrandingStore, applyBrandColor, DEFAULT_BRANDING, monogram } from '@/hooks/useBranding';
import { Branding } from '@/types';
import { Card, Button, Input, Toggle, Alert, PageHeader } from '@/components/ui/Base';
import { apiError } from '@/utils/format';

const PRESETS = ['#1E5269', '#3B82F6', '#10B981', '#7C3AED', '#B91C1C', '#1F2937'];

const SettingsPage: React.FC = () => {
  const { branding, set } = useBrandingStore();
  const [form, setForm] = useState<Branding>(branding);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => setForm(branding), [branding]);

  // Live preview: apply the colour as it is edited, and restore on leave if unsaved.
  useEffect(() => {
    applyBrandColor(form.primary_color);
  }, [form.primary_color]);
  useEffect(() => () => applyBrandColor(useBrandingStore.getState().branding.primary_color), []);

  const validColor = /^#[0-9a-fA-F]{6}$/.test(form.primary_color);

  const save = async () => {
    setMessage(null);
    if (form.org_name.trim().length < 2) return setMessage({ kind: 'error', text: 'The organisation name is required.' });
    if (!validColor) return setMessage({ kind: 'error', text: 'Enter the colour as a six-digit hex code, e.g. #1E5269.' });
    setSaving(true);
    try {
      const saved = await apiClient.updateSettings({ ...form, org_name: form.org_name.trim(), org_tagline: form.org_tagline.trim(), logo_url: form.logo_url.trim() });
      set({ ...DEFAULT_BRANDING, ...saved });
      setMessage({ kind: 'success', text: 'Branding saved. Everyone sees the new look the next time a page loads.' });
    } catch (err) {
      setMessage({ kind: 'error', text: apiError(err, 'Could not save settings') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Branding & settings" description="Make the system look like your organisation. Changes apply to every user, including the sign-in page." />
      {message && <Alert variant={message.kind}>{message.text}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-base font-semibold text-dark">Identity</h2>
            <Input label="Organisation name" value={form.org_name} onChange={(e) => setForm({ ...form, org_name: e.target.value })} />
            <Input label="Tagline" value={form.org_tagline} onChange={(e) => setForm({ ...form, org_tagline: e.target.value })} placeholder="Shown under the name" />
            <Input
              label="Logo URL"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://…/logo.png or /pgl-logo.png"
              hint="A PNG or SVG with a transparent background works best; wide logos are fine. Leave empty to use initials."
            />
          </Card>

          <Card className="space-y-4">
            <h2 className="text-base font-semibold text-dark">Brand colour</h2>
            <div className="flex flex-wrap items-center gap-3">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, primary_color: c })}
                  className={`h-9 w-9 rounded-full ring-offset-2 ${form.primary_color.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-dark' : ''}`}
                  style={{ background: c }}
                  aria-label={`Use ${c}`}
                />
              ))}
              <input
                type="color"
                value={validColor ? form.primary_color : '#1E5269'}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value.toUpperCase() })}
                className="h-9 w-12 cursor-pointer rounded border border-gray-300"
                aria-label="Custom colour"
              />
              <div className="w-32">
                <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} error={validColor ? undefined : 'Invalid hex'} />
              </div>
            </div>
            <p className="text-xs text-gray-500">Lighter and darker shades for hovers and backgrounds are generated from this colour automatically.</p>
          </Card>

          <Card>
            <Toggle
              checked={form.allow_registration !== 'false'}
              onChange={(v) => setForm({ ...form, allow_registration: v ? 'true' : 'false' })}
              label="Allow candidates to register themselves"
              description="Turn off if administrators should create every account."
            />
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setForm(branding)}>
              Discard changes
            </Button>
            <Button onClick={save} isLoading={saving}>
              Save branding
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Preview</p>
          <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-soft">
            <div className="bg-primary p-6 text-white">
              <div className="flex items-center gap-3">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="" className="h-11 w-auto max-w-[7rem] rounded-xl bg-white object-contain p-1.5" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 font-bold">{monogram(form.org_name || 'PT')}</div>
                )}
                <div>
                  <p className="font-semibold">{form.org_name || 'Organisation'}</p>
                  <p className="text-xs text-primary-100">{form.org_tagline}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 bg-white p-6">
              <div className="h-2.5 w-3/4 rounded bg-gray-200" />
              <div className="h-2.5 w-1/2 rounded bg-gray-200" />
              <div className="flex gap-2 pt-2">
                <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white">Primary</span>
                <span className="rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700">Soft</span>
                <span className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white">Success</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
