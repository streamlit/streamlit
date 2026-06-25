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
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import { ErrorOutline } from "@emotion-icons/material-outlined"
import { getLogger } from "loglevel"
import { TextField } from "react-aria-components"

import { TextInput as TextInputProto } from "@streamlit/protobuf"

import {
  DynamicIcon,
  isMaterialIcon,
} from "~lib/components/shared/Icon/DynamicIcon"
import Icon from "~lib/components/shared/Icon/Icon"
import InputInstructions from "~lib/components/shared/InputInstructions/InputInstructions"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import useOnInputChange from "~lib/hooks/useOnInputChange"
import useUpdateUiValue from "~lib/hooks/useUpdateUiValue"
import { convertRemToPx } from "~lib/theme/utils"
import { isEnterKeyPressed } from "~lib/util/inputUtils"
import { isInForm, labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledEndEnhancers,
  StyledErrorEnhancer,
  StyledInputElement,
  StyledInputRoot,
  StyledPasswordToggle,
  StyledStartEnhancer,
  StyledTextInput,
  StyledVisuallyHidden,
} from "./styled-components"
import {
  compileTextInputValidationRegex,
  INVALID_TEXT_INPUT_MESSAGE,
  passesTextInputValidation,
} from "./validation"

export interface Props {
  disabled: boolean
  element: TextInputProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

const LOG = getLogger("TextInput")

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

  const [userError, setUserError] = useState<string | null>(null)

  const onFormCleared = useCallback(() => {
    setUiValue(element.default ?? null)
    setDirty(true)
    setUserError(null)
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
  const errorId = `${id}-error`
  const { placeholder, formId, icon, maxChars } = element
  const inForm = isInForm({ formId })

  const isPassword = element.type === TextInputProto.Type.PASSWORD

  const compiledValidationResult = useMemo(
    () => compileTextInputValidationRegex(element.validateRegex),
    [element.validateRegex]
  )
  const validateRegex =
    compiledValidationResult instanceof RegExp
      ? compiledValidationResult
      : undefined
  const configError =
    typeof compiledValidationResult === "string"
      ? compiledValidationResult
      : null
  const hasValidationConfig = Boolean(element.validateRegex)
  // `userError` is only ever set while validation is configured, but derive the
  // displayed error defensively so it's never shown without an active config.
  const displayedError = hasValidationConfig
    ? (configError ?? userError)
    : null

  const commitWidgetValue = useCallback((): void => {
    setDirty(false)
    setValueWithSource({ value: uiValue, fromUi: true })
  }, [uiValue, setValueWithSource])

  const clearUserValidationError = useCallback((): void => {
    setUserError(null)
  }, [])

  const getUserValidationError = useCallback(
    (nextValue: string | null): string | null => {
      if (
        !validateRegex ||
        passesTextInputValidation(nextValue, validateRegex)
      ) {
        return null
      }

      return element.validateMessage || INVALID_TEXT_INPUT_MESSAGE
    },
    [element.validateMessage, validateRegex]
  )

  // Runs validation for the current value, updates the displayed user error,
  // and returns whether the value may be committed.
  const validateBeforeCommit = useCallback((): boolean => {
    if (configError) {
      return false
    }

    const validationError = getUserValidationError(uiValue)
    setUserError(validationError)
    return validationError === null
  }, [configError, getUserValidationError, uiValue])

  const tryCommitOutsideForm = useCallback((): boolean => {
    if (!dirty) {
      return true
    }

    if (!validateBeforeCommit()) {
      return false
    }

    commitWidgetValue()
    return true
  }, [commitWidgetValue, dirty, validateBeforeCommit])

  const formSubmitValidatorRef = useRef<() => boolean>(() => true)
  formSubmitValidatorRef.current = () => {
    if (!validateBeforeCommit()) {
      return false
    }

    if (dirty) {
      widgetMgr.setStringValue(element, uiValue, { fromUi: true }, fragmentId)
      setDirty(false)
    }

    return true
  }

  // Show "Please enter" instructions if in a form & allowed, or not in form and state is dirty.
  const allowEnterToSubmit = inForm
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

      if (inForm) {
        if (dirty) {
          commitWidgetValue()
        }
      } else {
        tryCommitOutsideForm()
      }

      setFocused(false)
    },
    [commitWidgetValue, dirty, elementRef, inForm, tryCommitOutsideForm]
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
    additionalAction: clearUserValidationError,
  })

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      if (!isEnterKeyPressed(event)) {
        return
      }

      event.preventDefault()

      if (inForm) {
        if (allowEnterToSubmit) {
          // No explicit commit is needed here: `useOnInputChange` already
          // pushes the latest value to the form's widget state on every
          // keystroke, and the registered form submit validator commits the
          // final value when validation is configured.
          widgetMgr.submitForm(formId, fragmentId)
          return
        }

        if (dirty) {
          commitWidgetValue()
        }
        return
      }

      tryCommitOutsideForm()
    },
    [
      allowEnterToSubmit,
      commitWidgetValue,
      dirty,
      formId,
      fragmentId,
      inForm,
      tryCommitOutsideForm,
      widgetMgr,
    ]
  )

  // Surface an invalid `validate` regex to the developer via the console. A
  // given regex is fixed for a widget's identity, so this logs once per distinct
  // config error.
  useEffect(() => {
    if (configError) {
      LOG.error(configError)
    }
  }, [configError])

  useEffect(() => {
    if (!inForm || !hasValidationConfig) {
      return undefined
    }

    const validator = (): boolean => formSubmitValidatorRef.current()
    widgetMgr.addFormSubmitValidator(formId, element.id, validator)

    return () => {
      widgetMgr.removeFormSubmitValidator(formId, element.id)
    }
  }, [element.id, formId, hasValidationConfig, inForm, widgetMgr])

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
          $hasError={Boolean(displayedError)}
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
            data-testid="stTextInputField"
            aria-label={element.label}
            aria-invalid={displayedError ? true : undefined}
            aria-describedby={displayedError ? errorId : undefined}
            value={uiValue ?? ""}
            placeholder={placeholder}
            type={showPassword ? "text" : getTypeString(element)}
            autoComplete={element.autocomplete}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={onChange}
            onKeyDown={handleKeyDown}
          />
          <StyledEndEnhancers>
            {displayedError && (
              <StyledErrorEnhancer data-testid="stTextInputErrorIcon">
                <Tooltip
                  content={displayedError}
                  placement={Placement.TOP_RIGHT}
                  error
                >
                  <Icon content={ErrorOutline} size="base" />
                </Tooltip>
              </StyledErrorEnhancer>
            )}
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
          </StyledEndEnhancers>
        </StyledInputRoot>
      </TextField>
      {displayedError && (
        // The error message is shown visually in a tooltip on hover. The tooltip
        // trigger isn't focusable, so we also expose the message to assistive
        // tech via a visually hidden, aria-describedby-linked alert.
        <StyledVisuallyHidden id={errorId} role="alert">
          {displayedError}
        </StyledVisuallyHidden>
      )}
      {shouldShowInstructions && (
        <InputInstructions
          dirty={dirty}
          value={uiValue ?? ""}
          maxLength={maxChars}
          inForm={inForm}
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
