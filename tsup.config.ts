import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["./src/index.ts", "./src/kaito.ts", "./src/express.ts"],
	clean: true,
	dts: {
		compilerOptions: {
			composite: false,
		},
	},
	format: ["esm", "cjs"],
	splitting: true,
});
