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
  type FC,
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { ErrorOutline } from "@emotion-icons/material-outlined"

import type { Element, TextArea as TextAreaProto } from "@streamlit/protobuf"
import { isNullOrEmptyString } from "@streamlit/utils"

import Icon from "~lib/components/shared/Icon/Icon"
import InputInstructions from "~lib/components/shared/InputInstructions/InputInstructions"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import {
  isRequiredEmptyText,
  requiredFieldError,
} from "~lib/components/widgets/BaseWidget/requiredField"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import {
  useBasicWidgetState,
  type ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import useOnInputChange from "~lib/hooks/useOnInputChange"
import useSubmitFormViaEnterKey from "~lib/hooks/useSubmitFormViaEnterKey"
import { useTextInputAutoExpand } from "~lib/hooks/useTextInputAutoExpand"
import useUpdateUiValue from "~lib/hooks/useUpdateUiValue"
import { convertRemToPx } from "~lib/theme/utils"
import { isInForm, labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import type { WidgetStateManager } from "~lib/WidgetStateManager"

import { getTextAreaHeight } from "./heightUtils"
import {
  StyledErrorIcon,
  StyledTextAreaContainer,
  StyledTextAreaInput,
  StyledTextAreaRoot,
  StyledVisuallyHidden,
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

/**
 * Element-state key for the empty value of a required field whose commit was
 * blocked. WidgetStateManager keeps it across remounts, so a rerun that
 * briefly removes the field doesn't snap the UI back to the last accepted
 * value. Presence of the entry also restores `dirty` and the required error.
 */
const REQUIRED_BLOCKED_UI_VALUE_KEY = "requiredBlockedUiValue"

const getStateFromWidgetMgr = (
  widgetMgr: WidgetStateManager,
  element: TextAreaProto
): TextAreaValue | null => {
  return widgetMgr.getStringValue(element) ?? null
}

/** Returns the blocked empty edit saved before an unmount, or `undefined` when there is none. */
const readBlockedUiValue = (
  widgetMgr: WidgetStateManager,
  elementId: string
): TextAreaValue | undefined => {
  return widgetMgr.getElementState<TextAreaValue>(
    elementId,
    REQUIRED_BLOCKED_UI_VALUE_KEY
  )
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
  widgetMgr.setStringValue(element.id, valueWithSource.value, {
    formId: element.formId,
    fragmentId,
    fromUser: valueWithSource.fromUser,
    // on_change="ignore" buffers the value without scheduling a rerun.
    // WidgetStateManager ignores triggerRerun inside forms (the form owns
    // commit timing).
    ...(element.ignoreRerun ? { triggerRerun: false } : {}),
  })
}

const TextArea: FC<Props> = ({
  disabled,
  element,
  widgetMgr,
  fragmentId,
  outerElement,
}) => {
  const id = useId()
  const errorId = `${id}-error`

  const { width, elementRef } = useCalculatedDimensions()

  /**
   * True if the user-specified state.value has not yet been synced to the WidgetStateManager.
   * Restored from element state after a remount (see REQUIRED_BLOCKED_UI_VALUE_KEY).
   */
  const [dirty, setDirty] = useState(
    () => readBlockedUiValue(widgetMgr, element.id) !== undefined
  )
  /**
   * Whether the area is currently focused.
   */
  const [focused, setFocused] = useState(false)
  /**
   * Whether the last commit or form submit was blocked because the field was
   * required and empty. The displayed error is derived from this flag, the
   * current `required` flag, and the current value. Restored from element
   * state after a remount (see REQUIRED_BLOCKED_UI_VALUE_KEY).
   */
  const [hasRequiredError, setHasRequiredError] = useState(
    () => readBlockedUiValue(widgetMgr, element.id) !== undefined
  )

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
   * widget's UI, the default value is used. After remount, prefer a blocked
   * empty edit persisted in element state over the last accepted value.
   */
  const [uiValue, setUiValue] = useState<string | null>(() => {
    const blockedUiValue = readBlockedUiValue(widgetMgr, element.id)
    if (blockedUiValue !== undefined) {
      return blockedUiValue
    }
    return getStateFromWidgetMgr(widgetMgr, element) ?? null
  })

  const onFormCleared = useCallback(() => {
    setUiValue(element.default ?? null)
    setDirty(true)
    setHasRequiredError(false)
  }, [element])

  const queryParamBinding = !isNullOrEmptyString(element.queryParamKey)
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

  const { placeholder, formId } = element
  const inForm = isInForm({ formId })

  // A session_state write replaces an empty edit that `required` blocked.
  // - The blocked edit keeps `dirty`, so useUpdateUiValue won't repaint it.
  // - Applied during render because useBasicWidgetState consumes `setValue`
  //   in an effect, which would paint the old value for one frame.
  // - Inside a form, it also replaces the staged empty edit, so the next
  //   submit sends the value the field shows.
  if (element.setValue && dirty && hasRequiredError) {
    const incomingValue = getCurrStateFromProto(element)
    setUiValue(incomingValue)
    setValueWithSource({ value: incomingValue, fromUser: inForm })
    setDirty(false)
    setHasRequiredError(false)
  }

  useUpdateUiValue(value, uiValue, setUiValue, dirty)

  // Drop the stored flag once the error is hidden. `required` is not part of
  // keyed widget identity, so the flag can outlive a rerun that turns
  // `required` off or fills the field, and would otherwise reappear when
  // `required` turns back on or a programmatic write clears the field.
  const requiredError = requiredFieldError(
    element.required,
    hasRequiredError,
    isRequiredEmptyText(uiValue)
  )
  if (hasRequiredError && requiredError === null) {
    setHasRequiredError(false)
  }
  const hasError = Boolean(requiredError)

  // Persist the blocked empty edit while its required error shows, so a remount
  // restores it (see REQUIRED_BLOCKED_UI_VALUE_KEY).
  useEffect(() => {
    if (dirty && hasError) {
      widgetMgr.setElementState(
        element.id,
        REQUIRED_BLOCKED_UI_VALUE_KEY,
        uiValue
      )
    } else {
      widgetMgr.deleteElementState(element.id, REQUIRED_BLOCKED_UI_VALUE_KEY)
    }
  }, [dirty, element.id, hasError, uiValue, widgetMgr])

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
    // The error state adds right padding, which can re-wrap the placeholder.
    // Keep the array length constant: a keyed widget can switch height modes
    // without remounting.
    dependencies: [
      element.placeholder,
      isAutoHeight ? uiValue : value,
      isAutoHeight && hasError,
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
    setValueWithSource({ value: uiValue, fromUser: true })
  }, [uiValue, setValueWithSource])

  /**
   * Returns whether the current value may be committed or submitted, and
   * shows the required error when `required` blocks an empty value.
   */
  const validateBeforeCommit = useCallback((): boolean => {
    if (element.required && isRequiredEmptyText(uiValue)) {
      setHasRequiredError(true)
      return false
    }
    return true
  }, [element.required, uiValue])

  /**
   * Commits outside a form unless `required` blocks an empty value. A blocked
   * commit keeps `dirty`, so the last accepted value (or an unflushed
   * `on_change="ignore"` value) stays in WidgetStateManager and nothing is
   * written to the URL. Callers only invoke it while `dirty`.
   */
  const tryCommitOutsideForm = useCallback((): void => {
    if (validateBeforeCommit()) {
      commitWidgetValue()
    }
  }, [commitWidgetValue, validateBeforeCommit])

  // Inside a form, blur and Ctrl/Cmd+Enter only stage the value; the form
  // submit validator below enforces `required`.
  const commitOrStageValue = inForm ? commitWidgetValue : tryCommitOutsideForm

  const onBlur = useCallback(() => {
    if (dirty) {
      commitOrStageValue()
    }
    setFocused(false)
  }, [dirty, commitOrStageValue])

  const onFocus = useCallback(() => {
    setFocused(true)
  }, [])

  const additionalAction = useCallback(() => {
    // Editing hides a leftover required error until the next commit or submit.
    setHasRequiredError(false)
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
    commitOrStageValue,
    dirty,
    widgetMgr,
    fragmentId,
    true
  )

  // Keystrokes already stage the value into the form (useOnInputChange), so
  // the submit validator only needs the required check. It reads the latest
  // render's value: every submit (button click, Ctrl/Cmd+Enter, or another
  // widget's Enter) runs in an event after that render.
  const formSubmitValidatorRef = useRef(validateBeforeCommit)
  formSubmitValidatorRef.current = validateBeforeCommit

  useEffect(() => {
    if (!inForm || !element.required) {
      return undefined
    }

    const validator = (): boolean => formSubmitValidatorRef.current()
    widgetMgr.addFormSubmitValidator(formId, element.id, validator)

    return () => {
      widgetMgr.removeFormSubmitValidator(formId, element.id)
    }
  }, [element.id, element.required, formId, inForm, widgetMgr])

  // Show "Please enter" instructions if in a form & allowed, or not in form and state is dirty.
  const allowEnterToSubmit = inForm
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
      $isStretchHeight={isStretchHeight}
    >
      <WidgetLabel
        label={element.label}
        disabled={disabled}
        required={element.required}
        labelVisibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
        htmlFor={id}
      >
        {element.help && (
          <WidgetLabelHelpIcon content={element.help} label={element.label} />
        )}
      </WidgetLabel>

      <StyledTextAreaRoot
        data-testid="stTextAreaRootElement"
        $hasError={hasError}
      >
        <StyledTextAreaInput
          ref={isAutoHeight ? textareaRef : undefined}
          value={uiValue ?? ""}
          placeholder={placeholder}
          onBlur={onBlur}
          onFocus={onFocus}
          onChange={onChange}
          onKeyDown={onKeyDown}
          aria-label={element.label}
          aria-required={element.required ? true : undefined}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={hasError ? errorId : undefined}
          disabled={disabled}
          id={id}
          rows={3}
          $height={isAutoHeight ? autoExpandHeight : inputHeight}
          $maxHeight={isAutoHeight ? autoExpandMaxHeight : ""}
          $resize={isStretchHeight ? "none" : "vertical"}
          $hasError={hasError}
        />
        {requiredError !== null && (
          <StyledErrorIcon data-testid="stTextAreaErrorIcon">
            <Tooltip
              content={requiredError}
              placement={Placement.TOP_RIGHT}
              error
            >
              <Icon content={ErrorOutline} size="base" />
            </Tooltip>
          </StyledErrorIcon>
        )}
      </StyledTextAreaRoot>
      {requiredError !== null && (
        // The error message is shown visually in a tooltip on hover. The
        // tooltip trigger isn't focusable, so we also expose the message to
        // assistive tech via a visually hidden, aria-describedby-linked alert.
        <StyledVisuallyHidden id={errorId} role="alert">
          {requiredError}
        </StyledVisuallyHidden>
      )}

      {shouldShowInstructions && (
        <InputInstructions
          dirty={dirty}
          value={uiValue ?? ""}
          maxLength={element.maxChars}
          type={"multiline"}
          inForm={inForm}
          allowEnterToSubmit={allowEnterToSubmit}
        />
      )}
    </StyledTextAreaContainer>
  )
}

export default memo(TextArea)
