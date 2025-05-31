const plugin = require('tailwindcss/plugin')

const INDENT = 28

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [`src/**/*.{tsx,css,ts}`],
  plugins: [
    plugin(function ({ addVariant }) {
      addVariant('child', '& > *')
      addVariant('ancestor', '& *')
    }),
  ],
  corePlugins: {
    preflight: false,
  },
  important: '.time-ruler',
  theme: {
    extend: {
      padding: {
        indent: INDENT,
      },
      margin: {
        indent: INDENT,
      },
      width: {
        indent: INDENT,
      },
      minWidth: {
        indent: INDENT,
      },
      minHeight: {
        indent: INDENT,
        line: 'var(--font-text-size)',
      },
      maxHeight: {
        line: 'var(--font-text-size)',
      },
      lineHeight: {
        line: 'var(--line-height-normal)',
      },
      height: {
        line: 'calc(var(--line-height-normal) * 1em)',
      },
      fontSize: {
        base: 'var(--font-text-size)',
      },
      fontFamily: {
        menu: 'var(--font-interface)',
        serif: 'var(--font-text)',
        sans: 'var(--font-text)',
      },
      borderRadius: {
        icon: 'var(--clickable-icon-radius)',
        checkbox: 'var(--checkbox-radius)',
      },
      colors: {
        primary: 'var(--background-primary)',
        code: 'var(--code-background)',
        error: 'var(--background-modifier-error)',
        border: 'var(--background-modifier-border)',
        hover: 'var(--background-modifier-hover)',
        selection: 'var(--text-selection)',
        normal: 'var(--text-normal)',
        muted: 'var(--text-muted)',
        faint: 'var(--text-faint)',
        accent: 'var(--text-accent)',
        divider: 'var(--divider-color)',
      },
      screens: {
        mobile: { raw: '(hover: none)' },
        mouse: { raw: '(hover: hover)' },
      },
    },
  },
}
