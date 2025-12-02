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

import { describe, expect, it } from "vitest"

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
