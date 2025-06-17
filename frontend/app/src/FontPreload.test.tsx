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

// Current hash for our preloaded font asset:
const SOURCE_SANS_REGULAR_HASH = "BsWL4Kly"

// Render a copy of index.html file to test
const HTML = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8")
document.documentElement.innerHTML = HTML.toString()

test("index.html preloads expected font with expected hash", () => {
  const preloadedFonts = document.querySelectorAll<HTMLLinkElement>(
    "link[rel='preload']"
  )

  // With variable font, we only preload one font
  // instead of 3 separate font weight files
  expect(preloadedFonts.length).toBe(1)

  // Get the preloaded font's href
  const fontElement = preloadedFonts.item(0)
  const fontHref = fontElement.href

  // 4 parts in full name split by "."
  // <font>-<weight>.otf.<fontHash>.woff2
  const fontFullName = fontHref.split("/").pop()
  const fontHash = fontFullName ? fontFullName.split(".")[2] : ""
  expect(fontHash).toBe(SOURCE_SANS_REGULAR_HASH)
})
