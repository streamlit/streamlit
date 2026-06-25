/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

import path from "path"

// We do not explicitly set the DEV_BUILD in any of our processes
// This is a convenience for developers for debugging purposes
const DEV_BUILD = Boolean(process.env.DEV_BUILD)
// DEV_WATCH is used to simplify development of the library
// to speed up rebuilds for development of Streamlit
const DEV_WATCH = Boolean(process.env.DEV_WATCH)

// https://vitejs.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    react({
      jsxImportSource: "@emotion/react",
      plugins: [["@swc/plugin-emotion", {}]],
    }),
    // Skip DTS generation in dev mode - types resolve from source via tsconfig paths
    ...(!DEV_WATCH
      ? [
          dts({
            insertTypesEntry: true,
            // Keep declaration emit on a separate tsconfig so normal typechecking can
            // still resolve sibling workspace source without pulling those files into
            // the build root under TypeScript 6.
            tsconfigPath: path.resolve(__dirname, "tsconfig.build.json"),
          }),
        ]
      : []),
  ],
  build: {
    outDir: "dist",
    sourcemap: DEV_BUILD || DEV_WATCH,
    reportCompressedSize: false,
    lib: {
      // Specify the entry point of your library
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "@streamlit/lib", // Replace with your library's name
      fileName: format => `streamlit-lib.${format}.js`,
      // For development, only build es format since that is what Streamlit uses.
      // DEV_WATCH is intentionally workspace-only: consumers in the monorepo
      // use the ESM entry (import/module), so missing CJS/UMD outputs are fine.
      formats: DEV_WATCH ? ["es"] : ["es", "umd", "cjs"],
    },
    rolldownOptions: {
      input: "src/index.ts",
      // Externalize dependencies that shouldn't be bundled into your library
      external: ["react", "react-dom"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "~lib": path.resolve(__dirname, "../lib/src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    css: true,
    reporters: ["verbose"],
    setupFiles: ["../vitest.setup.ts"],
    deps: {
      optimizer: {
        web: {
          include: ["vitest-canvas-mock"],
        },
      },
    },
  },
})
