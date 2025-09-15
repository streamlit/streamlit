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

import { toHex } from "color2k"
import humanizeString from "humanize-string"
import mapValues from "lodash/mapValues"

import {
  BaseColorPicker,
  darkTheme,
  EmotionTheme,
  lightTheme,
  toThemeInput,
  UISelectbox,
} from "@streamlit/lib"
import { CustomThemeConfig } from "@streamlit/protobuf"

interface ThemeOptionBuilder {
  help: string
  title: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  component: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  options?: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  getValue: (value: string, config: ThemeOptionBuilder) => any
}

const valueToColor = (value: string, _config: ThemeOptionBuilder): string =>
  toHex(value).toUpperCase()

const changedColorConfig = (
  themeInput: Partial<CustomThemeConfig>,
  baseTheme: EmotionTheme
): Array<string> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  const toLowerCaseIfString = (x: any): any => {
    if (typeof x === "string") {
      return x.toLowerCase()
    }
    return x
  }

  const baseInput: Partial<CustomThemeConfig> = mapValues(
    toThemeInput(baseTheme),
    toLowerCaseIfString
  )
  themeInput = mapValues(themeInput, toLowerCaseIfString)
  const configLines: Array<string> = []

  // This is tedious, but typescript won't let us define an array with the keys
  // ["primaryColor", "backgroundColor", etc.] and use its elements to key into
  // themeInput and baseInput since it can't infer that the string literals in
  // the array are indeed valid fields.
  if (themeInput.primaryColor !== baseInput.primaryColor) {
    configLines.push(`primaryColor="${themeInput.primaryColor}"`)
  }
  if (themeInput.backgroundColor !== baseInput.backgroundColor) {
    configLines.push(`backgroundColor="${themeInput.backgroundColor}"`)
  }
  if (
    themeInput.secondaryBackgroundColor !== baseInput.secondaryBackgroundColor
  ) {
    configLines.push(
      `secondaryBackgroundColor="${themeInput.secondaryBackgroundColor}"`
    )
  }
  if (themeInput.textColor !== baseInput.textColor) {
    configLines.push(`textColor="${themeInput.textColor}"`)
  }

  return configLines
}

const displayFontOption = (
  font: CustomThemeConfig.FontFamily | string
): string =>
  // @ts-expect-error
  humanizeString(CustomThemeConfig.FontFamily[font])

export const themeBuilder: Record<string, ThemeOptionBuilder> = {
  primaryColor: {
    help: "Primary accent color for interactive elements.",
    title: "Primary color",
    component: BaseColorPicker,
    getValue: valueToColor,
  },
  backgroundColor: {
    help: "Background color for the main content area.",
    title: "Background color",
    component: BaseColorPicker,
    getValue: valueToColor,
  },
  secondaryBackgroundColor: {
    help: "Background color used for the sidebar and most interactive widgets.",
    title: "Secondary background color",
    component: BaseColorPicker,
    getValue: valueToColor,
  },
  textColor: {
    help: "Color used for almost all text.",
    title: "Text color",
    component: BaseColorPicker,
    getValue: valueToColor,
  },
  font: {
    help: "Font family for all text in the app, except code blocks.",
    title: "Font family",
    options: Object.keys(CustomThemeConfig.FontFamily).map(font =>
      humanizeString(font)
    ),
    getValue: (value: string, config: ThemeOptionBuilder): number =>
      config.options?.findIndex(
        (font: string) => font === displayFontOption(value)
      ) || 0,
    component: UISelectbox,
  },
}

export const toMinimalToml = (
  themeInput: Partial<CustomThemeConfig>
): string => {
  const lines = ["[theme]"]

  const lightBaseConfig = changedColorConfig(themeInput, lightTheme.emotion)
  const darkBaseConfig = changedColorConfig(themeInput, darkTheme.emotion)

  const lbcLength = lightBaseConfig.length
  const dbcLength = darkBaseConfig.length

  if (lbcLength === dbcLength) {
    // Since the light and dark themes have different background, secondary
    // background, and text colors, this can only happen if all three of those
    // are changed. We don't need to define a base theme in this case.
    lines.push(...lightBaseConfig)
  } else if (lbcLength < dbcLength) {
    // Technically, the default base theme is light, but we break minimality
    // and set it here anyway to be more explicit.
    lines.push('base="light"', ...lightBaseConfig)
  } else {
    lines.push('base="dark"', ...darkBaseConfig)
  }

  if (themeInput.font) {
    const fontString = displayFontOption(themeInput.font).toLowerCase()
    lines.push(`font="${fontString}"`)
  }

  return [
    ...lines,
    // Add a newline to the end.
    "",
  ].join("\n")
}
