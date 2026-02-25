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
import { defineConfig } from "vite"
import { analyzer } from "vite-bundle-analyzer"
import terminal from "vite-plugin-terminal"
import { version } from "./package.json"

import react from "@vitejs/plugin-react-swc"
import viteTsconfigPaths from "vite-tsconfig-paths"

const BASE = "./"
const HASH = process.env.OMIT_HASH_FROM_MAIN_FILES ? "" : ".[hash]"
// We do not explicitly set the DEV_BUILD in any of our processes
// This is a convenience for developers for debugging purposes
const DEV_BUILD = Boolean(process.env.DEV_BUILD)
const IS_PROFILER_BUILD = Boolean(process.env.IS_PROFILER_BUILD)
const ANALYZE_BUNDLE = Boolean(process.env.ANALYZE_BUNDLE)
// Enable terminal plugin to pipe browser console logs to terminal (for coding agents)
const DEBUG_TO_CONSOLE = Boolean(process.env.DEBUG_TO_CONSOLE)
// Default frontend dev server port for local development.
const DEFAULT_DEV_SERVER_PORT = 3000
// Valid TCP/UDP user port range.
const MIN_PORT = 1
const MAX_PORT = 65535

/**
 * Resolve the frontend dev-server port from environment variables.
 *
 * Precedence:
 * 1) VITE_PORT
 * 2) PORT
 *
 * If the value is missing, non-integer, or out of range, we safely fall back
 * to `DEFAULT_DEV_SERVER_PORT` to avoid passing invalid values to Vite.
 */
const getDevServerPort = (): number => {
  const rawPort = process.env.VITE_PORT ?? process.env.PORT
  if (!rawPort) {
    return DEFAULT_DEV_SERVER_PORT
  }

  const parsedPort = Number(rawPort)
  if (
    !Number.isInteger(parsedPort) ||
    parsedPort < MIN_PORT ||
    parsedPort > MAX_PORT
  ) {
    return DEFAULT_DEV_SERVER_PORT
  }

  return parsedPort
}
// Frontend dev server port used by Vite.
const DEV_SERVER_PORT = getDevServerPort()
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
export default defineConfig(({ command }) => ({
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
    // Log browser console output to terminal for debugging by coding agents
    // Enable with: DEBUG_TO_CONSOLE=1 make frontend-dev
    ...(command === "serve" && DEBUG_TO_CONSOLE
      ? [
          terminal({
            console: "terminal",
            output: ["terminal", "console"],
          }),
        ]
      : []),
    ...(ANALYZE_BUNDLE
      ? [
          analyzer({
            analyzerMode: "json",
            // NOTE: fileName is relative to the build output directory (outDir: "build").
            // "../bundle-analysis.json" will be created in the project root (frontend/app/bundle-analysis.json).
            fileName: "../bundle-analysis.json",
          }),
          analyzer({
            analyzerMode: "static",
            // NOTE: fileName is relative to the build output directory (outDir: "build").
            // "../bundle-analysis.html" will be created in the project root (frontend/app/bundle-analysis.html).
            fileName: "../bundle-analysis.html",
          }),
        ]
      : []),
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
      // Redirect old lodash to lodash-es to avoid duplication
      {
        find: "lodash",
        replacement: "lodash-es",
      },
      ...profilerAliases,
    ],
  },
  server: {
    open: true,
    port: DEV_SERVER_PORT,
    host: true,
    proxy: {
      // These endpoints need to be kept in sync with the endpoints in
      // lib/streamlit/web/server/server.py
      "^.*/_stcore/.*": {
        target: DEV_SERVER_BACKEND_URL,
        changeOrigin: true,
        ws: true,
      },
      // Use negative lookahead to avoid matching /static/media/* (Vite's font files)
      // while still matching /media/* and /basepath/media/* (backend user uploads)
      "^(?!.*/static/media).*/media/.*": {
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
      "^.*/auth/.*": {
        target: DEV_SERVER_BACKEND_URL,
        changeOrigin: true,
      },
      "^.*/oauth2callback": {
        target: DEV_SERVER_BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "build",
    assetsDir: "static",
    sourcemap: DEV_BUILD || ANALYZE_BUNDLE,
    manifest: true,
    rollupOptions: {
      output: {
        // Customize the chunk file naming pattern to match static/js/[name].[hash].js
        chunkFileNames: `static/js/[name]${HASH}.js`,
        entryFileNames: `static/js/[name]${HASH}.js`,
        // Ensure assetFileNames is also configured if you're handling asset files
        assetFileNames: assetInfo => {
          // For CSS files, place them in the /static/css/ directory
          if (assetInfo.name?.endsWith(".css")) {
            // If OMIT_HASH_FROM_MAIN_FILES is set, we don't want to include the
            // hash in the filename of the entry file at the minimum. There could
            // be other files with the same name that cause a conflict, which would
            // increment the entry file to index2.css, etc. This ensures the entry
            // file is named index.css in this case.
            if (
              assetInfo.names.includes("index.css") &&
              assetInfo.originalFileNames.includes("index.html")
            ) {
              return `static/css/[name]${HASH}[extname]`
            }

            // For chunk css files, include the hash in the filename.
            return `static/css/[name].[hash][extname]`
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
  },
}))
