import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

/**
 * Config Tailwind.
 *
 * - `darkMode: 'media'` : le thème suit uniquement le réglage système iOS,
 *   pas de toggle manuel (conforme au cahier des charges).
 * - `accent` est une couleur pilotée par une variable CSS (--color-accent)
 *   définie au runtime, pour rester changeable depuis les Réglages sans
 *   reconstruire l'app.
 * - Le plugin local ajoute des utilitaires .pt-safe/.pb-safe/etc. pour
 *   respecter les safe areas iPhone (encoche, home indicator).
 */
const config: Config = {
  darkMode: 'media',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
  plugins: [
    plugin((api) => {
      api.addUtilities({
        '.pt-safe': { paddingTop: 'env(safe-area-inset-top)' },
        '.pb-safe': { paddingBottom: 'env(safe-area-inset-bottom)' },
        '.pl-safe': { paddingLeft: 'env(safe-area-inset-left)' },
        '.pr-safe': { paddingRight: 'env(safe-area-inset-right)' },
      });
    }),
  ],
};

export default config;
