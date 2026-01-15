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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useImagePreview } from "./useImagePreview"

describe("useImagePreview", () => {
  const mockCreateObjectURL = vi.fn()
  const mockRevokeObjectURL = vi.fn()

  beforeEach(() => {
    mockCreateObjectURL.mockReturnValue("blob:http://localhost/mock-blob-url")
    vi.stubGlobal("URL", {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockCreateObjectURL.mockClear()
    mockRevokeObjectURL.mockClear()
  })

  it("returns blob URL for image file", () => {
    const file = new File(["test"], "photo.jpg", { type: "image/jpeg" })

    const { result } = renderHook(() => useImagePreview(file, "photo.jpg"))

    expect(result.current).toBe("blob:http://localhost/mock-blob-url")
    expect(mockCreateObjectURL).toHaveBeenCalledWith(file)
  })

  it("returns null for non-image file", () => {
    const file = new File(["test"], "document.pdf", {
      type: "application/pdf",
    })

    const { result } = renderHook(() => useImagePreview(file, "document.pdf"))

    expect(result.current).toBeNull()
    expect(mockCreateObjectURL).not.toHaveBeenCalled()
  })

  it("returns null when file is undefined", () => {
    const { result } = renderHook(() =>
      useImagePreview(undefined, "photo.jpg")
    )

    expect(result.current).toBeNull()
    expect(mockCreateObjectURL).not.toHaveBeenCalled()
  })

  describe("blob URL memory management", () => {
    it("revokes blob URL on unmount to prevent memory leaks", () => {
      const file = new File(["test"], "photo.jpg", { type: "image/jpeg" })

      const { unmount } = renderHook(() => useImagePreview(file, "photo.jpg"))

      expect(mockRevokeObjectURL).not.toHaveBeenCalled()

      unmount()

      expect(mockRevokeObjectURL).toHaveBeenCalledWith(
        "blob:http://localhost/mock-blob-url"
      )
    })

    it("revokes old blob URL when file changes", () => {
      const file1 = new File(["test1"], "photo1.jpg", { type: "image/jpeg" })
      const file2 = new File(["test2"], "photo2.jpg", { type: "image/jpeg" })

      mockCreateObjectURL
        .mockReturnValueOnce("blob:http://localhost/mock-blob-url-1")
        .mockReturnValueOnce("blob:http://localhost/mock-blob-url-2")

      const { rerender, unmount } = renderHook(
        ({ file, filename }) => useImagePreview(file, filename),
        { initialProps: { file: file1, filename: "photo1.jpg" } }
      )

      expect(mockRevokeObjectURL).not.toHaveBeenCalled()

      rerender({ file: file2, filename: "photo2.jpg" })

      expect(mockRevokeObjectURL).toHaveBeenCalledWith(
        "blob:http://localhost/mock-blob-url-1"
      )

      // Clean up to avoid affecting other tests
      unmount()
    })
  })

  it("memoizes URL for the same file reference", () => {
    const file = new File(["test"], "photo.jpg", { type: "image/jpeg" })

    const { result, rerender } = renderHook(
      ({ file, filename }) => useImagePreview(file, filename),
      { initialProps: { file, filename: "photo.jpg" } }
    )

    const firstUrl = result.current

    rerender({ file, filename: "photo.jpg" })

    expect(result.current).toBe(firstUrl)
    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
  })
})
