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
  getDividerColors,
  getMarkdownBgColors,
  getMarkdownTextColors,
  getMetricBackgroundColor,
  getMetricColor,
  getMetricTextColor,
  hasLightBackgroundColor,
} from "./getColors"

describe("getDividerColors", () => {
  describe("light theme", () => {
    it("returns correct divider primitive colors for light theme", () => {
      expect(hasLightBackgroundColor(lightTheme.emotion)).toBe(true)
      const result = getDividerColors(lightTheme.emotion)

      // colors.red70
      expect(result.red).toBe("#ff4b4b")
      // colors.orange70
      expect(result.orange).toBe("#ffa421")
      // colors.yellow80
      expect(result.yellow).toBe("#faca2b")
      // colors.blue70
      expect(result.blue).toBe("#1c83e1")
      // colors.green70
      expect(result.green).toBe("#21c354")
      // colors.purple70
      expect(result.violet).toBe("#803df5")
      // colors.gray60
      expect(result.gray).toBe("#a3a8b8")
      // colors.gray60
      expect(result.grey).toBe("#a3a8b8")
      expect(result.rainbow).toBe(
        "linear-gradient(to right, #ff4b4b, #ffa421, #faca2b, #21c354, #1c83e1, #803df5)"
      )
    })

    it("matches the default theme colors", () => {
      const result = getDividerColors(lightTheme.emotion)
      const colors = lightTheme.emotion.colors

      expect(result.red).toBe(colors.redColor)
      expect(result.orange).toBe(colors.orangeColor)
      expect(result.yellow).toBe(colors.yellowColor)
      expect(result.blue).toBe(colors.blueColor)
      expect(result.green).toBe(colors.greenColor)
      expect(result.violet).toBe(colors.violetColor)
      expect(result.gray).toBe(colors.grayColor)
      expect(result.grey).toBe(colors.grayColor)
      expect(result.rainbow).toBe(
        `linear-gradient(to right, ${colors.redColor}, ${colors.orangeColor}, ${colors.yellowColor}, ${colors.greenColor}, ${colors.blueColor}, ${colors.violetColor})`
      )

      // Verify all colors are valid hex strings
      Object.entries(result).forEach(([key, value]) => {
        if (key !== "rainbow") {
          expect(value).toMatch(/^#[0-9a-fA-F]{6}$/)
        }
      })
    })

    it("gray and grey properties are identical", () => {
      const result = getDividerColors(lightTheme.emotion)
      expect(result.gray).toBe(result.grey)
    })

    it("rainbow gradient contains all colors in consistent order", () => {
      const result = getDividerColors(lightTheme.emotion)
      const expectedOrder = [
        result.red,
        result.orange,
        result.yellow,
        result.green,
        result.blue,
        result.violet,
      ]

      expect(result.rainbow).toBe(
        "linear-gradient(to right, #ff4b4b, #ffa421, #faca2b, #21c354, #1c83e1, #803df5)"
      )
      const gradientColors = result.rainbow.match(/#[0-9a-fA-F]{6}/g)
      expect(gradientColors).toEqual(expectedOrder)
    })
  })

  describe("dark theme", () => {
    it("returns correct divider primitive colors for dark theme", () => {
      expect(hasLightBackgroundColor(darkTheme.emotion)).toBe(false)
      const result = getDividerColors(darkTheme.emotion)

      // colors.red80
      expect(result.red).toBe("#ff2b2b")
      // colors.orange80
      expect(result.orange).toBe("#ff8700")
      // colors.yellow70
      expect(result.yellow).toBe("#ffe312")
      // colors.blue80
      expect(result.blue).toBe("#0068c9")
      // colors.green80
      expect(result.green).toBe("#09ab3b")
      // colors.purple70
      expect(result.violet).toBe("#803df5")
      // colors.gray80
      expect(result.gray).toBe("#555867")
      // colors.gray80
      expect(result.grey).toBe("#555867")
      expect(result.rainbow).toBe(
        "linear-gradient(to right, #ff2b2b, #ff8700, #ffe312, #09ab3b, #0068c9, #803df5)"
      )
    })

    it("matches the default theme colors", () => {
      const result = getDividerColors(darkTheme.emotion)
      const colors = darkTheme.emotion.colors

      expect(result.red).toBe(colors.redColor)
      expect(result.orange).toBe(colors.orangeColor)
      expect(result.yellow).toBe(colors.yellowColor)
      expect(result.blue).toBe(colors.blueColor)
      expect(result.green).toBe(colors.greenColor)
      expect(result.violet).toBe(colors.violetColor)
      expect(result.gray).toBe(colors.grayColor)
      expect(result.grey).toBe(colors.grayColor)
      expect(result.rainbow).toBe(
        `linear-gradient(to right, ${colors.redColor}, ${colors.orangeColor}, ${colors.yellowColor}, ${colors.greenColor}, ${colors.blueColor}, ${colors.violetColor})`
      )

      // Verify all colors are valid hex strings
      Object.entries(result).forEach(([key, value]) => {
        if (key !== "rainbow") {
          expect(value).toMatch(/^#[0-9a-fA-F]{6}$/)
        }
      })
    })

    it("gray and grey properties are identical", () => {
      const result = getDividerColors(darkTheme.emotion)
      expect(result.gray).toBe(result.grey)
    })

    it("rainbow gradient contains all colors in consistent order", () => {
      const result = getDividerColors(darkTheme.emotion)
      const expectedOrder = [
        result.red,
        result.orange,
        result.yellow,
        result.green,
        result.blue,
        result.violet,
      ]

      expect(result.rainbow).toBe(
        "linear-gradient(to right, #ff2b2b, #ff8700, #ffe312, #09ab3b, #0068c9, #803df5)"
      )
      const gradientColors = result.rainbow.match(/#[0-9a-fA-F]{6}/g)
      expect(gradientColors).toEqual(expectedOrder)
    })
  })
})

describe("getMarkdownBgColors", () => {
  it("returns correct background colors for light theme", () => {
    const result = getMarkdownBgColors(lightTheme.emotion)
    const colors = lightTheme.emotion.colors

    expect(result.redbg).toBe(colors.redBackgroundColor)
    expect(result.orangebg).toBe(colors.orangeBackgroundColor)
    expect(result.yellowbg).toBe(colors.yellowBackgroundColor)
    expect(result.bluebg).toBe(colors.blueBackgroundColor)
    expect(result.greenbg).toBe(colors.greenBackgroundColor)
    expect(result.violetbg).toBe(colors.violetBackgroundColor)
    expect(result.graybg).toBe(colors.grayBackgroundColor)
    expect(result.purplebg).toBe(transparentize(colors.purple90, 0.9))
    expect(result.primarybg).toBe(transparentize(colors.primary, 0.9))
  })

  it("returns correct background colors for dark theme", () => {
    const result = getMarkdownBgColors(darkTheme.emotion)
    const colors = darkTheme.emotion.colors

    expect(result.redbg).toBe(colors.redBackgroundColor)
    expect(result.orangebg).toBe(colors.orangeBackgroundColor)
    expect(result.yellowbg).toBe(colors.yellowBackgroundColor)
    expect(result.bluebg).toBe(colors.blueBackgroundColor)
    expect(result.greenbg).toBe(colors.greenBackgroundColor)
    expect(result.violetbg).toBe(colors.violetBackgroundColor)
    expect(result.graybg).toBe(colors.grayBackgroundColor)
    expect(result.purplebg).toBe(transparentize(colors.purple80, 0.7))
    expect(result.primarybg).toBe(transparentize(colors.primary, 0.7))
  })
})

describe("getMarkdownTextColors", () => {
  it("returns correct text colors for light theme", () => {
    const result = getMarkdownTextColors(lightTheme.emotion)
    const colors = lightTheme.emotion.colors

    expect(result.red).toBe(colors.redTextColor)
    expect(result.orange).toBe(colors.orangeTextColor)
    expect(result.yellow).toBe(colors.yellowTextColor)
    expect(result.blue).toBe(colors.blueTextColor)
    expect(result.green).toBe(colors.greenTextColor)
    expect(result.violet).toBe(colors.violetTextColor)
    expect(result.purple).toBe(colors.purple100)
    expect(result.gray).toBe(colors.grayTextColor)
    expect(result.primary).toBe(colors.primary)
  })

  it("returns correct text colors for dark theme", () => {
    const result = getMarkdownTextColors(darkTheme.emotion)
    const colors = darkTheme.emotion.colors

    expect(result.red).toBe(colors.redTextColor)
    expect(result.orange).toBe(colors.orangeTextColor)
    expect(result.yellow).toBe(colors.yellowTextColor)
    expect(result.blue).toBe(colors.blueTextColor)
    expect(result.green).toBe(colors.greenTextColor)
    expect(result.violet).toBe(colors.violetTextColor)
    expect(result.purple).toBe(colors.purple80)
    expect(result.gray).toBe(colors.grayTextColor)
    expect(result.primary).toBe(colors.primary)
  })
})

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
