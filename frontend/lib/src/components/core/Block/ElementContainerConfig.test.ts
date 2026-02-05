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

import { describe, expect, it } from "vitest"

import {
  ElementContainerConfig,
  MinStretchWidth,
} from "./ElementContainerConfig"

describe("ElementContainerConfig", () => {
  describe("constructor", () => {
    it("sets default values when no options provided", () => {
      const config = new ElementContainerConfig()
      expect(config.minStretchWidth).toBe(MinStretchWidth.NONE)
      expect(config.styleOverrides).toBeUndefined()
    })

    it("accepts all configuration options", () => {
      const config = new ElementContainerConfig({
        minStretchWidth: MinStretchWidth.LARGE,
        styleOverrides: { height: "100%", overflow: "visible" },
      })
      expect(config.minStretchWidth).toBe(MinStretchWidth.LARGE)
      expect(config.styleOverrides).toEqual({
        height: "100%",
        overflow: "visible",
      })
    })

    it("accepts partial configuration options", () => {
      const config = new ElementContainerConfig({
        minStretchWidth: MinStretchWidth.MEDIUM,
      })
      expect(config.minStretchWidth).toBe(MinStretchWidth.MEDIUM)
      expect(config.styleOverrides).toBeUndefined()
    })
  })

  describe("static configs", () => {
    it("DEFAULT has NONE min stretch width", () => {
      expect(ElementContainerConfig.DEFAULT.minStretchWidth).toBe(
        MinStretchWidth.NONE
      )
      expect(ElementContainerConfig.DEFAULT.styleOverrides).toBeUndefined()
    })

    it("LARGE_ELEMENT has LARGE min stretch width", () => {
      expect(ElementContainerConfig.LARGE_ELEMENT.minStretchWidth).toBe(
        MinStretchWidth.LARGE
      )
      expect(
        ElementContainerConfig.LARGE_ELEMENT.styleOverrides
      ).toBeUndefined()
    })

    it("MEDIUM_ELEMENT has MEDIUM min stretch width", () => {
      expect(ElementContainerConfig.MEDIUM_ELEMENT.minStretchWidth).toBe(
        MinStretchWidth.MEDIUM
      )
      expect(
        ElementContainerConfig.MEDIUM_ELEMENT.styleOverrides
      ).toBeUndefined()
    })
  })

  describe("with()", () => {
    it("creates new config with merged options without mutating original", () => {
      const base = ElementContainerConfig.LARGE_ELEMENT
      const extended = base.with({
        styleOverrides: { overflow: "visible" },
      })

      expect(extended.minStretchWidth).toBe(MinStretchWidth.LARGE)
      expect(extended.styleOverrides).toEqual({ overflow: "visible" })
      // Original unchanged (immutability)
      expect(base.styleOverrides).toBeUndefined()
    })

    it("merges styleOverrides correctly", () => {
      const base = new ElementContainerConfig({
        styleOverrides: { width: "100%", height: "auto" },
      })
      const extended = base.with({
        styleOverrides: { height: "50%", flex: "1" },
      })

      expect(extended.styleOverrides).toEqual({
        width: "100%",
        height: "50%",
        flex: "1",
      })
    })

    it("allows overriding minStretchWidth", () => {
      const base = ElementContainerConfig.LARGE_ELEMENT
      const extended = base.with({
        minStretchWidth: MinStretchWidth.FIT_CONTENT,
      })

      expect(extended.minStretchWidth).toBe(MinStretchWidth.FIT_CONTENT)
      expect(base.minStretchWidth).toBe(MinStretchWidth.LARGE)
    })

    it("allows overriding all properties", () => {
      const base = new ElementContainerConfig({
        minStretchWidth: MinStretchWidth.LARGE,
        styleOverrides: { width: "100%" },
      })

      const extended = base.with({
        minStretchWidth: MinStretchWidth.NONE,
        styleOverrides: { height: "auto" },
      })

      expect(extended.minStretchWidth).toBe(MinStretchWidth.NONE)
      expect(extended.styleOverrides).toEqual({
        width: "100%",
        height: "auto",
      })
    })
  })

  describe("computeStyleOverrides()", () => {
    it("returns empty object for default config", () => {
      const config = new ElementContainerConfig()
      expect(config.computeStyleOverrides()).toEqual({})
    })

    it("returns styleOverrides when provided", () => {
      const config = new ElementContainerConfig({
        styleOverrides: { width: "100%", overflow: "visible" },
      })
      expect(config.computeStyleOverrides()).toEqual({
        width: "100%",
        overflow: "visible",
      })
    })

    it("returns styleOverrides for complex styles", () => {
      const config = new ElementContainerConfig({
        styleOverrides: { height: "auto", flex: "1", overflow: "visible" },
      })
      expect(config.computeStyleOverrides()).toEqual({
        height: "auto",
        flex: "1",
        overflow: "visible",
      })
    })
  })

  describe("getMinStretchBehavior()", () => {
    it("returns undefined for NONE", () => {
      const config = new ElementContainerConfig({
        minStretchWidth: MinStretchWidth.NONE,
      })
      expect(config.getMinStretchBehavior()).toBeUndefined()
    })

    it("returns the enum value for LARGE", () => {
      const config = new ElementContainerConfig({
        minStretchWidth: MinStretchWidth.LARGE,
      })
      expect(config.getMinStretchBehavior()).toBe(MinStretchWidth.LARGE)
    })

    it("returns the enum value for MEDIUM", () => {
      const config = new ElementContainerConfig({
        minStretchWidth: MinStretchWidth.MEDIUM,
      })
      expect(config.getMinStretchBehavior()).toBe(MinStretchWidth.MEDIUM)
    })

    it("returns the enum value for FIT_CONTENT", () => {
      const config = new ElementContainerConfig({
        minStretchWidth: MinStretchWidth.FIT_CONTENT,
      })
      expect(config.getMinStretchBehavior()).toBe(MinStretchWidth.FIT_CONTENT)
    })
  })
})
