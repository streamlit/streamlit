/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import camelcase from "camelcase"
import { getLuminance, parseToRgba, toHex } from "color2k"
import decamelize from "decamelize"
import cloneDeep from "lodash/cloneDeep"
import isObject from "lodash/isObject"
import merge from "lodash/merge"
import once from "lodash/once"

import {
  CustomThemeConfig,
  ICustomThemeConfig,
} from "@streamlit/lib/src/proto"
import {
  baseTheme,
  CachedTheme,
  darkTheme,
  EmotionTheme,
  lightTheme,
  ThemeConfig,
  ThemeSpacing,
} from "@streamlit/lib/src/theme"
import { logError } from "@streamlit/lib/src/util/log"
import {
  localStorageAvailable,
  LocalStore,
} from "@streamlit/lib/src/util/storageUtils"
import {
  isDarkThemeInQueryParams,
  isLightThemeInQueryParams,
  notNullOrUndefined,
} from "@streamlit/lib/src/util/utils"

import { createBaseUiTheme } from "./createThemeUtil"
import {
  computeDerivedColors,
  createEmotionColors,
  DerivedColors,
} from "./getColors"
import { fonts } from "./primitives/typography"

export const AUTO_THEME_NAME = "Use system setting"
export const CUSTOM_THEME_NAME = "Custom Theme"

declare global {
  interface Window {
    __streamlit?: {
      LIGHT_THEME: ICustomThemeConfig
      DARK_THEME: ICustomThemeConfig
    }
  }
}

function mergeTheme(
  theme: ThemeConfig,
  injectedTheme: ICustomThemeConfig | undefined
): ThemeConfig {
  // We confirm the injectedTheme is a valid object before merging it
  // since the type makes assumption about the implementation of the
  // injected object.
  if (injectedTheme && isObject(injectedTheme)) {
    const themeConfigProto = new CustomThemeConfig(injectedTheme)
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return createTheme(theme.name, themeConfigProto, theme)
  }

  return theme
}

export const getMergedLightTheme = once(() =>
  mergeTheme(lightTheme, window.__streamlit?.LIGHT_THEME)
)
export const getMergedDarkTheme = once(() =>
  mergeTheme(darkTheme, window.__streamlit?.DARK_THEME)
)

export const getSystemTheme = (): ThemeConfig => {
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? getMergedDarkTheme()
    : getMergedLightTheme()
}

export const createAutoTheme = (): ThemeConfig => ({
  ...getSystemTheme(),
  name: AUTO_THEME_NAME,
})

// Update auto theme in case it has changed
export const createPresetThemes = (): ThemeConfig[] => [
  createAutoTheme(),
  getMergedLightTheme(),
  getMergedDarkTheme(),
]

export const isPresetTheme = (themeConfig: ThemeConfig): boolean => {
  const presetThemeNames = createPresetThemes().map((t: ThemeConfig) => t.name)
  return presetThemeNames.includes(themeConfig.name)
}

export const fontToEnum = (font: string): CustomThemeConfig.FontFamily => {
  const fontStyle = Object.keys(fonts).find(
    (fontType: string) => fonts[fontType] === font
  )
  const defaultFont = CustomThemeConfig.FontFamily.SANS_SERIF
  if (fontStyle) {
    const parsedFontStyle = decamelize(fontStyle).toUpperCase()
    return parsedFontStyle in CustomThemeConfig.FontFamily
      ? // @ts-expect-error
        CustomThemeConfig.FontFamily[parsedFontStyle]
      : defaultFont
  }
  return defaultFont
}

export const fontEnumToString = (
  font: CustomThemeConfig.FontFamily | null | undefined
): string | undefined =>
  font !== null &&
  font !== undefined && // font can be 0 for sans serif
  font in CustomThemeConfig.FontFamily
    ? fonts[
        camelcase(
          CustomThemeConfig.FontFamily[font].toString()
        ) as keyof typeof fonts
      ]
    : undefined

export const bgColorToBaseString = (bgColor?: string): string =>
  bgColor === undefined || getLuminance(bgColor) > 0.5 ? "light" : "dark"

export const isColor = (strColor: string): boolean => {
  const s = new Option().style
  s.color = strColor
  return s.color !== ""
}

export const createEmotionTheme = (
  themeInput: Partial<ICustomThemeConfig>,
  baseThemeConfig = baseTheme
): EmotionTheme => {
  const { colors, genericFonts } = baseThemeConfig.emotion
  const {
    font,
    radii,
    roundedness,
    spacing,
    linkColor,
    fontSizes,
    ...customColors
  } = themeInput

  // TODO(lukasmasuch) check this since it might never return undefined
  const parsedFont = fontEnumToString(font)

  const parsedColors = Object.entries(customColors).reduce(
    (colors: Record<string, string>, [key, color]) => {
      // @ts-expect-error
      if (isColor(color)) {
        // @ts-expect-error
        colors[key] = color
      } else if (isColor(`#${color}`)) {
        colors[key] = `#${color}`
      }
      return colors
    },
    {}
  )

  // TODO: create an enum for this. Updating everything if a
  // config option changes is a pain
  // Mapping from CustomThemeConfig to color primitives
  const {
    secondaryBackgroundColor: secondaryBg,
    backgroundColor: bgColor,
    sidebarTextColor: sidebarTextColor,
    sidebarBackgroundColor: sidebarBackgroundColor,
    sidebarSecondaryBackgroundColor: sidebarSecondaryBackgroundColor,
    primaryColor: primary,
    textColor: bodyText,
    skeletonBackgroundColor,
    widgetBackgroundColor,
    widgetBorderColor,
    borderColor,
  } = parsedColors
  console.log(
    "DEBUG parsedColors",
    primary,
    bodyText,
    sidebarTextColor,
    sidebarBackgroundColor,
    sidebarSecondaryBackgroundColor
  )

  const newGenericColors = { ...colors }

  if (primary) newGenericColors.primary = primary
  if (bodyText) newGenericColors.bodyText = bodyText
  if (secondaryBg) newGenericColors.secondaryBg = secondaryBg
  if (bgColor) newGenericColors.bgColor = bgColor
  if (sidebarTextColor) newGenericColors.sidebarTextColor = sidebarTextColor
  if (sidebarBackgroundColor)
    newGenericColors.sidebarBackgroundColor = sidebarBackgroundColor
  if (sidebarSecondaryBackgroundColor)
    newGenericColors.sidebarSecondaryBackgroundColor =
      sidebarSecondaryBackgroundColor
  if (widgetBackgroundColor)
    newGenericColors.widgetBackgroundColor = widgetBackgroundColor
  if (widgetBorderColor) newGenericColors.widgetBorderColor = widgetBorderColor
  if (skeletonBackgroundColor)
    newGenericColors.skeletonBackgroundColor = skeletonBackgroundColor

  if (linkColor) {
    newGenericColors.linkText = linkColor
  }

  const conditionalOverrides: any = {}

  conditionalOverrides.colors = createEmotionColors(newGenericColors)
  if (notNullOrUndefined(themeInput.sidebarShadow)) {
    conditionalOverrides.alwaysShowSidebarShadow = themeInput.sidebarShadow
  }

  if (borderColor) {
    conditionalOverrides.colors.borderColor = borderColor
  }

  if (notNullOrUndefined(roundedness)) {
    conditionalOverrides.radii = {
      ...baseThemeConfig.emotion.radii,
    }

    // Normalize the roundedness to be between 0 and 1.5rem.
    const baseRadii = Math.max(0, Math.min(roundedness, 1)) * 1.5
    conditionalOverrides.radii.default = addRemUnit(baseRadii)
    conditionalOverrides.radii.md = addRemUnit(baseRadii * 0.5)
    conditionalOverrides.radii.xl = addRemUnit(baseRadii * 1.5)
    conditionalOverrides.radii.xxl = addRemUnit(baseRadii * 2)
  }

  if (notNullOrUndefined(spacing)) {
    conditionalOverrides.spacing = {
      ...baseThemeConfig.emotion.spacing,
    }

    // threeXS: "0.125rem",
    // twoXS: "0.25rem",
    // xs: "0.375rem",
    // sm: "0.5rem",
    // md: "0.75rem",
    // lg: "1rem",
    // xl: "1.25rem",
    // twoXL: "1.5rem",
    // threeXL: "2rem",
    // fourXL: "4rem",

    // Normalize the spacing to be between 0.5 and 2rem
    const baseSpacing = 0.5 + Math.max(0, Math.min(spacing, 1)) * 1.5

    conditionalOverrides.spacing.threeXS = addRemUnit(baseSpacing * 0.125)
    conditionalOverrides.spacing.twoXS = addRemUnit(baseSpacing * 0.25)
    conditionalOverrides.spacing.xs = addRemUnit(baseSpacing * 0.375)
    conditionalOverrides.spacing.sm = addRemUnit(baseSpacing * 0.5)
    conditionalOverrides.spacing.md = addRemUnit(baseSpacing * 0.75)
    conditionalOverrides.spacing.lg = addRemUnit(baseSpacing)
    conditionalOverrides.spacing.xl = addRemUnit(baseSpacing * 1.25)
    conditionalOverrides.spacing.twoXL = addRemUnit(baseSpacing * 1.5)
    conditionalOverrides.spacing.threeXL = addRemUnit(baseSpacing * 2)

    console.log("spacing", conditionalOverrides)
  }

  if (radii) {
    conditionalOverrides.radii = {
      ...baseThemeConfig.emotion.radii,
    }

    if (radii.checkboxRadius)
      conditionalOverrides.radii.md = addPxUnit(radii.checkboxRadius)
    if (radii.baseWidgetRadius)
      conditionalOverrides.radii.default = addPxUnit(radii.baseWidgetRadius)
  }

  if (fontSizes) {
    //     const fontSizeTwoSmall = 12
    // const fontSizeSmall = 14
    // const fontSizeMedium = 16

    // export const fontSizes = {
    // twoSm: `${fontSizeTwoSmall}px`, // Use px to force sm to be a round number.
    // sm: `${fontSizeSmall}px`, // Use px to force sm to be a round number.
    // md: "1rem",
    // mdLg: "1.125rem",
    // lg: "1.25rem",
    // xl: "1.5rem",
    // twoXL: "1.75rem",
    // threeXL: "2.25rem",
    // fourXL: "2.75rem",

    // twoSmPx: fontSizeTwoSmall, // twoSm but as a number, in pixels
    // smPx: fontSizeSmall, // sm but as a number, in pixels
    // mdPx: fontSizeMedium, // med but as a number, in pixels

    conditionalOverrides.fontSizes = {
      ...baseThemeConfig.emotion.fontSizes,
    }

    if (fontSizes.baseFontSize) {
      conditionalOverrides.fontSizes.twoSm = addPxUnit(
        fontSizes.baseFontSize * 0.75
      )
      conditionalOverrides.fontSizes.twoSmPx = fontSizes.baseFontSize * 0.75

      conditionalOverrides.fontSizes.sm = addPxUnit(
        fontSizes.baseFontSize * 0.875
      )
      conditionalOverrides.fontSizes.smPx = fontSizes.baseFontSize * 0.875

      conditionalOverrides.fontSizes.md = addPxUnit(fontSizes.baseFontSize)
      conditionalOverrides.fontSizes.mdPx = fontSizes.baseFontSize

      conditionalOverrides.fontSizes.mdLg = addPxUnit(
        fontSizes.baseFontSize * 1.125
      )
      conditionalOverrides.fontSizes.lg = addPxUnit(
        fontSizes.baseFontSize * 1.25
      )
      conditionalOverrides.fontSizes.xl = addPxUnit(
        fontSizes.baseFontSize * 1.5
      )
      conditionalOverrides.fontSizes.twoXL = addPxUnit(
        fontSizes.baseFontSize * 1.75
      )
      conditionalOverrides.fontSizes.threeXL = addPxUnit(
        fontSizes.baseFontSize * 2.25
      )
      conditionalOverrides.fontSizes.fourXL = addPxUnit(
        fontSizes.baseFontSize * 2.75
      )
    }

    if (fontSizes.tinyFontSize) {
      conditionalOverrides.fontSizes.twoSm = addPxUnit(fontSizes.tinyFontSize)
      conditionalOverrides.fontSizes.twoSmPx = fontSizes.tinyFontSize
    }

    if (fontSizes.smallFontSize) {
      conditionalOverrides.fontSizes.sm = addPxUnit(fontSizes.smallFontSize)
      conditionalOverrides.fontSizes.smPx = fontSizes.smallFontSize
    }
  }

  console.log("parsedFont", parsedFont)

  console.log("conditionalOverrides", conditionalOverrides)
  return {
    ...baseThemeConfig.emotion,
    genericFonts: {
      ...genericFonts,
      ...(parsedFont && {
        bodyFont: themeInput.bodyFont ? themeInput.bodyFont : parsedFont,
        headingFont: themeInput.headingFont
          ? themeInput.headingFont
          : parsedFont,
        codeFont: themeInput.codeFont
          ? themeInput.codeFont
          : genericFonts.codeFont,
      }),
    },
    ...conditionalOverrides,
  }
}

export const toThemeInput = (
  theme: EmotionTheme
): Partial<CustomThemeConfig> => {
  const { colors, genericFonts } = theme
  return {
    primaryColor: colors.primary,
    backgroundColor: colors.bgColor,
    secondaryBackgroundColor: colors.secondaryBg,
    textColor: colors.bodyText,
    font: fontToEnum(genericFonts.bodyFont),
  }
}

export type ExportedTheme = {
  base: string
  primaryColor: string
  backgroundColor: string
  secondaryBackgroundColor: string
  textColor: string
  font: string
} & DerivedColors

export const toExportedTheme = (theme: EmotionTheme): ExportedTheme => {
  const { colors } = theme
  const themeInput = toThemeInput(theme)

  // At this point, we know that all of the fields of themeInput are populated
  // (since we went "backwards" from a theme -> themeInput), but typescript
  // doesn't know this, so we have to cast each field to string.
  return {
    primaryColor: themeInput.primaryColor as string,
    backgroundColor: themeInput.backgroundColor as string,
    secondaryBackgroundColor: themeInput.secondaryBackgroundColor as string,
    textColor: themeInput.textColor as string,

    base: bgColorToBaseString(themeInput.backgroundColor),
    font: fontEnumToString(themeInput.font) as string,
    ...computeDerivedColors(colors),
  }
}

const completeThemeInput = (
  partialInput: Partial<CustomThemeConfig>,
  baseTheme: ThemeConfig
): CustomThemeConfig => {
  return new CustomThemeConfig({
    ...toThemeInput(baseTheme.emotion),
    ...partialInput,
  })
}

export const createTheme = (
  themeName: string,
  themeInput: Partial<CustomThemeConfig>,
  baseThemeConfig?: ThemeConfig,
  inSidebar = false
): ThemeConfig => {
  console.log("DEBUG", themeInput, baseThemeConfig)
  let completedThemeInput: CustomThemeConfig
  if (baseThemeConfig) {
    completedThemeInput = completeThemeInput(themeInput, baseThemeConfig)
  } else if (themeInput.base === CustomThemeConfig.BaseTheme.DARK) {
    completedThemeInput = completeThemeInput(themeInput, darkTheme)
  } else {
    completedThemeInput = completeThemeInput(themeInput, lightTheme)
  }

  // We use startingTheme to pick a set of "auxiliary colors" for widgets like
  // the success/info/warning/error boxes and others; these need to have their
  // colors tweaked to work well with the background.
  //
  // For our auxiliary colors, we pick colors that look reasonable based on the
  // theme's backgroundColor instead of picking them using themeInput.base.
  // This way, things will look good even if a user sets
  // themeInput.base === LIGHT and themeInput.backgroundColor === "black".
  const bgColor = completedThemeInput.backgroundColor as string
  const startingTheme = merge(
    cloneDeep(
      baseThemeConfig
        ? baseThemeConfig
        : getLuminance(bgColor) > 0.5
        ? lightTheme
        : darkTheme
    ),
    { emotion: { inSidebar } }
  )

  const emotion = createEmotionTheme(completedThemeInput, startingTheme)
  console.log("emotion", emotion)
  return {
    ...startingTheme,
    name: themeName,
    emotion,
    basewebTheme: createBaseUiTheme(emotion, startingTheme.primitives),
    themeInput,
  }
}

export const getCachedTheme = (): ThemeConfig | null => {
  if (!localStorageAvailable()) {
    return null
  }

  const cachedThemeStr = window.localStorage.getItem(LocalStore.ACTIVE_THEME)
  if (!cachedThemeStr) {
    return null
  }

  const { name: themeName, themeInput }: CachedTheme =
    JSON.parse(cachedThemeStr)
  switch (themeName) {
    case lightTheme.name:
      return getMergedLightTheme()
    case darkTheme.name:
      return getMergedDarkTheme()
    default:
      // At this point we're guaranteed that themeInput is defined.
      return createTheme(themeName, themeInput as Partial<CustomThemeConfig>)
  }
}

const deleteOldCachedThemes = (): void => {
  const { CACHED_THEME_VERSION, CACHED_THEME_BASE_KEY } = LocalStore
  const { localStorage } = window

  // Pre-release versions of theming stored cached themes under the key
  // "stActiveTheme".
  localStorage.removeItem("stActiveTheme")

  // The first version of cached themes had keys of the form
  // `stActiveTheme-${window.location.pathname}` with no version number.
  localStorage.removeItem(CACHED_THEME_BASE_KEY)

  for (let i = 1; i <= CACHED_THEME_VERSION; i++) {
    localStorage.removeItem(`${CACHED_THEME_BASE_KEY}-v${i}`)
  }
}

export const setCachedTheme = (_themeConfig: ThemeConfig): void => {
  if (!localStorageAvailable()) {
    return
  }

  deleteOldCachedThemes()

  // Do not set the theme if the app has a pre-defined theme from the embedder
  if (isLightThemeInQueryParams() || isDarkThemeInQueryParams()) {
    return
  }

  // const cachedTheme: CachedTheme = {
  //   name: themeConfig.name,
  //   ...(!isPresetTheme(themeConfig) && {
  //     themeInput: toThemeInput(themeConfig.emotion),
  //   }),
  // }

  // window.localStorage.setItem(
  //   LocalStore.ACTIVE_THEME,
  //   JSON.stringify(cachedTheme)
  // )
}

export const removeCachedTheme = (): void => {
  if (!localStorageAvailable()) {
    return
  }

  window.localStorage.removeItem(LocalStore.ACTIVE_THEME)
}

export const getHostSpecifiedTheme = (): ThemeConfig => {
  if (isLightThemeInQueryParams()) {
    return getMergedLightTheme()
  }

  if (isDarkThemeInQueryParams()) {
    return getMergedDarkTheme()
  }

  return createAutoTheme()
}

export const getDefaultTheme = (): ThemeConfig => {
  // Priority for default theme
  const cachedTheme = getCachedTheme()

  // We shouldn't ever have auto saved in our storage in case
  // OS theme changes but we explicitly check in case!
  if (cachedTheme && cachedTheme.name !== AUTO_THEME_NAME) {
    return cachedTheme
  }

  return getHostSpecifiedTheme()
}

const whiteSpace = /\s+/
export function computeSpacingStyle(
  value: string,
  theme: EmotionTheme
): string {
  if (value === "") {
    return ""
  }

  return value
    .split(whiteSpace)
    .map(marginValue => {
      if (marginValue === "0") {
        return theme.spacing.none
      }

      if (!(marginValue in theme.spacing)) {
        logError(`Invalid spacing value: ${marginValue}`)
        return theme.spacing.none
      }

      return theme.spacing[marginValue as ThemeSpacing]
    })
    .join(" ")
}

/**
 * Return a @emotion/styled-like css dictionary to update the styles of headers, such as h1, h2, ...
 * Used for st.title, st.header, ... that are wrapped in the Sidebar or Dialogs.
 */
export function getWrappedHeadersStyle(theme: EmotionTheme): {
  [cssSelector: string]: { fontSize: string; fontWeight: number }
} {
  return {
    "& h1": {
      fontSize: theme.fontSizes.xl,
      fontWeight: theme.fontWeights.bold,
    },

    "& h2": {
      fontSize: theme.fontSizes.lg,
      fontWeight: theme.fontWeights.bold,
    },

    "& h3": {
      fontSize: theme.fontSizes.mdLg,
      fontWeight: theme.fontWeights.bold,
    },

    "& h4": {
      fontSize: theme.fontSizes.md,
      fontWeight: theme.fontWeights.bold,
    },

    "& h5": {
      fontSize: theme.fontSizes.sm,
      fontWeight: theme.fontWeights.bold,
    },

    "& h6": {
      fontSize: theme.fontSizes.twoSm,
      fontWeight: theme.fontWeights.bold,
    },
  }
}

function addPxUnit(n: number): string {
  return `${n}px`
}

function addRemUnit(n: number): string {
  return `${n}rem`
}

export function blend(color: string, background: string | undefined): string {
  if (background === undefined) return color
  const [r, g, b, a] = parseToRgba(color)
  if (a === 1) return color
  const [br, bg, bb, ba] = parseToRgba(background)
  const ao = a + ba * (1 - a)
  // (xaA + xaB·(1−aA))/aR
  const ro = Math.round((a * r + ba * br * (1 - a)) / ao)
  const go = Math.round((a * g + ba * bg * (1 - a)) / ao)
  const bo = Math.round((a * b + ba * bb * (1 - a)) / ao)
  return toHex(`rgba(${ro}, ${go}, ${bo}, ${ao})`)
}

/**
 * Convert a SCSS rem value to pixels.
 * @param scssValue: a string containing a value in rem units with or without the "rem" unit suffix
 * @returns pixel value of the given rem value
 */
export const convertRemToPx = (scssValue: string): number => {
  const remValue = parseFloat(scssValue.replace(/rem$/, ""))
  return (
    // TODO(lukasmasuch): We might want to somehow cache this value at some point.
    // However, I did experimented with the performance of calling this, and
    // it seems not like a big deal to call it many times.
    remValue * parseFloat(getComputedStyle(document.documentElement).fontSize)
  )
}
