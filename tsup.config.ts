import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["./src/index.ts"],
	clean: true,
	dts: {
		compilerOptions: {
			composite: false,
		},
	},
	format: ["esm", "cjs"],
});
