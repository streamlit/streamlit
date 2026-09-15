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

import { opacify, parseToRgba, transparentize } from "color2k"
import { LinearGradient } from "vega"

import { Metric as MetricProto } from "@streamlit/protobuf"

import { darkTheme, lightTheme } from "~lib/theme/themeConfigs"
import { EmotionTheme } from "~lib/theme/types"

import {
  getMetricAreaGradient,
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

/** Returns a copy of `theme` with a custom `redBackgroundColor`. */
const withMetricBackgroundColor = (
  theme: EmotionTheme,
  redBackgroundColor: string
): EmotionTheme => ({
  ...theme,
  colors: { ...theme.colors, redBackgroundColor },
})

describe("getMetricAreaGradient", () => {
  const themeTestCases = [
    { themeName: "light", theme: lightTheme.emotion },
    { themeName: "dark", theme: darkTheme.emotion },
  ] as const

  const gradientColorTestCases = [
    MetricProto.MetricColor.RED,
    MetricProto.MetricColor.GREEN,
    MetricProto.MetricColor.GRAY,
    MetricProto.MetricColor.ORANGE,
    MetricProto.MetricColor.YELLOW,
    MetricProto.MetricColor.BLUE,
    MetricProto.MetricColor.VIOLET,
    MetricProto.MetricColor.PRIMARY,
  ] as const

  const allTestCases = themeTestCases.flatMap(({ themeName, theme }) =>
    gradientColorTestCases.map(protoColor => ({
      themeName,
      theme,
      protoColor,
    }))
  )

  /** Returns the gradient, failing the test if the flat-fill fallback was hit. */
  const getGradient = (
    theme: EmotionTheme,
    protoColor: MetricProto.MetricColor,
    baselineOffset = 1
  ): LinearGradient => {
    const gradient = getMetricAreaGradient(theme, protoColor, baselineOffset)
    if (typeof gradient === "string") {
      throw new Error(`Expected a gradient, got the flat fill ${gradient}`)
    }
    return gradient
  }

  // The gradient's geometry does not depend on the theme or the color, so one
  // case covers it.
  it("returns a top-to-bottom gradient", () => {
    const gradient = getGradient(
      darkTheme.emotion,
      MetricProto.MetricColor.RED
    )

    expect(gradient.gradient).toBe("linear")
    // A vertical gradient keeps x constant and varies y from 0 to 1.
    expect(gradient.x1).toBe(0)
    expect(gradient.x2).toBe(0)
    expect(gradient.y1).toBe(0)
    expect(gradient.y2).toBe(1)
    expect(gradient.stops.map(stop => stop.offset)).toEqual([0, 1])
  })

  it.each(allTestCases)(
    "fades color $protoColor out completely at the baseline in $themeName theme",
    ({ theme, protoColor }) => {
      const [topStop, baselineStop] = getGradient(theme, protoColor).stops

      expect(parseToRgba(baselineStop.color)[3]).toBe(0)
      // The fade must be a real fade, not two identical stops.
      expect(baselineStop.color).not.toBe(topStop.color)
    }
  )

  it.each(allTestCases)(
    "boosts color $protoColor above the flat fill's alpha in the default $themeName theme",
    ({ theme, protoColor }) => {
      const backgroundColor = getMetricBackgroundColor(theme, protoColor)
      const { stops } = getGradient(theme, protoColor)

      expect(stops[0].color).toBe(opacify(backgroundColor, 0.15))
      // Only holds because both default themes use translucent background
      // colors; see the opaque custom theme case below.
      expect(parseToRgba(stops[0].color)[3]).toBeGreaterThan(
        parseToRgba(backgroundColor)[3]
      )
    }
  )

  it("clamps the boost for an opaque custom theme background color", () => {
    const opaqueTheme = withMetricBackgroundColor(darkTheme.emotion, "#ffcccc")
    const { stops } = getGradient(opaqueTheme, MetricProto.MetricColor.RED)

    expect(parseToRgba(stops[0].color)[3]).toBe(1)
    expect(parseToRgba(stops[1].color)[3]).toBe(0)
  })

  it("falls back to the flat fill for a color color2k cannot parse", () => {
    // `currentcolor` passes the custom theme's CSS-parser validation but throws
    // in color2k, which would otherwise take down the whole element.
    const unparsableTheme = withMetricBackgroundColor(
      darkTheme.emotion,
      "currentcolor"
    )

    expect(
      getMetricAreaGradient(unparsableTheme, MetricProto.MetricColor.RED, 1)
    ).toBe("currentcolor")
  })

  it("fades out in both directions from a baseline inside the fill", () => {
    const { stops } = getGradient(
      darkTheme.emotion,
      MetricProto.MetricColor.RED,
      0.75
    )

    expect(stops.map(stop => stop.offset)).toEqual([0, 0.75, 1])
    // Transparent at the baseline, opaque again at both outer edges.
    expect(parseToRgba(stops[1].color)[3]).toBe(0)
    expect(stops[2].color).toBe(stops[0].color)
  })

  it("does not add a third stop when the baseline is the bottom edge", () => {
    const { stops } = getGradient(
      darkTheme.emotion,
      MetricProto.MetricColor.RED
    )

    expect(stops).toHaveLength(2)
    expect(parseToRgba(stops[1].color)[3]).toBe(0)
  })
})
