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

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Paths
const pdfjsDistPath = path.join(__dirname, "..", "node_modules", "pdfjs-dist")
const workerPath = path.join(pdfjsDistPath, "build", "pdf.worker.min.mjs")
const assetsDir = path.join(__dirname, "src", "assets")
const destWorkerPath = path.join(assetsDir, "pdf.worker.min.mjs")

// Create assets directory if it doesn't exist
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true })
}

console.log("Setting up PDF.js files...")

// Copy worker
console.log("Copying PDF.js worker...")
if (fs.existsSync(destWorkerPath)) {
  fs.unlinkSync(destWorkerPath)
}
fs.copyFileSync(workerPath, destWorkerPath)

console.log("PDF.js setup complete!")
console.log("Files copied:")
console.log("- Worker:", destWorkerPath)
console.log("")
console.log(
  "Note: CMaps and standard fonts have been excluded to reduce bundle size."
)
console.log("This optimizes for English/Latin-script PDFs.")
console.log(
  "Non-Latin characters (CJK, Arabic, Hebrew) may not display correctly."
)
console.log("PDFs without embedded fonts will fall back to system fonts.")
