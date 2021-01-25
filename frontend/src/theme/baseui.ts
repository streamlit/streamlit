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

import { createTheme, lightThemePrimitives } from "baseui"
import { transparentize } from "color2k"
import mainTheme from "./mainTheme"

const { colors, fonts, fontSizes, lineHeights, radii } = mainTheme

const fontStyles = {
  fontFamily: fonts.sansSerif,
  fontSize: fontSizes.md,
  fontSizeSm: fontSizes.smDefault,
  fontWeight: "normal",
  lineHeight: lineHeights.base,
  lineHeightTight: lineHeights.tight,
}

// Theme primitives. See lightThemePrimitives for what's available. These are
// used to create a large JSON-style structure with theme values for all
// widgets.
// - See node_modules/baseui/themes/light-theme-primitives.js for an example
// of primitives we can use here.
// - See node_modules/baseui/themes/creator.js for the mapping of values from
// this file to output values.
const mainThemePrimitives = {
  ...lightThemePrimitives,

  primaryFontFamily: fonts.sansSerif,

  primary100: colors.primary,
  primary200: colors.primary,
  primary300: colors.primary,
  primary400: colors.primary,
  primary500: colors.primary,
  primary600: colors.primary,
  primary700: colors.primary,

  // Override gray values based on what is actually used in BaseWeb, and the
  // way we want it to match our theme originating from Bootstrap.
  mono100: colors.white, // Popup menu
  mono200: colors.lightestGray, // Text input, text area, selectbox
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

// Theme overrides.
// NOTE: A lot of the properties we can override here don't seem to actually
// be used anywhere in BaseWeb's source. Will report a bug about it.
export const themeOverrides = {
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
    accent: transparentize(colors.primary, 0.5),
    tagPrimarySolidBackground: colors.primary,
    borderFocus: colors.primary,
    contentPrimary: colors.black,
    inputFill: colors.lightestGray,
    inputPlaceholder: colors.darkGray,
    inputBorder: colors.lightestGray,
    inputFillActive: colors.lightestGray,
    tickMarkFillDisabled: colors.lightGray,
    tickFillDisabled: colors.gray,
    tickMarkFill: colors.lightestGray,
    tickFillSelected: colors.primary,
    calendarHeaderForegroundDisabled: colors.gray40,
    calendarDayBackgroundSelected: colors.primary,
    calendarDayBackgroundSelectedHighlighted: colors.primary,
    calendarDayForegroundSelected: colors.white,
    calendarDayForegroundSelectedHighlighted: colors.white,
    notificationInfoBackground: colors.alertInfoBackgroundColor,
    notificationInfoText: colors.alertInfoTextColor,
    notificationPositiveBackground: colors.alertSuccessBackgroundColor,
    notificationPositiveText: colors.alertSuccessTextColor,
    notificationWarningBackground: colors.alertWarningBackgroundColor,
    notificationWarningText: colors.alertWarningTextColor,
    notificationNegativeBackground: colors.alertErrorBackgroundColor,
    notificationNegativeText: colors.alertErrorTextColor,
    progressbarTrackFill: colors.lightestGray,
  },
}

export const mainBaseUITheme = createTheme(mainThemePrimitives, themeOverrides)
export const sidebarBaseUITheme = createTheme(mainThemePrimitives, {
  ...themeOverrides,
  colors: {
    ...themeOverrides.colors,
    // mono100 overrides
    datepickerBackground: colors.white,
    calendarBackground: colors.white,
    tickFill: colors.white,
    tickMarkFillDisabled: colors.white,
    menuFill: colors.white,

    // mono200 overrides
    buttonDisabledFill: colors.white,
    fileUploaderBackgroundColor: colors.white,
    tickFillHover: colors.white,
    inputFillDisabled: colors.white,
    inputFillActive: colors.white,

    // mono300 overrides
    toggleTrackFillDisabled: colors.white,
    tickFillActive: colors.white,
    sliderTrackFillDisabled: colors.white,
    inputBorder: colors.white,
    inputFill: colors.white,
    inputEnhanceFill: colors.white,
    inputEnhancerFillDisabled: colors.white,

    // mono400 overrides
    buttonDisabledSpinnerBackground: colors.gray40,
    toggleTrackFill: colors.gray40,
    sliderTrackFill: colors.gray40,
    sliderHandleInnerFill: colors.gray40,
    sliderHandleInnerFillDisabled: colors.gray40,

    progressbarTrackFill: colors.gray40,
  },
})

export type MainBaseUITheme = typeof mainBaseUITheme
export type SidebarBaseUITheme = typeof sidebarBaseUITheme
