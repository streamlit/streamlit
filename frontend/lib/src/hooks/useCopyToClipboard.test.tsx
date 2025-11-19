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

import { act, renderHook } from "@testing-library/react"

import { useCopyToClipboard } from "./useCopyToClipboard"

// Mock navigator.clipboard
const mockWriteText = vi.fn()
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
})

describe("useCopyToClipboard", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockWriteText.mockReset()
    mockWriteText.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("should copy text to clipboard and reset after timeout", async () => {
    const text = "Hello World"
    const timeout = 100
    const { result } = renderHook(() => useCopyToClipboard({ timeout }))

    expect(result.current.isCopied).toBe(false)

    // Perform copy
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      result.current.copyToClipboard(text)
    })

    expect(mockWriteText).toHaveBeenCalledWith(text)
    expect(result.current.isCopied).toBe(true)

    // Wait for timeout to reset
    act(() => {
      vi.advanceTimersByTime(timeout)
    })
    expect(result.current.isCopied).toBe(false)
  })

  it("should restart timeout on multiple rapid clicks", async () => {
    const text = "Hello World"
    const timeout = 200
    const { result } = renderHook(() => useCopyToClipboard({ timeout }))

    // First copy
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      result.current.copyToClipboard(text)
    })
    expect(result.current.isCopied).toBe(true)

    // Wait for half the timeout, then copy again
    act(() => {
      vi.advanceTimersByTime(timeout / 2)
    })
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      result.current.copyToClipboard(text)
    })
    expect(result.current.isCopied).toBe(true)

    // Wait for half the timeout again, then copy one more time
    act(() => {
      vi.advanceTimersByTime(timeout / 2)
    })
    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      result.current.copyToClipboard(text)
    })
    expect(result.current.isCopied).toBe(true)

    // Now wait for the full timeout from the last copy
    // Should still be copied after the original timeout would have expired
    act(() => {
      vi.advanceTimersByTime(timeout / 2)
    })
    expect(result.current.isCopied).toBe(true)

    // But should reset after the full timeout from the last copy
    act(() => {
      vi.advanceTimersByTime(timeout / 2)
    })
    expect(result.current.isCopied).toBe(false)

    expect(mockWriteText).toHaveBeenCalledTimes(3)
  })

  it("should handle clipboard write failure", async () => {
    const text = "Hello World"
    mockWriteText.mockRejectedValue(new Error("Clipboard write failed"))

    const { result } = renderHook(() => useCopyToClipboard())

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      result.current.copyToClipboard(text)
    })

    expect(result.current.isCopied).toBe(false)
  })

  it("should copy empty text", async () => {
    const { result } = renderHook(() => useCopyToClipboard())

    expect(result.current.isCopied).toBe(false)

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      result.current.copyToClipboard("")
    })

    expect(mockWriteText).toHaveBeenCalledWith("")
    expect(result.current.isCopied).toBe(true)
  })
})
