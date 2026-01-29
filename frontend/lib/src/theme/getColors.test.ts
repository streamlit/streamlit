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

import { transparentize } from "color2k"

import { darkTheme, lightTheme } from "~lib/theme/index"

import {
  BUILTIN_COLOR_NAMES,
  getDividerColors,
  getMarkdownTextColors,
  getThemeBackgroundColors,
  hasLightBackgroundColor,
  isBuiltinColorName,
  resolveBuiltinBackgroundColor,
  resolveBuiltinColor,
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

      // Verify all colors are valid hex strings (excluding rainbow which is a gradient)
      const colorEntries = Object.entries(result).filter(
        ([key]) => key !== "rainbow"
      )
      colorEntries.forEach(([_, value]) => {
        expect(value).toMatch(/^#[0-9a-fA-F]{6}$/)
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

      // Verify all colors are valid hex strings (excluding rainbow which is a gradient)
      const colorEntries = Object.entries(result).filter(
        ([key]) => key !== "rainbow"
      )
      colorEntries.forEach(([_, value]) => {
        expect(value).toMatch(/^#[0-9a-fA-F]{6}$/)
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

describe("getThemeBackgroundColors", () => {
  it("returns correct background colors for light theme", () => {
    const result = getThemeBackgroundColors(lightTheme.emotion)
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
    const result = getThemeBackgroundColors(darkTheme.emotion)
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

describe("BUILTIN_COLOR_NAMES", () => {
  it("contains all expected color names", () => {
    const expectedColors = [
      "red",
      "orange",
      "yellow",
      "green",
      "blue",
      "violet",
      "gray",
      "grey",
      "primary",
    ]
    expectedColors.forEach(color => {
      expect(BUILTIN_COLOR_NAMES.has(color)).toBe(true)
    })
    expect(BUILTIN_COLOR_NAMES.size).toBe(expectedColors.length)
  })
})

describe("isBuiltinColorName", () => {
  it("returns true for valid builtin color names", () => {
    expect(isBuiltinColorName("red")).toBe(true)
    expect(isBuiltinColorName("blue")).toBe(true)
    expect(isBuiltinColorName("primary")).toBe(true)
    expect(isBuiltinColorName("gray")).toBe(true)
    expect(isBuiltinColorName("grey")).toBe(true)
  })

  it("returns true for uppercase color names (case insensitive)", () => {
    expect(isBuiltinColorName("RED")).toBe(true)
    expect(isBuiltinColorName("Blue")).toBe(true)
    expect(isBuiltinColorName("PRIMARY")).toBe(true)
  })

  it("returns false for non-builtin colors", () => {
    expect(isBuiltinColorName("#ff0000")).toBe(false)
    expect(isBuiltinColorName("pink")).toBe(false)
    expect(isBuiltinColorName("rgb(255, 0, 0)")).toBe(false)
  })

  it("returns false for non-string values", () => {
    expect(isBuiltinColorName(null)).toBe(false)
    expect(isBuiltinColorName(undefined)).toBe(false)
    expect(isBuiltinColorName(123)).toBe(false)
    expect(isBuiltinColorName({})).toBe(false)
  })
})

describe("resolveBuiltinColor", () => {
  it("resolves builtin color names to theme colors for light theme", () => {
    const colors = lightTheme.emotion.colors

    expect(resolveBuiltinColor("red", lightTheme.emotion)).toBe(
      colors.redColor
    )
    expect(resolveBuiltinColor("orange", lightTheme.emotion)).toBe(
      colors.orangeColor
    )
    expect(resolveBuiltinColor("yellow", lightTheme.emotion)).toBe(
      colors.yellowColor
    )
    expect(resolveBuiltinColor("green", lightTheme.emotion)).toBe(
      colors.greenColor
    )
    expect(resolveBuiltinColor("blue", lightTheme.emotion)).toBe(
      colors.blueColor
    )
    expect(resolveBuiltinColor("violet", lightTheme.emotion)).toBe(
      colors.violetColor
    )
    expect(resolveBuiltinColor("gray", lightTheme.emotion)).toBe(
      colors.grayColor
    )
    expect(resolveBuiltinColor("grey", lightTheme.emotion)).toBe(
      colors.grayColor
    )
    expect(resolveBuiltinColor("primary", lightTheme.emotion)).toBe(
      colors.primary
    )
  })

  it("resolves builtin color names to theme colors for dark theme", () => {
    const colors = darkTheme.emotion.colors

    expect(resolveBuiltinColor("red", darkTheme.emotion)).toBe(colors.redColor)
    expect(resolveBuiltinColor("blue", darkTheme.emotion)).toBe(
      colors.blueColor
    )
    expect(resolveBuiltinColor("primary", darkTheme.emotion)).toBe(
      colors.primary
    )
  })

  it("handles case-insensitive color names", () => {
    const colors = lightTheme.emotion.colors

    expect(resolveBuiltinColor("RED", lightTheme.emotion)).toBe(
      colors.redColor
    )
    expect(resolveBuiltinColor("Blue", lightTheme.emotion)).toBe(
      colors.blueColor
    )
    expect(resolveBuiltinColor("PRIMARY", lightTheme.emotion)).toBe(
      colors.primary
    )
  })

  it("returns non-builtin colors unchanged", () => {
    expect(resolveBuiltinColor("#ff0000", lightTheme.emotion)).toBe("#ff0000")
    expect(resolveBuiltinColor("pink", lightTheme.emotion)).toBe("pink")
    expect(resolveBuiltinColor("rgb(255, 0, 0)", lightTheme.emotion)).toBe(
      "rgb(255, 0, 0)"
    )
  })

  it("does not resolve purple (no purpleColor exists, use violet instead)", () => {
    // "purple" is not a built-in color name - it passes through unchanged
    // This differs from resolveBuiltinBackgroundColor which DOES support "purple"
    expect(resolveBuiltinColor("purple", lightTheme.emotion)).toBe("purple")

    // Use "violet" for the main color
    expect(resolveBuiltinColor("violet", lightTheme.emotion)).toBe(
      lightTheme.emotion.colors.violetColor
    )
  })
})

describe("resolveBuiltinBackgroundColor", () => {
  it("resolves builtin color names to background colors for light theme", () => {
    const bgColors = getThemeBackgroundColors(lightTheme.emotion)

    expect(resolveBuiltinBackgroundColor("red", lightTheme.emotion)).toBe(
      bgColors.redbg
    )
    expect(resolveBuiltinBackgroundColor("orange", lightTheme.emotion)).toBe(
      bgColors.orangebg
    )
    expect(resolveBuiltinBackgroundColor("yellow", lightTheme.emotion)).toBe(
      bgColors.yellowbg
    )
    expect(resolveBuiltinBackgroundColor("green", lightTheme.emotion)).toBe(
      bgColors.greenbg
    )
    expect(resolveBuiltinBackgroundColor("blue", lightTheme.emotion)).toBe(
      bgColors.bluebg
    )
    expect(resolveBuiltinBackgroundColor("violet", lightTheme.emotion)).toBe(
      bgColors.violetbg
    )
    expect(resolveBuiltinBackgroundColor("purple", lightTheme.emotion)).toBe(
      bgColors.purplebg
    )
    expect(resolveBuiltinBackgroundColor("gray", lightTheme.emotion)).toBe(
      bgColors.graybg
    )
    expect(resolveBuiltinBackgroundColor("grey", lightTheme.emotion)).toBe(
      bgColors.graybg
    )
    expect(resolveBuiltinBackgroundColor("primary", lightTheme.emotion)).toBe(
      bgColors.primarybg
    )
  })

  it("resolves builtin color names to background colors for dark theme", () => {
    const bgColors = getThemeBackgroundColors(darkTheme.emotion)

    expect(resolveBuiltinBackgroundColor("red", darkTheme.emotion)).toBe(
      bgColors.redbg
    )
    expect(resolveBuiltinBackgroundColor("blue", darkTheme.emotion)).toBe(
      bgColors.bluebg
    )
    expect(resolveBuiltinBackgroundColor("primary", darkTheme.emotion)).toBe(
      bgColors.primarybg
    )
  })

  it("handles case-insensitive color names", () => {
    const bgColors = getThemeBackgroundColors(lightTheme.emotion)

    expect(resolveBuiltinBackgroundColor("RED", lightTheme.emotion)).toBe(
      bgColors.redbg
    )
    expect(resolveBuiltinBackgroundColor("Blue", lightTheme.emotion)).toBe(
      bgColors.bluebg
    )
    expect(resolveBuiltinBackgroundColor("PRIMARY", lightTheme.emotion)).toBe(
      bgColors.primarybg
    )
  })

  it("returns non-builtin colors unchanged", () => {
    expect(resolveBuiltinBackgroundColor("#ff0000", lightTheme.emotion)).toBe(
      "#ff0000"
    )
    expect(resolveBuiltinBackgroundColor("pink", lightTheme.emotion)).toBe(
      "pink"
    )
    expect(
      resolveBuiltinBackgroundColor("rgb(255, 0, 0)", lightTheme.emotion)
    ).toBe("rgb(255, 0, 0)")
  })

  it("has distinct purple and violet background colors", () => {
    const bgColors = getThemeBackgroundColors(lightTheme.emotion)

    expect(resolveBuiltinBackgroundColor("purple", lightTheme.emotion)).toBe(
      bgColors.purplebg
    )
    expect(resolveBuiltinBackgroundColor("violet", lightTheme.emotion)).toBe(
      bgColors.violetbg
    )
    // Unlike main colors, purple and violet have distinct background colors
    expect(bgColors.purplebg).not.toBe(bgColors.violetbg)
  })
})
