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

import { transparentize } from "color2k"

import { Metric as MetricProto } from "@streamlit/protobuf"

import { darkTheme, lightTheme } from "~lib/theme/index"

import {
  getMetricBackgroundColor,
  getMetricColor,
  getMetricTextColor,
} from "./metricColors"

describe("getMetricColor", () => {
  const metricColorTestCases = [
    { protoColor: MetricProto.MetricColor.RED, colorKey: "redColor" },
    { protoColor: MetricProto.MetricColor.GREEN, colorKey: "greenColor" },
    { protoColor: MetricProto.MetricColor.GRAY, colorKey: "grayColor" },
    { protoColor: MetricProto.MetricColor.ORANGE, colorKey: "orangeColor" },
    { protoColor: MetricProto.MetricColor.YELLOW, colorKey: "yellowColor" },
    { protoColor: MetricProto.MetricColor.BLUE, colorKey: "blueColor" },
    { protoColor: MetricProto.MetricColor.VIOLET, colorKey: "violetColor" },
    { protoColor: MetricProto.MetricColor.PRIMARY, colorKey: "primary" },
  ] as const

  it.each(metricColorTestCases)(
    "returns $colorKey for light theme",
    ({ protoColor, colorKey }) => {
      expect(getMetricColor(lightTheme.emotion, protoColor)).toBe(
        lightTheme.emotion.colors[colorKey]
      )
    }
  )

  it.each(metricColorTestCases)(
    "returns $colorKey for dark theme",
    ({ protoColor, colorKey }) => {
      expect(getMetricColor(darkTheme.emotion, protoColor)).toBe(
        darkTheme.emotion.colors[colorKey]
      )
    }
  )
})

describe("getMetricBackgroundColor", () => {
  const bgColorTestCases = [
    {
      protoColor: MetricProto.MetricColor.RED,
      colorKey: "redBackgroundColor",
    },
    {
      protoColor: MetricProto.MetricColor.GREEN,
      colorKey: "greenBackgroundColor",
    },
    {
      protoColor: MetricProto.MetricColor.GRAY,
      colorKey: "grayBackgroundColor",
    },
    {
      protoColor: MetricProto.MetricColor.ORANGE,
      colorKey: "orangeBackgroundColor",
    },
    {
      protoColor: MetricProto.MetricColor.YELLOW,
      colorKey: "yellowBackgroundColor",
    },
    {
      protoColor: MetricProto.MetricColor.BLUE,
      colorKey: "blueBackgroundColor",
    },
    {
      protoColor: MetricProto.MetricColor.VIOLET,
      colorKey: "violetBackgroundColor",
    },
  ] as const

  it.each(bgColorTestCases)(
    "returns $colorKey for light theme",
    ({ protoColor, colorKey }) => {
      expect(getMetricBackgroundColor(lightTheme.emotion, protoColor)).toBe(
        lightTheme.emotion.colors[colorKey]
      )
    }
  )

  it.each(bgColorTestCases)(
    "returns $colorKey for dark theme",
    ({ protoColor, colorKey }) => {
      expect(getMetricBackgroundColor(darkTheme.emotion, protoColor)).toBe(
        darkTheme.emotion.colors[colorKey]
      )
    }
  )

  it("returns computed primary background color for light theme", () => {
    expect(
      getMetricBackgroundColor(
        lightTheme.emotion,
        MetricProto.MetricColor.PRIMARY
      )
    ).toBe(transparentize(lightTheme.emotion.colors.primary, 0.9))
  })

  it("returns computed primary background color for dark theme", () => {
    expect(
      getMetricBackgroundColor(
        darkTheme.emotion,
        MetricProto.MetricColor.PRIMARY
      )
    ).toBe(transparentize(darkTheme.emotion.colors.primary, 0.7))
  })
})

describe("getMetricTextColor", () => {
  const textColorTestCases = [
    { protoColor: MetricProto.MetricColor.RED, colorKey: "redTextColor" },
    { protoColor: MetricProto.MetricColor.GREEN, colorKey: "greenTextColor" },
    { protoColor: MetricProto.MetricColor.GRAY, colorKey: "grayTextColor" },
    {
      protoColor: MetricProto.MetricColor.ORANGE,
      colorKey: "orangeTextColor",
    },
    {
      protoColor: MetricProto.MetricColor.YELLOW,
      colorKey: "yellowTextColor",
    },
    { protoColor: MetricProto.MetricColor.BLUE, colorKey: "blueTextColor" },
    {
      protoColor: MetricProto.MetricColor.VIOLET,
      colorKey: "violetTextColor",
    },
    { protoColor: MetricProto.MetricColor.PRIMARY, colorKey: "primary" },
  ] as const

  it.each(textColorTestCases)(
    "returns $colorKey for light theme",
    ({ protoColor, colorKey }) => {
      expect(getMetricTextColor(lightTheme.emotion, protoColor)).toBe(
        lightTheme.emotion.colors[colorKey]
      )
    }
  )

  it.each(textColorTestCases)(
    "returns $colorKey for dark theme",
    ({ protoColor, colorKey }) => {
      expect(getMetricTextColor(darkTheme.emotion, protoColor)).toBe(
        darkTheme.emotion.colors[colorKey]
      )
    }
  )
})
