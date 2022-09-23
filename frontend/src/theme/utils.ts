/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import {
  createTheme as createBaseTheme,
  lightThemePrimitives as lightBaseThemePrimitives,
} from "baseui"
import { ThemePrimitives, Theme as BaseTheme } from "baseui/theme"
import { getLuminance, darken, lighten, mix, transparentize } from "color2k"
import camelcase from "camelcase"
import decamelize from "decamelize"
import cloneDeep from "lodash/cloneDeep"
import merge from "lodash/merge"

import { CustomThemeConfig, ICustomThemeConfig } from "src/autogen/proto"
import { logError } from "src/lib/log"
import { LocalStore } from "src/lib/storageUtils"
import {
  baseTheme,
  CachedTheme,
  createAutoTheme,
  createPresetThemes,
  darkTheme,
  lightTheme,
  Theme,
  ThemeConfig,
  ThemeSpacing,
} from "src/theme"
import { fonts } from "./primitives/typography"

export const AUTO_THEME_NAME = "Use system setting"
export const CUSTOM_THEME_NAME = "Custom Theme"

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
      ? // @ts-ignore
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

// Theme primitives. See lightThemePrimitives for what's available. These are
// used to create a large JSON-style structure with theme values for all
// widgets.
// - See node_modules/baseui/themes/light-theme-primitives.js for an example
// of primitives we can use here.
// - See node_modules/baseui/themes/creator.js for the mapping of values from
// this file to output values.
export const createBaseThemePrimitives = (
  baseTheme: ThemePrimitives,
  theme: Theme
): ThemePrimitives => {
  const { colors, genericFonts } = theme

  return {
    ...baseTheme,

    primaryFontFamily: genericFonts.bodyFont,

    primary100: colors.primary,
    primary200: colors.primary,
    primary300: colors.primary,
    primary400: colors.primary,
    primary500: colors.primary,
    primary600: colors.primary,
    primary700: colors.primary,

    // Override gray values based on what is actually used in BaseWeb, and the
    // way we want it to match our theme originating from Bootstrap.
    mono100: colors.bgColor, // Popup menu
    mono200: colors.secondaryBg, // Text input, text area, selectbox
    mono300: colors.lightGray, // Disabled widget background
    mono400: colors.lightGray, // Slider track
    mono500: colors.gray, // Clicked checkbox and radio
    mono600: colors.fadedText40, // Disabled widget text
    mono700: colors.gray, // Unselected checkbox and radio
    mono800: colors.bodyText, // Selectbox text
    mono900: colors.bodyText, // Not used, but just in case.
    mono1000: colors.black,

    rating200: "#FFE1A5",
    rating400: "#FFC043",
  }
}

// Theme overrides.
// NOTE: A lot of the properties we can override here don't seem to actually
// be used anywhere in BaseWeb's source. Will report a bug about it.
export const createThemeOverrides = (theme: Theme): Record<string, any> => {
  const {
    inSidebar,
    colors,
    genericFonts,
    fontSizes,
    lineHeights,
    radii,
  } = theme
  const fontStyles = {
    fontFamily: genericFonts.bodyFont,
    fontSize: fontSizes.md,
    fontSizeSm: fontSizes.sm,
    fontWeight: "normal",
    lineHeight: lineHeights.base,
    lineHeightTight: lineHeights.tight,
  }

  return {
    borders: {
      radius100: radii.md,
      radius200: radii.md,
      radius300: radii.md,
      radius400: radii.md,
      buttonBorderRadius: radii.md,
      inputBorderRadius: radii.md,
      popoverBorderRadius: radii.md,
      surfaceBorderRadius: radii.md,
    },
    typography: {
      // Here we override some fonts that are used in widgets. We don't care
      // about the ones that are not used.
      font100: {},
      font150: { ...fontStyles }, // Popup menus
      font200: {},
      font250: {},
      font300: { ...fontStyles }, // Popup menus
      font350: { ...fontStyles }, // Checkbox
      font400: { ...fontStyles }, // Textinput, textarea, selectboxes
      font450: { ...fontStyles }, // Radio
      font460: { ...fontStyles }, // Calendar header buttons
      font470: { ...fontStyles }, // Button
      font500: { ...fontStyles }, // Selected items in selectbox
      font600: {},

      LabelXSmall: { ...fontStyles },
      LabelSmall: { ...fontStyles },
      LabelMedium: { ...fontStyles },
      LabelLarge: { ...fontStyles },
      ParagraphSmall: { ...fontStyles },
    },

    colors: {
      white: colors.white,
      black: colors.black,
      primary: colors.primary,
      primaryA: colors.primary,
      backgroundPrimary: colors.bgColor,
      backgroundSecondary: colors.secondaryBg,
      backgroundTertiary: colors.bgColor,
      borderOpaque: colors.darkenedBgMix25,
      accent: transparentize(colors.primary, 0.5),
      tagPrimarySolidBackground: colors.primary,
      tagPrimaryFontDisabled: colors.fadedText40,
      tagPrimaryOutlinedDisabled: colors.transparent,
      borderFocus: colors.primary,
      contentPrimary: colors.bodyText,
      inputPlaceholder: colors.fadedText60,
      tickFillDisabled: colors.fadedText40,
      tickMarkFill: colors.lightestGray,
      tickFillSelected: colors.primary,
      datepickerBackground: inSidebar ? colors.secondaryBg : colors.bgColor,
      calendarBackground: inSidebar ? colors.secondaryBg : colors.bgColor,
      calendarForeground: colors.bodyText,
      calendarDayForegroundPseudoSelected: colors.bodyText,
      calendarHeaderBackground: inSidebar
        ? colors.bgColor
        : colors.secondaryBg,
      calendarHeaderBackgroundActive: inSidebar
        ? colors.bgColor
        : colors.secondaryBg,
      calendarHeaderForeground: colors.bodyText,
      calendarHeaderForegroundDisabled: colors.gray40,
      calendarDayBackgroundSelected: colors.primary,
      calendarDayBackgroundSelectedHighlighted: colors.primary,
      calendarDayForegroundSelected: colors.white,
      calendarDayForegroundSelectedHighlighted: colors.white,
      calendarDayForegroundPseudoSelectedHighlighted: colors.bodyText,
      menuFontHighlighted: colors.bodyText,

      modalCloseColor: colors.bodyText,

      notificationInfoBackground: colors.alertInfoBackgroundColor,
      notificationInfoText: colors.alertInfoTextColor,
      notificationPositiveBackground: colors.alertSuccessBackgroundColor,
      notificationPositiveText: colors.alertSuccessTextColor,
      notificationWarningBackground: colors.alertWarningBackgroundColor,
      notificationWarningText: colors.alertWarningTextColor,
      notificationNegativeBackground: colors.alertErrorBackgroundColor,
      notificationNegativeText: colors.alertErrorTextColor,
      progressbarTrackFill: colors.secondaryBg,

      // mono100 overrides
      tickFill: colors.lightenedBg05, // Checkbox and Radio
      tickMarkFillDisabled: colors.lightenedBg05,
      menuFill: theme.inSidebar ? colors.secondaryBg : colors.bgColor, // Dropdown BG

      // mono200 overrides
      buttonDisabledFill: colors.lightenedBg05,
      tickFillHover: colors.secondaryBg,
      inputFillDisabled: colors.secondaryBg,
      inputFillActive: colors.secondaryBg,

      // mono300 overrides
      toggleTrackFillDisabled: colors.secondaryBg,
      tickFillActive: colors.secondaryBg,
      sliderTrackFillDisabled: colors.secondaryBg,
      inputBorder: colors.secondaryBg,
      inputFill: colors.secondaryBg,
      inputEnhanceFill: colors.secondaryBg,
      inputEnhancerFillDisabled: colors.secondaryBg,

      // mono400 overrides
      buttonDisabledSpinnerBackground: colors.gray40,
      toggleTrackFill: colors.gray40,
      sliderTrackFill: colors.gray40,
      sliderHandleInnerFill: colors.gray40,
      sliderHandleInnerFillDisabled: colors.gray40,
    },
  }
}

export const createBaseUiTheme = (
  theme: Theme,
  primitives = lightBaseThemePrimitives
): BaseTheme & Record<string, any> =>
  createBaseTheme(
    createBaseThemePrimitives(primitives, theme),
    createThemeOverrides(theme)
  )

type DerivedColors = {
  linkText: string
  fadedText05: string
  fadedText10: string
  fadedText20: string
  fadedText40: string
  fadedText60: string

  bgMix: string
  darkenedBgMix100: string
  darkenedBgMix25: string
  darkenedBgMix15: string
  lightenedBg05: string
}

const computeDerivedColors = (
  genericColors: Record<string, string>
): DerivedColors => {
  const { bodyText, secondaryBg, bgColor } = genericColors

  const hasLightBg = getLuminance(bgColor) > 0.5

  // Always keep links blue, but brighten them up a bit on dark backgrounds so
  // they're easier to read.
  const linkText = hasLightBg
    ? genericColors.blue
    : lighten(genericColors.blue, 0.2)

  const fadedText05 = transparentize(bodyText, 0.9) // Mostly used for very faint 1px lines.
  const fadedText10 = transparentize(bodyText, 0.8) // Mostly used for 1px lines.
  const fadedText20 = transparentize(bodyText, 0.7) // Used for 1px lines.
  const fadedText40 = transparentize(bodyText, 0.6) // Backgrounds.
  const fadedText60 = transparentize(bodyText, 0.4) // Secondary text.

  const bgMix = mix(bgColor, secondaryBg, 0.5)
  const darkenedBgMix100 = hasLightBg
    ? darken(bgMix, 0.3)
    : lighten(bgMix, 0.6) // Icons.
  // TODO(tvst): Rename to darkenedBgMix25 (number = opacity)
  const darkenedBgMix25 = transparentize(darkenedBgMix100, 0.75)
  const darkenedBgMix15 = transparentize(darkenedBgMix100, 0.85) // Hovered menu/nav items.

  const lightenedBg05 = lighten(bgColor, 0.025) // Button, checkbox, radio background.

  return {
    linkText,
    fadedText05,
    fadedText10,
    fadedText20,
    fadedText40,
    fadedText60,

    bgMix,
    darkenedBgMix100,
    darkenedBgMix25,
    darkenedBgMix15,
    lightenedBg05,
  }
}

export const createEmotionColors = (genericColors: {
  [key: string]: string
}): { [key: string]: string } => {
  const derivedColors = computeDerivedColors(genericColors)
  return {
    ...genericColors,
    ...derivedColors,

    // Alerts
    alertErrorBorderColor: genericColors.dangerBg,
    alertErrorBackgroundColor: genericColors.dangerBg,
    alertErrorTextColor: genericColors.danger,

    alertInfoBorderColor: genericColors.infoBg,
    alertInfoBackgroundColor: genericColors.infoBg,
    alertInfoTextColor: genericColors.info,

    alertSuccessBorderColor: genericColors.successBg,
    alertSuccessBackgroundColor: genericColors.successBg,
    alertSuccessTextColor: genericColors.success,

    alertWarningBorderColor: genericColors.warningBg,
    alertWarningBackgroundColor: genericColors.warningBg,
    alertWarningTextColor: genericColors.warning,

    codeTextColor: genericColors.green80,
    codeHighlightColor: derivedColors.bgMix,

    docStringModuleText: genericColors.bodyText,
    docStringContainerBackground: transparentize(
      genericColors.secondaryBg,
      0.6
    ),

    headingColor: genericColors.bodyText,
  }
}

export const isColor = (strColor: string): boolean => {
  const s = new Option().style
  s.color = strColor
  return s.color !== ""
}

export const createEmotionTheme = (
  themeInput: Partial<ICustomThemeConfig>,
  baseThemeConfig = baseTheme
): Theme => {
  const { genericColors, genericFonts } = baseThemeConfig.emotion
  const { font, ...customColors } = themeInput

  const parsedFont = fontEnumToString(font)

  const parsedColors = Object.entries(customColors).reduce(
    (colors: Record<string, string>, [key, color]) => {
      if (isColor(color)) {
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
  } = parsedColors

  const newGenericColors = {
    ...genericColors,
    ...(primary && { primary }),
    ...(bodyText && { bodyText }),
    ...(secondaryBg && { secondaryBg }),
    ...(bgColor && { bgColor }),
  }

  return {
    ...baseThemeConfig.emotion,
    colors: createEmotionColors(newGenericColors),
    genericColors: newGenericColors,
    genericFonts: {
      ...genericFonts,
      ...(parsedFont && {
        bodyFont: parsedFont,
        headingFont: parsedFont,
      }),
    },
  }
}

export const toThemeInput = (theme: Theme): Partial<CustomThemeConfig> => {
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

export const toExportedTheme = (theme: Theme): ExportedTheme => {
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
    cloneDeep(getLuminance(bgColor) > 0.5 ? lightTheme : darkTheme),
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

export const getSystemTheme = (): ThemeConfig => {
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? darkTheme
    : lightTheme
}

// Method taken from
// https://stackoverflow.com/questions/16427636/check-if-localstorage-is-available
export const localStorageAvailable = (): boolean => {
  const testData = "testData"

  try {
    const { localStorage } = window
    localStorage.setItem(testData, testData)
    localStorage.getItem(testData)
    localStorage.removeItem(testData)
  } catch (e) {
    return false
  }
  return true
}

export const getCachedTheme = (): ThemeConfig | null => {
  if (!localStorageAvailable()) {
    return null
  }

  const cachedThemeStr = window.localStorage.getItem(LocalStore.ACTIVE_THEME)
  if (!cachedThemeStr) {
    return null
  }

  const { name: themeName, themeInput }: CachedTheme = JSON.parse(
    cachedThemeStr
  )
  switch (themeName) {
    case lightTheme.name:
      return lightTheme
    case darkTheme.name:
      return darkTheme
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

  for (let i = 1; i < CACHED_THEME_VERSION; i++) {
    localStorage.removeItem(
      `${CACHED_THEME_BASE_KEY}-v${CACHED_THEME_VERSION}`
    )
  }
}

export const setCachedTheme = (themeConfig: ThemeConfig): void => {
  if (!localStorageAvailable()) {
    return
  }

  deleteOldCachedThemes()

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

export const getDefaultTheme = (): ThemeConfig => {
  // Priority for default theme
  // 1. Previous user preference
  // 2. OS preference
  // If local storage has Auto, refetch system theme as it may have changed
  // based on time of day. We shouldn't ever have this saved in our storage
  // but checking in case!
  const cachedTheme = getCachedTheme()
  return cachedTheme && cachedTheme.name !== AUTO_THEME_NAME
    ? cachedTheme
    : createAutoTheme()
}

const whiteSpace = /\s+/
export function computeSpacingStyle(value: string, theme: Theme): string {
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

export function hasLightBackgroundColor(theme: Theme): boolean {
  return getLuminance(theme.colors.bgColor) > 0.5
}
