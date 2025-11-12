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

import * as libModule from "@streamlit/lib"
import {
  AUTO_THEME_NAME,
  createPresetThemes,
  CUSTOM_THEME_AUTO_NAME,
  CUSTOM_THEME_NAME,
  darkTheme,
  lightTheme,
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
  let mediaQueryListeners: ((event: MediaQueryListEvent) => void)[] = []
  let mockMatchMedia: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mediaQueryListeners = []

    // sourced from:
    // https://jestjs.io/docs/en/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
    mockMatchMedia = vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn((event, handler) => {
        if (event === "change") {
          mediaQueryListeners.push(handler)
        }
      }),
      removeEventListener: vi.fn((event, handler) => {
        if (event === "change") {
          const index = mediaQueryListeners.indexOf(handler)
          if (index > -1) {
            mediaQueryListeners.splice(index, 1)
          }
        }
      }),
      dispatchEvent: vi.fn(),
    }))

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: mockMatchMedia,
    })
  })

  afterEach(() => {
    window.localStorage.clear()
    mediaQueryListeners = []
  })

  const triggerMediaQueryChange = (matches: boolean): void => {
    const event = {
      matches,
      media: "(prefers-color-scheme: dark)",
    } as MediaQueryListEvent

    act(() => {
      mediaQueryListeners.forEach(listener => listener(event))
    })
  }

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

  it("applies cached preference to preset themes", () => {
    // When only a preference is cached (e.g., "Dark"), it should load the preset theme
    setCachedTheme(darkTheme)

    const { result } = renderHook(() => useThemeManager())
    const [themeManager] = result.current
    const { activeTheme, availableThemes } = themeManager

    expect(activeTheme.name).toBe("Dark")
    // Should only have preset themes available (no custom themes)
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

  it("applies cached preference to set active theme to appropriate default theme - light", () => {
    // When a system preference is cached, it should set the appropriate custom theme as the active theme
    // custom theme as the active theme
    setCachedTheme(lightTheme)

    const { result } = renderHook(() => useThemeManager())
    const [themeManager] = result.current
    const { activeTheme, availableThemes } = themeManager

    expect(activeTheme.name).toBe("Light")
    expect(availableThemes.length).toBe(createPresetThemes().length)
  })

  it("applies cached preference to set active theme to appropriate default theme - dark", () => {
    // When a system preference is cached, it should set the appropriate custom theme as the active theme
    // custom theme as the active theme
    setCachedTheme(darkTheme)

    const { result } = renderHook(() => useThemeManager())
    const [themeManager] = result.current
    const { activeTheme, availableThemes } = themeManager

    expect(activeTheme.name).toBe("Dark")
    expect(availableThemes.length).toBe(createPresetThemes().length)
  })

  describe("setTheme (updateTheme)", () => {
    let setCachedThemeSpy: ReturnType<typeof vi.spyOn>
    let removeCachedThemeSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      setCachedThemeSpy = vi
        .spyOn(libModule, "setCachedTheme")
        .mockImplementation(() => {})
      removeCachedThemeSpy = vi
        .spyOn(libModule, "removeCachedTheme")
        .mockImplementation(() => {})
    })

    afterEach(() => {
      setCachedThemeSpy.mockRestore()
      removeCachedThemeSpy.mockRestore()
    })

    it("does not change theme when called with the same theme as current theme", () => {
      const { result } = renderHook(() => useThemeManager())
      // By default, the theme is auto theme
      const [themeManager] = result.current

      // Set the theme to light
      act(() => {
        themeManager.setTheme(lightTheme)
      })

      const [themeManager2] = result.current
      expect(themeManager2.activeTheme.name).toBe(lightTheme.name)

      // Clear the calls from the initial theme setting
      setCachedThemeSpy.mockClear()
      removeCachedThemeSpy.mockClear()

      // Set to the same theme (light) again
      act(() => {
        themeManager2.setTheme(lightTheme)
      })

      // No cache operations should have been called since theme didn't change
      expect(setCachedThemeSpy).not.toHaveBeenCalled()
      expect(removeCachedThemeSpy).not.toHaveBeenCalled()

      // Theme should remain unchanged
      const [themeManager3] = result.current
      expect(themeManager3.activeTheme.name).toBe(lightTheme.name)
    })

    it("sets theme and calls setCachedTheme for explicit theme preference (Dark)", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      // Initial theme should be Auto (default)
      expect(themeManager.activeTheme.name).toBe(AUTO_THEME_NAME)

      // Change preference to dark theme
      act(() => {
        themeManager.setTheme(darkTheme)
      })

      const [themeManager2] = result.current

      // Theme should be updated
      expect(themeManager2.activeTheme.name).toBe(darkTheme.name)

      // setCachedTheme should be called with the dark theme
      expect(setCachedThemeSpy).toHaveBeenCalledTimes(1)
      expect(setCachedThemeSpy).toHaveBeenCalledWith(darkTheme)

      // removeCachedTheme should NOT be called for explicit preferences
      expect(removeCachedThemeSpy).not.toHaveBeenCalled()
    })

    it("sets theme and calls setCachedTheme for explicit theme preference (Light)", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      // Initial theme should be Auto (default)
      expect(themeManager.activeTheme.name).toBe(AUTO_THEME_NAME)

      // Change back to light theme
      act(() => {
        themeManager.setTheme(lightTheme)
      })

      const [themeManager2] = result.current

      // Theme should be updated
      expect(themeManager2.activeTheme.name).toBe(lightTheme.name)

      // setCachedTheme should be called with the light theme
      expect(setCachedThemeSpy).toHaveBeenCalledTimes(1)
      expect(setCachedThemeSpy).toHaveBeenCalledWith(lightTheme)

      // removeCachedTheme should NOT be called
      expect(removeCachedThemeSpy).not.toHaveBeenCalled()
    })

    it("calls removeCachedTheme when setting Auto default theme", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      // Set to dark theme first
      act(() => {
        themeManager.setTheme(darkTheme)
      })

      // Clear previous calls
      setCachedThemeSpy.mockClear()
      removeCachedThemeSpy.mockClear()

      const [themeManager2] = result.current

      // Create an auto default theme
      const autoTheme = {
        ...lightTheme,
        name: AUTO_THEME_NAME,
      }

      // Change to auto theme
      act(() => {
        themeManager2.setTheme(autoTheme)
      })

      const [themeManager3] = result.current

      // Theme should be updated
      expect(themeManager3.activeTheme.name).toBe(AUTO_THEME_NAME)

      // removeCachedTheme should be called for auto theme
      expect(removeCachedThemeSpy).toHaveBeenCalledTimes(1)

      // setCachedTheme should NOT be called for auto theme
      expect(setCachedThemeSpy).not.toHaveBeenCalled()
    })

    it("calls removeCachedTheme when setting Auto custom theme", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      // Create a theme with auto as displayName (auto custom theme)
      const customAutoTheme = {
        ...lightTheme,
        name: CUSTOM_THEME_AUTO_NAME,
        displayName: AUTO_THEME_NAME,
      }

      // Change to auto theme
      act(() => {
        themeManager.setTheme(customAutoTheme)
      })

      const [themeManager2] = result.current

      // Theme should be updated
      expect(themeManager2.activeTheme.displayName).toBe(AUTO_THEME_NAME)

      // removeCachedTheme should be called for auto custom theme
      expect(removeCachedThemeSpy).toHaveBeenCalledTimes(1)

      // setCachedTheme should NOT be called
      expect(setCachedThemeSpy).not.toHaveBeenCalled()
    })

    it("calls removeCachedTheme when setting single custom theme", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      // Create a custom theme (single custom theme case, shouldn't be cached)
      const customTheme = {
        ...lightTheme,
        name: CUSTOM_THEME_NAME,
      }

      // Set custom theme
      act(() => {
        themeManager.setTheme(customTheme)
      })

      const [themeManager2] = result.current

      // Theme should be updated
      expect(themeManager2.activeTheme.name).toBe(CUSTOM_THEME_NAME)

      // removeCachedTheme should be called for single custom theme
      expect(removeCachedThemeSpy).toHaveBeenCalledTimes(1)

      // setCachedTheme should NOT be called for single custom theme
      expect(setCachedThemeSpy).not.toHaveBeenCalled()
    })
  })

  describe("updateAutoTheme (via media query changes)", () => {
    let getSystemThemePreferenceSpy: ReturnType<typeof vi.spyOn>
    let getHostSpecifiedThemeSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      getSystemThemePreferenceSpy = vi.spyOn(
        libModule,
        "getSystemThemePreference"
      )
      getHostSpecifiedThemeSpy = vi.spyOn(libModule, "getHostSpecifiedTheme")
    })

    afterEach(() => {
      getSystemThemePreferenceSpy.mockRestore()
      getHostSpecifiedThemeSpy.mockRestore()
    })

    it("does nothing if no auto theme is found (single custom theme)", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      const customTheme = {
        ...lightTheme,
        name: CUSTOM_THEME_NAME,
      }

      // Replace preset themes with single custom theme (no auto option)
      act(() => {
        themeManager.addThemes([customTheme], { keepPresetThemes: false })
      })

      act(() => {
        themeManager.setTheme(customTheme)
      })

      const [themeManager2] = result.current
      const themeBeforeUpdate = themeManager2.activeTheme
      const themesBeforeUpdate = themeManager2.availableThemes

      // Trigger media query change - should do nothing since no auto theme exists
      triggerMediaQueryChange(true)

      const [themeManager3] = result.current

      // Theme and available themes should remain unchanged
      expect(themeManager3.activeTheme).toEqual(themeBeforeUpdate)
      expect(themeManager3.availableThemes).toEqual(themesBeforeUpdate)

      // No system preference checks should have been made
      expect(getSystemThemePreferenceSpy).not.toHaveBeenCalled()
      expect(getHostSpecifiedThemeSpy).not.toHaveBeenCalled()
    })

    it("updates auto preset theme when system preference changes to light", () => {
      // Mock system preference to return light
      getSystemThemePreferenceSpy.mockReturnValue("light")
      const updatedAutoTheme = { ...lightTheme, name: AUTO_THEME_NAME }
      getHostSpecifiedThemeSpy.mockReturnValue(updatedAutoTheme)

      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      // Should start with auto theme
      expect(themeManager.activeTheme.name).toBe(AUTO_THEME_NAME)

      // Trigger media query change (system preference changed)
      triggerMediaQueryChange(false) // false = light mode

      const [themeManager2] = result.current

      // Should have called getHostSpecifiedTheme to get the updated auto theme
      expect(getHostSpecifiedThemeSpy).toHaveBeenCalled()

      // Active theme should still be auto (refreshed with light variant)
      expect(themeManager2.activeTheme.name).toBe(AUTO_THEME_NAME)

      // availableThemes should still include the auto theme
      const autoThemeInList = themeManager2.availableThemes.find(
        t => t.name === AUTO_THEME_NAME
      )
      expect(autoThemeInList).toBeDefined()
    })

    it("updates auto preset theme when system preference changes to dark", () => {
      // Mock system preference to return dark
      getSystemThemePreferenceSpy.mockReturnValue("dark")
      const updatedAutoTheme = { ...darkTheme, name: AUTO_THEME_NAME }
      getHostSpecifiedThemeSpy.mockReturnValue(updatedAutoTheme)

      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      // Should start with auto theme
      expect(themeManager.activeTheme.name).toBe(AUTO_THEME_NAME)

      // Trigger media query change (system preference changed)
      triggerMediaQueryChange(true) // true = dark mode

      const [themeManager2] = result.current

      // Should have called getHostSpecifiedTheme to get the updated auto theme
      expect(getHostSpecifiedThemeSpy).toHaveBeenCalled()

      // Active theme should still be auto (refreshed with dark variant)
      expect(themeManager2.activeTheme.name).toBe(AUTO_THEME_NAME)

      // availableThemes should still include the auto theme
      const autoThemeInList = themeManager2.availableThemes.find(
        t => t.name === AUTO_THEME_NAME
      )
      expect(autoThemeInList).toBeDefined()
    })

    it("does not update active theme if user switched away from auto", () => {
      // Mock system preference
      const updatedAutoTheme = { ...darkTheme, name: AUTO_THEME_NAME }
      getHostSpecifiedThemeSpy.mockReturnValue(updatedAutoTheme)

      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      // User switches to explicit light theme
      act(() => {
        themeManager.setTheme(lightTheme)
      })

      const [themeManager2] = result.current
      expect(themeManager2.activeTheme.name).toBe(lightTheme.name)

      // System preference changes (trigger media query change)
      triggerMediaQueryChange(true)

      const [themeManager3] = result.current

      // Active theme should remain light (not updated to auto)
      expect(themeManager3.activeTheme.name).toBe(lightTheme.name)

      // But availableThemes should have the updated auto theme
      const autoThemeInList = themeManager3.availableThemes.find(
        t => t.name === AUTO_THEME_NAME
      )
      expect(autoThemeInList).toBeDefined()
    })

    it("updates custom auto theme to light variant when system preference changes to light", () => {
      // Mock system preference to return light
      getSystemThemePreferenceSpy.mockReturnValue("light")

      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      // Create custom themes with light, dark, and auto variants
      const customLightTheme = {
        ...lightTheme,
        name: "Custom Light",
        displayName: "Light",
        emotion: {
          ...lightTheme.emotion,
          colors: { ...lightTheme.emotion.colors, primary: "#FF0000" },
        },
      }

      const customDarkTheme = {
        ...darkTheme,
        name: "Custom Dark",
        displayName: "Dark",
        emotion: {
          ...darkTheme.emotion,
          colors: { ...darkTheme.emotion.colors, primary: "#00FF00" },
        },
      }

      const customAutoTheme = {
        ...customLightTheme,
        name: CUSTOM_THEME_AUTO_NAME,
        displayName: AUTO_THEME_NAME,
      }

      // Add custom themes (including auto)
      act(() => {
        themeManager.addThemes(
          [customAutoTheme, customLightTheme, customDarkTheme],
          { keepPresetThemes: false }
        )
      })

      // Set active theme to custom auto
      act(() => {
        themeManager.setTheme(customAutoTheme)
      })

      const [themeManager2] = result.current
      expect(themeManager2.activeTheme.name).toBe(CUSTOM_THEME_AUTO_NAME)

      // Trigger media query change (system preference changed to light)
      triggerMediaQueryChange(false)

      const [themeManager3] = result.current

      // Should have called getSystemThemePreference to determine variant
      expect(getSystemThemePreferenceSpy).toHaveBeenCalled()

      // Active theme should still be custom auto
      expect(themeManager3.activeTheme.name).toBe(CUSTOM_THEME_AUTO_NAME)
      expect(themeManager3.activeTheme.displayName).toBe(AUTO_THEME_NAME)

      // Custom auto theme should have light variant's primary color
      expect(themeManager3.activeTheme.emotion.colors.primary).toBe("#FF0000")

      // availableThemes should still include the updated custom auto theme
      const customAutoInList = themeManager3.availableThemes.find(
        t => t.name === CUSTOM_THEME_AUTO_NAME
      )
      expect(customAutoInList).toBeDefined()
      expect(customAutoInList?.emotion.colors.primary).toBe("#FF0000")
    })

    it("updates custom auto theme to dark variant when system preference changes to dark", () => {
      // Mock system preference to return dark
      getSystemThemePreferenceSpy.mockReturnValue("dark")

      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      // Create custom themes with light, dark, and auto variants
      const customLightTheme = {
        ...lightTheme,
        name: "Custom Light",
        displayName: "Light",
        emotion: {
          ...lightTheme.emotion,
          colors: { ...lightTheme.emotion.colors, primary: "#FF0000" },
        },
      }

      const customDarkTheme = {
        ...darkTheme,
        name: "Custom Dark",
        displayName: "Dark",
        emotion: {
          ...darkTheme.emotion,
          colors: { ...darkTheme.emotion.colors, primary: "#00FF00" },
        },
      }

      const customAutoTheme = {
        ...customDarkTheme,
        name: CUSTOM_THEME_AUTO_NAME,
        displayName: AUTO_THEME_NAME,
      }

      // Add custom themes (including auto)
      act(() => {
        themeManager.addThemes(
          [customAutoTheme, customLightTheme, customDarkTheme],
          { keepPresetThemes: false }
        )
      })

      // Set active theme to custom auto
      act(() => {
        themeManager.setTheme(customAutoTheme)
      })

      const [themeManager2] = result.current
      expect(themeManager2.activeTheme.name).toBe(CUSTOM_THEME_AUTO_NAME)

      // Trigger media query change (system preference changed to dark)
      triggerMediaQueryChange(true)

      const [themeManager3] = result.current

      // Should have called getSystemThemePreference to determine variant
      expect(getSystemThemePreferenceSpy).toHaveBeenCalled()

      // Active theme should still be custom auto
      expect(themeManager3.activeTheme.name).toBe(CUSTOM_THEME_AUTO_NAME)
      expect(themeManager3.activeTheme.displayName).toBe(AUTO_THEME_NAME)

      // Custom auto theme should have dark variant's primary color
      expect(themeManager3.activeTheme.emotion.colors.primary).toBe("#00FF00")

      // availableThemes should still include the updated custom auto theme
      const customAutoInList = themeManager3.availableThemes.find(
        t => t.name === CUSTOM_THEME_AUTO_NAME
      )
      expect(customAutoInList).toBeDefined()
      expect(customAutoInList?.emotion.colors.primary).toBe("#00FF00")
    })

    it("does not update active theme if user switched to explicit custom theme", () => {
      // Mock system preference
      getSystemThemePreferenceSpy.mockReturnValue("dark")

      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      // Create custom themes
      const customLightTheme = {
        ...lightTheme,
        name: "Custom Light",
        displayName: "Light",
        emotion: {
          ...lightTheme.emotion,
          colors: { ...lightTheme.emotion.colors, primary: "#FF0000" },
        },
      }

      const customDarkTheme = {
        ...darkTheme,
        name: "Custom Dark",
        displayName: "Dark",
        emotion: {
          ...darkTheme.emotion,
          colors: { ...darkTheme.emotion.colors, primary: "#00FF00" },
        },
      }

      const customAutoTheme = {
        ...customLightTheme,
        name: CUSTOM_THEME_AUTO_NAME,
        displayName: AUTO_THEME_NAME,
      }

      // Add custom themes
      act(() => {
        themeManager.addThemes(
          [customAutoTheme, customLightTheme, customDarkTheme],
          { keepPresetThemes: false }
        )
      })

      // User explicitly selects custom light theme (not auto)
      act(() => {
        themeManager.setTheme(customLightTheme)
      })

      const [themeManager2] = result.current
      expect(themeManager2.activeTheme.name).toBe("Custom Light")

      // System preference changes (trigger media query change)
      triggerMediaQueryChange(true)

      const [themeManager3] = result.current

      // Active theme should remain Custom Light (not updated to auto)
      expect(themeManager3.activeTheme.name).toBe("Custom Light")
      expect(themeManager3.activeTheme.emotion.colors.primary).toBe("#FF0000")

      // But availableThemes should have the updated custom auto theme
      const customAutoInList = themeManager3.availableThemes.find(
        t => t.name === CUSTOM_THEME_AUTO_NAME
      )
      expect(customAutoInList).toBeDefined()
    })
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

    it("does not save single custom theme to localStorage", () => {
      const { result } = renderHook(() => useThemeManager())
      const [themeManager] = result.current

      act(() => {
        themeManager.setImportedTheme(mockCustomThemeConfig)
      })

      // Single custom theme (CUSTOM_THEME_NAME) should not be cached
      // since it's the only option (like auto theme)
      const cachedTheme = window.localStorage.getItem(LocalStore.ACTIVE_THEME)
      expect(cachedTheme).toBe(null)
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
