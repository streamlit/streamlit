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
import dts from "vite-plugin-dts"
import viteTsconfigPaths from "vite-tsconfig-paths"

import path from "path"

const DEV_BUILD = Boolean(process.env.DEV_BUILD)
const DEV_WATCH = Boolean(process.env.DEV_WATCH)

const EXTERNAL_DEPENDENCIES = [
  "apache-arrow",
  "hoist-non-react-statics",
  "react",
  "react-dom",
  "react/jsx-runtime",
]

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
      name: "streamlit-component-lib",
      formats: ["es"],
      fileName: () => "index.js",
    },
    rolldownOptions: {
      external: EXTERNAL_DEPENDENCIES,
    },
  },
  test: {
    globals: true,
    clearMocks: true,
    environment: "jsdom",
    css: true,
    reporters: ["verbose"],
    setupFiles: ["../vitest.setup.ts", "./src/setupTests.ts"],
    deps: {
      optimizer: {
        web: {
          include: ["vitest-canvas-mock"],
        },
      },
    },
  },
})
