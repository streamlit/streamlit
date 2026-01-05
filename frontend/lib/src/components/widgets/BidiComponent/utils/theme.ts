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

import { kebabCase } from "lodash-es"

import {
  StreamlitTheme,
  StreamlitThemeCssProperties,
} from "@streamlit/component-v2-lib"

import { EmotionTheme } from "~lib/theme"

/**
 * Converts an object to CSS custom properties
 * with the --st- prefix and kebab-case naming
 */
export const objectToCssCustomProperties = (
  obj: StreamlitTheme,
  prefix = "--st"
): StreamlitThemeCssProperties => {
  const result: Record<string, string> = {}

  Object.entries(obj).forEach(([key, value]: [string, unknown]) => {
    const kebabKey = kebabCase(key)
    const propertyName = `${prefix}-${kebabKey}`

    if (typeof value === "boolean") {
      result[propertyName] = value ? "1" : "0"
      return
    }

    if (value === undefined || value === null) {
      // Use CSS-wide keyword `unset` so that any property consuming this
      // variable reverts to its initial/inherited value instead of getting the
      // literal strings "undefined" or "null".
      result[propertyName] = "unset"
      return
    }

    if (Array.isArray(value)) {
      result[propertyName] = value.join(",")
      return
    }

    if (typeof value === "number" || typeof value === "string") {
      result[propertyName] = String(value)
      return
    }

    // Fallback for unexpected value types; use `unset` rather than relying on
    // Object's default stringification ('[object Object]').
    // This is a defensive fallback to avoid unexpected behavior. We don't
    // expect this to be reached in practice.
    result[propertyName] = "unset"
  })

  return result as StreamlitThemeCssProperties
}

/**
 * Extracts only the properties defined in Components V2 Theme from the emotion theme.
 *
 * Note: Protobuf sync enforcement and remediation steps live in
 * `frontend/lib/src/components/widgets/BidiComponent/utils/theme.test.ts`.
 * See that file for guidance when types/tests fail due to new theme fields.
 */
export const extractComponentsV2Theme = (
  theme: EmotionTheme
): StreamlitTheme => {
  const headingFontSizes = [
    theme.fontSizes.h1FontSize,
    theme.fontSizes.h2FontSize,
    theme.fontSizes.h3FontSize,
    theme.fontSizes.h4FontSize,
    theme.fontSizes.h5FontSize,
    theme.fontSizes.h6FontSize,
  ]

  const headingFontWeights = [
    theme.fontWeights.h1FontWeight,
    theme.fontWeights.h2FontWeight,
    theme.fontWeights.h3FontWeight,
    theme.fontWeights.h4FontWeight,
    theme.fontWeights.h5FontWeight,
    theme.fontWeights.h6FontWeight,
  ]

  return {
    primaryColor: theme.colors.primary,
    backgroundColor: theme.colors.bgColor,
    secondaryBackgroundColor: theme.colors.secondaryBg,
    textColor: theme.colors.bodyText,
    linkColor: theme.colors.link,
    linkUnderline: theme.linkUnderline,
    headingFont: theme.genericFonts.headingFont,
    codeFont: theme.genericFonts.codeFont,
    baseRadius: theme.radii.default,
    buttonRadius: theme.radii.button,
    baseFontSize:
      typeof theme.fontSizes.baseFontSize === "number"
        ? `${theme.fontSizes.baseFontSize}px`
        : String(theme.fontSizes.baseFontSize),
    baseFontWeight: theme.fontWeights.normal,
    codeFontWeight: theme.fontWeights.code,
    codeFontSize: theme.fontSizes.codeFontSize,
    headingFontSizes,
    headingFontSize1: headingFontSizes[0],
    headingFontSize2: headingFontSizes[1],
    headingFontSize3: headingFontSizes[2],
    headingFontSize4: headingFontSizes[3],
    headingFontSize5: headingFontSizes[4],
    headingFontSize6: headingFontSizes[5],
    headingFontWeights,
    headingFontWeight1: headingFontWeights[0],
    headingFontWeight2: headingFontWeights[1],
    headingFontWeight3: headingFontWeights[2],
    headingFontWeight4: headingFontWeights[3],
    headingFontWeight5: headingFontWeights[4],
    headingFontWeight6: headingFontWeights[5],
    borderColor: theme.colors.borderColor,
    dataframeBorderColor: theme.colors.dataframeBorderColor,
    dataframeHeaderBackgroundColor:
      theme.colors.dataframeHeaderBackgroundColor,
    codeBackgroundColor: theme.colors.codeBackgroundColor,
    font: theme.genericFonts.bodyFont,
    chartCategoricalColors: theme.colors.chartCategoricalColors,
    chartSequentialColors: theme.colors.chartSequentialColors,

    headingColor: theme.colors.headingColor,
    borderColorLight: theme.colors.borderColorLight,
    codeTextColor: theme.colors.codeTextColor,

    /**
     * Computed effective border color for widget elements.
     *
     * This value is derived from theme configuration:
     * - When showWidgetBorder=false: undefined from theme (fallback to
     *   transparent here)
     * - When showWidgetBorder=true: uses theme's borderColor
     * - Legacy: uses deprecated widgetBorderColor config if explicitly set
     *
     * Note: This is NOT the deprecated widgetBorderColor theme config input.
     * This is the computed OUTPUT that custom components should use.
     */
    widgetBorderColor: theme.colors.widgetBorderColor || "transparent",

    redColor: theme.colors.redColor,
    orangeColor: theme.colors.orangeColor,
    yellowColor: theme.colors.yellowColor,
    blueColor: theme.colors.blueColor,
    greenColor: theme.colors.greenColor,
    violetColor: theme.colors.violetColor,
    grayColor: theme.colors.grayColor,
    redBackgroundColor: theme.colors.redBackgroundColor,
    orangeBackgroundColor: theme.colors.orangeBackgroundColor,
    yellowBackgroundColor: theme.colors.yellowBackgroundColor,
    blueBackgroundColor: theme.colors.blueBackgroundColor,
    greenBackgroundColor: theme.colors.greenBackgroundColor,
    violetBackgroundColor: theme.colors.violetBackgroundColor,
    grayBackgroundColor: theme.colors.grayBackgroundColor,

    redTextColor: theme.colors.redTextColor,
    orangeTextColor: theme.colors.orangeTextColor,
    yellowTextColor: theme.colors.yellowTextColor,
    blueTextColor: theme.colors.blueTextColor,
    greenTextColor: theme.colors.greenTextColor,
    violetTextColor: theme.colors.violetTextColor,
    grayTextColor: theme.colors.grayTextColor,
  }
}
