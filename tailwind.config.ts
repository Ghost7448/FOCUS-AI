import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: { colors: { brand: { 50:"#eff6ff",100:"#dbeafe",200:"#bfdbfe",500:"#2878c8",600:"#1769aa",700:"#123b65",900:"#0b2540" } } } },
  plugins: []
};
export default config;