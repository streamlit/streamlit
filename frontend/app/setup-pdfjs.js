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

import path from "node:path"
import fs from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

// Get the pdfjs-dist path
const pdfjsDistPath = path.dirname(require.resolve("pdfjs-dist/package.json"))

// Define source and destination paths
const cMapsDir = path.join(pdfjsDistPath, "cmaps")
const standardFontsDir = path.join(pdfjsDistPath, "standard_fonts")
const workerFile = path.join(pdfjsDistPath, "build", "pdf.worker.min.mjs")

// Define destination paths in src/assets directory
const assetsDir = path.join(process.cwd(), "src", "assets")
const destCMapsDir = path.join(assetsDir, "cmaps")
const destStandardFontsDir = path.join(assetsDir, "standard_fonts")
const destWorkerFile = path.join(assetsDir, "pdf.worker.min.mjs")

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true })
}

// Copy cMaps
console.log("Copying cMaps...")
if (fs.existsSync(destCMapsDir)) {
  fs.rmSync(destCMapsDir, { recursive: true })
}
fs.cpSync(cMapsDir, destCMapsDir, { recursive: true })

// Copy standard fonts
console.log("Copying standard fonts...")
if (fs.existsSync(destStandardFontsDir)) {
  fs.rmSync(destStandardFontsDir, { recursive: true })
}
fs.cpSync(standardFontsDir, destStandardFontsDir, { recursive: true })

// Copy worker file
console.log("Copying PDF.js worker...")
fs.cpSync(workerFile, destWorkerFile)

console.log("PDF.js files copied successfully!")
console.log("Files copied to:")
console.log("- cMaps:", destCMapsDir)
console.log("- Standard fonts:", destStandardFontsDir)
console.log("- Worker:", destWorkerFile)
