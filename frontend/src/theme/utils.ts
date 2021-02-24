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
import {
  createTheme as createBaseTheme,
  lightThemePrimitives as lightBaseThemePrimitives,
} from "baseui"
import { ThemePrimitives, Theme as BaseTheme } from "baseui/theme"
import { getLuminance, mix, transparentize } from "color2k"
import camelcase from "camelcase"
import decamelize from "decamelize"

import { CustomThemeConfig, ICustomThemeConfig } from "autogen/proto"
import { logError } from "lib/log"
import { LocalStore } from "lib/storageUtils"
import {
  baseTheme,
  createAutoTheme,
  darkTheme,
  lightTheme,
  Theme,
  ThemeConfig,
  ThemeSpacing,
} from "theme"
import { fonts } from "./primitives/typography"

export const AUTO_THEME = "Use System Setting"

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
    mono600: colors.gray, // Disabled widget text
    mono700: colors.gray, // Unselected checkbox and radio
    mono800: colors.darkGray, // Selectbox text
    mono900: colors.darkGray, // Not used, but just in case.
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
    fontSizeSm: fontSizes.smDefault,
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
      accent: transparentize(colors.primary, 0.5),
      tagPrimarySolidBackground: colors.primary,
      borderFocus: colors.primary,
      contentPrimary: colors.bodyText,
      inputPlaceholder: colors.darkGray,
      tickFillDisabled: colors.gray,
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
      tickFill: colors.bgColor, // Checkbox and Radio
      tickMarkFillDisabled: colors.secondaryBg,
      menuFill: theme.inSidebar ? colors.secondaryBg : colors.bgColor, // Dropdown BG

      // mono200 overrides
      buttonDisabledFill: colors.secondaryBg,
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

export const createEmotionColors = (genericColors: {
  [key: string]: string
}): { [key: string]: string } => {
  return {
    ...genericColors,

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
    codeHighlightColor: mix(
      genericColors.secondaryBg,
      genericColors.bgColor,
      0.5
    ),

    docStringHeaderBorder: genericColors.bodyText,
    docStringModuleText: genericColors.bodyText,
    docStringContainerBackground: transparentize(
      genericColors.secondaryBg,
      0.6
    ),

    headingColor: genericColors.bodyText,

    tableGray: genericColors.gray40,
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
  const { name, font, ...customColors } = themeInput

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
    secondaryColor: secondary,
    textColor: bodyText,
  } = parsedColors
  const newGenericColors = {
    ...genericColors,
    ...(primary && { primary }),
    ...(secondary && { secondary }),
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

export const createTheme = (
  themeInput: Partial<CustomThemeConfig>,
  baseThemeConfig?: ThemeConfig
): ThemeConfig => {
  const bgColor =
    themeInput.backgroundColor ||
    baseThemeConfig?.emotion.colors.bgColor ||
    lightTheme.emotion.colors.bgColor
  const startingTheme =
    baseThemeConfig || (getLuminance(bgColor) > 0.5 ? lightTheme : darkTheme)
  const emotion = createEmotionTheme(themeInput, startingTheme)

  return {
    ...startingTheme,
    name: themeInput.name || "Custom theme",
    emotion,
    basewebTheme: createBaseUiTheme(emotion, startingTheme.primitives),
  }
}

export const toThemeInput = (theme: Theme): Partial<CustomThemeConfig> => {
  const { colors, genericFonts } = theme
  return {
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
    backgroundColor: colors.bgColor,
    secondaryBackgroundColor: colors.secondaryBg,
    textColor: colors.bodyText,
    font: fontToEnum(genericFonts.bodyFont),
  }
}

export const getSystemTheme = (): ThemeConfig => {
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? darkTheme
    : lightTheme
}

export const getDefaultTheme = (): ThemeConfig => {
  // Priority for default theme
  // 1. Previous user preference
  // 2. OS preference
  const storedTheme = window.localStorage.getItem(LocalStore.ACTIVE_THEME)
  const parsedTheme = storedTheme
    ? (JSON.parse(storedTheme) as ThemeConfig)
    : null

  // If local storage has Auto, refetch system theme as it may have changed
  // based on time of day. We shouldn't ever have this saved in our storage
  // but checking in case!
  return parsedTheme && parsedTheme.name !== AUTO_THEME
    ? parsedTheme
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
