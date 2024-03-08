/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"
import viteTsconfigPaths from "vite-tsconfig-paths"
import { default as checker } from "vite-plugin-checker"

import path from "path"

const BASE = "./"
const HASH = process.env.OMIT_HASH_FROM_MAIN_FILES ? "" : ".[hash]"

// https://vitejs.dev/config/
export default defineConfig({
  base: BASE,
  plugins: [
    react({
      jsxImportSource: "@emotion/react",
      plugins: [["@swc/plugin-emotion", {}]],
    }),
    viteTsconfigPaths(),
    // this plugin checks for type errors on a separate process
    checker({
      typescript: true,
    }),
  ],
  resolve: {
    alias: {
      "@streamlit/lib/src": path.resolve(__dirname, "../lib/src"),
      "@streamlit/lib": path.resolve(__dirname, "../lib/src"),
    },
  },
  server: {
    open: true,
    port: 3000,
  },
  build: {
    outDir: "build",
    assetsDir: "static",
    rollupOptions: {
      output: {
        // Customize the chunk file naming pattern to match static/js/[name].[hash].js
        chunkFileNames: `static/js/[name]${HASH}.js`,
        entryFileNames: `static/js/[name]${HASH}.js`,
        // Ensure assetFileNames is also configured if you're handling asset files
        assetFileNames: assetInfo => {
          if (assetInfo.name?.endsWith(".css")) {
            // For CSS files, place them in the /static/css/ directory
            return `static/css/[name]${HASH}[extname]`
          }

          // For other assets, use the /static/media/ directory
          return `static/media/[name]${HASH}[extname]`
        },
      },
    },
  },
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === "js" && process.env.OVERRIDE_PUBLIC_PATH) {
        return {
          runtime: `(window.__WEBPACK_PUBLIC_PATH_OVERRIDE || "/") + ${JSON.stringify(
            filename
          )}`,
        }
      }

      return { relative: true }
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
    coverage: {
      reporter: ["text", "json", "html"],
      include: ["src/**/*"],
      exclude: [],
    },
    server: {
      // Want a Non-Dev port for testing
      port: 3001,
    },
  },
})
