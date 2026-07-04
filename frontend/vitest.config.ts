import { defineConfig, mergeConfig } from "vitest/config"
import viteConfig from "./vite.config"

export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            globals: true,
            environment: "jsdom",
            setupFiles: "./src/test/setup.ts",
            coverage: {
                provider: "v8",
                include: [
                    "src/hooks/**/*.ts",
                    "src/lib/**/*.ts",
                    "src/services/**/*.ts",
                    "src/store/**/*.ts",
                    "src/utils/**/*.ts",
                ],
                exclude: [
                    "src/mocks/**/*.ts",
                    "src/types/**/*.ts",
                    "src/lib/map-config.ts",
                    "src/hooks/use-map-events.ts",
                    "src/hooks/use-map-init.ts",
                    "src/hooks/use-map-layers.ts",
                    "src/hooks/use-map-style.ts",
                ],
                thresholds: {
                    statements: 100,
                    branches: 100,
                    functions: 100,
                    lines: 100,
                }
            }
        },
    })
)
