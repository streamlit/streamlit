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

import { getLogger } from "loglevel"

import { fonts } from "@streamlit/lib"

const LOG = getLogger("preloadIconFont")

/**
 * Starts downloading the Material Symbols icon font before any icon renders.
 *
 * Browsers request an `@font-face` font only once text using it is laid out.
 * For the icon font, that happens only after the websocket has connected and
 * the app script has sent its first icon, and the font's `font-display: block`
 * keeps every icon invisible until the file arrives. Calling this at startup
 * downloads the font during that wait instead of after it.
 *
 * `document.fonts.load()` fetches only faces that are already declared. The
 * icon face is declared in time because index.tsx statically imports
 * `ThemedApp` → `App`, which imports `fonts.css`. Lazy-loading `App` would
 * silently turn this call into a no-op.
 *
 * This uses `document.fonts.load()` instead of a `<link rel="preload">` in
 * index.html, like the one for Source Sans, because:
 * - The update-emojis-material-icons workflow replaces this font every few
 *   weeks, which changes its hashed file name. Only a Vite build can compute
 *   that name, so a hard-coded preload would silently go stale.
 * - Starting after the entry bundle has loaded keeps the download from
 *   competing with the JS the app needs to render. A preload's
 *   `fetchpriority="low"` can't promise that over HTTP/1.1: it only delays
 *   when the request is sent, and the download then shares bandwidth.
 */
export function preloadIconFont(): void {
  document.fonts
    .load(`1em "${fonts.materialIcons}"`)
    .catch((error: unknown) => {
      LOG.warn("Failed to load the Material Symbols icon font:", error)
    })
}
