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

import {
  AUTO_THEME_NAME,
  createPresetThemes,
  createTheme,
  CUSTOM_THEME_AUTO_NAME,
  CUSTOM_THEME_DARK_NAME,
  CUSTOM_THEME_LIGHT_NAME,
  CUSTOM_THEME_NAME,
  darkTheme,
  lightTheme,
  LocalStore,
  setCachedThemeSelection,
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

    expect(updatedLocalStorage).toBe("Dark")
  })

  it("saves Auto selection", () => {
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

    const updatedLocalStorage = JSON.parse(
      window.localStorage.getItem(LocalStore.ACTIVE_THEME) || ""
    )

    expect(updatedLocalStorage).toBe("System")
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

  it("recalibrates custom auto theme on system preference change", () => {
    let mediaChangeHandler: ((event: MediaQueryListEvent) => void) | undefined
    let prefersDark = false

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: prefersDark,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: (
          _event: string,
          handler: (e: MediaQueryListEvent) => void
        ) => {
          mediaChangeHandler = handler
        },
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    const { result } = renderHook(() => useThemeManager())
    const [themeManager] = result.current

    const customLight = {
      ...createTheme(CUSTOM_THEME_LIGHT_NAME, { primaryColor: "lightblue" }),
      displayName: "Light",
    }
    const customDark = {
      ...createTheme(CUSTOM_THEME_DARK_NAME, { primaryColor: "darkblue" }),
      displayName: "Dark",
    }
    const customAuto = {
      ...customLight,
      name: CUSTOM_THEME_AUTO_NAME,
      displayName: AUTO_THEME_NAME,
    }

    act(() => {
      themeManager.addThemes([customLight, customDark, customAuto], {
        keepPresetThemes: false,
      })
      themeManager.setTheme(customAuto)
    })

    const initialSelection = JSON.parse(
      window.localStorage.getItem(LocalStore.ACTIVE_THEME) || ""
    )
    expect(initialSelection).toBe("System")

    prefersDark = true
    act(() => {
      mediaChangeHandler?.({ matches: true } as MediaQueryListEvent)
    })

    expect(result.current[0].activeTheme.name).toBe(CUSTOM_THEME_AUTO_NAME)
    expect(result.current[0].activeTheme.emotion.colors.primary).toBe(
      customDark.emotion.colors.primary
    )
    expect(
      JSON.parse(window.localStorage.getItem(LocalStore.ACTIVE_THEME) || "")
    ).toBe("System")

    prefersDark = false
    act(() => {
      mediaChangeHandler?.({ matches: false } as MediaQueryListEvent)
    })

    expect(result.current[0].activeTheme.name).toBe(CUSTOM_THEME_AUTO_NAME)
    expect(result.current[0].activeTheme.emotion.colors.primary).toBe(
      customLight.emotion.colors.primary
    )
    expect(
      JSON.parse(window.localStorage.getItem(LocalStore.ACTIVE_THEME) || "")
    ).toBe("System")
  })

  it("recalculates custom auto when user switches back to System", () => {
    const prefersDark = false
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: prefersDark,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    const { result } = renderHook(() => useThemeManager())
    const [themeManager] = result.current

    const customLight = {
      ...createTheme(CUSTOM_THEME_LIGHT_NAME, { primaryColor: "lightblue" }),
      displayName: "Light",
    }
    const customDark = {
      ...createTheme(CUSTOM_THEME_DARK_NAME, { primaryColor: "darkblue" }),
      displayName: "Dark",
    }
    const customAuto = {
      ...customLight,
      name: CUSTOM_THEME_AUTO_NAME,
      displayName: AUTO_THEME_NAME,
    }

    act(() => {
      themeManager.addThemes([customLight, customDark, customAuto], {
        keepPresetThemes: false,
      })
      themeManager.setTheme(customDark)
      themeManager.setTheme(customAuto)
    })

    expect(result.current[0].activeTheme.name).toBe(CUSTOM_THEME_AUTO_NAME)
    expect(result.current[0].activeTheme.emotion.colors.primary).toBe(
      customLight.emotion.colors.primary
    )
    expect(
      JSON.parse(window.localStorage.getItem(LocalStore.ACTIVE_THEME) || "")
    ).toBe("System")
  })

  it("recalculates preset auto when user switches back to System", () => {
    const { result } = renderHook(() => useThemeManager())
    const [themeManager] = result.current

    act(() => {
      themeManager.setTheme(darkTheme)
    })

    act(() => {
      themeManager.setTheme({
        ...darkTheme,
        name: AUTO_THEME_NAME,
      })
    })

    const [themeManager2] = result.current
    expect(themeManager2.activeTheme.name).toBe(AUTO_THEME_NAME)
    expect(
      JSON.parse(window.localStorage.getItem(LocalStore.ACTIVE_THEME) || "")
    ).toBe("System")
  })

  it("recalibrates preset auto on system preference change", () => {
    let mediaChangeHandler: ((event: MediaQueryListEvent) => void) | undefined
    let prefersDark = false

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: prefersDark,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: (
          _event: string,
          handler: (e: MediaQueryListEvent) => void
        ) => {
          mediaChangeHandler = handler
        },
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    const { result } = renderHook(() => useThemeManager())
    const [themeManager] = result.current

    act(() => {
      themeManager.setTheme({
        ...darkTheme,
        name: AUTO_THEME_NAME,
      })
    })

    expect(result.current[0].activeTheme.name).toBe(AUTO_THEME_NAME)
    expect(
      JSON.parse(window.localStorage.getItem(LocalStore.ACTIVE_THEME) || "")
    ).toBe("System")

    prefersDark = true
    act(() => {
      mediaChangeHandler?.({ matches: true } as MediaQueryListEvent)
    })

    expect(result.current[0].activeTheme.name).toBe(AUTO_THEME_NAME)
    expect(result.current[0].activeTheme.emotion.colors.primary).toBe(
      darkTheme.emotion.colors.primary
    )
    expect(
      JSON.parse(window.localStorage.getItem(LocalStore.ACTIVE_THEME) || "")
    ).toBe("System")

    prefersDark = false
    act(() => {
      mediaChangeHandler?.({ matches: false } as MediaQueryListEvent)
    })

    expect(result.current[0].activeTheme.name).toBe(AUTO_THEME_NAME)
    expect(result.current[0].activeTheme.emotion.colors.primary).toBe(
      lightTheme.emotion.colors.primary
    )
    expect(
      JSON.parse(window.localStorage.getItem(LocalStore.ACTIVE_THEME) || "")
    ).toBe("System")
  })

  it("sets the cached theme as the default theme if one is set", () => {
    setCachedThemeSelection(darkTheme)

    const { result } = renderHook(() => useThemeManager())
    const [themeManager] = result.current
    const { activeTheme, availableThemes } = themeManager

    expect(activeTheme.name).toBe(darkTheme.name)
    expect(availableThemes.length).toBe(createPresetThemes().length)
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

  describe("setImportedTheme", () => {
    it("creates a custom theme with the correct name", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      act(() => {
        themeManager.setImportedTheme(mockCustomThemeConfig)
      })

      const [themeManager2] = result.current
      expect(themeManager2.activeTheme.name).toBe(CUSTOM_THEME_NAME)
    })

    it("applies theme colors correctly", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      act(() => {
        themeManager.setImportedTheme(mockCustomThemeConfig)
      })

      const [themeManager2] = result.current
      const { activeTheme } = themeManager2

      expect(activeTheme.emotion.colors.primary).toBe(
        mockCustomThemeConfig.primaryColor
      )
      expect(activeTheme.emotion.colors.bgColor).toBe(
        mockCustomThemeConfig.backgroundColor
      )
      expect(activeTheme.emotion.colors.secondaryBg).toBe(
        mockCustomThemeConfig.secondaryBackgroundColor
      )
      expect(activeTheme.emotion.colors.bodyText).toBe(
        mockCustomThemeConfig.textColor
      )
    })

    it("calls setFonts to handle font configuration", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      act(() => {
        themeManager.setImportedTheme(mockCustomThemeConfig)
      })

      const [, fontFaces, fontSources] = result.current

      // Verify fonts were set via setFonts
      expect(fontFaces).toEqual(mockCustomThemeConfig.fontFaces)
      expect(fontSources).toEqual({
        headingFont: "https://use.typekit.net/eor5wum.css",
      })
    })

    it("handles theme without font configuration", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      const themeWithoutFonts = {
        primaryColor: "#FF0000",
        backgroundColor: "#000000",
        secondaryBackgroundColor: "#222222",
        textColor: "#FFFFFF",
      }

      act(() => {
        themeManager.setImportedTheme(themeWithoutFonts)
      })

      const [themeManager2, fontFaces, fontSources] = result.current

      expect(themeManager2.activeTheme.name).toBe(CUSTOM_THEME_NAME)
      expect(themeManager2.activeTheme.emotion.colors.primary).toBe("#FF0000")
      // Font states should remain empty or at default values
      expect(fontFaces).toEqual([])
      expect(fontSources).toBeNull()
    })

    it("saves the imported theme to localStorage", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      act(() => {
        themeManager.setImportedTheme(mockCustomThemeConfig)
      })

      const savedTheme = JSON.parse(
        window.localStorage.getItem(LocalStore.ACTIVE_THEME) || ""
      )

      expect(savedTheme).toBe("System")
    })

    it("replaces the current theme completely", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      const firstTheme = {
        primaryColor: "#FF0000",
        backgroundColor: "#FFFFFF",
      }

      const secondTheme = {
        primaryColor: "#00FF00",
        backgroundColor: "#000000",
      }

      act(() => {
        themeManager.setImportedTheme(firstTheme)
      })

      const [themeManager2] = result.current
      expect(themeManager2.activeTheme.emotion.colors.primary).toBe("#FF0000")

      act(() => {
        themeManager2.setImportedTheme(secondTheme)
      })

      const [themeManager3] = result.current
      expect(themeManager3.activeTheme.emotion.colors.primary).toBe("#00FF00")
      expect(themeManager3.activeTheme.emotion.colors.bgColor).toBe("#000000")
    })
  })

  describe("setFonts", () => {
    it("handles a font source", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      act(() => {
        themeManager.setFonts(mockCustomThemeConfig)
      })

      // Test that useThemeManager returns the correct fontSources state
      const [, , fontSources] = result.current
      expect(fontSources).toEqual({
        headingFont: "https://use.typekit.net/eor5wum.css",
      })
    })

    it("handles provided font faces", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      act(() => {
        themeManager.setFonts(mockCustomThemeConfig)
      })

      // Test that useThemeManager returns the correct fontFaces state
      const [, fontFaces] = result.current
      expect(fontFaces).toEqual(mockCustomThemeConfig.fontFaces)
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
        themeManager.setFonts(multiSourceThemeConfig)
      })

      // Test that useThemeManager returns the correct fontSources state
      const [, , fontSources] = result.current
      expect(fontSources).toEqual({
        font: "https://fonts.googleapis.com/css2?family=Inter&display=swap",
        codeFont:
          "https://fonts.googleapis.com/css2?family=Roboto+Mono&display=swap",
        headingFont: "https://use.typekit.net/eor5wum.css",
      })
    })

    it("handles multiple font faces and replaces existing ones", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      // First, set a theme with multiple font faces
      const multiFaceThemeConfig = {
        ...mockCustomThemeConfig,
        fontFaces: [
          {
            family: "Corgi",
            url: "https://fonts.googleapis.com/css2?family=Inter&display=swap",
            weight: 400,
          },
          {
            family: "Roboto Mono",
            url: "https://fonts.googleapis.com/css2?family=Roboto+Mono&display=swap",
            weight: 400,
          },
          {
            family: "Playwrite CC ZA",
            url: "https://use.typekit.net/eor5wum.css",
            weight: 400,
          },
        ],
      }

      act(() => {
        themeManager.setFonts(multiFaceThemeConfig)
      })

      // Test that useThemeManager returns the correct fontFaces state
      const [, fontFaces] = result.current
      expect(fontFaces).toEqual(multiFaceThemeConfig.fontFaces)
    })

    it("handles font sources from both theme and sidebar", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      const themeWithSidebarFontSources = {
        ...mockCustomThemeConfig,
        fontSources: [
          {
            configName: "font",
            sourceUrl:
              "https://fonts.googleapis.com/css2?family=Inter&display=swap",
          },
        ],
        sidebar: {
          fontSources: [
            {
              configName: "font-sidebar",
              sourceUrl:
                "https://fonts.googleapis.com/css2?family=Roboto&display=swap",
            },
            {
              configName: "codeFont-sidebar",
              sourceUrl:
                "https://fonts.googleapis.com/css2?family=Monaco&display=swap",
            },
          ],
        },
      }

      act(() => {
        themeManager.setFonts(themeWithSidebarFontSources)
      })

      // Test that useThemeManager returns font sources from both theme and sidebar
      const [, , fontSources] = result.current
      expect(fontSources).toEqual({
        font: "https://fonts.googleapis.com/css2?family=Inter&display=swap",
        "font-sidebar":
          "https://fonts.googleapis.com/css2?family=Roboto&display=swap",
        "codeFont-sidebar":
          "https://fonts.googleapis.com/css2?family=Monaco&display=swap",
      })
    })

    it("handles font replacement correctly", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      // First theme with multiple sources
      const firstTheme = {
        ...mockCustomThemeConfig,
        fontSources: [
          { configName: "font", sourceUrl: "https://example.com/font1.css" },
          {
            configName: "codeFont",
            sourceUrl: "https://example.com/code1.css",
          },
        ],
      }

      act(() => {
        themeManager.setFonts(firstTheme)
      })

      const [, , fontSources] = result.current
      expect(fontSources).toEqual({
        font: "https://example.com/font1.css",
        codeFont: "https://example.com/code1.css",
      })

      // Replace with different theme
      const secondTheme = {
        ...mockCustomThemeConfig,
        fontSources: [
          {
            configName: "headingFont",
            sourceUrl: "https://example.com/heading2.css",
          },
        ],
      }

      act(() => {
        themeManager.setFonts(secondTheme)
      })

      // Should completely replace the previous font sources
      const [, , updatedFontSources] = result.current
      expect(updatedFontSources).toEqual({
        headingFont: "https://example.com/heading2.css",
      })
    })
  })
})
