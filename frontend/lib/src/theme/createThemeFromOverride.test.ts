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

import { CustomThemeConfig, IThemeOverride } from "@streamlit/protobuf"

import {
  createThemeFromOverride,
  getThemeOverrideSurfaceFlags,
  isEmptyThemeOverride,
  mergeOverrideValues,
} from "./createThemeFromOverride"
import { CSS_NAMED_COLORS, isThemeApiColor } from "./cssNamedColors"
import { darkTheme, lightTheme } from "./themeConfigs"
import { createPresetThemes } from "./utils"

const PARENT_PRIMARY = "#ff00ff"
const PARENT_BG = "#abcdef"
const OVERRIDE_PRIMARY = "#7c3aed"
const LIGHT_SECTION_PRIMARY = "#111111"
const DARK_SECTION_PRIMARY = "#eeeeee"

const parentLight = {
  ...lightTheme.emotion,
  colors: {
    ...lightTheme.emotion.colors,
    primary: PARENT_PRIMARY,
    bgColor: PARENT_BG,
  },
}

const parentDark = {
  ...darkTheme.emotion,
  colors: {
    ...darkTheme.emotion.colors,
    primary: PARENT_PRIMARY,
  },
}

const availableThemes = createPresetThemes()

describe("isThemeApiColor", () => {
  it.each([
    "#008000",
    "#fff",
    "rgb(0, 128, 0)",
    "rgba(0, 128, 0, 0.5)",
    "green",
    "RebeccaPurple",
  ])("accepts %s", color => {
    expect(isThemeApiColor(color)).toBe(true)
  })

  it.each([
    "hsl(120, 100%, 25%)",
    "transparent",
    "currentColor",
    "primary",
    "#GGG",
    "rgb(not-a-color)",
    "rgb(0,0,0); position:fixed; inset:0",
  ])("rejects %s", color => {
    expect(isThemeApiColor(color)).toBe(false)
  })

  it("includes CSS Color Module Level 4 named colors", () => {
    expect(CSS_NAMED_COLORS.size).toBe(148)
    expect(CSS_NAMED_COLORS.has("rebeccapurple")).toBe(true)
    expect(CSS_NAMED_COLORS.has("transparent")).toBe(false)
  })
})

describe("isEmptyThemeOverride", () => {
  it("treats missing, empty, and inherit-only payloads as empty", () => {
    expect(isEmptyThemeOverride(undefined)).toBe(true)
    expect(isEmptyThemeOverride(null)).toBe(true)
    expect(isEmptyThemeOverride({})).toBe(true)
    expect(isEmptyThemeOverride({ values: {} })).toBe(true)
  })

  it("treats visual tokens and explicit base as non-empty", () => {
    expect(
      isEmptyThemeOverride({ values: { primaryColor: OVERRIDE_PRIMARY } })
    ).toBe(false)
    expect(
      isEmptyThemeOverride({
        base: CustomThemeConfig.BaseTheme.LIGHT,
      })
    ).toBe(false)
    expect(
      isEmptyThemeOverride({
        values: { showWidgetBorder: false },
      })
    ).toBe(false)
  })
})

describe("mergeOverrideValues", () => {
  it("does not drop false booleans", () => {
    const merged = mergeOverrideValues(
      {
        values: {
          showWidgetBorder: false,
          linkUnderline: false,
        },
      },
      true
    )
    expect(merged.showWidgetBorder).toBe(false)
    expect(merged.linkUnderline).toBe(false)
  })

  it("lets a variant false boolean replace a shared true value", () => {
    const merged = mergeOverrideValues(
      {
        values: {
          showWidgetBorder: true,
          light: { showWidgetBorder: false },
        },
      },
      true
    )
    expect(merged.showWidgetBorder).toBe(false)
  })
})

describe("getThemeOverrideSurfaceFlags", () => {
  it("paints background and text only when those tokens are set", () => {
    expect(
      getThemeOverrideSurfaceFlags(
        { values: { primaryColor: OVERRIDE_PRIMARY } },
        parentLight
      )
    ).toEqual({ applyBackgroundColor: false, applyTextColor: false })

    expect(
      getThemeOverrideSurfaceFlags(
        {
          values: {
            backgroundColor: "#fafaff",
            textColor: "#1f1733",
          },
        },
        parentLight
      )
    ).toEqual({ applyBackgroundColor: true, applyTextColor: true })
  })

  it("uses light-section tokens when the parent mode is light", () => {
    expect(
      getThemeOverrideSurfaceFlags(
        { values: { light: { backgroundColor: "#fafaff" } } },
        parentLight
      )
    ).toEqual({ applyBackgroundColor: true, applyTextColor: false })
  })

  it("paints variant background and text for an explicit base", () => {
    expect(
      getThemeOverrideSurfaceFlags(
        { base: CustomThemeConfig.BaseTheme.DARK },
        parentLight
      )
    ).toEqual({ applyBackgroundColor: true, applyTextColor: true })
  })
})

describe("createThemeFromOverride", () => {
  it("keeps the parent background for a primary-only inherit override", () => {
    const theme = createThemeFromOverride(
      { values: { primaryColor: OVERRIDE_PRIMARY } },
      parentLight,
      availableThemes
    )
    expect(theme.emotion.colors.primary).toBe(OVERRIDE_PRIMARY)
    expect(theme.emotion.colors.bgColor).toBe(PARENT_BG)
  })

  it("inherits unspecified radii from the parent emotion theme", () => {
    const parentWithRadius = {
      ...parentLight,
      radii: {
        ...parentLight.radii,
        button: "12px",
      },
    }
    const theme = createThemeFromOverride(
      { values: { primaryColor: OVERRIDE_PRIMARY } },
      parentWithRadius,
      availableThemes
    )
    expect(theme.emotion.radii.button).toBe("12px")
    expect(theme.emotion.colors.primary).toBe(OVERRIDE_PRIMARY)
  })

  it("does not leak parent tokens through an explicit light base", () => {
    const theme = createThemeFromOverride(
      {
        base: CustomThemeConfig.BaseTheme.LIGHT,
        values: { primaryColor: OVERRIDE_PRIMARY },
      },
      parentLight,
      availableThemes
    )
    expect(theme.emotion.colors.primary).toBe(OVERRIDE_PRIMARY)
    expect(theme.emotion.colors.bgColor).toBe(
      lightTheme.emotion.colors.bgColor
    )
    expect(theme.emotion.colors.bgColor).not.toBe(PARENT_BG)
  })

  it("does not leak an outer primary through an explicit dark base", () => {
    const theme = createThemeFromOverride(
      {
        base: CustomThemeConfig.BaseTheme.DARK,
        values: { backgroundColor: "#0d1117" },
      },
      parentLight,
      availableThemes
    )
    expect(theme.emotion.colors.primary).toBe(darkTheme.emotion.colors.primary)
    expect(theme.emotion.colors.primary).not.toBe(PARENT_PRIMARY)
    expect(theme.emotion.colors.bgColor).toBe("#0d1117")
    expect(theme.overlayBase).toBe(CustomThemeConfig.BaseTheme.DARK)
    expect(theme.name).toBe("Scoped")
  })

  it("keeps the selected name while overlayBase follows an explicit dark base", () => {
    const theme = createThemeFromOverride(
      { base: CustomThemeConfig.BaseTheme.DARK },
      parentLight,
      availableThemes,
      {
        name: "Custom Theme Light",
        displayName: "Light",
        parentThemeInput: {
          headingFont: "Inter",
          sidebar: { backgroundColor: "#f8f8ff" },
        },
      }
    )
    expect(theme.name).toBe("Custom Theme Light")
    expect(theme.displayName).toBe("Light")
    expect(theme.overlayBase).toBe(CustomThemeConfig.BaseTheme.DARK)
  })

  it("applies light and dark sections based on the parent mode", () => {
    const override: IThemeOverride = {
      values: {
        light: { primaryColor: LIGHT_SECTION_PRIMARY },
        dark: { primaryColor: DARK_SECTION_PRIMARY },
      },
    }
    const lightThemeFromParent = createThemeFromOverride(
      override,
      parentLight,
      availableThemes
    )
    const darkThemeFromParent = createThemeFromOverride(
      override,
      parentDark,
      availableThemes
    )
    expect(lightThemeFromParent.emotion.colors.primary).toBe(
      LIGHT_SECTION_PRIMARY
    )
    expect(darkThemeFromParent.emotion.colors.primary).toBe(
      DARK_SECTION_PRIMARY
    )
  })

  it("preserves inSidebar on the derived emotion theme", () => {
    const theme = createThemeFromOverride(
      { values: { primaryColor: OVERRIDE_PRIMARY } },
      parentLight,
      availableThemes,
      { inSidebar: true }
    )
    expect(theme.emotion.inSidebar).toBe(true)
  })

  it("preserves runtime name and displayName", () => {
    const theme = createThemeFromOverride(
      { values: { primaryColor: OVERRIDE_PRIMARY } },
      parentLight,
      availableThemes,
      { name: "Light", displayName: "Light" }
    )
    expect(theme.name).toBe("Light")
    expect(theme.displayName).toBe("Light")
    expect(theme.emotion.colors.primary).toBe(OVERRIDE_PRIMARY)
  })

  it("merges parent themeInput under overlay tokens", () => {
    const theme = createThemeFromOverride(
      { values: { primaryColor: OVERRIDE_PRIMARY } },
      parentLight,
      availableThemes,
      {
        parentThemeInput: {
          headingFont: "Inter",
          sidebar: { backgroundColor: "#111111" },
        },
      }
    )
    expect(theme.themeInput?.primaryColor).toBe(OVERRIDE_PRIMARY)
    expect(theme.themeInput?.headingFont).toBe("Inter")
    expect(theme.themeInput?.sidebar?.backgroundColor).toBe("#111111")
  })

  it("clears parent widget borders when showWidgetBorder is false", () => {
    const parentWithBorders = {
      ...parentLight,
      colors: {
        ...parentLight.colors,
        widgetBorderColor: "#cccccc",
      },
    }
    const theme = createThemeFromOverride(
      { values: { showWidgetBorder: false } },
      parentWithBorders,
      availableThemes
    )
    expect(theme.emotion.colors.widgetBorderColor).toBeUndefined()
  })
})
