/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /**
         * Paleta de marca Appsline, tomada del nuevo logo
         * (cerebro de circuito: cian -> azul profundo).
         *   #00A3FE  cian brillante   (highlight del logo)
         *   #0060FC  azul medio       (trazos del circuito)
         *   #002EFD  azul profundo    (base del logo)
         */
        brand: {
          50: '#eaf3ff',
          100: '#d4e6ff',
          200: '#a9ccff',
          300: '#6fb0ff',
          400: '#00a3fe', // cian del logo
          500: '#0060fc', // azul medio del logo
          600: '#0047e0',
          700: '#002efd', // azul profundo del logo
          800: '#0025c4',
          900: '#001c8f',
          950: '#00114f',
        },
        /** Neutros de superficie para el tema oscuro del sitio público */
        ink: {
          50: '#f4f7fb',
          900: '#11141c',
          950: '#0d1017',
          1000: '#080a0f',
        },
        /**
         * Alias heredados. Se mantienen para no romper las vistas
         * existentes, pero ahora apuntan a la nueva paleta azul.
         */
        'app-one': '#002EFD',
        'app-two': '#0060FC',
        'app-three': '#00A3FE',
      },
      boxShadow: {
        'brand': '0 15px 50px -12px rgba(0, 96, 252, .45)',
        'brand-sm': '0 6px 20px -6px rgba(0, 96, 252, .35)',
        'card': '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.1)',
        'card-lg': '0 4px 6px -2px rgba(16,24,40,.03), 0 12px 16px -4px rgba(16,24,40,.08)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #002EFD 0%, #0060FC 55%, #00A3FE 100%)',
      },
      animation: {
        progress: 'progress 1s infinite linear',
      },
      keyframes: {
        progress: {
          '0%': { transform: ' translateX(0) scaleX(0)' },
          '40%': { transform: 'translateX(0) scaleX(0.4)' },
          '100%': { transform: 'translateX(100%) scaleX(0.5)' },
        },
      },
      transformOrigin: {
        'left-right': '0% 50%',
      }
    },
  },
  plugins: [],
}
