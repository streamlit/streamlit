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

import {
  configDefaults,
  coverageConfigDefaults,
  defineConfig,
} from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    // Include all packages that have a vite.config.ts file
    projects: ["*/vite.config.ts"],

    // Global coverage configuration
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: [
        "text-summary",
        "json-summary",
        "html",
        // Add full JSON report when COVERAGE_JSON=1 (used by AI coverage workflows)
        ...(process.env.COVERAGE_JSON ? (["json"] as const) : []),
      ],
      include: ["*/src/**/*.{js,jsx,ts,tsx}"],
      exclude: [
        "**/*.d.ts",
        "**/vitest.setup.ts",
        "lib/src/vendor/**",
        "eslint-plugin-streamlit-custom/src/**",
        "**/src/assets/**",
        "**/dist/**",
        "**/protobuf/**",
        "**/*.interface.ts",
        ...coverageConfigDefaults.exclude,
      ],
    },
    exclude: [
      ...configDefaults.exclude,
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*",
    ],
  },
})
