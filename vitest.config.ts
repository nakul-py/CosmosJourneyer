import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        include: ["**/*.{test,spec}.ts"],
        exclude: ["node_modules", "dist", ".git", "tests/e2e/**"]
    }
});
