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
  CompositionEvent,
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
import { Cancel } from "@emotion-icons/material-rounded"
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
import { useDebouncedCallback } from "~lib/hooks/useDebouncedCallback"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import useOnInputChange from "~lib/hooks/useOnInputChange"
import useUpdateUiValue from "~lib/hooks/useUpdateUiValue"
import { convertRemToPx } from "~lib/theme/utils"
import { isEnterKeyPressed } from "~lib/util/inputUtils"
import {
  isInForm,
  labelVisibilityProtoValueToEnum,
  notNullOrUndefined,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledClearButton,
  StyledEndEnhancers,
  StyledErrorEnhancer,
  StyledInputElement,
  StyledInputInstructionsContainer,
  StyledInputRoot,
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

  /**
   * Whether the input is currently focused.
   */
  const [focused, setFocused] = useState(false)

  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const uiValueRef = useRef(uiValue)
  uiValueRef.current = uiValue
  const lastCommittedValueRef = useRef<string | null>(
    getStateFromWidgetMgr(widgetMgr, element) ?? null
  )
  // User-committed strings that may still be in flight. Used to recognize
  // stale setValue echoes of older reruns. Ordinary live reruns do not send
  // setValue, so this set is only an ack stand-in: a matching latest-commit
  // echo removes that one value, and a non-echo setValue clears the rest.
  // A restore of an earlier unacked string is indistinguishable from a stale
  // echo without a commit generation on the wire.
  const pendingLiveCommitsRef = useRef(new Set<string | null>())
  const isComposingRef = useRef(false)

  const setDirtyAndRef = useCallback((nextDirty: boolean): void => {
    dirtyRef.current = nextDirty
    setDirty(nextDirty)
  }, [])

  const setUiValueAndRef = useCallback((nextValue: string): void => {
    uiValueRef.current = nextValue
    setUiValue(nextValue)
  }, [])

  /** Controls visibility of the password plain-text toggle. */
  const [showPassword, setShowPassword] = useState(false)

  // Tracks whether the user's current value failed validation. We store a
  // boolean rather than the message string so the displayed message always
  // reflects the latest `element.validateMessage`: the message can change on
  // rerun while the widget identity stays stable (only the regex is part of
  // the widget ID), and a stored string would otherwise go stale.
  const [hasUserError, setHasUserError] = useState(false)

  const onFormCleared = useCallback(() => {
    uiValueRef.current = element.default ?? null
    setUiValue(element.default ?? null)
    setDirtyAndRef(true)
    setHasUserError(false)
  }, [element.default, setDirtyAndRef])

  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_value" as const,
        // Text input is clearable (empty string is a valid value)
        clearable: true,
      }
    : undefined

  const { placeholder, formId, icon, maxChars } = element
  const inForm = isInForm({ formId })
  // protobufjs optional uint32 is `null` when unset (prototype default), not
  // `undefined`. `0` is a live-on immediate commit and must not be treated as off.
  const isLive = notNullOrUndefined(element.liveDebounceMs)
  const liveDebounceMs = element.liveDebounceMs ?? 0
  const liveEnabled = isLive && !inForm

  // Skip script-driven setValue that would clobber live edits:
  // - dirty: keystrokes not yet committed
  // - an in-flight user-committed string that is not the latest: a stale
  //   echo of an older rerun, including after blur
  // Matching the latest commit acks only that value so a later stale echo of
  // an earlier commit (A then B then A, then a late B) is still dropped.
  // Any other incoming value (callback / session_state write) applies,
  // including while focused.
  const shouldApplyIncomingValue = useCallback(
    (incoming: string | null): boolean => {
      if (dirtyRef.current) {
        return false
      }
      if (incoming === lastCommittedValueRef.current) {
        pendingLiveCommitsRef.current.delete(incoming)
        return true
      }
      if (pendingLiveCommitsRef.current.has(incoming)) {
        return false
      }
      pendingLiveCommitsRef.current.clear()
      return true
    },
    []
  )

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
    shouldApplyIncomingValue: liveEnabled
      ? shouldApplyIncomingValue
      : undefined,
  })

  // session_state / callback writes update `value` without going through
  // commitWidgetValue; keep lastCommitted aligned so later echoes compare
  // against the script's value, not the previous user commit.
  // This must run during render: useBasicWidgetState's setValue effect is
  // registered by a hook called above, so it runs before any effect declared
  // here. Moving this into useEffect would leave the ref stale for that
  // setValue effect. A discarded render still writes the ref.
  if (!dirty) {
    lastCommittedValueRef.current = value
  }

  useUpdateUiValue(value, uiValue, setUiValue, dirty)

  const theme = useEmotionTheme()
  const id = useId()
  const errorId = `${id}-error`

  const isPassword = element.type === TextInputProto.Type.PASSWORD
  const isSearch = element.type === TextInputProto.Type.SEARCH
  // Show a Streamlit-styled clear (×) button for search inputs holding a value,
  // replacing the browser's native (and visually inconsistent) search-clear
  // control, which we hide via CSS.
  const showClearButton = isSearch && !disabled && Boolean(uiValue)

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
  // The user error is only ever set while validation is configured, but derive
  // the displayed error defensively so it's never shown without an active
  // config. The user-error message is derived from the current
  // `element.validateMessage` so it stays in sync when only the message changes.
  const userError = hasUserError
    ? element.validateMessage ||
      (validateRegex
        ? getInvalidTextInputMessage(validateRegex)
        : INVALID_TEXT_INPUT_MESSAGE)
    : null
  const displayedError = hasValidationConfig
    ? (configError ?? userError)
    : null

  const commitWidgetValue = useCallback(
    (valueToCommit: string | null = uiValueRef.current): void => {
      lastCommittedValueRef.current = valueToCommit
      // on_change="ignore" stages without a rerun, so nothing will echo-ack.
      if (liveEnabled && !element.ignoreRerun) {
        pendingLiveCommitsRef.current.add(valueToCommit)
      }
      setDirtyAndRef(false)
      setValueWithSource({ value: valueToCommit, fromUser: true })
    },
    [element.ignoreRerun, liveEnabled, setDirtyAndRef, setValueWithSource]
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

  // Runs validation for the given value, updates the displayed user error,
  // and returns whether the value may be committed.
  const validateBeforeCommit = useCallback(
    (valueToValidate: string | null = uiValueRef.current): boolean => {
      // Empty values always bypass validation — including when the regex config
      // itself is broken — so users can still clear the field or submit an empty
      // form input. The config error remains visible via `displayedError`.
      if (valueToValidate === null || valueToValidate === "") {
        setHasUserError(false)
        return true
      }

      if (configError) {
        return false
      }

      const invalid = isUserValueInvalid(valueToValidate)
      setHasUserError(invalid)
      return !invalid
    },
    [configError, isUserValueInvalid]
  )

  const tryCommitOutsideForm = useCallback(
    (valueToCommit: string | null = uiValueRef.current): boolean => {
      if (!dirtyRef.current) {
        return true
      }

      // Skip a second commit of the same value (e.g. a trailing input event
      // after compositionend already committed).
      if (valueToCommit === lastCommittedValueRef.current) {
        setDirtyAndRef(false)
        return true
      }

      if (!validateBeforeCommit(valueToCommit)) {
        return false
      }

      commitWidgetValue(valueToCommit)
      return true
    },
    [commitWidgetValue, setDirtyAndRef, validateBeforeCommit]
  )

  const { debouncedCallback: scheduleLiveCommit, cancel: cancelLiveCommit } =
    useDebouncedCallback(tryCommitOutsideForm, liveDebounceMs)

  // useDebouncedCallback does not cancel a manually started timer when the
  // delay changes. Drop pending work if live is toggled or the delay changes
  // on a keyed widget; blur/Enter still flush if the user confirms.
  useEffect(() => {
    return () => {
      cancelLiveCommit()
    }
  }, [cancelLiveCommit, liveDebounceMs, liveEnabled])

  const commitOrScheduleLive = useCallback(
    (valueToCommit: string | null = uiValueRef.current): void => {
      if (!liveEnabled || isComposingRef.current) {
        return
      }
      if (liveDebounceMs === 0) {
        tryCommitOutsideForm(valueToCommit)
        return
      }
      // Debounce > 0: fire with uiValueRef at timer time, not this keystroke.
      scheduleLiveCommit()
    },
    [liveDebounceMs, liveEnabled, scheduleLiveCommit, tryCommitOutsideForm]
  )

  const handleAcceptedChange = useCallback(
    (newValue: string): void => {
      setHasUserError(false)
      commitOrScheduleLive(newValue)
    },
    [commitOrScheduleLive]
  )

  const formSubmitValidatorRef = useRef<() => boolean>(() => true)
  formSubmitValidatorRef.current = () => {
    if (!validateBeforeCommit(uiValueRef.current)) {
      return false
    }

    if (dirtyRef.current) {
      widgetMgr.setStringValue(element.id, uiValueRef.current, {
        formId: element.formId,
        fragmentId,
        fromUser: true,
      })
      lastCommittedValueRef.current = uiValueRef.current
      setDirtyAndRef(false)
    }

    return true
  }

  // Show "Please enter" instructions if in a form & allowed, or not in form
  // and dirty. Hide "Press Enter to apply" when live updates are on.
  const allowEnterToSubmit = inForm
    ? widgetMgr.allowFormEnterToSubmit(formId)
    : dirty && !isLive

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
        if (dirtyRef.current) {
          commitWidgetValue()
        }
      } else {
        cancelLiveCommit()
        tryCommitOutsideForm()
      }

      setFocused(false)
    },
    [
      cancelLiveCommit,
      commitWidgetValue,
      elementRef,
      inForm,
      tryCommitOutsideForm,
    ]
  )

  const handleToggleShowPassword = useCallback((): void => {
    setShowPassword(prev => !prev)
  }, [])

  // Clear the search input and commit the empty value so results update
  // immediately (empty values bypass validation).
  const handleClear = useCallback((): void => {
    cancelLiveCommit()
    setUiValueAndRef("")
    setHasUserError(false)
    commitWidgetValue("")
  }, [cancelLiveCommit, commitWidgetValue, setUiValueAndRef])

  const onChange = useOnInputChange({
    formId,
    maxChars,
    setDirty: setDirtyAndRef,
    setUiValue: setUiValueAndRef,
    setValueWithSource,
    additionalAction: handleAcceptedChange,
  })

  const handleCompositionStart = useCallback((): void => {
    isComposingRef.current = true
    cancelLiveCommit()
  }, [cancelLiveCommit])

  const handleCompositionEnd = useCallback(
    (e: CompositionEvent<HTMLInputElement>): void => {
      isComposingRef.current = false
      // compositionend does not go through the input handler. Route through
      // onChange so maxChars and uiValue stay in sync before a live commit.
      // A trailing input event with the same value is deduped by
      // tryCommitOutsideForm.
      onChange({ target: { value: e.currentTarget.value } })
    },
    [onChange]
  )

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
            setDirtyAndRef(false)
          }
          return
        }

        // See `handleBlur`: in-form commits intentionally defer validation to
        // form submit, so the staged value is committed without the regex check.
        if (dirtyRef.current) {
          commitWidgetValue()
        }
        return
      }

      cancelLiveCommit()
      tryCommitOutsideForm()
    },
    [
      allowEnterToSubmit,
      cancelLiveCommit,
      commitWidgetValue,
      formId,
      fragmentId,
      inForm,
      setDirtyAndRef,
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
      {/*
       * Keep React Aria out of native constraint validation so a native
       * `type="email"`/`"url"` `typeMismatch` does not create a second invalid
       * state alongside our regex `validate` tooltip. TextInput already owns
       * `aria-invalid` and the error UI, so we also deliberately do NOT set
       * `isInvalid` here.
       */}
      <TextField isDisabled={disabled} validationBehavior="aria">
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
            // Label the mobile keyboard's return key for search inputs. This is
            // the one type-aligned keyboard hint we set; other types rely on
            // the native input `type` alone.
            enterKeyHint={
              element.type === TextInputProto.Type.SEARCH
                ? "search"
                : undefined
            }
            autoComplete={element.autocomplete}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
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
            {showClearButton && (
              <StyledClearButton
                type="button"
                data-testid="stTextInputClearButton"
                aria-label="Clear entry"
                tabIndex={-1}
                // Prevent mousedown from moving focus off the input before the
                // click fires, which would otherwise commit the dirty value via
                // handleBlur and cause a spurious extra rerun.
                onMouseDown={preventFocusLoss}
                onClick={handleClear}
              >
                <Cancel size={theme.iconSizes.base} aria-hidden="true" />
              </StyledClearButton>
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
          $hasErrorIcon={Boolean(displayedError)}
          $hasClearButton={showClearButton}
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
  widgetMgr.setStringValue(element.id, vws.value, {
    formId: element.formId,
    fragmentId,
    fromUser: vws.fromUser,
    // on_change="ignore" buffers the value without scheduling a rerun.
    // WidgetStateManager ignores triggerRerun inside forms (the form owns
    // commit timing).
    ...(element.ignoreRerun ? { triggerRerun: false } : {}),
  })
}

/**
 * Maps each `TextInputProto.Type` enum value to its native DOM `<input type>`.
 * `PHONE` is the only entry whose DOM type (`"tel"`) differs from its name.
 */
const DOM_INPUT_TYPE_BY_PROTO: Record<number, string> = {
  [TextInputProto.Type.DEFAULT]: "text",
  [TextInputProto.Type.PASSWORD]: "password",
  [TextInputProto.Type.EMAIL]: "email",
  [TextInputProto.Type.URL]: "url",
  [TextInputProto.Type.PHONE]: "tel",
  [TextInputProto.Type.SEARCH]: "search",
}

function getTypeString(element: TextInputProto): string {
  return DOM_INPUT_TYPE_BY_PROTO[element.type] ?? "text"
}

// Prevents the toggle button from stealing focus from the input on mousedown,
// avoiding a premature dirty-value commit via handleBlur. Extracted at module
// level so the reference is stable across renders.
function preventFocusLoss(e: MouseEvent): void {
  e.preventDefault()
}

export default memo(TextInput)
