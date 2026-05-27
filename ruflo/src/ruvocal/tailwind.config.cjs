const defaultTheme = require("tailwindcss/defaultTheme");
const colors = require("tailwindcss/colors");

/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: "class",
	mode: "jit",
	content: ["./src/**/*.{html,js,svelte,ts}"],
	theme: {
		extend: {
			colors: {
				gray: {
					600: "#2a3040",
					700: "#1e2435",
					800: "#151a2a",
					900: "#0d1225",
					950: "#0a0e1a",
				},
				godoman: {
					green: "#00d084",
					purple: "#9b51e0",
					blue: "#227ec5",
				},
			},
			fontSize: {
				xxs: "0.625rem",
				smd: "0.94rem",
			},
		},
	},
	plugins: [
		require("tailwind-scrollbar")({ nocompatible: true }),
		require("@tailwindcss/typography"),
	],
};
