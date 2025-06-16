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

import { pdfjs } from "react-pdf"

// Configure PDF.js worker using the local worker file
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "../assets/pdf.worker.min.mjs",
  import.meta.url
).toString()

// PDF.js options for cMaps and standard fonts
export const pdfOptions = {
  cMapUrl: "/src/assets/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/src/assets/standard_fonts/",
}

// Export pdfjs for additional configuration if needed
export { pdfjs }
