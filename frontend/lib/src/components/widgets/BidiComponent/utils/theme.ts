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

    result[propertyName] = String(value)
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
    headingFontSizes: [
      theme.fontSizes.h1FontSize,
      theme.fontSizes.h2FontSize,
      theme.fontSizes.h3FontSize,
      theme.fontSizes.h4FontSize,
      theme.fontSizes.h5FontSize,
      theme.fontSizes.h6FontSize,
    ],
    headingFontWeights: [
      theme.fontWeights.h1FontWeight,
      theme.fontWeights.h2FontWeight,
      theme.fontWeights.h3FontWeight,
      theme.fontWeights.h4FontWeight,
      theme.fontWeights.h5FontWeight,
      theme.fontWeights.h6FontWeight,
    ],
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

    widgetBorderColor: theme.colors.widgetBorderColor,

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
