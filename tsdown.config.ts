import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["./src/index.ts", "./src/kaito.ts", "./src/express.ts"],
	clean: true,
	dts: {
		compilerOptions: {
			composite: false,
		},
	},
	format: ["esm", "cjs"],
	platform: "neutral",
	target: false,
	checks: {
		legacyCjs: false,
	},
	outExtensions({ format }) {
		if (format === "cjs") {
			return { js: ".cjs", dts: ".d.cts" };
		}

		return { js: ".js", dts: ".d.ts" };
	},
});
