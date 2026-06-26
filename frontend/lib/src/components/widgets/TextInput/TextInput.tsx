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
  FocusEvent,
  memo,
  MouseEvent,
  ReactElement,
  useCallback,
  useId,
  useState,
} from "react"

import { TextField } from "react-aria-components"

import { TextInput as TextInputProto } from "@streamlit/protobuf"

import {
  DynamicIcon,
  isMaterialIcon,
} from "~lib/components/shared/Icon/DynamicIcon"
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
import useUpdateUiValue from "~lib/hooks/useUpdateUiValue"
import { convertRemToPx } from "~lib/theme/utils"
import { isInForm, labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledInputElement,
  StyledInputRoot,
  StyledPasswordToggle,
  StyledStartEnhancer,
  StyledTextInput,
} from "./styled-components"

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

  const { width, elementRef } = useCalculatedDimensions()

  /**
   * True if the user-specified state.value has not yet been synced to the WidgetStateManager.
   */
  const [dirty, setDirty] = useState(false)

  /** Controls visibility of the password plain-text toggle. */
  const [showPassword, setShowPassword] = useState(false)

  const onFormCleared = useCallback(() => {
    setUiValue(element.default ?? null)
    setDirty(true)
  }, [element.default])

  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_value" as const,
        // Text input is clearable (empty string is a valid value)
        clearable: true,
      }
    : undefined

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
    formClearBehavior: "resetValueAndRunCallback",
    onFormCleared,
    queryParamBinding,
  })

  useUpdateUiValue(value, uiValue, setUiValue, dirty)

  /**
   * Whether the input is currently focused.
   */
  const [focused, setFocused] = useState(false)

  const theme = useEmotionTheme()
  const id = useId()
  const { placeholder, formId, icon, maxChars } = element

  const isPassword = element.type === TextInputProto.Type.PASSWORD

  const commitWidgetValue = useCallback((): void => {
    setDirty(false)
    setValueWithSource({ value: uiValue, fromUi: true })
  }, [uiValue, setValueWithSource])

  // Show "Please enter" instructions if in a form & allowed, or not in form and state is dirty.
  const allowEnterToSubmit = isInForm({ formId })
    ? widgetMgr.allowFormEnterToSubmit(formId)
    : dirty

  const shouldShowInstructions =
    focused && width > convertRemToPx(theme.breakpoints.hideWidgetDetails)

  const handleFocus = useCallback((): void => {
    setFocused(true)
  }, [])

  const handleBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>): void => {
      // When keyboard Tab moves focus to the password toggle, focus stays
      // within the widget — don't commit yet, the user is still composing.
      if (elementRef.current?.contains(e.relatedTarget)) {
        setFocused(false)
        return
      }
      if (dirty) {
        commitWidgetValue()
      }
      setFocused(false)
    },
    [dirty, commitWidgetValue, elementRef]
  )

  const handleToggleShowPassword = useCallback((): void => {
    setShowPassword(prev => !prev)
  }, [])

  const onChange = useOnInputChange({
    formId,
    maxChars,
    setDirty,
    setUiValue,
    setValueWithSource,
  })

  const onKeyDown = useSubmitFormViaEnterKey(
    formId,
    commitWidgetValue,
    dirty,
    widgetMgr,
    fragmentId
  )

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
          <WidgetLabelHelpIcon content={element.help} label={element.label} />
        )}
      </WidgetLabel>
      <TextField isDisabled={disabled}>
        <StyledInputRoot
          data-testid="stTextInputRootElement"
          $isFocused={focused}
          $hasIcon={!!icon}
        >
          {icon && (
            <StyledStartEnhancer $isMaterialIcon={isMaterialIcon(icon)}>
              <DynamicIcon
                data-testid="stTextInputIcon"
                iconValue={icon}
                size="base"
              />
            </StyledStartEnhancer>
          )}
          <StyledInputElement
            id={id}
            aria-label={element.label}
            value={uiValue ?? ""}
            placeholder={placeholder}
            type={showPassword ? "text" : getTypeString(element)}
            autoComplete={element.autocomplete}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={onChange}
            onKeyDown={onKeyDown}
          />
          {isPassword && (
            <StyledPasswordToggle
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={handleToggleShowPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              disabled={disabled}
            >
              <DynamicIcon
                iconValue={
                  showPassword
                    ? ":material/visibility_off:"
                    : ":material/visibility:"
                }
                size="base"
              />
            </StyledPasswordToggle>
          )}
        </StyledInputRoot>
      </TextField>
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
  fragmentId: string | undefined
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

// Prevents the toggle button from stealing focus from the input on mousedown,
// avoiding a premature dirty-value commit via handleBlur. Extracted at module
// level so the reference is stable across renders.
function preventFocusLoss(e: MouseEvent): void {
  e.preventDefault()
}

export default memo(TextInput)
