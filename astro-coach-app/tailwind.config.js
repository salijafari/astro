/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./providers/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Vazirmatn-Regular", "System"],
        medium: ["Vazirmatn-Medium", "System"],
        semibold: ["Vazirmatn-SemiBold", "System"],
        bold: ["Vazirmatn-Bold", "System"],
      },
    },
  },
  plugins: [],
};
