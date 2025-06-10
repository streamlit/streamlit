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

// Current hashes for our preloaded font assets:
const REGULAR_HASH = "BqTI-3mA"
const SEMI_BOLD_HASH = "BQV5CVwD"
const BOLD_HASH = "gn7Db9ke"

// Render a copy of index.html file to test
const HTML = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8")
document.documentElement.innerHTML = HTML.toString()

function getFontHref(index: number): string {
  const fontPreloadElements: NodeList | null = document.querySelectorAll(
    "link[rel='preload']"
  )
  const fontElement: HTMLLinkElement | null = fontPreloadElements.item(
    index
  ) as HTMLLinkElement
  return fontElement ? fontElement.href : ""
}

test("index.html preloads 3 expected fonts with expected hashes", () => {
  const expectedfontHashes = [REGULAR_HASH, SEMI_BOLD_HASH, BOLD_HASH]
  const preloadedFontsCount = document.querySelectorAll(
    "link[rel='preload']"
  ).length
  expect(preloadedFontsCount).toBe(3)

  for (let i = 0; i < preloadedFontsCount; i++) {
    const fontHref = getFontHref(i)
    const fontFullName = fontHref.split("/").pop()

    // 4 parts in full name split by "."
    // <font>-<weight>.otf.<fontHash>.woff2
    const fontHash = fontFullName ? fontFullName.split(".")[2] : ""
    expect(fontHash).toBe(expectedfontHashes[i])
  }
})
