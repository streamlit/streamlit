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

import React, { ReactElement, useState, useEffect } from "react"
import { withTheme } from "@emotion/react"
import { Radio as UIRadio, RadioGroup, ALIGN } from "baseui/radio"
import {
  WidgetLabel,
  StyledWidgetLabelHelpInline,
} from "src/components/widgets/BaseWidget"
import TooltipIcon from "src/components/shared/TooltipIcon"
import { Placement } from "src/components/shared/Tooltip"
import { Theme } from "src/theme"
import { Radio as RadioProto } from "src/autogen/proto"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import { labelVisibilityProtoValueToEnum } from "src/lib/utils"

export interface Props {
  disabled: boolean
  theme: Theme
  element: RadioProto
  widgetMgr: WidgetStateManager
  width: number
}

function Radio(props: Props): ReactElement {
  const { theme, element, width, widgetMgr } = props
  let { disabled } = props
  const { colors, radii } = theme
  const style = { width }
  const { horizontal, options, label, labelVisibility, help } = element

  const initialValue = (): number => {
    // If WidgetStateManager knew a value for this widget, initialize to that.
    // Otherwise, use the default value from the widget protobuf.
    const storedValue = widgetMgr.getIntValue(element)
    return storedValue !== undefined ? storedValue : element.default
  }

  const [value, setStateValue] = useState(initialValue())
  const [source, setStateSource] = useState({ fromUi: false })

  const updateFromProtobuf = (): void => {
    element.setValue = false
    setStateValue(element.value)
    setStateSource({ fromUi: false })
  }

  const maybeUpdateFromProtobuf = (): void => {
    const { setValue } = element
    if (setValue) {
      updateFromProtobuf()
    }
  }

  const checkNoOptions = (): void => {
    if (options.length === 0) {
      options.push("No options to select.")
    }
    if (options[0] === "No options to select.") {
      disabled = true
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedIndex = parseInt(e.target.value, 10)
    setStateValue(selectedIndex)
    setStateSource({ fromUi: true })
  }

  const onFormCleared = (): void => {
    setStateValue(element.default)
    setStateSource({ fromUi: true })
  }

  useEffect(() => {
    if (element.setValue) {
      updateFromProtobuf()
    } else {
      setStateSource({ fromUi: false })
    }
    // Add form-clear event handler.
    const formListener = widgetMgr.addFormClearedListener(
      element.formId,
      onFormCleared
    )
    return function cleanup() {
      formListener.disconnect()
    }
  }, [])

  useEffect(() => {
    props.widgetMgr.setIntValue(element, value, source)
  }, [value, source])

  useEffect(() => {
    maybeUpdateFromProtobuf()
  })

  checkNoOptions()

  return (
    <div className="row-widget stRadio" style={style}>
      <WidgetLabel
        data-testid="WidgetLabel"
        label={label}
        disabled={disabled}
        labelVisibility={labelVisibilityProtoValueToEnum(
          labelVisibility?.value
        )}
      >
        {help && (
          <StyledWidgetLabelHelpInline>
            <TooltipIcon content={help} placement={Placement.TOP_RIGHT} />
          </StyledWidgetLabelHelpInline>
        )}
      </WidgetLabel>
      <RadioGroup
        id="RadioGroup"
        onChange={handleChange}
        value={value.toString()}
        disabled={disabled}
        align={horizontal ? ALIGN.horizontal : ALIGN.vertical}
        aria-label={label}
      >
        {options.map((option: string, index: number) => (
          <UIRadio
            key={index}
            value={index.toString()}
            overrides={{
              Root: {
                style: ({
                  $isFocusVisible,
                }: {
                  $isFocusVisible: boolean
                }) => ({
                  marginBottom: 0,
                  marginTop: 0,
                  marginRight: "1rem",
                  // Make left and right padding look the same visually.
                  paddingLeft: 0,
                  alignItems: "start",
                  paddingRight: "2px",
                  backgroundColor: $isFocusVisible
                    ? colors.darkenedBgMix25
                    : "",
                  borderTopLeftRadius: radii.md,
                  borderTopRightRadius: radii.md,
                  borderBottomLeftRadius: radii.md,
                  borderBottomRightRadius: radii.md,
                }),
              },
              RadioMarkOuter: {
                style: ({ $checked }: { $checked: boolean }) => ({
                  width: "1rem",
                  height: "1rem",
                  marginTop: "0.35rem",
                  marginRight: "0",
                  backgroundColor:
                    $checked && !disabled
                      ? colors.primary
                      : colors.fadedText40,
                }),
              },
              RadioMarkInner: {
                style: ({ $checked }: { $checked: boolean }) => ({
                  height: $checked ? "6px" : ".75rem",
                  width: $checked ? "6px" : ".75rem",
                }),
              },
              Label: {
                style: {
                  color: disabled ? colors.fadedText40 : colors.bodyText,
                  position: "relative",
                  top: "1px",
                },
              },
            }}
          >
            {option}
          </UIRadio>
        ))}
      </RadioGroup>
    </div>
  )
}

export default withTheme(Radio)
