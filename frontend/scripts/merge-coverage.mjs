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

/**
 * Merge coverage reports from all packages into a single report.
 * This script is used after running `turbo run testCoverage` to aggregate
 * coverage data from individual packages.
 */

import { createCoverageMap } from "istanbul-lib-coverage"
import { createContext } from "istanbul-lib-report"
import reports from "istanbul-reports"
import { readFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, "..")
const outputDir = join(rootDir, "coverage")

// List of packages that may have coverage reports
const packages = [
  "app",
  "charts",
  "chat",
  "component-v2-lib",
  "connection",
  "core",
  "data-utils",
  "dataframe",
  "eslint-plugin-streamlit-custom",
  "lib",
  "render-tree",
  "shared",
  "theme",
  "utils",
]

function findCoverageFiles() {
  const coverageFiles = []

  for (const pkg of packages) {
    const coverageFile = join(rootDir, pkg, "coverage", "coverage-final.json")
    if (existsSync(coverageFile)) {
      coverageFiles.push({ pkg, file: coverageFile })
    }
  }

  return coverageFiles
}

function mergeCoverage() {
  const coverageFiles = findCoverageFiles()

  if (coverageFiles.length === 0) {
    console.log("No coverage files found. Run `yarn testCoverage` first.")
    process.exit(0)
  }

  console.log(`Found ${coverageFiles.length} coverage files:`)
  coverageFiles.forEach(({ pkg }) => console.log(`  - ${pkg}`))

  // Create merged coverage map
  const coverageMap = createCoverageMap({})

  for (const { pkg, file } of coverageFiles) {
    try {
      const coverage = JSON.parse(readFileSync(file, "utf-8"))
      coverageMap.merge(coverage)
      console.log(`Merged coverage from ${pkg}`)
    } catch (error) {
      console.error(`Error reading coverage from ${pkg}:`, error.message)
    }
  }

  // Clean and create output directory
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true })
  }
  mkdirSync(outputDir, { recursive: true })

  // Create report context
  const context = createContext({
    dir: outputDir,
    coverageMap,
    watermarks: {
      statements: [50, 80],
      functions: [50, 80],
      branches: [50, 80],
      lines: [50, 80],
    },
  })

  // Generate reports
  const reportTypes = ["text-summary", "json-summary", "html", "json"]

  for (const type of reportTypes) {
    try {
      const report = reports.create(type, {})
      report.execute(context)
      console.log(`Generated ${type} report`)
    } catch (error) {
      console.error(`Error generating ${type} report:`, error.message)
    }
  }

  console.log(`\nCoverage reports written to ${outputDir}`)
}

mergeCoverage()
