/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
import { version } from "./package.json"

import react from "@vitejs/plugin-react-swc"
import viteTsconfigPaths from "vite-tsconfig-paths"

const BASE = "./"
const HASH = process.env.OMIT_HASH_FROM_MAIN_FILES ? "" : ".[hash]"
// We do not explicitly set the DEV_BUILD in any of our processes
// This is a convenience for developers for debugging purposes
const DEV_BUILD = Boolean(process.env.DEV_BUILD)
const IS_PROFILER_BUILD = Boolean(process.env.IS_PROFILER_BUILD)
// The URL of the backend server to proxy to:
// Can be changed to run against a remote server or different port:
const DEV_SERVER_BACKEND_URL =
  process.env.DEV_SERVER_BACKEND_URL || `http://localhost:8501`

/**
 * If this is a profiler build, we need to alias react-dom and scheduler to
 * their profiling versions so that we can use the React DevTools profiler
 * programmatically in tests.
 * @see https://fb.me/react-profiling
 */
const profilerAliases = IS_PROFILER_BUILD
  ? [
      {
        find: /^react-dom$/,
        replacement: "react-dom/profiling",
      },
      {
        find: "scheduler/tracing",
        replacement: "scheduler/tracing-profiling",
      },
    ]
  : []

// https://vitejs.dev/config/
export default defineConfig({
  base: BASE,
  define: {
    PACKAGE_METADATA: {
      version,
    },
  },
  plugins: [
    react({
      jsxImportSource: "@emotion/react",
      plugins: [["@swc/plugin-emotion", {}]],
    }),
    viteTsconfigPaths(),
  ],
  resolve: {
    alias: [
      // Alias react-syntax-highlighter to the cjs version to avoid
      // issues with the esm version causing a bug in rendering
      // See https://github.com/react-syntax-highlighter/react-syntax-highlighter/issues/565
      {
        find: "react-syntax-highlighter",
        replacement: "react-syntax-highlighter/dist/cjs/index.js",
      },
      ...profilerAliases,
    ],
  },
  server: {
    open: true,
    port: 3000,
    host: true,
    proxy: {
      // These endpoints need to be kept in sync with the endpoints in
      // lib/streamlit/web/server/server.py
      "^.*/_stcore/.*": {
        target: DEV_SERVER_BACKEND_URL,
        changeOrigin: true,
        ws: true,
      },
      "^.*/media/.*": {
        target: DEV_SERVER_BACKEND_URL,
        changeOrigin: true,
      },
      "^.*/component/.*": {
        target: DEV_SERVER_BACKEND_URL,
        changeOrigin: true,
      },
      "^.*/app/static/.*": {
        target: DEV_SERVER_BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "build",
    assetsDir: "static",
    sourcemap: DEV_BUILD,
    manifest: true,
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
    server: {
      // Want a Non-Dev port for testing
      port: 3001,
    },
  },
})
