import { create } from 'zustand';
import { Branding } from '@/types';
import { apiClient } from '@/api/client';

export const DEFAULT_BRANDING: Branding = {
  org_name: 'PyTest',
  org_tagline: 'Customizable Examination System',
  logo_url: '/pgl-logo.png',
  primary_color: '#1E5269',
  allow_registration: 'true',
};

const SHADES: [number, 'white' | 'black', number][] = [
  [50, 'white', 0.94],
  [100, 'white', 0.87],
  [200, 'white', 0.72],
  [300, 'white', 0.55],
  [400, 'white', 0.35],
  [500, 'white', 0.17],
  [600, 'white', 0],
  [700, 'black', 0.15],
  [800, 'black', 0.3],
  [900, 'black', 0.45],
  [950, 'black', 0.6],
];

/**
 * Derive a full 50–950 scale from one brand colour (the colour itself becomes
 * shade 600) and publish it as CSS variables that Tailwind's primary-* classes read.
 */
export function applyBrandColor(hex: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const base = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const root = document.documentElement;
  for (const [shade, toward, ratio] of SHADES) {
    const target = toward === 'white' ? 255 : 0;
    const rgb = base.map((c) => Math.round(c + (target - c) * ratio));
    root.style.setProperty(`--primary-${shade}`, rgb.join(' '));
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hex);
}

interface BrandingStore {
  branding: Branding;
  loaded: boolean;
  load: () => Promise<void>;
  set: (branding: Branding) => void;
}

const CACHE_KEY = 'branding';

function readCache(): Branding | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...DEFAULT_BRANDING, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

function apply(branding: Branding) {
  applyBrandColor(branding.primary_color || DEFAULT_BRANDING.primary_color);
  document.title = `${branding.org_name} – Examination System`;
}

const cached = readCache();
if (cached) apply(cached);

export const useBrandingStore = create<BrandingStore>((set) => ({
  // The cached copy avoids a flash of the default brand on reload.
  branding: cached || DEFAULT_BRANDING,
  loaded: false,

  load: async () => {
    try {
      const branding = { ...DEFAULT_BRANDING, ...(await apiClient.getSettings()) };
      apply(branding);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(branding));
      } catch {
        // Storage unavailable: branding still applies for this session.
      }
      set({ branding, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  set: (branding) => {
    apply(branding);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(branding));
    } catch {
      // ignore
    }
    set({ branding });
  },
}));

/** Two-letter monogram used when no logo is configured. */
export function monogram(name: string) {
  const words = name.trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}
