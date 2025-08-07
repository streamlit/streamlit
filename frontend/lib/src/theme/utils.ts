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

import { getLuminance, parseToRgba, toHex, transparentize } from "color2k"
import cloneDeep from "lodash/cloneDeep"
import isObject from "lodash/isObject"
import merge from "lodash/merge"
import once from "lodash/once"
import { getLogger } from "loglevel"

import { CustomThemeConfig, ICustomThemeConfig } from "@streamlit/protobuf"
import type { StreamlitWindowObject } from "@streamlit/utils"
import { localStorageAvailable } from "@streamlit/utils"

import { CircularBuffer } from "~lib/components/shared/Profiler/CircularBuffer"
import {
  baseTheme,
  CachedTheme,
  darkTheme,
  EmotionTheme,
  lightTheme,
  ThemeConfig,
  ThemeSpacing,
} from "~lib/theme"
import { LocalStore } from "~lib/util/storageUtils"
import {
  isDarkThemeInQueryParams,
  isLightThemeInQueryParams,
  notNullOrUndefined,
} from "~lib/util/utils"

import { createBaseUiTheme } from "./createBaseUiTheme"
import {
  computeDerivedColors,
  createEmotionColors,
  DerivedColors,
} from "./getColors"
import { fonts } from "./primitives/typography"

// Extended theme config type to include properties not in the protobuf definition
export type ExtendedCustomThemeConfig = Partial<ICustomThemeConfig> & {
  baseFontWeight?: number | null
  codeFontSize?: string | number | null
  codeFontWeight?: number | null
  linkUnderline?: boolean | null
  chartCategoricalColors?: string[] | null
}

export const AUTO_THEME_NAME = "Use system setting"
export const CUSTOM_THEME_NAME = "Custom Theme"

declare global {
  interface Window {
    __streamlit?: StreamlitWindowObject
    __streamlit_profiles__?: Record<
      string,
      CircularBuffer<{
        phase: "mount" | "update" | "nested-update"
        actualDuration: number
        baseDuration: number
        startTime: number
        commitTime: number
      }>
    >
  }
}
const LOG = getLogger("theme:utils")

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

export const bgColorToBaseString = (bgColor?: string): string =>
  bgColor === undefined || getLuminance(bgColor) > 0.5 ? "light" : "dark"

export const isColor = (strColor: string): boolean => {
  const s = new Option().style
  s.color = strColor
  return s.color !== ""
}

/**
 * Helper function that rounds a font size (in rem) to the nearest eighth of a rem
 * This is used to keep configured font sizes to (generally) round values for dialogs.
 * See `convertFontSizes` in `StreamlitMarkdown/styled-components.ts`
 * (ex: 0.78 -> 0.75)
 */
export const roundFontSizeToNearestEighth = (remFontSize: number): number => {
  return Math.round(remFontSize * 8) / 8
}

export const parseFont = (font: string): string => {
  // Try to map a short font family to our default
  // font families
  const fontMap: Record<string, string> = {
    "sans-serif": fonts.sansSerif,
    serif: fonts.serif,
    monospace: fonts.monospace,
  }
  // The old font config supported "sans serif" as a font family, but this
  // isn't a valid font family, so we need to support it by converting it to
  // "sans-serif".
  const fontKey = font.toLowerCase().replaceAll(" ", "-")
  if (fontKey in fontMap) {
    return fontMap[fontKey]
  }

  // If the font is not in the map, return the font as is:
  return font
}

/**
 * Helper function to parse/validate a config color value
 * @param color: a string - the color value passed in as a given config
 * @param configKey: a string - the config that the color value was passed for
 * @param inSidebar: boolean - whether this is for sidebar theming (for error messages)
 * @returns the validated color value or undefined if the color is invalid
 */
const parseColor = (
  color: string,
  configKey: string,
  inSidebar: boolean = false
): string | undefined => {
  // First try the color as-is
  if (isColor(color)) {
    return color
  }

  // If that fails, try adding a # prefix
  if (isColor(`#${color}`)) {
    return `#${color}`
  }

  // If both fail and this is a color config, log a warning
  const isAColorConfig = configKey.toLowerCase().includes("color")
  if (isAColorConfig) {
    const themeSection = inSidebar ? "theme.sidebar" : "theme"
    LOG.warn(
      `Invalid color passed for ${configKey} in ${themeSection}: "${color}"`
    )
  }

  return undefined
}

/**
 * Helper function to parse the baseRadius & buttonRadius options which allow the same possible values
 * @param radius: a string - "none", "small", "medium", "large", "full", a number in pixels or rem
 * @returns radius value and css unit
 */
export const parseRadius = (
  radius: string
): [number | undefined, "px" | "rem"] => {
  let cssUnit: "px" | "rem" = "rem"
  let radiusValue: number | undefined = undefined
  const processedRadius = radius.trim().toLowerCase()

  if (processedRadius === "none") {
    radiusValue = 0
  } else if (processedRadius === "small") {
    radiusValue = 0.35
  } else if (processedRadius === "medium") {
    radiusValue = 0.5
  } else if (processedRadius === "large") {
    radiusValue = 1
  } else if (processedRadius === "full") {
    radiusValue = 1.4
  } else if (processedRadius.endsWith("rem")) {
    radiusValue = parseFloat(processedRadius)
  } else if (processedRadius.endsWith("px")) {
    radiusValue = parseFloat(processedRadius)
    cssUnit = "px"
  } else if (!isNaN(parseFloat(processedRadius))) {
    // Fallback: if the value can be parsed as a number, treat it as pixels
    radiusValue = parseFloat(processedRadius)
    cssUnit = "px"
  }

  return [radiusValue, cssUnit]
}

/**
 * Helper function to parse fontSize options which allow the same possible values
 * @param fontSize a string number in pixels or rem; handles number values as pixels
 * (e.g. "15px", "0.875rem", "15")
 * @returns font size in em (e.g. "0.875em")
 */
export const parseFontSize = (
  configName: string,
  fontSize: string | number,
  inSidebar: boolean
): string | undefined => {
  const themeSection = inSidebar ? "theme.sidebar" : "theme"

  if (typeof fontSize === "string") {
    // If string, check its valid (ends with "rem" or "px")
    // and can be parsed as a number
    const processedFontSize = fontSize.trim().toLowerCase()
    const parsedFontSize = parseFloat(processedFontSize)
    if (
      parsedFontSize &&
      (processedFontSize.endsWith("rem") || processedFontSize.endsWith("px"))
    ) {
      return processedFontSize
    }

    // Fallback: if the value can be parsed as a number, treat it as pixels
    if (parsedFontSize.toString() === processedFontSize) {
      return `${processedFontSize}px`
    }
  }
  // If invalid, log warning and return undefined
  LOG.warn(
    `Invalid size passed for ${configName} in ${themeSection}: ${fontSize}. Falling back to default ${configName}.`
  )
}

/**
 * Validate a font weight config
 */
const isValidFontWeight = (
  weightConfigName: string,
  fontWeight: number | null | undefined,
  minWeight: number,
  maxWeight: number,
  inSidebar?: boolean
): boolean => {
  const themeSection = inSidebar ? "theme.sidebar" : "theme"

  // If the font weight config is set, validate it (log warning if invalid)
  if (notNullOrUndefined(fontWeight)) {
    const isInteger = Number.isInteger(fontWeight)
    const isIncrementOf100 = fontWeight % 100 === 0
    const isInRange = fontWeight >= minWeight && fontWeight <= maxWeight

    if (!isInteger || !isIncrementOf100 || !isInRange) {
      LOG.warn(
        `Invalid ${weightConfigName}: ${fontWeight} in ${themeSection}. The ${weightConfigName} must be an integer ${minWeight}-${maxWeight}, and an increment of 100. Falling back to default font weight.`
      )
      return false
    }

    return true
  }

  // If the font weight config is not set, return false
  return false
}

/**
 * Helper function to handle each heading font size in the headingFontSizes config
 * @param configName: the name of the config option
 * @param fontSize: the heading font size provided via theme config
 * @param baseFontSize: the base font size (default or provided via theme config)
 * @param inSidebar: whether this is the sidebar theme
 * @returns the heading font size in rem
 */
const convertHeadingFontSizeToRem = (
  configName: string,
  fontSize: string,
  baseFontSize: number,
  inSidebar: boolean
): string | undefined => {
  // Validates the font size (logs warning & returns undefined if invalid)
  const validatedSize = parseFontSize(configName, fontSize, inSidebar)

  // Need each heading font size to be in rem
  if (validatedSize && validatedSize.endsWith("rem")) {
    return validatedSize
  } else if (validatedSize && validatedSize.endsWith("px")) {
    // Convert the font size to rem, and round to nearest 8th
    const remValue = parseFloat(validatedSize) / baseFontSize
    return `${remValue}rem`
  }

  // If invalid, return undefined
  return undefined
}

/**
 * Set the heading font sizes in the theme config
 * @param defaultFontSizes: the default theme font sizes
 * @param inSidebar: whether this is the sidebar theme
 * @param baseFontSize: the base font size (default or provided via theme config)
 * @param headingFontSizes: the h1-h6 heading font sizes provided via theme config
 * @returns an updated emotion theme font sizes object
 */
const setHeadingFontSizes = (
  defaultFontSizes: EmotionTheme["fontSizes"],
  inSidebar: boolean,
  baseFontSize: number,
  headingFontSizes: string[] | null | undefined
): EmotionTheme["fontSizes"] => {
  const headingFontSizesOverrides = {
    ...defaultFontSizes,
  }

  if (headingFontSizes) {
    headingFontSizes.forEach((size, index) => {
      const headingFontSizeKey = `h${index + 1}FontSize`
      // Gets the heading font size in rem if not already & logs warning if invalid
      const convertedSize = convertHeadingFontSizeToRem(
        `${headingFontSizeKey} in headingFontSizes`,
        size,
        baseFontSize,
        inSidebar
      )

      // If valid configured value, overwrite the default heading font size
      if (convertedSize) {
        // @ts-expect-error
        headingFontSizesOverrides[headingFontSizeKey] = convertedSize
      }
    })
  }

  return headingFontSizesOverrides
}

/**
 * Helper function to set the normal, bold, and extrabold font weights based
 * on the baseFontWeight option
 * @param defaultFontWeights: the default theme font weights
 * @param inSidebar: whether the theme is in the sidebar
 * @param baseFontWeight: the base font weight provided via theme config
 * @param codeFontWeight: the code font weight provided via theme config
 * @param headingFontWeights: the h1-h6 heading font weights provided via theme config
 * @returns an updated emotion theme font weights object
 */
const setFontWeights = (
  defaultFontWeights: EmotionTheme["fontWeights"],
  inSidebar: boolean,
  baseFontWeight: number | null | undefined,
  codeFontWeight: number | null | undefined,
  headingFontWeights: number[] | null | undefined
): EmotionTheme["fontWeights"] => {
  const fontWeightOverrides = {
    ...defaultFontWeights,
    // Override default h1FontWeight for sidebar to 600
    // Default for main theme set in typography (700)
    h1FontWeight: inSidebar ? 600 : defaultFontWeights.h1FontWeight,
  }

  // Validate the baseFontWeight provided is an integer between 100 and 600
  if (
    baseFontWeight &&
    isValidFontWeight("baseFontWeight", baseFontWeight, 100, 600)
  ) {
    // Set each of the font weights based on the base weight provided
    // The provided baseFontWeight sets the normal weight
    fontWeightOverrides.normal = baseFontWeight
    // The semiBold weight is set to the baseFontWeight + 100
    fontWeightOverrides.semiBold = baseFontWeight + 100
    // The bold weight is set to the baseFontWeight + 200
    fontWeightOverrides.bold = baseFontWeight + 200
    // The extrabold weight is set to the baseFontWeight + 300
    fontWeightOverrides.extrabold = baseFontWeight + 300

    // Set fallback for code font weights based on configured baseFontWeight
    fontWeightOverrides.code = baseFontWeight
    fontWeightOverrides.codeBold = baseFontWeight + 200
    fontWeightOverrides.codeExtraBold = baseFontWeight + 300
  }

  if (
    codeFontWeight &&
    isValidFontWeight("codeFontWeight", codeFontWeight, 100, 600)
  ) {
    // Set each of the code weights based on the base code font weight provided
    fontWeightOverrides.code = codeFontWeight
    // The bold weight is set to the codeFontWeight + 200
    fontWeightOverrides.codeBold = codeFontWeight + 200
    // The extrabold weight is set to the codeFontWeight + 300
    fontWeightOverrides.codeExtraBold = codeFontWeight + 300
  }

  if (headingFontWeights) {
    // Filling out the heading font weights array is handled in app_session.py
    headingFontWeights.forEach((weight, index) => {
      const headingFontWeightKey = `h${index + 1}FontWeight`
      if (
        isValidFontWeight(
          `${headingFontWeightKey} in headingFontWeights`,
          weight,
          100,
          900,
          inSidebar
        )
      ) {
        // @ts-expect-error
        fontWeightOverrides[headingFontWeightKey] = weight
      }
    })
  }

  return fontWeightOverrides
}

/**
 * Helper function to validate each of the colors passed in the chart colors configs
 * @param configName: the name of the config ("chartCategoricalColors", "chartSequentialColors" or "chartDivergingColors")
 * @param colors: the colors config passed in (array of strings)
 * @returns the valid colors from the config
 */
const validateChartColors = (
  configName: string,
  colors: string[]
): string[] => {
  return (
    colors
      // parseColor returns undefined for invalid colors
      .map(color => parseColor(color, configName))
      // Filter any invalid colors
      .filter((color): color is string => color !== undefined)
  )
}

export const createEmotionTheme = (
  themeInput: ExtendedCustomThemeConfig,
  baseThemeConfig = baseTheme
): EmotionTheme => {
  const { colors, genericFonts, inSidebar } = baseThemeConfig.emotion
  const {
    baseFontSize,
    baseFontWeight,
    baseRadius,
    buttonRadius,
    codeFontSize,
    codeFontWeight,
    showWidgetBorder,
    headingFont,
    headingFontSizes,
    headingFontWeights,
    bodyFont,
    codeFont,
    showSidebarBorder,
    linkUnderline,
    // Since chart color configs passed as array, handle separate from parsedColors
    chartCategoricalColors,
    chartSequentialColors,
    ...customColors
  } = themeInput

  const parsedColors = Object.entries(customColors).reduce(
    (colorsArg: Record<string, string>, [key, color]) => {
      // @ts-expect-error
      const validatedColor = parseColor(color, key, inSidebar)
      if (validatedColor) {
        colorsArg[key] = validatedColor
      }

      return colorsArg
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
    dataframeBorderColor,
    dataframeHeaderBackgroundColor,
    widgetBorderColor,
    borderColor,
    linkColor,
    codeBackgroundColor,
  } = parsedColors

  const newGenericColors = { ...colors }

  if (primary) newGenericColors.primary = primary
  if (bodyText) newGenericColors.bodyText = bodyText
  if (secondaryBg) newGenericColors.secondaryBg = secondaryBg
  if (bgColor) newGenericColors.bgColor = bgColor
  if (linkColor) newGenericColors.link = linkColor

  // Secondary color is not yet configurable. Set secondary color to primary color
  // by default for all custom themes.
  newGenericColors.secondary = newGenericColors.primary

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  const conditionalOverrides: any = {}

  conditionalOverrides.colors = createEmotionColors(newGenericColors)

  if (notNullOrUndefined(codeBackgroundColor)) {
    conditionalOverrides.colors.codeBackgroundColor = codeBackgroundColor
  }

  if (notNullOrUndefined(borderColor)) {
    conditionalOverrides.colors.borderColor = borderColor

    const borderColorLight = transparentize(borderColor, 0.55)
    // Used for tabs border and expander when stale
    conditionalOverrides.colors.borderColorLight = borderColorLight
    // Set the fallback here for dataframe & table border color
    conditionalOverrides.colors.dataframeBorderColor = borderColorLight
  }

  if (notNullOrUndefined(dataframeBorderColor)) {
    // If dataframeBorderColor explicitly set, override borderColorLight fallback
    conditionalOverrides.colors.dataframeBorderColor = dataframeBorderColor
  }

  if (notNullOrUndefined(dataframeHeaderBackgroundColor)) {
    conditionalOverrides.colors.dataframeHeaderBackgroundColor =
      dataframeHeaderBackgroundColor
  }

  if (showWidgetBorder || widgetBorderColor) {
    // widgetBorderColor from the themeInput is deprecated. For compatibility
    // with older SiS theming, we still apply it here if provided, but we should
    // consider full removing it at some point.
    conditionalOverrides.colors.widgetBorderColor =
      widgetBorderColor || conditionalOverrides.colors.borderColor
  }

  if (
    notNullOrUndefined(chartCategoricalColors) &&
    chartCategoricalColors.length > 0
  ) {
    // Validate the categorical colors config
    const validatedCategoricalColors = validateChartColors(
      "chartCategoricalColors",
      chartCategoricalColors
    )
    // Set the validated colors if non-empty array
    if (validatedCategoricalColors.length > 0) {
      conditionalOverrides.colors.chartCategoricalColors =
        validatedCategoricalColors
    }
  }

  if (
    notNullOrUndefined(chartSequentialColors) &&
    chartSequentialColors.length > 0
  ) {
    // Validate the sequential colors config
    const validatedSequentialColors = validateChartColors(
      "chartSequentialColors",
      chartSequentialColors
    )
    // Set the validated colors, sequential colors should be an array of length 10
    // Also checked on BE, but check here again in case one of the entries is not a valid color
    if (validatedSequentialColors.length === 10) {
      conditionalOverrides.colors.chartSequentialColors =
        validatedSequentialColors
    } else {
      LOG.warn(
        `Invalid chartSequentialColors: ${chartSequentialColors.toString()}. Falling back to default chartSequentialColors.`
      )
    }
  }

  if (notNullOrUndefined(baseRadius)) {
    conditionalOverrides.radii = {
      ...baseThemeConfig.emotion.radii,
    }

    const [radiusValue, cssUnit] = parseRadius(baseRadius)

    if (notNullOrUndefined(radiusValue) && !isNaN(radiusValue)) {
      const radiusWithCssUnit = addCssUnit(radiusValue, cssUnit)
      conditionalOverrides.radii.default = radiusWithCssUnit

      // Set the fallback button radius if baseRadius is set
      conditionalOverrides.radii.button = radiusWithCssUnit

      // Adapt all the other radii sizes based on the base radii:
      // We make sure that the value is rounded to 2 decimal places to avoid
      // floating point precision issues.
      conditionalOverrides.radii.md = addCssUnit(
        roundToTwoDecimals(radiusValue * 0.5),
        cssUnit
      )
      conditionalOverrides.radii.xl = addCssUnit(
        roundToTwoDecimals(radiusValue * 1.5),
        cssUnit
      )
      conditionalOverrides.radii.xxl = addCssUnit(
        roundToTwoDecimals(radiusValue * 2),
        cssUnit
      )
    } else {
      LOG.warn(
        `Invalid base radius: ${baseRadius}. Falling back to default base radius.`
      )
    }
  }

  if (notNullOrUndefined(buttonRadius)) {
    // Handles case where buttonRadius is the only radius set in the themeInput
    if (!conditionalOverrides.radii) {
      conditionalOverrides.radii = {
        ...baseThemeConfig.emotion.radii,
      }
    }

    const [radiusValue, cssUnit] = parseRadius(buttonRadius)

    if (notNullOrUndefined(radiusValue) && !isNaN(radiusValue)) {
      // If valid buttonRadius set, override baseRadius fallback
      conditionalOverrides.radii.button = addCssUnit(radiusValue, cssUnit)
    } else {
      LOG.warn(
        `Invalid button radius: ${buttonRadius}. Falling back to default button radius.`
      )
    }
  }

  conditionalOverrides.fontSizes = {
    ...baseThemeConfig.emotion.fontSizes,
  }

  if (baseFontSize && baseFontSize > 0) {
    // Set the root font size to the configured value (used on global styles):
    conditionalOverrides.fontSizes.baseFontSize = baseFontSize
  }

  if (codeFontSize) {
    // Returns font size as a string, or undefined if invalid
    const parsedCodeFontSize = parseFontSize(
      "codeFontSize",
      codeFontSize,
      inSidebar
    )
    if (parsedCodeFontSize) {
      conditionalOverrides.fontSizes.codeFontSize = parsedCodeFontSize
    }
    // codeFontSize default (fallback) set in typography primitives (0.875rem)
    // inlineCodeFontSize set in typography primitives (0.75em)
  }

  // Set the heading font sizes based on the heading font sizes config provided
  conditionalOverrides.fontSizes = setHeadingFontSizes(
    conditionalOverrides.fontSizes,
    inSidebar,
    conditionalOverrides.fontSizes.baseFontSize,
    headingFontSizes
  )

  // Set the font weights based on the font weight configs provided
  conditionalOverrides.fontWeights = setFontWeights(
    baseThemeConfig.emotion.fontWeights,
    inSidebar,
    baseFontWeight,
    codeFontWeight,
    headingFontWeights
  )

  if (notNullOrUndefined(showSidebarBorder)) {
    conditionalOverrides.showSidebarBorder = showSidebarBorder
  }

  if (notNullOrUndefined(linkUnderline)) {
    conditionalOverrides.linkUnderline = linkUnderline
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  const fontOverrides: any = {}
  if (headingFont) {
    fontOverrides.headingFont = parseFont(headingFont)
  } else if (bodyFont) {
    fontOverrides.headingFont = parseFont(bodyFont)
  }

  return {
    ...baseThemeConfig.emotion,
    colors: createEmotionColors(newGenericColors),
    genericFonts: {
      ...genericFonts,
      ...(bodyFont && {
        bodyFont: parseFont(bodyFont),
      }),
      ...(codeFont && {
        codeFont: parseFont(codeFont),
      }),
      ...fontOverrides,
    },
    ...conditionalOverrides,
  }
}

export const toThemeInput = (
  theme: EmotionTheme
): Partial<CustomThemeConfig> => {
  const { colors } = theme
  return {
    primaryColor: colors.primary,
    backgroundColor: colors.bgColor,
    secondaryBackgroundColor: colors.secondaryBg,
    textColor: colors.bodyText,
    bodyFont: theme.genericFonts.bodyFont,
  }
}

export type ExportedTheme = {
  base: string
  primaryColor: string
  backgroundColor: string
  secondaryBackgroundColor: string
  textColor: string
  bodyFont: string
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
    bodyFont: themeInput.bodyFont as string,
    base: bgColorToBaseString(themeInput.backgroundColor),

    ...computeDerivedColors(colors),
  }
}

const completeThemeInput = (
  partialInput: Partial<CustomThemeConfig>,
  baseThemeArg: ThemeConfig
): CustomThemeConfig => {
  return new CustomThemeConfig({
    ...toThemeInput(baseThemeArg.emotion),
    ...partialInput,
  })
}

export const createTheme = (
  themeName: string,
  themeInput: Partial<CustomThemeConfig>,
  baseThemeConfig?: ThemeConfig,
  inSidebar = false
): ThemeConfig => {
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
  const bgColor = completedThemeInput.backgroundColor
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

  // We need to deep clone the theme object to prevent a bug in BaseWeb that causes
  // primitives to be modified globally. This cloning decouples our BaseWeb theme
  // object from the shared primitive objects and prevents unintended side effects.
  const basewebTheme = cloneDeep(
    createBaseUiTheme(emotion, startingTheme.primitives)
  )

  return {
    ...startingTheme,
    name: themeName,
    emotion,
    basewebTheme,
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
        LOG.error(`Invalid spacing value: ${marginValue}`)
        return theme.spacing.none
      }

      return theme.spacing[marginValue as ThemeSpacing]
    })
    .join(" ")
}

export function addCssUnit(n: number, unit: "px" | "rem"): string {
  return `${n}${unit}`
}

function roundToTwoDecimals(n: number): number {
  return parseFloat(n.toFixed(2))
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
    remValue *
    // We fallback to 16px if the fontSize is not defined (should only happen in tests)
    (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
  )
}
