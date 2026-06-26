/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Andaman Travel Care blue — primary brand
        brand: {
          50: '#eef4ff',
          100: '#d8e6ff',
          200: '#b6d0ff',
          300: '#85b1ff',
          400: '#5089fb',
          500: '#2a6ef0',
          600: '#1566d6',
          700: '#0f51ad',
          800: '#123f87',
          900: '#15366d',
        },
        // Deep brand-blue "ink" for the app shell / dark surfaces
        ink: {
          700: '#123f87',
          800: '#0e2f63',
          900: '#0a2249',
        },
        // Orange accent (logo / Contact Us)
        sand: {
          50: '#fff6ed',
          100: '#ffe9d2',
          200: '#fed0a4',
          300: '#fdb36b',
          400: '#fb8f3c',
          500: '#f5731a',
          600: '#d65c10',
        },
        // Cool neutral surface
        surface: {
          DEFAULT: '#f8fafc',
          card: '#ffffff',
        },
        line: '#e2e8f0',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        // Compact, refined scale tuned for Plus Jakarta Sans' larger x-height.
        h1: ['1.625rem', { lineHeight: '1.2', letterSpacing: '-0.022em', fontWeight: '700' }],
        h2: ['1.3rem', { lineHeight: '1.3', letterSpacing: '-0.018em', fontWeight: '700' }],
        h3: ['1.0625rem', { lineHeight: '1.4', letterSpacing: '-0.012em', fontWeight: '600' }],
        h4: ['0.9375rem', { lineHeight: '1.5', letterSpacing: '-0.006em', fontWeight: '600' }],
      },
      letterSpacing: {
        tightest: '-0.03em',
        tighter: '-0.02em',
        tight: '-0.01em',
      },
      lineHeight: {
        prose: '1.6',
        snug: '1.4',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(8,36,32,.05)',
        soft: '0 1px 2px rgba(8,36,32,.04), 0 2px 6px -1px rgba(8,36,32,.05)',
        md: '0 4px 12px -2px rgba(8,36,32,.08), 0 2px 6px -2px rgba(8,36,32,.06)',
        lg: '0 12px 28px -8px rgba(8,36,32,.16), 0 4px 10px -4px rgba(8,36,32,.08)',
        xl: '0 24px 48px -12px rgba(8,36,32,.22)',
        glow: '0 8px 24px -8px rgba(21,102,214,.40)',
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '0.85rem',
        '2xl': '1.15rem',
      },
      backgroundImage: {
        ocean: 'linear-gradient(135deg, #0f51ad 0%, #1566d6 55%, #2a7ef0 100%)',
        'ocean-soft': 'linear-gradient(135deg, #eef4ff 0%, #ffffff 60%)',
      },
      keyframes: {
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'scale-in': 'scale-in .18s ease-out',
        'fade-in': 'fade-in .15s ease-out',
      },
    },
  },
  plugins: [],
};
