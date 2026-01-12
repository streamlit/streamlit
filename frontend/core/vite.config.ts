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

import path from "path"

import dts from "vite-plugin-dts"
import viteTsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
  base: "./",
  plugins: [
    viteTsconfigPaths(),
    dts({
      insertTypesEntry: true,
      copyDtsFiles: false,
      skipDiagnostics: true,
    }),
  ],
  build: {
    outDir: "dist",
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "@streamlit/core",
      fileName: format => `streamlit-core.${format}.js`,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "@emotion/react",
        "@emotion/styled",
        "baseui",
        "styletron-react",
        "@streamlit/protobuf",
        "@streamlit/theme",
        "@streamlit/utils",
        "@streamlit/shared",
        "@streamlit/render-tree",
        "@streamlit/data-utils",
        "lodash-es",
      ],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["../vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
