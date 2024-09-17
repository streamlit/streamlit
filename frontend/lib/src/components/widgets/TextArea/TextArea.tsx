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

import React, {
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useState,
} from "react"

import { Textarea as UITextArea } from "baseui/textarea"
import { useTheme } from "@emotion/react"
import uniqueId from "lodash/uniqueId"

import { TextArea as TextAreaProto } from "@streamlit/lib/src/proto"
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

export interface Props {
  disabled: boolean
  element: TextAreaProto
  widgetMgr: WidgetStateManager
  width: number
  fragmentId?: string
}

function TextArea({
  disabled,
  element,
  widgetMgr,
  width,
  fragmentId,
}: Props): ReactElement {
  const [value, setValueWithSource] = useBasicWidgetState<
    string | null,
    TextAreaProto
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
  const [id] = useState(() => uniqueId("text_area_"))
  const { height, placeholder, formId } = element
  const style = { width }

  // Show "Please enter" instructions if in a form & allowed, or not in form
  const allowSubmitOnEnter =
    widgetMgr.allowFormSubmitOnEnter(formId) || !isInForm({ formId })

  const onBlur = useCallback((): void => {
    if (dirty) {
      setValueWithSource({ value: uiValue, fromUi: true })
    }
  }, [dirty, uiValue])

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
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

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      const { metaKey, ctrlKey } = e

      if (isEnterKeyPressed(e) && (ctrlKey || metaKey) && dirty) {
        e.preventDefault()

        if (dirty) {
          setValueWithSource({ value: uiValue, fromUi: true })
        }

        if (widgetMgr.allowFormSubmitOnEnter(element.formId)) {
          widgetMgr.submitForm(element.formId, fragmentId)
        }
      }
    },
    [uiValue, element, widgetMgr, fragmentId]
  )

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
        value={uiValue ?? ""}
        placeholder={placeholder}
        onBlur={onBlur}
        onChange={onChange}
        onKeyDown={onKeyDown}
        aria-label={element.label}
        disabled={disabled}
        id={id}
        overrides={{
          Input: {
            style: {
              lineHeight: theme.lineHeights.inputWidget,
              height: height ? `${height}px` : "",
              minHeight: "95px",
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
      {/* Hide the "Please enter to apply" text in small widget sizes */}
      {width > theme.breakpoints.hideWidgetDetails && (
        <InputInstructions
          dirty={dirty}
          value={uiValue ?? ""}
          maxLength={element.maxChars}
          type={"multiline"}
          inForm={isInForm({ formId })}
          allowSubmitOnEnter={allowSubmitOnEnter}
        />
      )}
    </div>
  )
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: TextAreaProto
): string | null {
  return widgetMgr.getStringValue(element) ?? null
}

function getDefaultStateFromProto(element: TextAreaProto): string | null {
  return element.default ?? null
}

function getCurrStateFromProto(element: TextAreaProto): string | null {
  return element.value ?? null
}

function updateWidgetMgrState(
  element: TextAreaProto,
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

function isEnterKeyPressed(
  event: React.KeyboardEvent<HTMLTextAreaElement>
): boolean {
  const { keyCode, key } = event

  // Using keyCode as well due to some different behaviors on Windows
  // https://bugs.chromium.org/p/chromium/issues/detail?id=79407
  return (
    (key === "Enter" || keyCode === 13 || keyCode === 10) &&
    // Do not send the sentence being composed when Enter is typed into the IME.
    !(event.nativeEvent?.isComposing === true)
  )
}

export default memo(TextArea)
