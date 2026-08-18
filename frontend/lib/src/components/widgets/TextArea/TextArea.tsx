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

import {
  FC,
  memo,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { Element, TextArea as TextAreaProto } from "@streamlit/protobuf"

import InputInstructions from "~lib/components/shared/InputInstructions/InputInstructions"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import useOnInputChange from "~lib/hooks/useOnInputChange"
import useSubmitFormViaEnterKey from "~lib/hooks/useSubmitFormViaEnterKey"
import { useTextInputAutoExpand } from "~lib/hooks/useTextInputAutoExpand"
import useUpdateUiValue from "~lib/hooks/useUpdateUiValue"
import { convertRemToPx } from "~lib/theme/utils"
import { isInForm, labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { getTextAreaHeight } from "./heightUtils"
import {
  StyledTextAreaContainer,
  StyledTextAreaInput,
  StyledTextAreaRoot,
} from "./styled-components"

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
): TextAreaValue | null => {
  return widgetMgr.getStringValue(element) ?? null
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
  fragmentId: string | undefined
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
  const id = useId()

  const { width, elementRef } = useCalculatedDimensions()

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

  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_value" as const,
        // Text area is clearable (empty string is a valid value)
        clearable: true,
      }
    : undefined

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
    formClearBehavior: "resetValueAndRunCallback",
    onFormCleared,
    queryParamBinding,
  })

  useUpdateUiValue(value, uiValue, setUiValue, dirty)

  const theme = useEmotionTheme()

  // Track if we've done the initial height calculation with a valid width.
  // This prevents recalculating on every window resize, which would override manual user resizes.
  const hasInitializedWithWidthRef = useRef(false)

  const {
    height: autoExpandHeight,
    maxHeight: autoExpandMaxHeight,
    updateScrollHeight,
  } = useTextInputAutoExpand({
    textareaRef,
    // Recalculate height when placeholder or displayed value changes.
    // When isAutoHeight is true, use uiValue to ensure height updates during typing and after blur.
    // When isAutoHeight is false, the effect only needs to run when value changes (less frequent).
    dependencies: [
      element.placeholder,
      ...(isAutoHeight ? [uiValue] : [value]),
    ],
  })

  // Recalculate height once when width first becomes available (ResizeObserver is async).
  // We don't include width in dependencies above to avoid overriding manual user resizes.
  useLayoutEffect(() => {
    if (!isAutoHeight) return
    if (width > 0 && !hasInitializedWithWidthRef.current) {
      hasInitializedWithWidthRef.current = true
      updateScrollHeight()
    }
  }, [isAutoHeight, width, updateScrollHeight])

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
    focused && width > convertRemToPx(theme.breakpoints.hideWidgetDetails)

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
          <WidgetLabelHelpIcon content={element.help} label={element.label} />
        )}
      </WidgetLabel>

      <StyledTextAreaRoot data-testid="stTextAreaRootElement">
        <StyledTextAreaInput
          ref={isAutoHeight ? textareaRef : undefined}
          value={uiValue ?? ""}
          placeholder={placeholder}
          onBlur={onBlur}
          onFocus={onFocus}
          onChange={onChange}
          onKeyDown={onKeyDown}
          aria-label={element.label}
          disabled={disabled}
          id={id}
          rows={3}
          $height={isAutoHeight ? autoExpandHeight : inputHeight}
          $maxHeight={isAutoHeight ? autoExpandMaxHeight : ""}
          $resize={isStretchHeight ? "none" : "vertical"}
        />
      </StyledTextAreaRoot>

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
