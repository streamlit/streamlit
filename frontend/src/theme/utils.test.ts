/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { CustomThemeConfig } from "autogen/proto"
import { LocalStore } from "lib/storageUtils"
import { baseTheme, darkTheme, lightTheme } from "theme"
import {
  AUTO_THEME,
  computeSpacingStyle,
  createEmotionTheme,
  createTheme,
  getDefaultTheme,
  getSystemTheme,
  isColor,
  toThemeInput,
} from "./utils"

const matchMediaFillers = {
  onchange: null,
  addListener: jest.fn(), // deprecated
  removeListener: jest.fn(), // deprecated
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}

describe("Styling utils", () => {
  describe("computeSpacingStyle", () => {
    test("pulls correct theme values", async () => {
      expect(computeSpacingStyle("sm md lg none", lightTheme.emotion)).toEqual(
        "0.5rem 0.75rem 1rem 0"
      )
      expect(computeSpacingStyle("xs  0  px  lg", lightTheme.emotion)).toEqual(
        "0.375rem 0 1px 1rem"
      )
    })
  })
})

describe("createTheme", () => {
  it("createTheme returns a theme", () => {
    const customThemeConfig = new CustomThemeConfig({
      name: "my theme",
      primaryColor: "red",
      secondaryBackgroundColor: "blue",
      font: CustomThemeConfig.FontFamily.SERIF,
    })
    const customTheme = createTheme(customThemeConfig)
    expect(customTheme.name).toBe("my theme")
    expect(customTheme.emotion.colors.primary).toBe("red")
    expect(customTheme.emotion.colors.secondaryBg).toBe("blue")
    expect(customTheme.emotion.genericFonts.bodyFont).toBe(
      baseTheme.emotion.fonts.serif
    )
    // If it is not provided, use the default
    expect(customTheme.emotion.colors.bgColor).toBe(
      baseTheme.emotion.colors.bgColor
    )
  })

  it("createTheme returns a theme based on a different theme", () => {
    const customThemeConfig = new CustomThemeConfig({
      name: "my theme",
      primaryColor: "red",
      secondaryBackgroundColor: "blue",
      font: CustomThemeConfig.FontFamily.SERIF,
    })
    const customTheme = createTheme(customThemeConfig, darkTheme)
    expect(customTheme.name).toBe("my theme")
    expect(customTheme.emotion.colors.primary).toBe("red")
    expect(customTheme.emotion.colors.secondaryBg).toBe("blue")
    expect(customTheme.emotion.genericFonts.bodyFont).toBe(
      baseTheme.emotion.fonts.serif
    )
    // If it is not provided, use the default
    expect(customTheme.emotion.colors.bgColor).toBe(
      darkTheme.emotion.colors.bgColor
    )
  })

  it("createTheme handles hex values without #", () => {
    const customThemeConfig = new CustomThemeConfig({
      name: "my theme",
      primaryColor: "eee",
      secondaryBackgroundColor: "fc9231",
      font: CustomThemeConfig.FontFamily.SERIF,
    })
    const customTheme = createTheme(customThemeConfig, darkTheme)
    expect(customTheme.name).toBe("my theme")
    expect(customTheme.emotion.colors.primary).toBe("#eee")
    expect(customTheme.emotion.colors.secondaryBg).toBe("#fc9231")
    expect(customTheme.emotion.genericFonts.bodyFont).toBe(
      customTheme.emotion.fonts.serif
    )
    // If it is not provided, use the default
    expect(customTheme.emotion.colors.bgColor).toBe(
      darkTheme.emotion.colors.bgColor
    )
  })
})

describe("getDefaultTheme", () => {
  beforeEach(() => {
    // sourced from:
    // https://jestjs.io/docs/en/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        ...matchMediaFillers,
      })),
    })
  })

  it("sets default to auto when nothing is available", () => {
    expect(getDefaultTheme().name).toBe(AUTO_THEME)
  })

  it("sets default when value in localstorage is available", () => {
    window.localStorage.setItem(
      LocalStore.ACTIVE_THEME,
      JSON.stringify(darkTheme)
    )
    expect(getDefaultTheme().name).toBe("Dark")
  })

  it("gets systemTheme if localstorage is auto", () => {
    window.localStorage.setItem(
      LocalStore.ACTIVE_THEME,
      JSON.stringify({
        ...darkTheme,
        name: AUTO_THEME,
      })
    )

    const defaultTheme = getDefaultTheme()
    expect(defaultTheme.name).toBe(AUTO_THEME)
    expect(defaultTheme.emotion.colors.bgColor).toBe(
      lightTheme.emotion.colors.bgColor
    )
  })

  it("sets default when OS is dark", () => {
    // sourced from:
    // https://jestjs.io/docs/en/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: true,
        media: query,
        ...matchMediaFillers,
      })),
    })
    const defaultTheme = getDefaultTheme()
    expect(defaultTheme.name).toBe(AUTO_THEME)
    expect(defaultTheme.emotion.colors.bgColor).toBe(
      darkTheme.emotion.colors.bgColor
    )
  })
})

describe("getSystemTheme", () => {
  it("sets to light when matchMedia does not match dark", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        ...matchMediaFillers,
      })),
    })

    expect(getSystemTheme().name).toBe("Light")
  })

  it("sets to dark when matchMedia does match dark", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: true,
        media: query,
        ...matchMediaFillers,
      })),
    })

    expect(getSystemTheme().name).toBe("Dark")
  })
})

describe("isColor", () => {
  // https://www.w3schools.com/cssref/css_colors_legal.asp
  it("works with valid colors", () => {
    expect(isColor("#fff")).toBe(true)
    expect(isColor("#ffffff")).toBe(true)
    expect(isColor("#ffffff0")).toBe(true)
    expect(isColor("#000")).toBe(true)
    expect(isColor("#000000")).toBe(true)
    expect(isColor("#fafafa")).toBe(true)
    expect(isColor("red")).toBe(true)
    expect(isColor("coral")).toBe(true)
    expect(isColor("transparent")).toBe(true)
    expect(isColor("rgb(0,0,0)")).toBe(true)
    expect(isColor("rgb(-1, 0, -255)")).toBe(true)
    expect(isColor("rgba(0,0,0,.5)")).toBe(true)
    expect(isColor("hsl(120,50%,40%)")).toBe(true)
    expect(isColor("hsl(120,50%,40%, .4)")).toBe(true)
    expect(isColor("currentColor")).toBe(true)
  })

  it("works with invalid colors", () => {
    expect(isColor("fff")).toBe(false)
    expect(isColor("cookies are delicious")).toBe(false)
    expect(isColor("")).toBe(false)
    expect(isColor("hsl(120,50,40)")).toBe(false)
  })
})

describe("createEmotionTheme", () => {
  it("sets to light when matchMedia does not match dark", () => {
    const themeInput: Partial<CustomThemeConfig> = {
      name: "my theme",
      font: CustomThemeConfig.FontFamily.MONOSPACE,
      primaryColor: "red",
      secondaryColor: "yellow",
      backgroundColor: "pink",
      secondaryBackgroundColor: "blue",
      textColor: "orange",
    }

    const theme = createEmotionTheme(themeInput)

    expect(theme.colors.primary).toBe("red")
    expect(theme.colors.secondary).toBe("yellow")
    expect(theme.colors.bgColor).toBe("pink")
    expect(theme.colors.secondaryBg).toBe("blue")
    expect(theme.colors.bodyText).toBe("orange")
    expect(theme.genericFonts.bodyFont).toBe(theme.fonts.monospace)
    expect(theme.genericFonts.headingFont).toBe(theme.fonts.monospace)
    expect(theme.genericFonts.codeFont).toBe(theme.fonts.monospace)
  })

  it("defaults to base if missing value", () => {
    const themeInput: Partial<CustomThemeConfig> = {
      name: "my theme",
      primaryColor: "red",
      secondaryColor: "yellow",
    }

    const theme = createEmotionTheme(themeInput)

    expect(theme.colors.primary).toBe("red")
    expect(theme.colors.secondary).toBe("yellow")
    expect(theme.colors.bgColor).toBe(baseTheme.emotion.colors.bgColor)
    expect(theme.colors.secondaryBg).toBe(baseTheme.emotion.colors.secondaryBg)
    expect(theme.colors.bodyText).toBe(baseTheme.emotion.colors.bodyText)
    expect(theme.genericFonts.bodyFont).toBe(
      baseTheme.emotion.genericFonts.bodyFont
    )
    expect(theme.genericFonts.headingFont).toBe(
      baseTheme.emotion.genericFonts.headingFont
    )
    expect(theme.genericFonts.codeFont).toBe(
      baseTheme.emotion.genericFonts.codeFont
    )
  })
})

describe("toComponentTheme", () => {
  it("converts from emotion theme to what a custom component expects", () => {
    const { colors, genericFonts } = lightTheme.emotion
    expect(toThemeInput(lightTheme.emotion)).toEqual({
      primaryColor: colors.primary,
      secondaryColor: colors.secondary,
      backgroundColor: colors.bgColor,
      secondaryBackgroundColor: colors.secondaryBg,
      textColor: colors.bodyText,
      font: genericFonts.bodyFont,
    })
  })
})
