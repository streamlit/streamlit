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

import React, { FC, memo, useCallback, useRef, useState } from "react"

import { Textarea as UITextArea } from "baseui/textarea"
import uniqueId from "lodash/uniqueId"

import { Element, TextArea as TextAreaProto } from "@streamlit/protobuf"

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
import { useTextInputAutoExpand } from "~lib/hooks/useTextInputAutoExpand"
import useUpdateUiValue from "~lib/hooks/useUpdateUiValue"
import { isInForm, labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { getTextAreaHeight } from "./heightUtils"
import { StyledTextAreaContainer } from "./styled-components"

export interface Props {
  disabled: boolean
  element: TextAreaProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
  // needed for height
  outerElement: Element
}

type TextAreaValue = string | null

const getStateFromWidgetMgr = (
  widgetMgr: WidgetStateManager,
  element: TextAreaProto
): TextAreaValue | undefined => {
  return widgetMgr.getStringValue(element) ?? element.default ?? null
}

const getDefaultStateFromProto = (element: TextAreaProto): TextAreaValue => {
  return element.default ?? null
}

const getCurrStateFromProto = (element: TextAreaProto): TextAreaValue => {
  return element.value ?? null
}

const updateWidgetMgrState = (
  element: TextAreaProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWithSource<TextAreaValue>,
  fragmentId?: string
): void => {
  widgetMgr.setStringValue(
    element,
    valueWithSource.value,
    { fromUi: valueWithSource.fromUi },
    fragmentId
  )
}

const TextArea: FC<Props> = ({
  disabled,
  element,
  widgetMgr,
  fragmentId,
  outerElement,
}) => {
  const id = useRef(uniqueId("text_area_")).current

  const [width, elementRef] = useCalculatedWidth()

  /**
   * True if the user-specified state.value has not yet been synced to the WidgetStateManager.
   */
  const [dirty, setDirty] = useState(false)
  /**
   * Whether the area is currently focused.
   */
  const [focused, setFocused] = useState(false)

  // Determine if we should use auto-expansion.
  const isAutoHeight = outerElement.heightConfig?.useContent ?? false
  // Disable resize if stretch height is enabled.
  const isStretchHeight = outerElement.heightConfig?.useStretch ?? false

  // For text area, we need to set the height on the input element and let
  // that determine the height of the overall element so that resizing works.
  const inputHeight = getTextAreaHeight(outerElement, element)

  // Create ref for auto-expansion
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  const [uiValue, setUiValue] = useState<string | null>(
    () => getStateFromWidgetMgr(widgetMgr, element) ?? null
  )

  const onFormCleared = useCallback(() => {
    setUiValue(element.default ?? null)
    setDirty(true)
  }, [element])

  const [value, setValueWithSource] = useBasicWidgetState<
    TextAreaValue,
    TextAreaProto
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

  const theme = useEmotionTheme()

  const {
    height: autoExpandHeight,
    maxHeight: autoExpandMaxHeight,
    updateScrollHeight,
  } = useTextInputAutoExpand({
    textareaRef,
    dependencies: [element.placeholder],
  })

  const commitWidgetValue = useCallback((): void => {
    setDirty(false)
    setValueWithSource({ value: uiValue, fromUi: true })
  }, [uiValue, setValueWithSource])

  const onBlur = useCallback(() => {
    if (dirty) {
      commitWidgetValue()
    }
    setFocused(false)
  }, [dirty, commitWidgetValue])

  const onFocus = useCallback(() => {
    setFocused(true)
  }, [])

  const additionalAction = useCallback(() => {
    if (isAutoHeight) {
      updateScrollHeight()
    }
  }, [isAutoHeight, updateScrollHeight])

  const onChange = useOnInputChange({
    formId: element.formId,
    maxChars: element.maxChars,
    setDirty,
    setUiValue,
    setValueWithSource,
    additionalAction,
  })

  const onKeyDown = useSubmitFormViaEnterKey(
    element.formId,
    commitWidgetValue,
    dirty,
    widgetMgr,
    fragmentId,
    true
  )

  const { placeholder, formId } = element

  // Show "Please enter" instructions if in a form & allowed, or not in form and state is dirty.
  const allowEnterToSubmit = isInForm({ formId })
    ? widgetMgr.allowFormEnterToSubmit(formId)
    : dirty

  // Hide input instructions for small widget sizes.
  const shouldShowInstructions =
    focused && width > theme.breakpoints.hideWidgetDetails

  return (
    <StyledTextAreaContainer
      className="stTextArea"
      data-testid="stTextArea"
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

      <UITextArea
        inputRef={isAutoHeight ? textareaRef : undefined}
        value={uiValue ?? ""}
        placeholder={placeholder}
        onBlur={onBlur}
        onFocus={onFocus}
        onChange={onChange}
        onKeyDown={onKeyDown}
        aria-label={element.label}
        disabled={disabled}
        id={id}
        overrides={{
          Input: {
            style: {
              fontWeight: theme.fontWeights.normal,
              lineHeight: theme.lineHeights.inputWidget,
              // The default height of the text area is calculated to perfectly fit 3 lines of text.
              height: isAutoHeight ? autoExpandHeight : inputHeight,
              maxHeight: isAutoHeight ? autoExpandMaxHeight : "",
              minHeight: theme.sizes.largestElementHeight,
              resize: isStretchHeight ? "none" : "vertical",
              // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
              paddingRight: theme.spacing.md,
              paddingLeft: theme.spacing.md,
              paddingBottom: theme.spacing.md,
              paddingTop: theme.spacing.md,
              "::placeholder": {
                color: theme.colors.fadedText60,
              },
            },
          },
          Root: {
            props: {
              "data-testid": "stTextAreaRootElement",
            },
            style: {
              // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
              borderLeftWidth: theme.sizes.borderWidth,
              borderRightWidth: theme.sizes.borderWidth,
              borderTopWidth: theme.sizes.borderWidth,
              borderBottomWidth: theme.sizes.borderWidth,
              flexGrow: 1,
            },
          },
        }}
      />

      {shouldShowInstructions && (
        <InputInstructions
          dirty={dirty}
          value={uiValue ?? ""}
          maxLength={element.maxChars}
          type={"multiline"}
          inForm={isInForm({ formId })}
          allowEnterToSubmit={allowEnterToSubmit}
        />
      )}
    </StyledTextAreaContainer>
  )
}

export default memo(TextArea)
