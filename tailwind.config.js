module.exports = {
  mode: 'jit',
  purge: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  // darkMode: 'media', // or 'media' or 'class'
  darkMode: 'class', // or 'media' or 'class'
  // darkMode: true, // or 'media' or 'class'
  // darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {},
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
