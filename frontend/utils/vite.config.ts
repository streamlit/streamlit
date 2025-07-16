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
import dts from "vite-plugin-dts"
import viteTsconfigPaths from "vite-tsconfig-paths"

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
    viteTsconfigPaths(),
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    outDir: "dist",
    sourcemap: DEV_BUILD || DEV_WATCH,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "@streamlit/utils",
      fileName: format => `streamlit-utils.${format}.js`,
      // For development, only build es format since that is what Streamlit uses
      formats: DEV_WATCH ? ["es"] : ["es", "umd", "cjs"],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    css: true,
    reporters: ["verbose"],
    setupFiles: ["../vitest.setup.ts"],
  },
})
