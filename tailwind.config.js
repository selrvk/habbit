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
        bg:     "#4B2E2B",   
        mid:    "#6B3A2A",   
        card:   "#8C5A3C",   
        accent: "#C08552",   
        cream:  "#FFF8F0",   
      },
      fontFamily: {
        jua:      ["Jua-Regular"],
        dynapuff: ["DynaPuff-Regular"],
      },
    },
  },
  plugins: [],
};