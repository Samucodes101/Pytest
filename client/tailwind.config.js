/** @type {import('tailwindcss').Config} */

// Primary is driven by CSS variables (see index.css) so an organisation can
// rebrand at runtime from the Settings page. #1E5269 is the default and sits at 600.
const primaryScale = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => [
    shade,
    `rgb(var(--primary-${shade}) / <alpha-value>)`,
  ])
);

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: 'rgb(var(--primary-600) / <alpha-value>)', ...primaryScale },
        secondary: {
          DEFAULT: '#3B82F6',
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        accent: {
          DEFAULT: '#10B981',
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        dark: { DEFAULT: '#1F2937', 800: '#1F2937', 900: '#111827' },
        light: '#F9FAFB',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(31, 41, 55, 0.04), 0 2px 8px rgba(31, 41, 55, 0.06)',
        medium: '0 10px 24px rgba(31, 41, 55, 0.10), 0 2px 6px rgba(31, 41, 55, 0.06)',
      },
    },
  },
  plugins: [],
};
