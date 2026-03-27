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

import { streamlit } from "@streamlit/protobuf"

import {
  getConfiguredHeight,
  getConfiguredWidth,
  shouldUseContainerWidth,
  shouldUseContentWidth,
  shouldUseStretchHeight,
} from "./dimensionUtils"

describe("width configuration utilities", () => {
  describe("shouldUseContainerWidth", () => {
    it("returns true when widthConfig.useStretch is true", () => {
      const widthConfig = new streamlit.WidthConfig({ useStretch: true })

      expect(shouldUseContainerWidth(widthConfig)).toBe(true)
    })

    it("returns false when widthConfig.useStretch is false", () => {
      const widthConfig = new streamlit.WidthConfig({ useStretch: false })

      expect(shouldUseContainerWidth(widthConfig)).toBe(false)
    })

    it("returns false when widthConfig.useContent is true", () => {
      const widthConfig = new streamlit.WidthConfig({ useContent: true })

      expect(shouldUseContainerWidth(widthConfig)).toBe(false)
    })

    it("returns false when widthConfig.pixelWidth is set", () => {
      const widthConfig = new streamlit.WidthConfig({ pixelWidth: 400 })

      expect(shouldUseContainerWidth(widthConfig)).toBe(false)
    })

    it("returns false when widthConfig is null", () => {
      expect(shouldUseContainerWidth(null)).toBe(false)
    })

    it("returns false when widthConfig is undefined", () => {
      expect(shouldUseContainerWidth(undefined)).toBe(false)
    })
  })

  describe("shouldUseContentWidth", () => {
    it("returns true when widthConfig.useContent is true", () => {
      const widthConfig = new streamlit.WidthConfig({ useContent: true })

      expect(shouldUseContentWidth(widthConfig)).toBe(true)
    })

    it("returns false when widthConfig.useContent is false", () => {
      const widthConfig = new streamlit.WidthConfig({ useContent: false })

      expect(shouldUseContentWidth(widthConfig)).toBe(false)
    })

    it("returns false when widthConfig.useStretch is true", () => {
      const widthConfig = new streamlit.WidthConfig({ useStretch: true })

      expect(shouldUseContentWidth(widthConfig)).toBe(false)
    })

    it("returns false when widthConfig.pixelWidth is set", () => {
      const widthConfig = new streamlit.WidthConfig({ pixelWidth: 400 })

      expect(shouldUseContentWidth(widthConfig)).toBe(false)
    })

    it("returns false when widthConfig is null", () => {
      expect(shouldUseContentWidth(null)).toBe(false)
    })

    it("returns false when widthConfig is undefined", () => {
      expect(shouldUseContentWidth(undefined)).toBe(false)
    })
  })

  describe("getConfiguredWidth", () => {
    it("returns widthConfig.pixelWidth when set", () => {
      const widthConfig = new streamlit.WidthConfig({ pixelWidth: 400 })

      expect(getConfiguredWidth(widthConfig)).toBe(400)
    })

    it("returns undefined when widthConfig is null", () => {
      expect(getConfiguredWidth(null)).toBe(undefined)
    })

    it("returns undefined when widthConfig is undefined", () => {
      expect(getConfiguredWidth(undefined)).toBe(undefined)
    })

    it("returns undefined when widthConfig.pixelWidth is 0", () => {
      const widthConfig = new streamlit.WidthConfig({ pixelWidth: 0 })

      expect(getConfiguredWidth(widthConfig)).toBe(undefined)
    })

    it("returns undefined when widthConfig has useStretch set", () => {
      const widthConfig = new streamlit.WidthConfig({ useStretch: true })

      expect(getConfiguredWidth(widthConfig)).toBe(undefined)
    })
  })

  describe("getConfiguredHeight", () => {
    it("returns heightConfig.pixelHeight when set", () => {
      const heightConfig = new streamlit.HeightConfig({ pixelHeight: 400 })

      expect(getConfiguredHeight(heightConfig)).toBe(400)
    })

    it("returns undefined when heightConfig is null", () => {
      expect(getConfiguredHeight(null)).toBe(undefined)
    })

    it("returns undefined when heightConfig is undefined", () => {
      expect(getConfiguredHeight(undefined)).toBe(undefined)
    })

    it("returns undefined when heightConfig.pixelHeight is 0", () => {
      const heightConfig = new streamlit.HeightConfig({ pixelHeight: 0 })

      expect(getConfiguredHeight(heightConfig)).toBe(undefined)
    })

    it("returns undefined when heightConfig has useStretch set", () => {
      const heightConfig = new streamlit.HeightConfig({ useStretch: true })

      expect(getConfiguredHeight(heightConfig)).toBe(undefined)
    })
  })

  describe("shouldUseStretchHeight", () => {
    it("returns true when heightConfig.useStretch is true", () => {
      const heightConfig = new streamlit.HeightConfig({ useStretch: true })

      expect(shouldUseStretchHeight(heightConfig)).toBe(true)
    })

    it("returns false when heightConfig.useStretch is false", () => {
      const heightConfig = new streamlit.HeightConfig({ useStretch: false })

      expect(shouldUseStretchHeight(heightConfig)).toBe(false)
    })

    it("returns false when heightConfig is null", () => {
      expect(shouldUseStretchHeight(null)).toBe(false)
    })

    it("returns false when heightConfig is undefined", () => {
      expect(shouldUseStretchHeight(undefined)).toBe(false)
    })

    it("returns false when heightConfig.useStretch is not set", () => {
      const heightConfig = new streamlit.HeightConfig({ pixelHeight: 300 })

      expect(shouldUseStretchHeight(heightConfig)).toBe(false)
    })

    it("returns false when isInRoot is true, even if heightConfig.useStretch is true", () => {
      const heightConfig = new streamlit.HeightConfig({ useStretch: true })

      expect(shouldUseStretchHeight(heightConfig, true)).toBe(false)
    })

    it("returns true when isInRoot is false and heightConfig.useStretch is true", () => {
      const heightConfig = new streamlit.HeightConfig({ useStretch: true })

      expect(shouldUseStretchHeight(heightConfig, false)).toBe(true)
    })

    it("returns false when isInRoot is undefined and heightConfig.useStretch is false", () => {
      const heightConfig = new streamlit.HeightConfig({ useStretch: false })

      expect(shouldUseStretchHeight(heightConfig, undefined)).toBe(false)
    })
  })
})
