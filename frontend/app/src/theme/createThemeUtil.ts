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
import { transparentize } from "color2k"
import { Theme } from "./types"

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
  }
}

// Theme overrides.
// NOTE: A lot of the properties we can override here don't seem to actually
// be used anywhere in BaseWeb's source. Will report a bug about it.
export const createThemeOverrides = (theme: Theme): Record<string, any> => {
  const { inSidebar, colors, genericFonts, fontSizes, lineHeights, radii } =
    theme

  const fontStyles = {
    fontFamily: genericFonts.bodyFont,
    fontSize: fontSizes.md,
    fontSizeSm: fontSizes.sm,
    fontWeight: "normal",
    lineHeight: lineHeights.base,
    lineHeightTight: lineHeights.tight,
  }

  const widgetBackgroundColor = colors.widgetBackgroundColor
    ? colors.widgetBackgroundColor
    : colors.secondaryBg

  // We want menuFill to always use bgColor. But when in sidebar, bgColor and secondaryBg are
  // swapped! So here we unswap them.
  const mainPaneBgColor = inSidebar ? colors.secondaryBg : colors.bgColor
  const mainPaneSecondaryBgColor = inSidebar
    ? colors.bgColor
    : colors.secondaryBg

  return {
    borders: {
      radius100: radii.md,
      radius200: radii.md,
      radius300: radii.md,
      radius400: radii.md,

      // Override borders that are declared from literals in
      // https://github.com/uber/baseweb/blob/master/src/themes/shared/borders.ts

      /** Datepicker (Range), Progress Bar, Slider, Tag */
      useRoundedCorners: true,
      /** Button, ButtonGroup */
      buttonBorderRadiusMini: radii.md, // Unused today.
      buttonBorderRadius: radii.md,
      /** Checkbox */
      checkboxBorderRadius: radii.sm,
      /** Input, Select, Textarea */
      inputBorderRadiusMini: radii.md, // Unused today.
      inputBorderRadius: radii.md,
      /** Popover, Menu, Tooltip */
      popoverBorderRadius: radii.md,
      /** Card, Datepicker, Modal, Toast, Notification */
      surfaceBorderRadius: radii.md,
      /** Tag */
      tagBorderRadius: radii.md,
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
      backgroundSecondary: widgetBackgroundColor,
      backgroundTertiary: colors.bgColor,
      borderOpaque: colors.darkenedBgMix25,
      accent: transparentize(colors.primary, 0.5),
      tagPrimarySolidBackground: colors.primary,
      tagPrimaryFontDisabled: colors.fadedText40,
      tagPrimaryOutlinedDisabled: colors.transparent,
      borderSelected: colors.primary,
      contentPrimary: colors.bodyText,
      inputPlaceholder: colors.fadedText60,
      tickFillDisabled: colors.fadedText40,
      tickMarkFill: colors.lightestGray,
      tickFillSelected: colors.primary,
      datepickerBackground: mainPaneBgColor,
      calendarBackground: mainPaneBgColor,
      calendarForeground: colors.bodyText,
      calendarDayForegroundPseudoSelected: colors.bodyText,
      calendarHeaderBackground: mainPaneSecondaryBgColor,
      calendarHeaderBackgroundActive: mainPaneSecondaryBgColor,
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
      progressbarTrackFill: widgetBackgroundColor,

      // mono100 overrides
      tickFill: colors.lightenedBg05, // Checkbox and Radio
      tickMarkFillDisabled: colors.lightenedBg05,
      // We want menuFill to always use bgColor. But when in sidebar, bgColor and secondaryBg are
      // swapped! So here we unswap them.
      menuFill: mainPaneBgColor,

      // mono200 overrides
      buttonDisabledFill: colors.lightenedBg05,
      tickFillHover: widgetBackgroundColor,
      inputFillDisabled: widgetBackgroundColor,
      inputFillActive: widgetBackgroundColor,

      // mono300 overrides
      toggleTrackFillDisabled: widgetBackgroundColor,
      tickFillActive: widgetBackgroundColor,
      sliderTrackFillDisabled: widgetBackgroundColor,
      inputBorder: colors.widgetBorderColor
        ? colors.widgetBorderColor
        : widgetBackgroundColor,
      inputFill: widgetBackgroundColor,
      inputEnhanceFill: widgetBackgroundColor,
      inputEnhancerFillDisabled: widgetBackgroundColor,

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
