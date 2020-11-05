/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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
import { mainTheme } from "theme"
import { PLACEMENT as POPOVER_PLACEMENT } from "baseui/popover"
import { StyleObject } from "styletron-react"
import { logMessage } from "lib/log"
import { SCSS_VARS } from "autogen/scssVariables"

const fontFamilyMono = SCSS_VARS["$font-family-monospace"]
const fontFamilySans = SCSS_VARS["$font-family-sans-serif"]
const fontSizeBase = SCSS_VARS["$font-size-base"]
const fontSizeSm = SCSS_VARS["$font-size-sm"]

const borderRadius = SCSS_VARS["$border-radius"]
const labelFontSize = SCSS_VARS["$font-size-sm"]
const lineHeightBase = SCSS_VARS["$line-height-base"]
const lineHeightTight = SCSS_VARS["$line-height-tight"]

const smallTextMargin = SCSS_VARS["$m2-3-font-size-sm"]
const textMargin = SCSS_VARS["$font-size-sm"]
const tinyTextMargin = SCSS_VARS["$m1-2-font-size-sm"]
const spacer = SCSS_VARS.$spacer
const gutter = SCSS_VARS.$gutter

// Using this calculator instead to work with spacer
const spacingCalculator = (spacing?: number): string => {
  if (!spacing) {
    return spacer
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const [match, amount, unit] = spacer.match(/(?<amount>\d)(?<unit>.*)/)!
  const numberAmount: number = parseInt(amount, 10)
  return match && numberAmount ? `${numberAmount * spacing}${unit}` : spacer
}

export const spacing = {
  xxs: spacingCalculator(0.25),
  xs: spacingCalculator(0.375),
  sm: spacingCalculator(0.5),
  md: spacingCalculator(0.75),
  lg: spacer,
  xl: spacingCalculator(1.25),
  xxl: spacingCalculator(1.5),
  xxxl: spacingCalculator(2),
}

// Colors
export const colors = {
  black: SCSS_VARS.$black,
  white: SCSS_VARS.$white,
  grayDark: SCSS_VARS["$gray-dark"],
  gray: SCSS_VARS.$gray,
  grayLight: SCSS_VARS["$gray-light"],
  grayLighter: SCSS_VARS["$gray-lighter"],
  grayLightest: SCSS_VARS["$gray-lightest"],
  transparent: "transparent",

  primary: SCSS_VARS.$primary,
  primaryA50: SCSS_VARS["$primary-a50"],

  secondary: SCSS_VARS.$secondary,
  danger: mainTheme.colors.danger,
  disabledBg: SCSS_VARS.$disabled,
  disabledColor: SCSS_VARS.$gray,
}

export const fontStyles = {
  fontFamily: fontFamilySans,
  fontSize: fontSizeBase,
  fontSizeSm,
  fontWeight: "normal",
  lineHeight: lineHeightBase,
  lineHeightTight,
}

export const variables = {
  borderRadius,
  spacer,
  gutter,
}

export enum Sizes {
  SMALL = "sm",
  MEDIUM = "md",
  LARGE = "lg",
  EXTRALARGE = "xl",
}

export const iconSizes = {
  xs: ".75rem",
  sm: "1.25rem",
  md: "1.8rem",
  lg: "2.3rem",
  xl: "2.5rem",
}

export const utilityClasses: { [any: string]: StyleObject } = {
  ellipsis: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
}

export const sliderOverrides = {
  Root: {
    style: {
      paddingTop: smallTextMargin,
    },
  },
  Thumb: {
    style: ({ $disabled }: { $disabled: boolean }) => ({
      backgroundColor: $disabled ? colors.gray : colors.primary,
      borderTopLeftRadius: "100%",
      borderTopRightRadius: "100%",
      borderBottomLeftRadius: "100%",
      borderBottomRightRadius: "100%",
      borderStyle: "none",
      boxShadow: "none",
      height: SCSS_VARS["$border-radius-large"],
      width: SCSS_VARS["$border-radius-large"],
      ":focus": {
        boxShadow: `0 0 0 0.2rem ${colors.primaryA50}`,
        outline: "none",
      },
    }),
  },
  InnerThumb: {
    style: {
      display: "none",
    },
  },
  Tick: {
    style: {
      fontFamily: fontFamilyMono,
      fontSize: labelFontSize,
    },
  },
  ThumbValue: {
    style: ({ $disabled }: { $disabled: boolean }) => ({
      fontFamily: fontFamilyMono,
      fontSize: labelFontSize,
      paddingBottom: smallTextMargin,
      color: $disabled ? colors.gray : colors.primary,
      top: "-22px",
      position: "absolute",
      whiteSpace: "nowrap",
      backgroundColor: colors.transparent,
      lineHeight: lineHeightBase,
      fontWeight: "normal",
    }),
  },
  TickBar: {
    style: {
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: smallTextMargin,
      justifyContent: "space-between",
      alignItems: "center",
      display: "flex",
    },
  },
  TickBarItem: {
    style: {
      lineHeight: lineHeightBase,
      fontWeight: "normal",
      fontSize: labelFontSize,
      fontFamily: fontFamilyMono,
    },
  },
  Track: {
    style: {
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: smallTextMargin,
    },
  },
  InnerTrack: {
    style: ({ $disabled }: { $disabled: boolean }) =>
      $disabled ? { background: colors.grayLighter } : {},
  },
}

export const datePickerOverrides = {
  Popover: {
    props: {
      placement: POPOVER_PLACEMENT.bottomLeft,
    },
  },
  CalendarContainer: {
    style: {
      fontSize: fontSizeSm,
    },
  },
  CalendarHeader: {
    style: {
      // Make header look nicer.
      backgroundColor: colors.gray,
    },
  },
  MonthHeader: {
    style: {
      // Make header look nicer.
      backgroundColor: colors.gray,
    },
  },
  Week: {
    style: {
      fontSize: fontSizeSm,
    },
  },
  Day: {
    style: ({ $selected }: { $selected: boolean }) => ({
      "::after": {
        borderColor: $selected ? colors.transparent : "",
      },
    }),
  },
  PrevButton: {
    style: () => ({
      // Align icon to the center of the button.
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      // Remove primary-color click effect.
      ":active": {
        backgroundColor: colors.transparent,
      },
      ":focus": {
        backgroundColor: colors.transparent,
        outline: 0,
      },
    }),
  },
  NextButton: {
    style: {
      // Align icon to the center of the button.
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      // Remove primary-color click effect.
      ":active": {
        backgroundColor: colors.transparent,
      },
      ":focus": {
        backgroundColor: colors.transparent,
        outline: 0,
      },
    },
  },
  Input: {
    props: {
      // The default maskChar ` ` causes empty dates to display as ` / / `
      // Clearing the maskChar so empty dates will not display
      maskChar: null,
    },
  },
}

export const buttonOverrides = {
  BaseButton: {
    style: {
      paddingTop: tinyTextMargin,
      paddingBottom: tinyTextMargin,
      paddingLeft: textMargin,
      paddingRight: textMargin,
      backgroundColor: colors.white,
      // We shouldn't mix shorthand properties with longhand -- which usually
      // means we should use longhand for everything. But BaseUI's Button
      // actually uses the shorthand "border" property, so that's what I'm
      // using here too.
      border: `1px solid ${colors.grayLighter}`,
      color: colors.black,
      ":hover": {
        backgroundColor: colors.white,
        borderColor: colors.primary,
        color: colors.primary,
      },
      ":focus": {
        backgroundColor: colors.white,
        borderColor: colors.primary,
        boxShadow: `0 0 0 0.2rem ${colors.primaryA50}`,
        color: colors.primary,
        outline: "none",
      },
      ":active": {
        color: colors.white,
      },
      ":disabled": {
        backgroundColor: colors.grayLighter,
        borderColor: colors.transparent,
        color: colors.gray,
      },
      ":hover:disabled": {
        backgroundColor: colors.grayLighter,
        borderColor: colors.transparent,
        color: colors.gray,
      },
    },
  },
}

export const multiSelectOverrides = {
  ValueContainer: {
    style: () => ({
      /*
        This minHeight is needed to fix a bug from BaseWeb in which the
        div that contains the options changes their height from 40px to 44px.

        You could check this behavior in their documentation as well:
        https://v8-17-1.baseweb.design/components/select/#select-as-multi-pick-search

        Issue related: https://github.com/streamlit/streamlit/issues/590
       */
      minHeight: "44px",
    }),
  },
  ClearIcon: {
    style: {
      color: colors.grayDark,
    },
  },
  SearchIcon: {
    style: {
      color: colors.grayDark,
    },
  },
  MultiValue: {
    props: {
      overrides: {
        Root: {
          style: {
            fontSize: "12px",
          },
        },
      },
    },
  },
}

export const radioOverrides = {
  Root: {
    style: ({ $isFocused }: { $isFocused: boolean }) => ({
      marginBottom: 0,
      marginTop: 0,
      paddingRight: smallTextMargin,
      backgroundColor: $isFocused ? colors.grayLightest : "",
      borderTopLeftRadius: borderRadius,
      borderTopRightRadius: borderRadius,
      borderBottomLeftRadius: borderRadius,
      borderBottomRightRadius: borderRadius,
    }),
  },
  RadioMarkInner: {
    style: ({ $checked }: { $checked: boolean }) => ({
      height: $checked ? "6px" : "16px",
      width: $checked ? "6px" : "16px",
    }),
  },
}

export const checkboxOverrides = {
  ...radioOverrides,
  Checkmark: {
    style: ({
      $isFocusVisible,
      $checked,
    }: {
      $isFocusVisible: boolean
      $checked: boolean
    }) => ({
      borderWidth: "2px",
      outline: 0,
      boxShadow:
        $isFocusVisible && $checked ? `0 0 0 0.2rem ${colors.primaryA50}` : "",
    }),
  },
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

  primaryFontFamily: SCSS_VARS["$font-family-sans-serif"],

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
  mono200: colors.grayLightest, // Text input, text area, selectbox
  mono300: colors.grayLighter, // Disabled widget background
  mono400: colors.grayLighter, // Slider track
  mono500: colors.gray, // Clicked checkbox and radio
  mono600: colors.gray, // Disabled widget text
  mono700: colors.gray, // Unselected checkbox and radio
  mono800: colors.grayDark, // Selectbox text
  mono900: colors.grayDark, // Not used, but just in case.
  mono1000: colors.black,

  rating200: "#FFE1A5",
  rating400: "#FFC043",
}

// Theme overrides.
// NOTE: A lot of the properties we can override here don't seem to actually
// be used anywhere in BaseWeb's source. Will report a bug about it.
export const themeOverrides = {
  borders: {
    radius100: borderRadius,
    radius200: borderRadius,
    radius300: borderRadius,
    radius400: borderRadius,
    buttonBorderRadius: borderRadius,
    inputBorderRadius: borderRadius,
    popoverBorderRadius: borderRadius,
    surfaceBorderRadius: borderRadius,
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
    accent: colors.primaryA50,
    tagPrimarySolidBackground: colors.primary,
    borderFocus: colors.primary,
    contentPrimary: colors.black,
    inputFill: colors.grayLightest,
    inputPlaceholder: colors.grayDark,
    inputBorder: colors.grayLightest,
    inputFillActive: colors.grayLightest,
    tickMarkFillDisabled: colors.grayLighter,
    tickFillDisabled: colors.gray,
    tickMarkFill: colors.grayLightest,
    tickFillSelected: colors.primary,
    calendarHeaderForegroundDisabled: colors.grayLight,
    calendarDayBackgroundSelected: colors.primary,
    calendarDayBackgroundSelectedHighlighted: colors.primary,
    calendarDayForegroundSelected: colors.white,
    calendarDayForegroundSelectedHighlighted: colors.white,
    notificationInfoBackground: mainTheme.colors.alertInfoBackgroundColor,
    notificationInfoText: mainTheme.colors.alertInfoTextColor,
    notificationPositiveBackground:
      mainTheme.colors.alertSuccessBackgroundColor,
    notificationPositiveText: mainTheme.colors.alertSuccessTextColor,
    notificationWarningBackground:
      mainTheme.colors.alertWarningBackgroundColor,
    notificationWarningText: mainTheme.colors.alertWarningTextColor,
    notificationNegativeBackground: mainTheme.colors.alertErrorBackgroundColor,
    notificationNegativeText: mainTheme.colors.alertErrorTextColor,
    progressbarTrackFill: mainTheme.colors.gray20,
  },
}

export const mainWidgetTheme = createTheme(mainThemePrimitives, themeOverrides)

export const sidebarWidgetTheme = createTheme(mainThemePrimitives, {
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
    buttonDisabledSpinnerBackground: colors.grayLight,
    toggleTrackFill: colors.grayLight,
    sliderTrackFill: colors.grayLight,
    sliderHandleInnerFill: colors.grayLight,
    sliderHandleInnerFillDisabled: colors.grayLight,

    progressbarTrackFill: mainTheme.colors.lightGray,
  },
})

// Log the widget theme just for debug purposes.
logMessage("mainWidgetTheme", mainWidgetTheme)
logMessage("sidebarWidgetTheme", sidebarWidgetTheme)

export type MainWidgetTheme = typeof mainWidgetTheme
export type SidebarWidgetTheme = typeof sidebarWidgetTheme
