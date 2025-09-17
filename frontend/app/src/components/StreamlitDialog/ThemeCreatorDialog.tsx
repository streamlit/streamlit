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

import React, { ReactElement, useCallback, useContext } from "react"

import { Check } from "@emotion-icons/material-outlined"

import {
  themeBuilder,
  toMinimalToml,
} from "@streamlit/app/src/components/StreamlitDialog/themeUtils"
import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import {
  BaseButton,
  BaseButtonKind,
  BaseColorPicker,
  createTheme,
  CUSTOM_THEME_NAME,
  Icon,
  LibContext,
  Modal,
  ModalBody,
  ModalHeader,
  StreamlitMarkdown,
  ThemeConfig,
  toThemeInput,
  useCopyToClipboard,
} from "@streamlit/lib"

import {
  StyledBackButton,
  StyledDialogBody,
  StyledFullRow,
} from "./styled-components"

const ThemeOption = ({
  name,
  value,
  onThemeOptionChange,
}: {
  name: string
  value: string
  onThemeOptionChange: (name: string, value: string) => void
}): ReactElement | null => {
  const themeOptionConfig = themeBuilder[name]
  const isColor = themeOptionConfig.component === BaseColorPicker
  // Props that vary based on component type
  const variableProps = {
    options: themeOptionConfig.options || undefined,
    showValue: isColor,
    value: themeOptionConfig.getValue(value, themeOptionConfig),
  }

  const handleChange = useCallback(
    (newVal: string) => {
      onThemeOptionChange(name, newVal)
    },
    [name, onThemeOptionChange]
  )

  return (
    <React.Fragment key={name}>
      <themeOptionConfig.component
        disabled={false}
        label={themeOptionConfig.title}
        help={themeOptionConfig.help}
        onChange={handleChange}
        {...variableProps}
      />
    </React.Fragment>
  )
}

export interface Props {
  backToSettings: (animateModal: boolean) => void
  onClose: () => void
  metricsMgr: MetricsManager
}

const ThemeCreatorDialog = (props: Props): ReactElement => {
  const { activeTheme, addThemes, setTheme } = useContext(LibContext)

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
  }

  const config = toMinimalToml(themeInput)

  const { isCopied, copyToClipboard } = useCopyToClipboard()

  const copyConfig = (): void => {
    props.metricsMgr.enqueue("menuClick", {
      label: "copyThemeToClipboard",
    })
    copyToClipboard(config)
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
        <StyledBackButton
          onClick={onClickedBack}
          data-testid="stThemeCreatorBack"
        />
        Edit active theme
      </ModalHeader>
      <ModalBody>
        <StyledDialogBody data-testid="stThemeCreatorDialog">
          <StyledFullRow>
            <StreamlitMarkdown
              source={`
Changes made to the active theme will exist for the duration of a
session. To discard changes and recover the original theme,
refresh the page.`}
              allowHTML={false}
              isCaption={true}
            />
          </StyledFullRow>

          <ThemeOption
            name="primaryColor"
            value={primaryColor}
            onThemeOptionChange={onThemeOptionChange}
          />
          <ThemeOption
            name="backgroundColor"
            value={backgroundColor}
            onThemeOptionChange={onThemeOptionChange}
          />
          <ThemeOption
            name="textColor"
            value={textColor}
            onThemeOptionChange={onThemeOptionChange}
          />
          <ThemeOption
            name="secondaryBackgroundColor"
            value={secondaryBackgroundColor}
            onThemeOptionChange={onThemeOptionChange}
          />

          <StyledFullRow>
            <StyledFullRow>
              <StreamlitMarkdown
                source={`
To save your changes, copy your custom theme into the clipboard and paste it into the
\`[theme]\` section of your \`.streamlit/config.toml\` file.
`}
                allowHTML={false}
                isCaption={true}
              />
            </StyledFullRow>
          </StyledFullRow>

          <StyledFullRow>
            <div>
              <BaseButton onClick={copyConfig} kind={BaseButtonKind.SECONDARY}>
                {isCopied ? (
                  <React.Fragment>
                    {"Copied to clipboard "}
                    <Icon
                      content={Check}
                      size="lg"
                      color={activeTheme.emotion.colors.greenTextColor}
                    />
                  </React.Fragment>
                ) : (
                  "Copy theme to clipboard"
                )}
              </BaseButton>
            </div>
          </StyledFullRow>
        </StyledDialogBody>
      </ModalBody>
    </Modal>
  )
}

export default ThemeCreatorDialog
