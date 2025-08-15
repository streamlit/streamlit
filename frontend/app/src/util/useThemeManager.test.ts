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
  headingFont: "playwrite-cc-za",
  fontFaces: [
    {
      family: "Inter",
      url: "https://rsms.me/inter/font-files/Inter-Regular.woff2?v=3.19",
      weight: 400,
    },
  ],
  fontSources: [
    {
      configName: "headingFont",
      sourceUrl: "https://use.typekit.net/eor5wum.css",
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

  it("handles a font source", () => {
    const { result } = renderHook(() => useThemeManager())
    const [themeManager] = result.current

    act(() => {
      themeManager.setImportedTheme(mockCustomThemeConfig)
    })

    // Check that the font source link has been added to the DOM
    const fontSourceLinks = document.head.querySelectorAll("link")
    expect(fontSourceLinks).toHaveLength(1)

    const headingFontLink = document.getElementById(
      "headingFont"
    ) as HTMLLinkElement
    expect(headingFontLink).not.toBeNull()
    expect(headingFontLink.href).toBe("https://use.typekit.net/eor5wum.css")
    expect(headingFontLink.rel).toBe("stylesheet")
    expect(headingFontLink.id).toBe("headingFont")
  })

  it("handles multiple font sources and replaces existing ones", () => {
    const { result } = renderHook(() => useThemeManager())
    const [themeManager] = result.current

    // First, set a theme with multiple font sources
    const multiSourceThemeConfig = {
      ...mockCustomThemeConfig,
      fontSources: [
        {
          configName: "font",
          sourceUrl:
            "https://fonts.googleapis.com/css2?family=Inter&display=swap",
        },
        {
          configName: "codeFont",
          sourceUrl:
            "https://fonts.googleapis.com/css2?family=Roboto+Mono&display=swap",
        },
        {
          configName: "headingFont",
          sourceUrl: "https://use.typekit.net/eor5wum.css",
        },
      ],
    }

    act(() => {
      themeManager.setImportedTheme(multiSourceThemeConfig)
    })

    // Check that all font source links have been added to the DOM
    const fontSourceLinks = document.head.querySelectorAll("link")
    expect(fontSourceLinks).toHaveLength(3)

    const bodyFontLink = document.getElementById("font") as HTMLLinkElement
    expect(bodyFontLink).not.toBeNull()
    expect(bodyFontLink.href).toBe(
      "https://fonts.googleapis.com/css2?family=Inter&display=swap"
    )

    const codeFontLink = document.getElementById("codeFont") as HTMLLinkElement
    expect(codeFontLink).not.toBeNull()
    expect(codeFontLink.href).toBe(
      "https://fonts.googleapis.com/css2?family=Roboto+Mono&display=swap"
    )

    const headingFontLink = document.getElementById(
      "headingFont"
    ) as HTMLLinkElement
    expect(headingFontLink).not.toBeNull()
    expect(headingFontLink.href).toBe("https://use.typekit.net/eor5wum.css")

    // Now update with a new theme that replaces the headingFont source
    const updatedThemeConfig = {
      ...mockCustomThemeConfig,
      fontSources: [
        {
          configName: "headingFont",
          sourceUrl:
            "https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap",
        },
      ],
    }

    act(() => {
      themeManager.setImportedTheme(updatedThemeConfig)
    })

    // Check that the old headingFont link was replaced
    const updatedHeadingFontLink = document.getElementById(
      "headingFont"
    ) as HTMLLinkElement
    expect(updatedHeadingFontLink).not.toBeNull()
    expect(updatedHeadingFontLink.href).toBe(
      "https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap"
    )

    // The previous font and codeFont links should still exist (not replaced)
    expect(document.getElementById("font")).not.toBeNull()
    expect(document.getElementById("codeFont")).not.toBeNull()
  })
})
