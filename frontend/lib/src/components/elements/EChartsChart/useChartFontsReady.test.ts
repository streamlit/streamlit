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

import { act, renderHook } from "@testing-library/react"

import { mockTheme } from "~lib/mocks/mockTheme"

import {
  CHART_FONT_TIMEOUT_MS,
  resetChartFontsForTests,
  useChartFontsReady,
} from "./useChartFontsReady"

const theme = mockTheme.emotion

interface MockFontFaceSet {
  check: ReturnType<typeof vi.fn>
  load: ReturnType<typeof vi.fn>
}

function mockFonts(fonts: MockFontFaceSet | undefined): void {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: fonts,
  })
}

describe("useChartFontsReady", () => {
  afterEach(() => {
    mockFonts(undefined)
    resetChartFontsForTests()
    vi.useRealTimers()
  })

  it("is ready without a FontFaceSet", () => {
    mockFonts(undefined)

    const { result } = renderHook(() => useChartFontsReady(theme, true))

    expect(result.current).toBe(true)
  })

  it("doesn't wait for a chart without the Streamlit theme", () => {
    const fonts = { check: vi.fn(() => false), load: vi.fn() }
    mockFonts(fonts)

    const { result } = renderHook(() => useChartFontsReady(theme, false))

    expect(result.current).toBe(true)
    expect(fonts.check).not.toHaveBeenCalled()
    expect(fonts.load).not.toHaveBeenCalled()
  })

  it("is ready on the first render when the fonts are loaded", () => {
    const fonts = { check: vi.fn(() => true), load: vi.fn() }
    mockFonts(fonts)

    const { result } = renderHook(() => useChartFontsReady(theme, true))

    expect(result.current).toBe(true)
    expect(fonts.check).toHaveBeenCalledWith(
      `${theme.fontWeights.normal} 1em ${theme.genericFonts.bodyFont}`
    )
    expect(fonts.load).not.toHaveBeenCalled()
  })

  it("waits for loading fonts", async () => {
    let resolveLoad: () => void = () => undefined
    const fonts = {
      check: vi.fn(() => false),
      load: vi.fn(
        () =>
          new Promise<void>(resolve => {
            resolveLoad = resolve
          })
      ),
    }
    mockFonts(fonts)

    const { result } = renderHook(() => useChartFontsReady(theme, true))

    expect(result.current).toBe(false)
    expect(fonts.load).toHaveBeenCalledWith(
      `${theme.fontWeights.normal} 1em ${theme.genericFonts.bodyFont}`
    )

    await act(async () => {
      resolveLoad()
      await Promise.resolve()
    })

    expect(result.current).toBe(true)
  })

  it("renders with the fallback when a font fails to load", async () => {
    const fonts = {
      check: vi.fn(() => false),
      load: vi.fn(() => Promise.reject(new Error("network"))),
    }
    mockFonts(fonts)

    const { result } = renderHook(() => useChartFontsReady(theme, true))

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current).toBe(true)
  })

  it("keeps waiting for the other fonts when one fails", async () => {
    let resolveHeading: () => void = () => undefined
    const fonts = {
      check: vi.fn(() => false),
      load: vi.fn((spec: string) =>
        spec.includes("BodyFont")
          ? Promise.reject(new Error("network"))
          : new Promise<void>(resolve => {
              resolveHeading = resolve
            })
      ),
    }
    mockFonts(fonts)
    const twoFonts = {
      ...theme,
      genericFonts: {
        ...theme.genericFonts,
        bodyFont: "BodyFont, sans-serif",
        headingFont: "HeadingFont, serif",
      },
    }

    const { result } = renderHook(() => useChartFontsReady(twoFonts, true))

    await act(async () => {
      await Promise.resolve()
    })
    expect(fonts.load).toHaveBeenCalledTimes(2)
    // The heading font is still loading, so its widths aren't known yet.
    expect(result.current).toBe(false)

    await act(async () => {
      resolveHeading()
      await Promise.resolve()
    })
    expect(result.current).toBe(true)
  })

  it("stops waiting after the timeout and stays ready", () => {
    vi.useFakeTimers()
    const fonts = {
      check: vi.fn(() => false),
      // Never settles, like a font host that doesn't answer.
      load: vi.fn(() => new Promise<void>(vi.fn())),
    }
    mockFonts(fonts)

    const { result, rerender } = renderHook(() =>
      useChartFontsReady(theme, true)
    )

    act(() => {
      vi.advanceTimersByTime(CHART_FONT_TIMEOUT_MS - 1)
    })
    expect(result.current).toBe(false)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe(true)

    // A later render never holds back a chart that is already showing.
    rerender()
    expect(result.current).toBe(true)

    // A chart mounted later doesn't wait again: the fallback widths are
    // already cached for the page.
    const later = renderHook(() => useChartFontsReady(theme, true))
    expect(later.result.current).toBe(true)
    expect(fonts.load).toHaveBeenCalledTimes(1)
  })

  it("waits again for a different font set", async () => {
    const fonts = {
      check: vi.fn(() => false),
      load: vi.fn(() => Promise.resolve()),
    }
    mockFonts(fonts)

    const first = renderHook(() => useChartFontsReady(theme, true))
    await act(async () => {
      await Promise.resolve()
    })
    expect(first.result.current).toBe(true)

    const otherFonts = {
      ...theme,
      genericFonts: { ...theme.genericFonts, bodyFont: "Geist, sans-serif" },
    }
    const second = renderHook(() => useChartFontsReady(otherFonts, true))
    expect(second.result.current).toBe(false)
    expect(fonts.load).toHaveBeenCalledWith(
      `${theme.fontWeights.normal} 1em Geist, sans-serif`
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(second.result.current).toBe(true)
  })
})
