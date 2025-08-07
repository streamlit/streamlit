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

import React, { memo, ReactElement, useCallback, useState } from "react"

import { Input as UIInput } from "baseui/input"
import uniqueId from "lodash/uniqueId"

import { TextInput as TextInputProto } from "@streamlit/protobuf"

import { DynamicIcon } from "~lib/components/shared/Icon"
import InputInstructions from "~lib/components/shared/InputInstructions/InputInstructions"
import { Placement } from "~lib/components/shared/Tooltip"
import TooltipIcon from "~lib/components/shared/TooltipIcon"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "~lib/components/widgets/BaseWidget"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useCalculatedWidth } from "~lib/hooks/useCalculatedWidth"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import useOnInputChange from "~lib/hooks/useOnInputChange"
import useSubmitFormViaEnterKey from "~lib/hooks/useSubmitFormViaEnterKey"
import useUpdateUiValue from "~lib/hooks/useUpdateUiValue"
import { isInForm, labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { StyledTextInput } from "./styled-components"

export interface Props {
  disabled: boolean
  element: TextInputProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function TextInput({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}: Props): ReactElement {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  const [uiValue, setUiValue] = useState<string | null>(
    () => getStateFromWidgetMgr(widgetMgr, element) ?? null
  )

  const [width, elementRef] = useCalculatedWidth()

  /**
   * True if the user-specified state.value has not yet been synced to the WidgetStateManager.
   */
  const [dirty, setDirty] = useState(false)

  const onFormCleared = useCallback(() => {
    setUiValue(element.default ?? null)
    setDirty(true)
  }, [element.default])

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
    onFormCleared,
  })

  useUpdateUiValue(value, uiValue, setUiValue, dirty)

  /**
   * Whether the input is currently focused.
   */
  const [focused, setFocused] = useState(false)

  const theme = useEmotionTheme()
  const [id] = useState(() => uniqueId("text_input_"))
  const { placeholder, formId, icon, maxChars } = element

  const commitWidgetValue = useCallback((): void => {
    setDirty(false)
    setValueWithSource({ value: uiValue, fromUi: true })
  }, [uiValue, setValueWithSource])

  // Show "Please enter" instructions if in a form & allowed, or not in form and state is dirty.
  const allowEnterToSubmit = isInForm({ formId })
    ? widgetMgr.allowFormEnterToSubmit(formId)
    : dirty

  // Hide input instructions for small widget sizes.
  const shouldShowInstructions =
    focused && width > theme.breakpoints.hideWidgetDetails

  const onBlur = useCallback((): void => {
    if (dirty) {
      commitWidgetValue()
    }
    setFocused(false)
  }, [dirty, commitWidgetValue])

  const onFocus = useCallback((): void => {
    setFocused(true)
  }, [])

  const onChange = useOnInputChange({
    formId,
    maxChars,
    setDirty,
    setUiValue,
    setValueWithSource,
  })

  const onKeyPress = useSubmitFormViaEnterKey(
    formId,
    commitWidgetValue,
    dirty,
    widgetMgr,
    fragmentId
  )

  // Material icons need to be larger to render similar size of emojis,
  // and we change their text color
  const isMaterialIcon = icon?.startsWith(":material")
  const dynamicIconSize = isMaterialIcon ? "lg" : "base"

  return (
    <StyledTextInput
      className="stTextInput"
      data-testid="stTextInput"
      ref={elementRef}
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
        startEnhancer={
          icon && (
            <DynamicIcon
              data-testid="stTextInputIcon"
              iconValue={icon}
              size={dynamicIconSize}
            />
          )
        }
        overrides={{
          Input: {
            style: {
              fontWeight: theme.fontWeights.normal,
              // Issue: https://github.com/streamlit/streamlit/issues/2495
              // The input won't shrink in Firefox,
              // unless the line below is provided.
              // See https://stackoverflow.com/a/33811151
              minWidth: 0,
              lineHeight: theme.lineHeights.inputWidget,
              // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
              paddingRight: theme.spacing.sm,
              paddingLeft: theme.spacing.md,
              paddingBottom: theme.spacing.sm,
              paddingTop: theme.spacing.sm,
              "::placeholder": {
                color: theme.colors.fadedText60,
              },
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
              paddingLeft: icon ? theme.spacing.sm : 0,
            },
          },
          StartEnhancer: {
            style: {
              paddingLeft: 0,
              paddingRight: 0,
              // Keeps emoji icons from being cut off on the right
              minWidth: theme.iconSizes.lg,
              // Material icons color changed as inactionable
              color: isMaterialIcon ? theme.colors.fadedText60 : "inherit",
            },
          },
        }}
      />
      {shouldShowInstructions && (
        <InputInstructions
          dirty={dirty}
          value={uiValue ?? ""}
          maxLength={maxChars}
          inForm={isInForm({ formId })}
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

export default memo(TextInput)
