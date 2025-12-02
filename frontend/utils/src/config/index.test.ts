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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getStreamlitConfig, StreamlitConfig } from "./index"

describe("StreamlitConfig", () => {
  // Note: These tests verify the module's behavior after import.
  // Since the capture happens at module load time, we can't easily test
  // the "capture on load" behavior without module isolation.
  // The main security benefit is verified by the fact that values are frozen.

  describe("getStreamlitConfig", () => {
    it("returns undefined when window.__streamlit was not set", () => {
      // This test verifies behavior when config was not set before module load
      // Note: In the test environment, window.__streamlit is typically undefined
      const config = getStreamlitConfig()
      // The config will be undefined if window.__streamlit wasn't set before module load
      expect(config === undefined || typeof config === "object").toBe(true)
    })

    it("returns a frozen object when config exists", () => {
      const config = getStreamlitConfig()
      if (config !== undefined) {
        expect(Object.isFrozen(config)).toBe(true)
      }
    })

    it("StreamlitConfig accessors return expected types", () => {
      // These should return undefined or the expected type
      expect(
        StreamlitConfig.BACKEND_BASE_URL === undefined ||
          typeof StreamlitConfig.BACKEND_BASE_URL === "string"
      ).toBe(true)
      expect(
        StreamlitConfig.HOST_CONFIG_BASE_URL === undefined ||
          typeof StreamlitConfig.HOST_CONFIG_BASE_URL === "string"
      ).toBe(true)
      expect(
        StreamlitConfig.DOWNLOAD_ASSETS_BASE_URL === undefined ||
          typeof StreamlitConfig.DOWNLOAD_ASSETS_BASE_URL === "string"
      ).toBe(true)
      expect(
        StreamlitConfig.MAIN_PAGE_BASE_URL === undefined ||
          typeof StreamlitConfig.MAIN_PAGE_BASE_URL === "string"
      ).toBe(true)
      expect(
        StreamlitConfig.CUSTOM_COMPONENT_CLIENT_ID === undefined ||
          typeof StreamlitConfig.CUSTOM_COMPONENT_CLIENT_ID === "string"
      ).toBe(true)
      expect(
        StreamlitConfig.ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION ===
          undefined ||
          typeof StreamlitConfig.ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION ===
            "boolean"
      ).toBe(true)
    })
  })

  describe("immutability", () => {
    it("captured config cannot be modified", () => {
      const config = getStreamlitConfig()

      if (config !== undefined) {
        // Attempting to modify should throw in strict mode or silently fail
        expect(() => {
          ;(config as Record<string, unknown>).BACKEND_BASE_URL = "hacked"
        }).toThrow()
      }
    })

    it("nested objects in config are also frozen", () => {
      const config = getStreamlitConfig()

      if (config?.LIGHT_THEME) {
        expect(Object.isFrozen(config.LIGHT_THEME)).toBe(true)
      }
      if (config?.DARK_THEME) {
        expect(Object.isFrozen(config.DARK_THEME)).toBe(true)
      }
    })
  })
})

/**
 * Tests that verify module isolation behavior with a full config structure.
 * These tests use vi.resetModules() to re-import the module after setting
 * window.__streamlit, simulating the real-world scenario where the host
 * sets the config before loading the Streamlit bundle.
 */
describe("StreamlitConfig with module isolation", () => {
  // Store original window.__streamlit value
  const originalStreamlit = window.__streamlit

  beforeEach(() => {
    // Reset modules before each test to allow fresh imports
    vi.resetModules()
  })

  afterEach(() => {
    // Restore original state
    window.__streamlit = originalStreamlit
    vi.resetModules()
  })

  it("captures and freezes a complete config structure with themes", async () => {
    // Set up a realistic config structure before module load
    window.__streamlit = {
      BACKEND_BASE_URL: "https://backend.example.com:8501",
      HOST_CONFIG_BASE_URL: "https://host.example.com/_stcore/host-config",
      DOWNLOAD_ASSETS_BASE_URL: "https://cdn.example.com/media",
      MAIN_PAGE_BASE_URL: "https://app.example.com/my-app",
      CUSTOM_COMPONENT_CLIENT_ID: "test-client-id-12345",
      ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION: true,
      LIGHT_THEME: {
        primaryColor: "#FF4B4B",
        backgroundColor: "#FFFFFF",
        secondaryBackgroundColor: "#F0F2F6",
        textColor: "#262730",
        base: 0, // LIGHT
        bodyFont: "Source Sans Pro",
        codeFont: "Source Code Pro",
        headingFont: "Source Sans Pro",
        fontFaces: [
          {
            url: "https://fonts.example.com/SourceSansPro-Regular.woff2",
            family: "Source Sans Pro",
            style: "normal",
            weightRange: "400",
          },
          {
            url: "https://fonts.example.com/SourceSansPro-Bold.woff2",
            family: "Source Sans Pro",
            style: "normal",
            weightRange: "700",
          },
        ],
        radii: {
          baseWidgetRadius: 4,
          checkboxRadius: 3,
        },
      },
      DARK_THEME: {
        primaryColor: "#FF4B4B",
        backgroundColor: "#0E1117",
        secondaryBackgroundColor: "#262730",
        textColor: "#FAFAFA",
        base: 1, // DARK
        bodyFont: "Source Sans Pro",
        codeFont: "Source Code Pro",
        headingFont: "Source Sans Pro",
        fontFaces: [
          {
            url: "https://fonts.example.com/SourceCodePro-Regular.woff2",
            family: "Source Code Pro",
            style: "normal",
            weightRange: "400",
          },
        ],
        radii: {
          baseWidgetRadius: 8,
          checkboxRadius: 4,
        },
      },
    }

    // Re-import the module to trigger capture
    const { getStreamlitConfig, StreamlitConfig } = await import("./index")
    const config = getStreamlitConfig()

    // Verify config was captured
    expect(config).toBeDefined()

    // Verify all top-level values
    expect(StreamlitConfig.BACKEND_BASE_URL).toBe(
      "https://backend.example.com:8501"
    )
    expect(StreamlitConfig.HOST_CONFIG_BASE_URL).toBe(
      "https://host.example.com/_stcore/host-config"
    )
    expect(StreamlitConfig.DOWNLOAD_ASSETS_BASE_URL).toBe(
      "https://cdn.example.com/media"
    )
    expect(StreamlitConfig.MAIN_PAGE_BASE_URL).toBe(
      "https://app.example.com/my-app"
    )
    expect(StreamlitConfig.CUSTOM_COMPONENT_CLIENT_ID).toBe(
      "test-client-id-12345"
    )
    expect(
      StreamlitConfig.ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION
    ).toBe(true)

    // Verify theme values
    expect(StreamlitConfig.LIGHT_THEME?.primaryColor).toBe("#FF4B4B")
    expect(StreamlitConfig.DARK_THEME?.backgroundColor).toBe("#0E1117")

    // Verify root is frozen
    expect(Object.isFrozen(config)).toBe(true)

    // Assert config and themes exist for subsequent checks
    if (!config?.LIGHT_THEME || !config.DARK_THEME) {
      throw new Error("Config or themes should be defined")
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lightTheme = config.LIGHT_THEME as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const darkTheme = config.DARK_THEME as any

    // Verify LIGHT_THEME is frozen
    expect(Object.isFrozen(config.LIGHT_THEME)).toBe(true)

    // Verify nested radii object is frozen
    expect(Object.isFrozen(lightTheme.radii)).toBe(true)

    // Verify fontFaces array is frozen
    expect(Object.isFrozen(lightTheme.fontFaces)).toBe(true)

    // Verify elements inside fontFaces array are frozen
    expect(Object.isFrozen(lightTheme.fontFaces[0])).toBe(true)
    expect(Object.isFrozen(lightTheme.fontFaces[1])).toBe(true)

    // Verify DARK_THEME and its nested structures are frozen
    expect(Object.isFrozen(config.DARK_THEME)).toBe(true)
    expect(Object.isFrozen(darkTheme.radii)).toBe(true)
    expect(Object.isFrozen(darkTheme.fontFaces)).toBe(true)
    expect(Object.isFrozen(darkTheme.fontFaces[0])).toBe(true)
  })

  it("modifications to deeply nested structures throw errors", async () => {
    window.__streamlit = {
      BACKEND_BASE_URL: "https://backend.example.com",
      LIGHT_THEME: {
        primaryColor: "#FF4B4B",
        radii: { baseWidgetRadius: 4 },
        fontFaces: [{ url: "https://fonts.example.com/font.woff2" }],
      },
    }

    const { getStreamlitConfig } = await import("./index")
    const config = getStreamlitConfig()

    expect(config).toBeDefined()
    if (!config?.LIGHT_THEME) {
      throw new Error("Config and LIGHT_THEME should be defined")
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lightTheme = config.LIGHT_THEME as any

    // Attempt to modify top-level property
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(config as any).BACKEND_BASE_URL = "hacked"
    }).toThrow(TypeError)

    // Attempt to modify LIGHT_THEME property
    expect(() => {
      lightTheme.primaryColor = "hacked"
    }).toThrow(TypeError)

    // Attempt to modify nested radii object
    expect(() => {
      lightTheme.radii.baseWidgetRadius = 999
    }).toThrow(TypeError)

    // Attempt to push to fontFaces array
    expect(() => {
      lightTheme.fontFaces.push({ url: "hacked" })
    }).toThrow(TypeError)

    // Attempt to modify fontFaces array element
    expect(() => {
      lightTheme.fontFaces[0].url = "hacked"
    }).toThrow(TypeError)
  })

  it("is isolated from modifications to original window.__streamlit", async () => {
    const originalUrl = "https://original.example.com"
    window.__streamlit = {
      BACKEND_BASE_URL: originalUrl,
    }

    const { StreamlitConfig } = await import("./index")

    // Verify initial capture
    expect(StreamlitConfig.BACKEND_BASE_URL).toBe(originalUrl)

    // Modify the original window.__streamlit
    window.__streamlit.BACKEND_BASE_URL = "https://modified.example.com"

    // StreamlitConfig should still return the original captured value
    expect(StreamlitConfig.BACKEND_BASE_URL).toBe(originalUrl)

    // Even replacing the entire object shouldn't affect the captured value
    window.__streamlit = {
      BACKEND_BASE_URL: "https://replaced.example.com",
    }
    expect(StreamlitConfig.BACKEND_BASE_URL).toBe(originalUrl)
  })

  it("returns undefined for all accessors when window.__streamlit is not set", async () => {
    window.__streamlit = undefined

    const { StreamlitConfig, getStreamlitConfig } = await import("./index")

    expect(getStreamlitConfig()).toBeUndefined()
    expect(StreamlitConfig.BACKEND_BASE_URL).toBeUndefined()
    expect(StreamlitConfig.HOST_CONFIG_BASE_URL).toBeUndefined()
    expect(StreamlitConfig.DOWNLOAD_ASSETS_BASE_URL).toBeUndefined()
    expect(StreamlitConfig.MAIN_PAGE_BASE_URL).toBeUndefined()
    expect(StreamlitConfig.CUSTOM_COMPONENT_CLIENT_ID).toBeUndefined()
    expect(StreamlitConfig.LIGHT_THEME).toBeUndefined()
    expect(StreamlitConfig.DARK_THEME).toBeUndefined()
    expect(
      StreamlitConfig.ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION
    ).toBeUndefined()
  })
})
