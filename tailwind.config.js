/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg:     "#4B2E2B",   // darkest brown — main background
        mid:    "#6B3A2A",   // mid brown — subtle separators / hover states
        card:   "#8C5A3C",   // card/surface brown
        accent: "#C08552",   // warm tan — buttons, highlights, borders
        cream:  "#FFF8F0",   // off-white — all text, light surfaces
      },
      fontFamily: {
        jua:      ["Jua-Regular"],
        dynapuff: ["DynaPuff-Regular"],
      },
    },
  },
  plugins: [],
};