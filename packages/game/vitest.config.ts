import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        tsconfigPaths: true,
    },
    test: {
        environment: "jsdom",
        include: ["**/*.{test,spec}.ts"],
        exclude: ["node_modules", "dist", ".git", "tests/e2e/**"],
    },
    plugins: [
        {
            name: "asset-loader",
            transform(code, id) {
                // Handle GLSL files
                if (id.endsWith(".glsl")) {
                    return `export default ${JSON.stringify(code)};`;
                }
                // Handle other asset files
                if (id.endsWith(".env") || id.endsWith(".dds") || id.endsWith(".babylon")) {
                    return `export default ${JSON.stringify("")};`;
                }
                return null;
            },
        },
    ],
    assetsInclude: ["**/*.glsl", "**/*.env", "**/*.dds", "**/*.babylon", "**/*.obj", "**/*.glb"],
});
