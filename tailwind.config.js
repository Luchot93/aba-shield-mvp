/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ACD-117: WCAG AA color-contrast fixes. These override specific shades
        // of Tailwind's default palette (not the whole hue) with the next-darker
        // official Tailwind shade, since the originals fail 4.5:1 against white/
        // light backgrounds in several reused components. Intentionally global —
        // affects every usage of these exact classes app-wide.
        teal:  { 600: '#0F766E' },               // was #0D9488 (teal-700 value)
        slate: { 400: '#64748B', 500: '#475569' }, // were #94A3B8 / #64748B (slate-500 / slate-600 values)
        red:   { 500: '#DC2626' },                // was #EF4444 (red-600 value)
      },
    },
  },
  plugins: [],
};
