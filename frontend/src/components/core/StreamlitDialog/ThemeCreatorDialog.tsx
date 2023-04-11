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

import React, { ReactElement } from "react"
import { Check } from "@emotion-icons/material-outlined"
import { toHex } from "color2k"
import humanizeString from "humanize-string"
import mapValues from "lodash/mapValues"

import { CustomThemeConfig } from "src/autogen/proto"
import { AppContext } from "src/components/core/AppContext"
import Button, { Kind } from "src/components/shared/Button"
import ColorPicker from "src/components/shared/ColorPicker"
import Modal, { ModalHeader, ModalBody } from "src/components/shared/Modal"
import UISelectbox from "src/components/shared/Dropdown"
import Icon from "src/components/shared/Icon"
import {
  CUSTOM_THEME_NAME,
  createTheme,
  darkTheme,
  lightTheme,
  Theme,
  ThemeConfig,
  toThemeInput,
} from "src/theme"

import {
  StyledDialogBody,
  StyledFullRow,
  StyledBackButton,
  StyledHr,
  StyledSmall,
} from "./styled-components"

interface ThemeOptionBuilder {
  help: string
  title: string
  component: any
  options?: any[]
  getValue: (value: string, config: ThemeOptionBuilder) => any
}

const valueToColor = (value: string, _config: ThemeOptionBuilder): string =>
  toHex(value).toUpperCase()

const displayFontOption = (
  font: CustomThemeConfig.FontFamily | string
): string =>
  // @ts-expect-error
  humanizeString(CustomThemeConfig.FontFamily[font])

const themeBuilder: Record<string, ThemeOptionBuilder> = {
  primaryColor: {
    help: "Primary accent color for interactive elements.",
    title: "Primary color",
    component: ColorPicker,
    getValue: valueToColor,
  },
  backgroundColor: {
    help: "Background color for the main content area.",
    title: "Background color",
    component: ColorPicker,
    getValue: valueToColor,
  },
  secondaryBackgroundColor: {
    help: "Background color used for the sidebar and most interactive widgets.",
    title: "Secondary background color",
    component: ColorPicker,
    getValue: valueToColor,
  },
  textColor: {
    help: "Color used for almost all text.",
    title: "Text color",
    component: ColorPicker,
    getValue: valueToColor,
  },
  font: {
    help: "Font family for all text in the app, except code blocks.",
    title: "Font family",
    options: Object.keys(CustomThemeConfig.FontFamily).map(font =>
      humanizeString(font)
    ),
    getValue: (value: string, config: ThemeOptionBuilder): number =>
      (config.options &&
        config.options.findIndex(
          (font: string) => font === displayFontOption(value)
        )) ||
      0,
    component: UISelectbox,
  },
}

const changedColorConfig = (
  themeInput: Partial<CustomThemeConfig>,
  baseTheme: Theme
): Array<string> => {
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

export interface Props {
  backToSettings: (animateModal: boolean) => void
  onClose: () => void
}

const ThemeCreatorDialog = (props: Props): ReactElement => {
  const [copied, updateCopied] = React.useState(false)
  const { activeTheme, addThemes, setTheme } = React.useContext(AppContext)

  const themeInput = toThemeInput(activeTheme.emotion)

  const updateTheme = (customTheme: ThemeConfig): void => {
    addThemes([customTheme])
    setTheme(customTheme)
  }

  const onThemeOptionChange = (key: string, newVal: string): void => {
    const customTheme = createTheme(CUSTOM_THEME_NAME, {
      ...themeInput,
      [key]: newVal,
    })
    updateTheme(customTheme)
    updateCopied(false)
  }

  const config = toMinimalToml(themeInput)

  const copyConfig = (): void => {
    navigator.clipboard.writeText(config)
    updateCopied(true)
  }

  const ThemeOption = ({
    name,
    value,
  }: {
    name: string
    value: string
  }): ReactElement | null => {
    const themeOptionConfig = themeBuilder[name]
    const isColor = themeOptionConfig.component === ColorPicker
    // Props that vary based on component type
    const variableProps = {
      options: themeOptionConfig.options || undefined,
      showValue: isColor,
      value: themeOptionConfig.getValue(value, themeOptionConfig),
    }
    return (
      <React.Fragment key={name}>
        <themeOptionConfig.component
          disabled={false}
          label={themeOptionConfig.title}
          help={themeOptionConfig.help}
          onChange={(newVal: string) => {
            onThemeOptionChange(name, newVal)
          }}
          {...variableProps}
        />
      </React.Fragment>
    )
  }

  const onClickedBack = (): void => {
    // Disable the modal animation when returning to the settings dialog so
    // that it looks like a page transition instead of the modal
    // appearing/disappearing rapidly.
    props.backToSettings(false)
  }

  // At this point, we're guaranteed to have themeInput be a fully populated
  // CustomThemeConfig.
  const {
    primaryColor,
    textColor,
    backgroundColor,
    secondaryBackgroundColor,
  } = themeInput as {
    primaryColor: string
    textColor: string
    backgroundColor: string
    secondaryBackgroundColor: string
  }

  return (
    <Modal animate={false} isOpen onClose={props.onClose}>
      <ModalHeader>
        <StyledBackButton onClick={onClickedBack} />
        Edit active theme
      </ModalHeader>
      <ModalBody>
        <StyledDialogBody>
          <StyledFullRow>
            <StyledSmall>
              Changes made to the active theme will exist for the duration of a
              session. To discard changes and recover the original theme,
              refresh the page.
            </StyledSmall>
          </StyledFullRow>

          <ThemeOption name="primaryColor" value={primaryColor} />
          <ThemeOption name="backgroundColor" value={backgroundColor} />
          <ThemeOption name="textColor" value={textColor} />
          <ThemeOption
            name="secondaryBackgroundColor"
            value={secondaryBackgroundColor}
          />

          <StyledFullRow>
            <ThemeOption name="font" value={String(themeInput.font)} />
          </StyledFullRow>

          <StyledFullRow>
            <StyledHr />
          </StyledFullRow>

          <StyledFullRow>
            <StyledSmall>
              To save your changes, copy your custom theme into the clipboard
              and paste it into the
              <code>[theme]</code> section of your{" "}
              <code>.streamlit/config.toml</code> file.
            </StyledSmall>

            <div>
              <Button onClick={copyConfig} kind={Kind.SECONDARY}>
                {copied ? (
                  <React.Fragment>
                    {"Copied to clipboard "}
                    <Icon
                      content={Check}
                      size="lg"
                      color={activeTheme.emotion.colors.success}
                    />
                  </React.Fragment>
                ) : (
                  "Copy theme to clipboard"
                )}
              </Button>
            </div>
          </StyledFullRow>
        </StyledDialogBody>
      </ModalBody>
    </Modal>
  )
}

export default ThemeCreatorDialog
