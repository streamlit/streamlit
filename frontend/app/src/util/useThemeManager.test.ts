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

import {
  AUTO_THEME_NAME,
  createPresetThemes,
  CUSTOM_THEME_NAME,
  darkTheme,
  LocalStore,
  setCachedTheme,
  ThemeConfig,
} from "@streamlit/lib"

import { useThemeManager } from "./useThemeManager"

const mockCustomThemeConfig = {
  primaryColor: "#1A6CE7",
  backgroundColor: "#FFFFFF",
  secondaryBackgroundColor: "#F5F5F5",
  textColor: "#1A1D21",
  // Option is deprecated, but we still test to ensure backwards compatibility:
  widgetBackgroundColor: "#FFFFFF",
  // Option is deprecated, but we still test to ensure backwards compatibility:
  widgetBorderColor: "#D3DAE8",
  // Option is deprecated, but we still test to ensure backwards compatibility:
  skeletonBackgroundColor: "#CCDDEE",
  fontFaces: [
    {
      family: "Inter",
      url: "https://rsms.me/inter/font-files/Inter-Regular.woff2?v=3.19",
      weight: 400,
    },
  ],
}

describe("useThemeManager", () => {
  beforeEach(() => {
    // sourced from:
    // https://jestjs.io/docs/en/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it("updates the theme", () => {
    const { result } = renderHook(() => useThemeManager())
    const [themeManager] = result.current

    act(() => {
      themeManager.setTheme(darkTheme)
    })

    const [themeManager2] = result.current
    const updatedTheme: ThemeConfig = themeManager2.activeTheme

    expect(updatedTheme.name).toBe("Dark")

    const updatedLocalStorage = JSON.parse(
      window.localStorage.getItem(LocalStore.ACTIVE_THEME) || ""
    )

    expect(updatedLocalStorage.name).toBe("Dark")
  })

  it("does not save Auto theme", () => {
    const { result } = renderHook(() => useThemeManager())
    const [themeManager] = result.current

    act(() => {
      themeManager.setTheme(darkTheme)
    })

    const [themeManager2] = result.current

    act(() => {
      themeManager2.setTheme({
        ...darkTheme,
        name: AUTO_THEME_NAME,
      })
    })

    const updatedLocalStorage = window.localStorage.getItem(
      LocalStore.ACTIVE_THEME
    )

    expect(updatedLocalStorage).toBe(null)
  })

  it("updates availableThemes", () => {
    const { result } = renderHook(() => useThemeManager())
    const [themeManager] = result.current

    const initialThemes = themeManager.availableThemes

    act(() => {
      themeManager.addThemes([darkTheme])
      themeManager.addThemes([darkTheme])
    })

    const [themeManager2] = result.current
    const newThemes = themeManager2.availableThemes

    // Should only have added one theme despite multiple calls adding themes.
    expect(newThemes.length).toBe(initialThemes.length + 1)
  })

  it("sets the cached theme as the default theme if one is set", () => {
    setCachedTheme(darkTheme)

    const { result } = renderHook(() => useThemeManager())
    const [themeManager] = result.current
    const { activeTheme, availableThemes } = themeManager

    expect(activeTheme.name).toBe(darkTheme.name)
    expect(availableThemes.length).toBe(createPresetThemes().length)
  })

  it("includes a custom theme as an available theme if one is cached", () => {
    setCachedTheme({
      ...darkTheme,
      name: CUSTOM_THEME_NAME,
    })

    const { result } = renderHook(() => useThemeManager())
    const [themeManager] = result.current
    const { activeTheme, availableThemes } = themeManager

    expect(activeTheme.name).toBe(CUSTOM_THEME_NAME)
    expect(availableThemes.length).toBe(createPresetThemes().length + 1)
  })

  it("handles custom theme sent from Host", () => {
    const { result } = renderHook(() => useThemeManager())
    const [themeManager, fontFaces] = result.current

    expect(fontFaces).toHaveLength(0)

    act(() => {
      themeManager.setImportedTheme(mockCustomThemeConfig)
    })

    const [themeManager2, fontFaces2] = result.current

    const updatedTheme: ThemeConfig = themeManager2.activeTheme

    expect(updatedTheme.name).toBe(CUSTOM_THEME_NAME)
    expect(updatedTheme.emotion.colors.primary).toBe(
      mockCustomThemeConfig.primaryColor
    )

    expect(fontFaces2).toHaveLength(1)
    expect(fontFaces2).toEqual(mockCustomThemeConfig.fontFaces)
  })
})
