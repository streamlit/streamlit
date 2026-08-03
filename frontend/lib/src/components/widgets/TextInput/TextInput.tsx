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
  useContext,
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

import { BackendOperationContext } from "~lib/components/core/BackendOperationContext"
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
  StyledInputInstructionsContainer,
  StyledInputRoot,
  StyledLoadingEnhancer,
  StyledPasswordToggle,
  StyledStartEnhancer,
  StyledTextInput,
  StyledVisuallyHidden,
} from "./styled-components"
import {
  compileTextInputValidationRegex,
  getInvalidTextInputMessage,
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

  // Tracks whether the user's current value failed validation. We store a
  // boolean rather than the message string so the displayed message always
  // reflects the latest `element.validateMessage`: the message can change on
  // rerun while the widget identity stays stable (only the regex is part of
  // the widget ID), and a stored string would otherwise go stale.
  const [hasUserError, setHasUserError] = useState(false)

  // True while a server-side validation request is in flight. Shows a spinner
  // and blocks committing/submitting until the response arrives.
  const [isValidating, setIsValidating] = useState(false)

  // The error message returned by the most recent failed server-side
  // validation. Cleared when the user edits or validation passes. Unlike the
  // client-side regex message, this is dynamic (returned by the callable), so
  // it must be stored rather than derived from the proto.
  const [serverErrorMessage, setServerErrorMessage] = useState<string | null>(
    null
  )

  // Monotonic token used to ignore stale server-validation responses. It is
  // bumped whenever the user edits (or a new validation starts), so a response
  // that arrives after the value changed is discarded.
  const latestValidationRef = useRef(0)

  const { backendOperationClient } = useContext(BackendOperationContext)

  const onFormCleared = useCallback(() => {
    setUiValue(element.default ?? null)
    setDirty(true)
    setHasUserError(false)
    setServerErrorMessage(null)
    setIsValidating(false)
    latestValidationRef.current += 1
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
  // Client-side (regex) and server-side (callable) validation are mutually
  // exclusive: the backend sets at most one of `validateRegex` /
  // `validateCallableId`.
  const hasClientValidation = Boolean(element.validateRegex)
  const hasServerValidation = Boolean(element.validateCallableId)
  const hasValidationConfig = hasClientValidation || hasServerValidation
  // The user error is only ever set while validation is configured, but derive
  // the displayed error defensively so it's never shown without an active
  // config. For server-side validation the message comes from the callable's
  // response (`serverErrorMessage`); for client-side regex it is derived from
  // the current `element.validateMessage` so it stays in sync when only the
  // message changes. Both fall back to a generic message.
  const clientValidationError =
    element.validateMessage ||
    (validateRegex
      ? getInvalidTextInputMessage(validateRegex)
      : INVALID_TEXT_INPUT_MESSAGE)
  const activeValidationError = hasServerValidation
    ? serverErrorMessage || INVALID_TEXT_INPUT_MESSAGE
    : clientValidationError
  const userError = hasUserError ? activeValidationError : null
  const displayedError = hasValidationConfig
    ? (configError ?? userError)
    : null

  const commitWidgetValue = useCallback((): void => {
    setDirty(false)
    setValueWithSource({ value: uiValue, fromUi: true })
  }, [uiValue, setValueWithSource])

  const clearUserValidationError = useCallback((): void => {
    // Invalidate any in-flight server validation so a late response can't
    // resurrect an error (or commit) for a value the user has since changed.
    latestValidationRef.current += 1
    setHasUserError(false)
    setServerErrorMessage(null)
    setIsValidating(false)
  }, [])

  // Runs the server-side validation callable for `valueToValidate` via the
  // backend operation client, without triggering a script rerun. Any failure
  // (misconfiguration, timeout, connection error) "fails closed" as invalid
  // with a generic message so an unvalidated value is never committed.
  const runServerValidation = useCallback(
    async (
      valueToValidate: string
    ): Promise<{ valid: boolean; message: string | null }> => {
      if (!backendOperationClient || !element.validateCallableId) {
        return { valid: false, message: null }
      }

      try {
        const response = await backendOperationClient.requestWidgetValidation({
          validatorId: element.validateCallableId,
          value: valueToValidate,
        })
        if (response.isValid) {
          return { valid: true, message: null }
        }
        return { valid: false, message: response.errorMessage || null }
      } catch {
        return { valid: false, message: null }
      }
    },
    [backendOperationClient, element.validateCallableId]
  )

  const isUserValueInvalid = useCallback(
    (nextValue: string | null): boolean => {
      if (!validateRegex) {
        return false
      }

      return !passesTextInputValidation(nextValue, validateRegex)
    },
    [validateRegex]
  )

  // Runs validation for the current value, updates the displayed user error,
  // and returns whether the value may be committed.
  const validateBeforeCommit = useCallback((): boolean => {
    // Empty values always bypass validation — including when the regex config
    // itself is broken — so users can still clear the field or submit an empty
    // form input. The config error remains visible via `displayedError`.
    if (uiValue === null || uiValue === "") {
      setHasUserError(false)
      return true
    }

    if (configError) {
      return false
    }

    const invalid = isUserValueInvalid(uiValue)
    setHasUserError(invalid)
    return !invalid
  }, [configError, isUserValueInvalid, uiValue])

  // Server-side commit path (outside a form): validate the value on the backend
  // and only commit (triggering the normal rerun + on_change) if it passes.
  const tryCommitOutsideFormWithServer =
    useCallback(async (): Promise<void> => {
      // Guard against re-entry while a validation request is already in flight so
      // a second blur/Enter doesn't fire duplicate requests.
      if (!dirty || isValidating) {
        return
      }

      // Empty/None values bypass validation and commit immediately.
      if (uiValue === null || uiValue === "") {
        setHasUserError(false)
        setServerErrorMessage(null)
        commitWidgetValue()
        return
      }

      const token = ++latestValidationRef.current
      // Clear any prior error while re-validating so the spinner and the error
      // icon are never shown at the same time (a re-blur without editing keeps
      // `dirty` true and would otherwise leave the old error visible).
      setHasUserError(false)
      setServerErrorMessage(null)
      setIsValidating(true)
      const { valid, message } = await runServerValidation(uiValue)

      // Ignore the response if the user has edited (or a newer validation
      // started) since this request was sent.
      if (token !== latestValidationRef.current) {
        return
      }
      setIsValidating(false)

      if (valid) {
        setHasUserError(false)
        setServerErrorMessage(null)
        commitWidgetValue()
      } else {
        setHasUserError(true)
        setServerErrorMessage(message)
      }
    }, [commitWidgetValue, dirty, isValidating, runServerValidation, uiValue])

  const tryCommitOutsideForm = useCallback((): void => {
    if (hasServerValidation) {
      void tryCommitOutsideFormWithServer()
      return
    }

    if (!dirty) {
      return
    }

    if (!validateBeforeCommit()) {
      return
    }

    commitWidgetValue()
  }, [
    commitWidgetValue,
    dirty,
    hasServerValidation,
    tryCommitOutsideFormWithServer,
    validateBeforeCommit,
  ])

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

  // Async form-submit gate for server-side validation. On submit, the form
  // awaits this before committing; the value is already staged into the form's
  // pending state on every keystroke (via `useOnInputChange`), so — unlike the
  // synchronous client-side gate above — this only validates and does not
  // re-stage the value.
  const serverFormSubmitValidatorRef = useRef<() => Promise<boolean>>(() =>
    Promise.resolve(true)
  )
  serverFormSubmitValidatorRef.current = async () => {
    // Empty/None values bypass validation.
    if (uiValue === null || uiValue === "") {
      setHasUserError(false)
      setServerErrorMessage(null)
      return true
    }

    const token = ++latestValidationRef.current
    // Clear any prior error while re-validating so the spinner and error icon
    // are never shown simultaneously.
    setHasUserError(false)
    setServerErrorMessage(null)
    setIsValidating(true)
    const { valid, message } = await runServerValidation(uiValue)

    // If the user edited during validation, treat this submit as failed for
    // this field so a value that was never validated isn't submitted.
    if (token !== latestValidationRef.current) {
      return false
    }
    setIsValidating(false)

    if (valid) {
      setHasUserError(false)
      setServerErrorMessage(null)
      setDirty(false)
      return true
    }

    setHasUserError(true)
    setServerErrorMessage(message)
    return false
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
        // Inside a form, intermediate commits (blur, or Enter without submit)
        // intentionally skip validation: the value only stages into the form's
        // pending state and isn't sent to the server until submit, where the
        // registered form submit validator gates the entire form. Deferring
        // field-level errors to submit time is the intended form UX, so don't
        // run the regex check here.
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
          // final value when validation is configured. Clear dirty only when
          // submit succeeds so `useUpdateUiValue` can sync post-submit
          // script-driven value changes (e.g. session_state updates in a
          // callback). On validation failure, dirty stays true.
          if (widgetMgr.submitForm(formId, fragmentId)) {
            setDirty(false)
          }
          return
        }

        // See `handleBlur`: in-form commits intentionally defer validation to
        // form submit, so the staged value is committed without the regex check.
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

  // Register the synchronous client-side (regex) form-submit gate.
  useEffect(() => {
    if (!inForm || !hasClientValidation) {
      return undefined
    }

    const validator = (): boolean => formSubmitValidatorRef.current()
    widgetMgr.addFormSubmitValidator(formId, element.id, validator)

    return () => {
      widgetMgr.removeFormSubmitValidator(formId, element.id)
    }
  }, [element.id, formId, hasClientValidation, inForm, widgetMgr])

  // Register the asynchronous server-side (callable) form-submit gate.
  useEffect(() => {
    if (!inForm || !hasServerValidation) {
      return undefined
    }

    const validator = (): Promise<boolean> =>
      serverFormSubmitValidatorRef.current()
    widgetMgr.addFormSubmitAsyncValidator(formId, element.id, validator)

    return () => {
      widgetMgr.removeFormSubmitAsyncValidator(formId, element.id)
    }
  }, [element.id, formId, hasServerValidation, inForm, widgetMgr])

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
            {isValidating && (
              <StyledLoadingEnhancer data-testid="stTextInputLoadingIcon">
                {/* The spinner icon is aria-hidden, so announce the in-progress
                    validation to assistive tech via a polite status region. */}
                <StyledVisuallyHidden role="status">
                  Validating
                </StyledVisuallyHidden>
                <DynamicIcon
                  iconValue="spinner"
                  size="base"
                  testid="stTextInputSpinner"
                />
              </StyledLoadingEnhancer>
            )}
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
        <StyledInputInstructionsContainer
          $hasErrorIcon={Boolean(displayedError) || isValidating}
          $hasPasswordToggle={isPassword}
        >
          <InputInstructions
            dirty={dirty}
            value={uiValue ?? ""}
            maxLength={maxChars}
            inForm={inForm}
            allowEnterToSubmit={allowEnterToSubmit}
          />
        </StyledInputInstructionsContainer>
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
