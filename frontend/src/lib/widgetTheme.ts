/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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
import { logMessage } from "lib/log"
import { SCSS_VARS } from "autogen/scssVariables"

const black = SCSS_VARS["$black"]
const borderRadius = SCSS_VARS["$border-radius"]
const fontFamilyMono = SCSS_VARS["$font-family-monospace"]
const fontFamilySans = SCSS_VARS["$font-family-sans-serif"]
const fontSizeBase = SCSS_VARS["$font-size-base"]
const fontSizeSm = SCSS_VARS["$font-size-sm"]
const grayDark = SCSS_VARS["$gray-dark"]
const gray = SCSS_VARS["$gray"]
const grayLight = SCSS_VARS["$gray-light"]
const grayLighter = SCSS_VARS["$gray-lighter"]
const grayLightest = SCSS_VARS["$gray-lightest"]
const labelFontSize = SCSS_VARS["$font-size-sm"]
const lineHeightBase = SCSS_VARS["$line-height-base"]
const primary = SCSS_VARS["$primary"]
const primaryA50 = SCSS_VARS["$primary-a50"]
const smallTextMargin = SCSS_VARS["$m2-3-font-size-sm"]
const textMargin = SCSS_VARS["$font-size-sm"]
const tinyTextMargin = SCSS_VARS["$m1-2-font-size-sm"]
const white = SCSS_VARS["$white"]

const fontStyles = {
  fontFamily: fontFamilySans,
  fontSize: fontSizeBase,
  fontWeight: "normal",
  lineHeight: lineHeightBase,
}

export const sliderOverrides = {
  Root: {
    style: {
      paddingTop: smallTextMargin,
    },
  },
  Thumb: {
    style: ({ $disabled }: any) => ({
      backgroundColor: $disabled ? gray : primary,
      borderTopLeftRadius: "100%",
      borderTopRightRadius: "100%",
      borderBottomLeftRadius: "100%",
      borderBottomRightRadius: "100%",
      borderStyle: "none",
      boxShadow: "none",
      height: SCSS_VARS["$border-radius-large"],
      width: SCSS_VARS["$border-radius-large"],
      ":focus": {
        boxShadow: `0 0 0 0.2rem ${primaryA50}`,
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
    style: ({ $disabled }: any) => ({
      fontFamily: fontFamilyMono,
      fontSize: labelFontSize,
      paddingBottom: smallTextMargin,
      color: $disabled ? gray : primary,
      top: "-22px",
      position: "absolute",
      whiteSpace: "nowrap",
      backgroundColor: "transparent",
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
    style: ({ $disabled }: any) =>
      $disabled ? { background: grayLighter } : {},
  },
}

export const datePickerOverrides = {
  CalendarContainer: {
    style: {
      fontSize: fontSizeSm,
    },
  },
  CalendarHeader: {
    style: {
      // Make header look nicer.
      backgroundColor: gray,
    },
  },
  MonthHeader: {
    style: {
      // Make header look nicer.
      backgroundColor: gray,
    },
  },
  Week: {
    style: {
      fontSize: fontSizeSm,
    },
  },
  Day: {
    style: {
      // The hover effect is very slow for this widget. Let's just turn it off.
      ":hover": {
        backgroundColor: "transparent",
      },
    },
  },
  PrevButton: {
    style: {
      // Align icon to the center of the button.
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      // Remove primary-color click effect.
      ":active": {
        backgroundColor: "transparent",
      },
      ":focus": {
        backgroundColor: "transparent",
      },
    },
  },
  NextButton: {
    style: {
      // Align icon to the center of the button.
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      // Remove primary-color click effect.
      ":active": {
        backgroundColor: "transparent",
      },
      ":focus": {
        backgroundColor: "transparent",
      },
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
      backgroundColor: white,
      // We shouldn't mix shorthand properties with longhand -- which usually
      // means we should use longhand for everything. But BaseUI's Button
      // actually uses the shorthand "border" property, so that's what I'm
      // using here too.
      border: `1px solid ${grayLighter}`,
      color: black,
      ":hover": {
        backgroundColor: "transparent",
        borderColor: primary,
        color: primary,
      },
      ":focus": {
        backgroundColor: white,
        borderColor: primary,
        boxShadow: `0 0 0 0.2rem ${primaryA50}`,
        color: primary,
        outline: "none",
      },
      ":active": {
        color: white,
      },
      ":disabled": {
        backgroundColor: grayLighter,
        borderColor: "transparent",
        color: gray,
      },
      ":hover:disabled": {
        backgroundColor: grayLighter,
        borderColor: "transparent",
        color: gray,
      },
    },
  },
}

export const radioOverrides = {
  Root: {
    style: ({ $isFocused }: any) => ({
      marginBottom: 0,
      marginTop: 0,
      paddingRight: smallTextMargin,
      backgroundColor: $isFocused ? grayLightest : "",
      borderTopLeftRadius: borderRadius,
      borderTopRightRadius: borderRadius,
      borderBottomLeftRadius: borderRadius,
      borderBottomRightRadius: borderRadius,
    }),
  },
}

export const checkboxOverrides = radioOverrides

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

  primary100: primary,
  primary200: primary,
  primary300: primary,
  primary400: primary,
  primary500: primary,
  primary600: primary,
  primary700: primary,

  // Override gray values based on what is actually used in BaseWeb, and the
  // way we want it to match our Bootstrap theme.
  mono100: white, // Popup menu
  mono200: grayLightest, // Text input, text area, selectbox
  mono300: grayLighter, // Disabled widget background
  mono400: grayLighter, // Slider track
  mono500: gray, // Clicked checkbox and radio
  mono600: gray, // Disabled widget text
  mono700: gray, // Unselected checkbox and radio
  mono800: grayDark, // Selectbox text
  mono900: grayDark, // Not used, but just in case.
  mono1000: black,

  rating200: "#FFE1A5",
  rating400: "#FFC043",
}

// Theme overrides.
// NOTE: A lot of the properties we can override here don't seem to actually
// be used anywhere in BaseWeb's source. Will report a bug about it.
const themeOverrides = {
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
  },

  colors: {
    white: white,
    black: black,
    tickMarkFillDisabled: grayLighter,
    tickFillDisabled: gray,
  },
}

export const mainWidgetTheme = createTheme(mainThemePrimitives, themeOverrides)

export const sidebarWidgetTheme = createTheme(
  {
    ...mainThemePrimitives,

    // Override gray values based on what is actually used in BaseWeb, and the
    // way we want it to match our Bootstrap theme.
    mono100: white, // Popup menu
    mono200: white, // Text input, text area, selectbox
    mono300: white, // Disabled widget background
    mono400: grayLight, // Slider track
  },
  themeOverrides
)

// Log the widget theme just for debug purposes.
logMessage("mainWidgetTheme", mainWidgetTheme)
logMessage("sidebarWidgetTheme", sidebarWidgetTheme)
