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
import { getLuminance, parseToRgba, toHex, transparentize } from "color2k"
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
  const { genericColors, genericFonts } = baseThemeConfig.emotion
  const { font, radii, fontSizes, ...customColors } = themeInput

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
    primaryColor: primary,
    textColor: bodyText,
    skeletonBackgroundColor,
    widgetBackgroundColor,
    widgetBorderColor,
  } = parsedColors

  const newGenericColors = { ...genericColors }

  if (primary) newGenericColors.primary = primary
  if (bodyText) newGenericColors.bodyText = bodyText
  if (secondaryBg) newGenericColors.secondaryBg = secondaryBg
  if (bgColor) newGenericColors.bgColor = bgColor
  if (widgetBackgroundColor)
    newGenericColors.widgetBackgroundColor = widgetBackgroundColor
  if (widgetBorderColor) newGenericColors.widgetBorderColor = widgetBorderColor
  if (skeletonBackgroundColor)
    newGenericColors.skeletonBackgroundColor = skeletonBackgroundColor

  const conditionalOverrides: any = {}

  if (radii) {
    conditionalOverrides.radii = {
      ...baseThemeConfig.emotion.radii,
    }

    if (radii.checkboxRadius)
      conditionalOverrides.radii.md = addPxUnit(radii.checkboxRadius)
    if (radii.baseWidgetRadius)
      conditionalOverrides.radii.lg = addPxUnit(radii.baseWidgetRadius)
  }

  if (fontSizes) {
    conditionalOverrides.fontSizes = {
      ...baseThemeConfig.emotion.fontSizes,
    }

    if (fontSizes.tinyFontSize) {
      conditionalOverrides.fontSizes.twoSm = addPxUnit(fontSizes.tinyFontSize)
      conditionalOverrides.fontSizes.twoSmPx = fontSizes.tinyFontSize
    }

    if (fontSizes.smallFontSize) {
      conditionalOverrides.fontSizes.sm = addPxUnit(fontSizes.smallFontSize)
      conditionalOverrides.fontSizes.smPx = fontSizes.smallFontSize
    }

    if (fontSizes.baseFontSize) {
      conditionalOverrides.fontSizes.md = addPxUnit(fontSizes.baseFontSize)
      conditionalOverrides.fontSizes.mdPx = fontSizes.baseFontSize
    }
  }

  return {
    ...baseThemeConfig.emotion,
    colors: createEmotionColors(newGenericColors),
    genericColors: newGenericColors,
    genericFonts: {
      ...genericFonts,
      ...(parsedFont && {
        bodyFont: themeInput.bodyFont ? themeInput.bodyFont : parsedFont,
        headingFont: themeInput.bodyFont ? themeInput.bodyFont : parsedFont,
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
  const { genericColors } = theme
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

    ...computeDerivedColors(genericColors),
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
  if (baseThemeConfig) {
    themeInput = completeThemeInput(themeInput, baseThemeConfig)
  } else if (themeInput.base === CustomThemeConfig.BaseTheme.DARK) {
    themeInput = completeThemeInput(themeInput, darkTheme)
  } else {
    themeInput = completeThemeInput(themeInput, lightTheme)
  }

  // We use startingTheme to pick a set of "auxiliary colors" for widgets like
  // the success/info/warning/error boxes and others; these need to have their
  // colors tweaked to work well with the background.
  //
  // For our auxiliary colors, we pick colors that look reasonable based on the
  // theme's backgroundColor instead of picking them using themeInput.base.
  // This way, things will look good even if a user sets
  // themeInput.base === LIGHT and themeInput.backgroundColor === "black".
  const bgColor = themeInput.backgroundColor as string
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

  const emotion = createEmotionTheme(themeInput, startingTheme)

  return {
    ...startingTheme,
    name: themeName,
    emotion,
    basewebTheme: createBaseUiTheme(emotion, startingTheme.primitives),
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

export const setCachedTheme = (themeConfig: ThemeConfig): void => {
  if (!localStorageAvailable()) {
    return
  }

  deleteOldCachedThemes()

  // Do not set the theme if the app has a pre-defined theme from the embedder
  if (isLightThemeInQueryParams() || isDarkThemeInQueryParams()) {
    return
  }

  const cachedTheme: CachedTheme = {
    name: themeConfig.name,
    ...(!isPresetTheme(themeConfig) && {
      themeInput: toThemeInput(themeConfig.emotion),
    }),
  }

  window.localStorage.setItem(
    LocalStore.ACTIVE_THEME,
    JSON.stringify(cachedTheme)
  )
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

export function hasLightBackgroundColor(theme: EmotionTheme): boolean {
  return getLuminance(theme.colors.bgColor) > 0.5
}

export function getDividerColors(theme: EmotionTheme): any {
  const lightTheme = hasLightBackgroundColor(theme)
  const blue = lightTheme ? theme.colors.blue60 : theme.colors.blue90
  const green = lightTheme ? theme.colors.green60 : theme.colors.green90
  const orange = lightTheme ? theme.colors.orange60 : theme.colors.orange90
  const red = lightTheme ? theme.colors.red60 : theme.colors.red90
  const violet = lightTheme ? theme.colors.purple60 : theme.colors.purple80
  const gray = lightTheme ? theme.colors.gray40 : theme.colors.gray70

  return {
    blue: blue,
    green: green,
    orange: orange,
    red: red,
    violet: violet,
    gray: gray,
    grey: gray,
    rainbow: `linear-gradient(to right, ${red}, ${orange}, ${green}, ${blue}, ${violet})`,
  }
}

export function getMarkdownTextColors(theme: EmotionTheme): any {
  const lightTheme = hasLightBackgroundColor(theme)
  const red = lightTheme ? theme.colors.red80 : theme.colors.red70
  const orange = lightTheme ? theme.colors.orange100 : theme.colors.orange60
  const yellow = lightTheme ? theme.colors.yellow100 : theme.colors.yellow40
  const green = lightTheme ? theme.colors.green90 : theme.colors.green60
  const blue = lightTheme ? theme.colors.blue80 : theme.colors.blue50
  const violet = lightTheme ? theme.colors.purple80 : theme.colors.purple50
  const purple = lightTheme ? theme.colors.purple100 : theme.colors.purple80
  const gray = lightTheme ? theme.colors.gray80 : theme.colors.gray70
  const primary = theme.colors.primary
  return {
    red: red,
    orange: orange,
    yellow: yellow,
    green: green,
    blue: blue,
    violet: violet,
    purple: purple,
    gray: gray,
    primary: primary,
  }
}

export function getMarkdownBgColors(theme: EmotionTheme): any {
  const lightTheme = hasLightBackgroundColor(theme)

  return {
    redbg: transparentize(
      theme.colors[lightTheme ? "red80" : "red60"],
      lightTheme ? 0.9 : 0.7
    ),
    orangebg: transparentize(theme.colors.yellow70, lightTheme ? 0.9 : 0.7),
    yellowbg: transparentize(
      theme.colors[lightTheme ? "yellow70" : "yellow50"],
      lightTheme ? 0.9 : 0.7
    ),
    greenbg: transparentize(
      theme.colors[lightTheme ? "green70" : "green60"],
      lightTheme ? 0.9 : 0.7
    ),
    bluebg: transparentize(
      theme.colors[lightTheme ? "blue70" : "blue60"],
      lightTheme ? 0.9 : 0.7
    ),
    violetbg: transparentize(
      theme.colors[lightTheme ? "purple70" : "purple60"],
      lightTheme ? 0.9 : 0.7
    ),
    purplebg: transparentize(
      theme.colors[lightTheme ? "purple90" : "purple80"],
      lightTheme ? 0.9 : 0.7
    ),
    graybg: transparentize(
      theme.colors[lightTheme ? "gray70" : "gray50"],
      lightTheme ? 0.9 : 0.7
    ),
    primarybg: transparentize(theme.colors.primary, lightTheme ? 0.9 : 0.7),
  }
}

export function getGray70(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.gray70
    : theme.colors.gray30
}

export function getGray30(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.gray30
    : theme.colors.gray85
}

export function getGray90(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.gray90
    : theme.colors.gray10
}

export function getBlue80(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.blue80
    : theme.colors.blue40
}

function getBlueArrayAsc(theme: EmotionTheme): string[] {
  const { colors } = theme
  return [
    colors.blue10,
    colors.blue20,
    colors.blue30,
    colors.blue40,
    colors.blue50,
    colors.blue60,
    colors.blue70,
    colors.blue80,
    colors.blue90,
    colors.blue100,
  ]
}

function getBlueArrayDesc(theme: EmotionTheme): string[] {
  const { colors } = theme
  return [
    colors.blue100,
    colors.blue90,
    colors.blue80,
    colors.blue70,
    colors.blue60,
    colors.blue50,
    colors.blue40,
    colors.blue30,
    colors.blue20,
    colors.blue10,
  ]
}

export function getSequentialColorsArray(theme: EmotionTheme): string[] {
  return hasLightBackgroundColor(theme)
    ? getBlueArrayAsc(theme)
    : getBlueArrayDesc(theme)
}

export function getDivergingColorsArray(theme: EmotionTheme): string[] {
  const { colors } = theme
  return [
    colors.red100,
    colors.red90,
    colors.red70,
    colors.red50,
    colors.red30,
    colors.blue30,
    colors.blue50,
    colors.blue70,
    colors.blue90,
    colors.blue100,
  ]
}

export function getCategoricalColorsArray(theme: EmotionTheme): string[] {
  const { colors } = theme
  return hasLightBackgroundColor(theme)
    ? [
        colors.blue80,
        colors.blue40,
        colors.red80,
        colors.red40,
        colors.blueGreen80,
        colors.green40,
        colors.orange80,
        colors.orange50,
        colors.purple80,
        colors.gray40,
      ]
    : [
        colors.blue40,
        colors.blue80,
        colors.red40,
        colors.red80,
        colors.green40,
        colors.blueGreen80,
        colors.orange50,
        colors.orange80,
        colors.purple80,
        colors.gray40,
      ]
}

export function getDecreasingRed(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.red80
    : theme.colors.red40
}

export function getIncreasingGreen(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.blueGreen80
    : theme.colors.green40
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
