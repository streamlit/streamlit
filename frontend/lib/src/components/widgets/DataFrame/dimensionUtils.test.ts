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

import { Arrow as ArrowProto, streamlit } from "@streamlit/protobuf"

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
      const element = ArrowProto.create({ useContainerWidth: false })
      const widthConfig = new streamlit.WidthConfig({ useStretch: true })

      expect(shouldUseContainerWidth(element, widthConfig)).toBe(true)
    })

    it("returns false when widthConfig.useStretch is false", () => {
      const element = ArrowProto.create({ useContainerWidth: true })
      const widthConfig = new streamlit.WidthConfig({ useStretch: false })

      expect(shouldUseContainerWidth(element, widthConfig)).toBe(false)
    })

    it("returns false when widthConfig.useContent is true", () => {
      const element = ArrowProto.create({ useContainerWidth: true })
      const widthConfig = new streamlit.WidthConfig({ useContent: true })

      expect(shouldUseContainerWidth(element, widthConfig)).toBe(false)
    })

    it("returns false when widthConfig.pixelWidth is set", () => {
      const element = ArrowProto.create({ useContainerWidth: true })
      const widthConfig = new streamlit.WidthConfig({ pixelWidth: 400 })

      expect(shouldUseContainerWidth(element, widthConfig)).toBe(false)
    })

    it("falls back to element.useContainerWidth when widthConfig is null", () => {
      const element = ArrowProto.create({ useContainerWidth: true })

      expect(shouldUseContainerWidth(element, null)).toBe(true)
    })

    it("falls back to element.useContainerWidth when widthConfig is undefined", () => {
      const element = ArrowProto.create({ useContainerWidth: false })

      expect(shouldUseContainerWidth(element, undefined)).toBe(false)
    })

    it("returns false when element.useContainerWidth is undefined", () => {
      const element = ArrowProto.create({})

      expect(shouldUseContainerWidth(element, null)).toBe(false)
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
      const element = ArrowProto.create({ width: 300 })
      const widthConfig = new streamlit.WidthConfig({ pixelWidth: 400 })

      expect(getConfiguredWidth(element, widthConfig)).toBe(400)
    })

    it("falls back to element.width when widthConfig is null", () => {
      const element = ArrowProto.create({ width: 300 })

      expect(getConfiguredWidth(element, null)).toBe(300)
    })

    it("returns element.width when element.width is not set (default value)", () => {
      const element = ArrowProto.create({})

      expect(getConfiguredWidth(element, null)).toBe(undefined)
    })

    it("returns undefined when widthConfig.pixelWidth is 0", () => {
      const element = ArrowProto.create({ width: 300 })
      const widthConfig = new streamlit.WidthConfig({ pixelWidth: 0 })

      expect(getConfiguredWidth(element, widthConfig)).toBe(undefined)
    })

    it("returns undefined when element.width is 0", () => {
      const element = ArrowProto.create({ width: 0 })

      expect(getConfiguredWidth(element, null)).toBe(undefined)
    })
  })

  describe("getConfiguredHeight", () => {
    it("returns heightConfig.pixelHeight when set", () => {
      const element = ArrowProto.create({ height: 300 })
      const heightConfig = new streamlit.HeightConfig({ pixelHeight: 400 })

      expect(getConfiguredHeight(element, heightConfig)).toBe(400)
    })

    it("falls back to element.height when heightConfig is null", () => {
      const element = ArrowProto.create({ height: 300 })

      expect(getConfiguredHeight(element, null)).toBe(300)
    })

    it("returns undefined when element.height is not set (default value)", () => {
      const element = ArrowProto.create({})

      expect(getConfiguredHeight(element, null)).toBe(undefined)
    })

    it("returns undefined when heightConfig.pixelHeight is 0", () => {
      const element = ArrowProto.create({ height: 300 })
      const heightConfig = new streamlit.HeightConfig({ pixelHeight: 0 })

      expect(getConfiguredHeight(element, heightConfig)).toBe(undefined)
    })

    it("returns undefined when element.height is 0", () => {
      const element = ArrowProto.create({ height: 0 })

      expect(getConfiguredHeight(element, null)).toBe(undefined)
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
