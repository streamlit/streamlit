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

import React, { FC, memo, useCallback, useRef, useState } from "react"

import { Textarea as UITextArea } from "baseui/textarea"
import { useTheme } from "@emotion/react"
import uniqueId from "lodash/uniqueId"

import { TextArea as TextAreaProto } from "@streamlit/lib/src/proto"
import {
  Source,
  WidgetStateManager,
} from "@streamlit/lib/src/WidgetStateManager"
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
import { EmotionTheme } from "@streamlit/lib/src/theme"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "@streamlit/lib/src/useBasicWidgetState"

export interface Props {
  disabled: boolean
  element: TextAreaProto
  widgetMgr: WidgetStateManager
  width: number
  fragmentId?: string
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
  width,
}) => {
  const id = useRef(uniqueId("text_area_")).current

  const [localValue, setLocalValue] = useState<string | null>(
    getStateFromWidgetMgr(widgetMgr, element) ?? null
  )
  /**
   * True if the user-specified state.value has not yet been synced to the WidgetStateManager.
   */
  const [dirty, setDirty] = useState(false)
  /**
   * Whether the area is currently focused.
   */
  const [focused, setFocused] = useState(false)

  const onFormCleared = useCallback(() => {
    setLocalValue(element.default ?? null)
    setDirty(true)
  }, [element])

  const [, setValueWithSource] = useBasicWidgetState<
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

  const theme: EmotionTheme = useTheme()

  const commitWidgetValue = useCallback(
    ({ fromUi }: Source): void => {
      setValueWithSource({ value: localValue, fromUi })
      setDirty(false)
    },
    [localValue, setValueWithSource]
  )

  const onBlur = useCallback(() => {
    if (dirty) {
      commitWidgetValue({ fromUi: true })
    }
    setFocused(false)
  }, [dirty, commitWidgetValue])

  const onFocus = useCallback(() => {
    setFocused(true)
  }, [])

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      const { value } = e.target
      const { maxChars } = element

      if (maxChars !== 0 && value.length > maxChars) {
        return
      }

      // mark it dirty but don't update its value in the WidgetMgr
      // This means that individual keypresses won't trigger a script re-run.
      setLocalValue(value)
      setDirty(true)
    },
    [element]
  )

  const isEnterKeyPressed = (
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ): boolean => {
    const { keyCode, key } = event

    // Using keyCode as well due to some different behaviors on Windows
    // https://bugs.chromium.org/p/chromium/issues/detail?id=79407
    return (
      (key === "Enter" || keyCode === 13 || keyCode === 10) &&
      // Do not send the sentence being composed when Enter is typed into the IME.
      !(event.nativeEvent?.isComposing === true)
    )
  }

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      const { metaKey, ctrlKey } = e
      const { formId } = element
      const allowFormEnterToSubmit = widgetMgr.allowFormEnterToSubmit(formId)

      if (isEnterKeyPressed(e) && (ctrlKey || metaKey) && dirty) {
        e.preventDefault()

        commitWidgetValue({ fromUi: true })
        if (allowFormEnterToSubmit) {
          widgetMgr.submitForm(formId, fragmentId)
        }
      }
    },
    [element, widgetMgr, dirty, commitWidgetValue, fragmentId]
  )

  const style = { width }
  const { height, placeholder, formId } = element

  // Show "Please enter" instructions if in a form & allowed, or not in form and state is dirty.
  const allowEnterToSubmit = isInForm({ formId })
    ? widgetMgr.allowFormEnterToSubmit(formId)
    : dirty

  // Hide input instructions for small widget sizes.
  const shouldShowInstructions =
    focused && width > theme.breakpoints.hideWidgetDetails

  return (
    <div className="stTextArea" data-testid="stTextArea" style={style}>
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
        value={localValue ?? ""}
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
              lineHeight: theme.lineHeights.inputWidget,

              // The default height of the text area is calculated to perfectly fit 3 lines of text.
              height: height ? `${height}px` : "",
              minHeight: theme.sizes.largestElementHeight,
              resize: "vertical",
              "::placeholder": {
                opacity: "0.7",
              },
              // Baseweb requires long-hand props, short-hand leads to weird bugs & warnings.
              paddingRight: theme.spacing.lg,
              paddingLeft: theme.spacing.lg,
              paddingBottom: theme.spacing.lg,
              paddingTop: theme.spacing.lg,
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
            },
          },
        }}
      />
      {shouldShowInstructions && (
        <InputInstructions
          dirty={dirty}
          value={localValue ?? ""}
          maxLength={element.maxChars}
          type={"multiline"}
          inForm={isInForm({ formId })}
          allowEnterToSubmit={allowEnterToSubmit}
        />
      )}
    </div>
  )
}

export default memo(TextArea)
