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

import { preloadIconFont } from "./preloadIconFont"

/** jsdom doesn't implement the CSS Font Loading API, so each test installs one. */
const mockFontsLoad = (load: FontFaceSet["load"]): void => {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { load },
  })
}

describe("preloadIconFont", () => {
  afterEach(() => {
    // Drops the per-test document.fonts override, so later tests see jsdom
    // without the Font Loading API again.
    Reflect.deleteProperty(document, "fonts")
    vi.restoreAllMocks()
  })

  it("requests the Material Symbols font face without logging a warning", async () => {
    const warn = vi.spyOn(getLogger("preloadIconFont"), "warn")
    const load = vi.fn().mockResolvedValue([])
    mockFontsLoad(load)

    preloadIconFont()

    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith('1em "Material Symbols Rounded"')
    await load.mock.results[0]?.value
    expect(warn).not.toHaveBeenCalled()
  })

  it("logs a warning instead of rejecting when the download fails", async () => {
    const warn = vi.spyOn(getLogger("preloadIconFont"), "warn")
    const error = new DOMException("A network error occurred.", "NetworkError")
    mockFontsLoad(vi.fn().mockRejectedValue(error))

    expect(() => preloadIconFont()).not.toThrow()

    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        "Failed to load the Material Symbols icon font:",
        error
      )
    )
  })
})
