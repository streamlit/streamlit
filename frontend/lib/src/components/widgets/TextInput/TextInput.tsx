/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { ReactElement, useCallback, useEffect, useState } from "react"

import uniqueId from "lodash/uniqueId"
import { Input as UIInput } from "baseui/input"
import { useTheme } from "@emotion/react"

import { TextInput as TextInputProto } from "@streamlit/lib/src/proto"
import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "@streamlit/lib/src/useBasicWidgetState"
import InputInstructions from "@streamlit/lib/src/components/shared/InputInstructions/InputInstructions"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "@streamlit/lib/src/components/widgets/BaseWidget"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import {
  isInForm,
  labelVisibilityProtoValueToEnum,
} from "@streamlit/lib/src/util/utils"

import { StyledTextInput } from "./styled-components"

export interface Props {
  disabled: boolean
  element: TextInputProto
  widgetMgr: WidgetStateManager
  width: number
  fragmentId?: string
}

function TextInput({
  disabled,
  element,
  widgetMgr,
  width,
  fragmentId,
}: Props): ReactElement {
  const [value, setValueWithSource] = useBasicWidgetState<
    string | null,
    TextInputProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
  })

  /**
   * True if the user-specified state.value has not yet been synced to the WidgetStateManager.
   */
  const [dirty, setDirty] = useState(false)

  /**
   * Whether the input is currently focused.
   */
  const [focused, setFocused] = useState(false)

  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  const [uiValue, setUiValue] = useState<string | null>(value)

  useEffect(() => {
    if (value !== uiValue) {
      setUiValue(value)
    }
    // Don't include `uiValue` in the deps below or the slider will become
    // jittery.
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [value])

  const theme = useTheme()
  const [id] = useState(() => uniqueId("text_input_"))
  const { placeholder, formId } = element

  // Show "Please enter" instructions if in a form & allowed, or not in form and state is dirty.
  const allowEnterToSubmit = isInForm({ formId })
    ? widgetMgr.allowFormEnterToSubmit(formId)
    : dirty

  // Hide input instructions for small widget sizes.
  const shouldShowInstructions =
    focused && width > theme.breakpoints.hideWidgetDetails

  const onBlur = useCallback((): void => {
    if (dirty) {
      setValueWithSource({ value: uiValue, fromUi: true })
    }
    setFocused(false)
  }, [dirty, uiValue])

  const onFocus = useCallback((): void => {
    setFocused(true)
  }, [])

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      const { value: newValue } = e.target
      const { maxChars } = element

      if (maxChars !== 0 && newValue.length > maxChars) {
        return
      }

      setDirty(true)
      setUiValue(newValue)

      // We immediately update its widgetValue on text changes in forms
      // see here for why: https://github.com/streamlit/streamlit/issues/7101
      // The widgetValue won't be passed to the Python script until the form
      // is submitted, so this won't cause the script to re-run.
      if (isInForm(element)) {
        // Make sure dirty is true so that enter to submit form text shows
        setValueWithSource({ value: newValue, fromUi: true })
      }
      // If the TextInput is *not* part of a form, we mark it dirty but don't
      // update its value in the WidgetMgr. This means that individual keypresses
      // won't trigger a script re-run.
    },
    [element]
  )

  const onKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      if (e.key !== "Enter") {
        return
      }

      if (dirty) {
        setValueWithSource({ value: uiValue, fromUi: true })
      }

      if (widgetMgr.allowFormEnterToSubmit(element.formId)) {
        widgetMgr.submitForm(element.formId, fragmentId)
      }
    },
    [uiValue, element, fragmentId]
  )

  return (
    <StyledTextInput
      className="stTextInput"
      data-testid="stTextInput"
      width={width}
    >
      <WidgetLabel
        label={element.label}
        disabled={disabled}
        labelVisibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
        htmlFor={id}
      >
        {element.help && (
          <StyledWidgetLabelHelp>
            <TooltipIcon
              content={element.help}
              placement={Placement.TOP_RIGHT}
            />
          </StyledWidgetLabelHelp>
        )}
      </WidgetLabel>
      <UIInput
        value={uiValue ?? ""}
        placeholder={placeholder}
        onBlur={onBlur}
        onFocus={onFocus}
        onChange={onChange}
        onKeyPress={onKeyPress}
        aria-label={element.label}
        disabled={disabled}
        id={id}
        type={getTypeString(element)}
        autoComplete={element.autocomplete}
        overrides={{
          Input: {
            style: {
              // Issue: https://github.com/streamlit/streamlit/issues/2495
              // The input won't shrink in Firefox,
              // unless the line below is provided.
              // See https://stackoverflow.com/a/33811151
              minWidth: 0,
              "::placeholder": {
                opacity: "0.7",
              },
              lineHeight: theme.lineHeights.inputWidget,
              // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
              paddingRight: theme.spacing.sm,
              paddingLeft: theme.spacing.sm,
              paddingBottom: theme.spacing.sm,
              paddingTop: theme.spacing.sm,
            },
          },
          Root: {
            props: {
              "data-testid": "stTextInputRootElement",
            },
            style: {
              height: theme.sizes.minElementHeight,
              // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
              borderLeftWidth: theme.sizes.borderWidth,
              borderRightWidth: theme.sizes.borderWidth,
              borderTopWidth: theme.sizes.borderWidth,
              borderBottomWidth: theme.sizes.borderWidth,
            },
          },
        }}
      />
      {shouldShowInstructions && (
        <InputInstructions
          dirty={dirty}
          value={uiValue ?? ""}
          maxLength={element.maxChars}
          inForm={isInForm({ formId: element.formId })}
          allowEnterToSubmit={allowEnterToSubmit}
        />
      )}
    </StyledTextInput>
  )
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: TextInputProto
): string | null {
  return widgetMgr.getStringValue(element) ?? null
}

function getDefaultStateFromProto(element: TextInputProto): string | null {
  return element.default ?? null
}

function getCurrStateFromProto(element: TextInputProto): string | null {
  return element.value ?? null
}

function updateWidgetMgrState(
  element: TextInputProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<string | null>,
  fragmentId?: string
): void {
  widgetMgr.setStringValue(
    element,
    vws.value,
    { fromUi: vws.fromUi },
    fragmentId
  )
}

function getTypeString(element: TextInputProto): string {
  return element.type === TextInputProto.Type.PASSWORD ? "password" : "text"
}

export default TextInput
