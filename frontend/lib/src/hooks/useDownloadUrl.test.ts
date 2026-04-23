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

import { renderHook } from "@testing-library/react"

import useDownloadUrl from "./useDownloadUrl"

vi.mock("~lib/util/createDownloadLinkElement", () => ({
  default: vi.fn(() => {
    const link = document.createElement("a")
    link.click = vi.fn()
    return link
  }),
}))

describe("useDownloadUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
  })

  it("returns a no-op callback when url is null", async () => {
    const createDownloadLinkElement =
      await import("~lib/util/createDownloadLinkElement")
    const mockCreate = vi.mocked(createDownloadLinkElement.default)

    const { result } = renderHook(() => useDownloadUrl(null, "file.txt"))
    const downloadFn = result.current

    expect(() => downloadFn()).not.toThrow()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(document.body.querySelector("a")).toBeNull()
  })

  it("creates a link, appends it, clicks it, and removes it", async () => {
    const createDownloadLinkElement =
      await import("~lib/util/createDownloadLinkElement")
    const mockCreate = vi.mocked(createDownloadLinkElement.default)

    const mockLink = document.createElement("a")
    // Verify the link is in the DOM at the time click is called
    mockLink.click = vi.fn(() => {
      expect(document.body.contains(mockLink)).toBe(true)
    })
    mockCreate.mockReturnValue(mockLink)

    const { result } = renderHook(() =>
      useDownloadUrl("http://example.com/file.zip", "file.zip")
    )

    result.current()

    expect(mockCreate).toHaveBeenCalledWith({
      enforceDownloadInNewTab: false,
      url: "http://example.com/file.zip",
      filename: "file.zip",
    })
    expect(mockLink.click).toHaveBeenCalled()
    expect(document.body.contains(mockLink)).toBe(false)
  })
})
