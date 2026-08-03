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
  ClipboardEvent,
  FocusEvent,
  KeyboardEvent,
  memo,
  ReactElement,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import { ErrorOutline } from "@emotion-icons/material-outlined"
import { Cancel } from "@emotion-icons/material-rounded"
import { Time } from "@internationalized/date"
import { I18nProvider, type TimeValue } from "react-aria-components"

import { TimeInput as TimeInputProto } from "@streamlit/protobuf"

import { LibConfigContext } from "~lib/components/core/LibConfigContext"
import Icon from "~lib/components/shared/Icon/Icon"
import InputInstructions from "~lib/components/shared/InputInstructions/InputInstructions"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useCalculatedDimensions } from "~lib/hooks/useCalculatedDimensions"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme/utils"
import {
  isInForm,
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledClearButton,
  StyledErrorIconContainer,
  StyledTimeField,
  StyledTimeFieldContainer,
  StyledTimeFieldInput,
  StyledTimeInputWrapper,
  StyledTimeSegment,
  StyledVisuallyHidden,
} from "./styled-components"

export interface Props {
  disabled: boolean
  element: TimeInputProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

/**
 * Maps a step value (in seconds) to a React Aria TimeField granularity.
 *
 * Always returns at least "minute" because the wire format includes at
 * minimum HH:MM — hiding minutes (hour-only granularity) would silently
 * discard minute components from values like "12:45" that can arrive via
 * query-params or session state.
 *
 * Note: `step` also controls arrow-key behaviour via `handleKeyCapture`.
 */
function stepToGranularity(stepSeconds: number): "minute" | "second" {
  return stepSeconds % 60 !== 0 ? "second" : "minute"
}

/** Converts an HH:MM or HH:MM:SS wire-format string to a React Aria Time object. */
function stringToTime(value: string): Time {
  const [hours, minutes, seconds = 0] = value.split(":").map(Number)
  return new Time(hours, minutes, seconds)
}

/** Converts a React Aria Time object back to the wire format (HH:MM or HH:MM:SS). */
function timeToString(
  value: TimeValue,
  granularity: "minute" | "second"
): string {
  const hh = String(value.hour).padStart(2, "0")
  const mm = String(value.minute).padStart(2, "0")
  if (granularity === "second") {
    return `${hh}:${mm}:${String(value.second).padStart(2, "0")}`
  }
  return `${hh}:${mm}`
}

function TimeInput({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}: Props): ReactElement {
  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: "string_value" as const,
        clearable: !element.default,
      }
    : undefined

  const onFormClearedRef = useRef<() => void>(() => {})
  const stableOnFormCleared = useCallback(() => {
    onFormClearedRef.current()
  }, [])

  const [value, setValueWithSource] = useBasicWidgetState<
    string | null,
    TimeInputProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
    queryParamBinding,
    formClearBehavior: "resetValueAndRunCallback",
    onFormCleared: stableOnFormCleared,
  })

  // Local display state drives the TimeField directly, avoiding the
  // useEffect-delay in useBasicWidgetState that would cause React Aria
  // to see a stale value mid-render and reset its segment edit buffer.
  const [displayValue, setDisplayValue] = useState<string | null>(value)

  // Tracks whether the user has a pending (uncommitted) edit. Drives the
  // "Press Enter to apply/submit form" hint via InputInstructions.
  // Explicit state — NOT derived from (displayValue !== value) — to avoid a
  // one-render flicker after arrow-key/immediate commits where value still
  // reflects the previous async update cycle.
  const [dirty, setDirty] = useState(false)

  const [isFocused, setIsFocused] = useState(false)

  const [validationError, setValidationError] = useState<string | null>(null)

  // If a user pastes an out-of-range value (e.g. "08:99"), the Time object
  // can't represent it. Store the raw digits here to override segment rendering
  // while keeping the TimeField value at the last valid state.
  const [pasteOverride, setPasteOverride] = useState<{
    hour: string
    minute: string
    second?: string
  } | null>(null)

  onFormClearedRef.current = () => {
    setDisplayValue(element.default ?? null)
    setDirty(false)
    setValidationError(null)
    setPasteOverride(null)
  }

  // Sync from backend when value changes externally (form clear, session
  // state update, setValue call). Uses render-time adjustment pattern:
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  // Gated: only update display when user has no uncommitted local edits
  // (displayValue still matches the last committed value we synced from).
  const [prevValue, setPrevValue] = useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    setValidationError(null)
    setPasteOverride(null)
    if (displayValue === prevValue) {
      setDisplayValue(value)
    }
  }

  // Refs mirror display/committed values so blur and key handlers always
  // read the latest without needing those values in their dependency arrays.
  const displayValueRef = useRef(displayValue)
  displayValueRef.current = displayValue
  const valueRef = useRef(value)
  valueRef.current = value

  /**
   * Arrow-key presses commit immediately (like the +/- buttons on
   * st.number_input); typed digits commit only on blur. This flag is set
   * in handleKeyCapture and consumed + reset in handleChange so that
   * the two paths share a single commit call-site.
   */
  const commitImmediatelyRef = useRef(false)

  const id = useId()
  const validationErrorId = `${id}-validation-error`
  const theme = useEmotionTheme()
  const { locale } = useContext(LibConfigContext)
  const step = element.step ? Number(element.step) : 900
  const clearable = isNullOrUndefined(element.default) && !disabled
  const inForm = isInForm({ formId: element.formId })

  const stepMins = step / 60
  const stepHours = step / 3600

  const { width, elementRef } = useCalculatedDimensions()

  // Show "Press Enter to apply" when focused (and the widget is wide enough).
  const shouldShowInstructions =
    isFocused && width > convertRemToPx(theme.breakpoints.hideWidgetDetails)

  // Drives InputInstructions: show submit hint if in a form and the form allows
  // Enter-to-submit; outside a form, show "apply" hint when there's a dirty edit.
  const allowEnterToSubmit = inForm
    ? widgetMgr.allowFormEnterToSubmit(element.formId)
    : dirty

  // Prop passed to react-aria <TimeField>. For "localized" we pass undefined
  // so react-aria uses the configured locale via I18nProvider.
  const hourCycleProp: 12 | 24 | undefined =
    element.format === "localized"
      ? undefined // localized — let I18nProvider locale decide
      : element.format === "12h"
        ? 12
        : 24 // default: 24-hour (backward compatible)

  // For placeholder rendering we need to know whether the resolved display is
  // 12-hour, even when format is "localized". Probe Intl with the configured
  // locale so the empty-state "hh"/"HH" hint matches what react-aria renders.
  const placeholderIs12Hour = useMemo((): boolean => {
    if (element.format === "12h") return true
    if (element.format === "localized") {
      const hc = new Intl.DateTimeFormat(locale, {
        hour: "numeric",
      }).resolvedOptions().hourCycle
      return hc === "h11" || hc === "h12"
    }
    return false
  }, [element.format, locale])

  /**
   * Called by TimeField on every committed segment change.
   *
   * Typing: only update local display — commit is deferred to blur, matching
   * the behaviour of st.number_input (no spurious on_change calls or fragment
   * reruns while the user is still editing).
   *
   * Arrow keys: commit immediately via commitImmediatelyRef set in
   * handleKeyCapture, matching the st.number_input +/- button behaviour.
   */
  const handleChange = useCallback(
    (newTime: TimeValue | null): void => {
      if (newTime === null && !clearable) {
        commitImmediatelyRef.current = false
        setValidationError(null)
        setPasteOverride(null)
        return
      }
      const granularity = stepToGranularity(step)
      const newValue = newTime ? timeToString(newTime, granularity) : null
      setDisplayValue(newValue)
      if (commitImmediatelyRef.current) {
        commitImmediatelyRef.current = false
        setDirty(false)
        setValueWithSource({ value: newValue, fromUi: true })
        if (inForm) {
          updateWidgetMgrState(
            element,
            widgetMgr,
            { value: newValue, fromUi: true },
            fragmentId
          )
        }
      } else {
        // Typed / deferred path — mark as dirty so InputInstructions can show.
        setDirty(true)
      }
      setValidationError(null)
      setPasteOverride(null)
    },
    [
      clearable,
      setValueWithSource,
      step,
      inForm,
      element,
      widgetMgr,
      fragmentId,
    ]
  )

  /**
   * Commit the current display value when the user leaves the entire field.
   * relatedTarget check ensures we don't commit when focus simply moves
   * between the hour and minute segments within the same wrapper.
   * Skip the commit entirely when the displayed value hasn't changed so we
   * don't trigger a spurious rerun on an unedited blur.
   */
  const handleBlur = useCallback(
    (e: FocusEvent<HTMLDivElement>): void => {
      if (e.currentTarget.contains(e.relatedTarget)) return
      setIsFocused(false)
      setPasteOverride(null)
      setValidationError(null)
      setDirty(false)
      if (displayValueRef.current === valueRef.current) return
      setValueWithSource({ value: displayValueRef.current, fromUi: true })
      // Inside a form, write synchronously so that a Submit click in the same
      // event loop gets the just-committed value. setValueWithSource defers its
      // WidgetStateManager write to a useEffect which hasn't run yet.
      if (inForm) {
        updateWidgetMgrState(
          element,
          widgetMgr,
          { value: displayValueRef.current, fromUi: true },
          fragmentId
        )
      }
    },
    [setValueWithSource, inForm, element, widgetMgr, fragmentId]
  )

  const handleFocus = useCallback((): void => {
    setIsFocused(true)
  }, [])

  const handleClear = useCallback((): void => {
    setDisplayValue(null)
    setDirty(false)
    setValidationError(null)
    setPasteOverride(null)
    if (valueRef.current === null) return
    setValueWithSource({ value: null, fromUi: true })
    if (inForm) {
      updateWidgetMgrState(
        element,
        widgetMgr,
        { value: null, fromUi: true },
        fragmentId
      )
    }
  }, [setValueWithSource, inForm, element, widgetMgr, fragmentId])

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>): void => {
      if (disabled) return
      const text = e.clipboardData.getData("text").trim()
      const granularity = stepToGranularity(step)

      // Full time paste: HH:MM:SS or HH:MM (with colon) or HHMM / HMM (3-4 digits, no colon)
      const colonMatchFull = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(text)
      const colonMatch = !colonMatchFull
        ? /^(\d{1,2}):(\d{2})$/.exec(text)
        : null
      const bareMatch =
        !colonMatchFull && !colonMatch ? /^(\d{1,2})(\d{2})$/.exec(text) : null
      const match = colonMatchFull ?? colonMatch ?? bareMatch
      if (match) {
        const hours = Number(match[1])
        const minutes = Number(match[2])
        const seconds = match[3] !== undefined ? Number(match[3]) : 0
        e.preventDefault()
        if (hours > 23 || minutes > 59 || seconds > 59) {
          setPasteOverride({
            hour: String(hours).padStart(2, "0"),
            minute: String(minutes).padStart(2, "0"),
            second:
              granularity === "second"
                ? String(seconds).padStart(2, "0")
                : undefined,
          })
          const parts = ["Hours must be 0–23", "minutes 0–59"]
          if (granularity === "second") parts.push("seconds 0–59")
          setValidationError(`Time is out of range. ${parts.join(", ")}.`)
          return
        }
        commitImmediatelyRef.current = true
        handleChange(
          granularity === "second"
            ? new Time(hours, minutes, seconds)
            : new Time(hours, minutes)
        )
        return
      }

      // Partial paste: pure digits (1-2) into the currently focused segment
      const digitMatch = /^\d{1,2}$/.exec(text)
      if (digitMatch) {
        const target = e.target as HTMLElement
        if (target.getAttribute("role") !== "spinbutton") return
        const segmentType = target.getAttribute("data-type")
        const numValue = Number(text)
        const current = displayValue ? stringToTime(displayValue) : null
        const currentHour = current
          ? String(current.hour).padStart(2, "0")
          : "00"
        const currentMinute = current
          ? String(current.minute).padStart(2, "0")
          : "00"
        const currentSecond = current
          ? String(current.second).padStart(2, "0")
          : "00"
        e.preventDefault()

        if (segmentType === "hour" && numValue <= 23) {
          commitImmediatelyRef.current = true
          handleChange(
            new Time(
              numValue,
              current ? current.minute : 0,
              granularity === "second" ? (current ? current.second : 0) : 0
            )
          )
        } else if (segmentType === "minute" && numValue <= 59) {
          commitImmediatelyRef.current = true
          handleChange(
            new Time(
              current ? current.hour : 0,
              numValue,
              granularity === "second" ? (current ? current.second : 0) : 0
            )
          )
        } else if (segmentType === "second" && numValue <= 59) {
          commitImmediatelyRef.current = true
          handleChange(
            new Time(
              current ? current.hour : 0,
              current ? current.minute : 0,
              numValue
            )
          )
        } else {
          const maxLabel =
            segmentType === "hour"
              ? "Hours must be 0–23."
              : segmentType === "second"
                ? "Seconds must be 0–59."
                : "Minutes must be 0–59."
          setPasteOverride({
            hour:
              segmentType === "hour"
                ? String(numValue).padStart(2, "0")
                : currentHour,
            minute:
              segmentType === "minute"
                ? String(numValue).padStart(2, "0")
                : currentMinute,
            second:
              granularity === "second"
                ? segmentType === "second"
                  ? String(numValue).padStart(2, "0")
                  : currentSecond
                : undefined,
          })
          setValidationError(
            `Value is out of range for ${segmentType}. ${maxLabel}`
          )
        }
        return
      }

      // Unrecognized format containing a colon — show error
      if (text.includes(":")) {
        e.preventDefault()
        setValidationError(
          granularity === "second"
            ? "Invalid time format. Please use HH:MM:SS or HH:MM."
            : "Invalid time format. Please use HH:MM."
        )
      }
    },
    [disabled, displayValue, handleChange, step]
  )

  /**
   * Capture-phase key handler for spinbutton segments. Handles:
   * - Enter: commits the current display value and, when the form allows it
   *   and no validation error is visible, submits the form.
   * - ArrowUp/Down: increments/decrements by `step` (overriding react-aria's
   *   default ±1). The capture phase + stopImmediatePropagation prevents
   *   react-aria from also applying its own change on top of ours.
   *
   * Arrow formula:
   *   ArrowUp   → floor(current / step) * step + step  (next boundary above)
   *   ArrowDown → ceil(current / step)  * step - step  (next boundary below)
   * This ensures that an off-step value always moves toward the nearest valid
   * boundary in the pressed direction, matching the original widget behaviour.
   */
  const handleKeyCapture = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      const target = e.target as HTMLElement
      if (target.getAttribute("role") !== "spinbutton") return
      if (disabled) return

      // Enter commits the current display value, matching st.number_input.
      if (e.key === "Enter") {
        setPasteOverride(null)
        setValidationError(null)
        setDirty(false)
        if (displayValueRef.current !== valueRef.current) {
          setValueWithSource({ value: displayValueRef.current, fromUi: true })
          if (inForm) {
            updateWidgetMgrState(
              element,
              widgetMgr,
              { value: displayValueRef.current, fromUi: true },
              fragmentId
            )
          }
        }
        // NOTE: `validationError` reads the value from BEFORE the
        // `setValidationError(null)` call above takes effect (React state
        // updates aren't synchronous within the same handler), so this
        // correctly reflects whatever error was visible when Enter was pressed
        // — e.g. a paste-triggered out-of-range error — and blocks form
        // submission while it's showing, matching NumberInput's pattern.
        if (
          !validationError &&
          widgetMgr.allowFormEnterToSubmit(element.formId)
        ) {
          widgetMgr.submitForm(element.formId, fragmentId)
        }
        return
      }

      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return

      // If the widget displays an invalid paste, arrow keys simply revert to
      // the prior valid value rather than computing a new step from it.
      if (pasteOverride) {
        e.preventDefault()
        e.stopPropagation()
        e.nativeEvent.stopImmediatePropagation()
        setPasteOverride(null)
        setValidationError(null)
        return
      }

      if (!displayValue) return

      // Arrow key on an existing value always commits immediately (like the
      // +/- buttons on st.number_input). Set the flag after the paste-override
      // check so it doesn't leak when the revert path early-returns.
      commitImmediatelyRef.current = true

      const segmentType = target.getAttribute("data-type")
      const up = e.key === "ArrowUp"
      const current = stringToTime(displayValue)

      if (segmentType === "minute" && step % 60 === 0) {
        // Minute-granular step. For step=60 (stepMins=1) react-aria's ±1 is correct.
        if (!Number.isInteger(stepMins) || stepMins <= 1) return

        e.preventDefault()
        // Stop both React synthetic propagation and the underlying native event
        // so react-aria's onKeyDown on the spinbutton cannot also fire.
        e.stopPropagation()
        e.nativeEvent.stopImmediatePropagation()

        const totalMins = current.hour * 60 + current.minute
        const next = up
          ? Math.floor(totalMins / stepMins) * stepMins + stepMins
          : Math.ceil(totalMins / stepMins) * stepMins - stepMins
        const wrapped =
          next >= 1440
            ? 0
            : next < 0
              ? Math.floor(1439 / stepMins) * stepMins
              : next
        handleChange(new Time(Math.floor(wrapped / 60), wrapped % 60))
      } else if (segmentType === "hour" && step % 3600 === 0) {
        // Hour-only mode. React-aria defaults to ±1 h; only intercept when the
        // step is a multiple of hours greater than 1.
        if (!Number.isInteger(stepHours) || stepHours <= 1) return

        e.preventDefault()
        e.stopPropagation()
        e.nativeEvent.stopImmediatePropagation()

        const next = up
          ? Math.floor(current.hour / stepHours) * stepHours + stepHours
          : Math.ceil(current.hour / stepHours) * stepHours - stepHours
        const wrapped =
          next >= 24
            ? 0
            : next < 0
              ? Math.floor(23 / stepHours) * stepHours
              : next
        handleChange(new Time(wrapped, 0))
      } else if (step % 60 !== 0 && step > 1) {
        // Non-minute-divisible step (e.g. 30s, 90s): all time segments snap
        // using total-seconds math so the result is always a valid step boundary.
        if (
          segmentType !== "hour" &&
          segmentType !== "minute" &&
          segmentType !== "second"
        )
          return

        e.preventDefault()
        e.stopPropagation()
        e.nativeEvent.stopImmediatePropagation()

        const totalSecs =
          current.hour * 3600 + current.minute * 60 + current.second

        let next: number
        if (segmentType === "second") {
          next = up
            ? Math.floor(totalSecs / step) * step + step
            : Math.ceil(totalSecs / step) * step - step
        } else {
          // For hour/minute segments, find the next step boundary at least one
          // segment-unit away so the displayed segment visibly changes.
          const jumpSize = segmentType === "hour" ? 3600 : 60
          next = up
            ? Math.ceil((totalSecs + jumpSize) / step) * step
            : Math.floor((totalSecs - jumpSize) / step) * step
        }

        const wrapped = ((next % 86400) + 86400) % 86400
        handleChange(
          new Time(
            Math.floor(wrapped / 3600),
            Math.floor((wrapped % 3600) / 60),
            wrapped % 60
          )
        )
      }
    },
    [
      disabled,
      displayValue,
      pasteOverride,
      validationError,
      step,
      stepMins,
      stepHours,
      handleChange,
      setValueWithSource,
      inForm,
      element,
      widgetMgr,
      fragmentId,
    ]
  )

  return (
    <div className="stTimeInput" data-testid="stTimeInput" ref={elementRef}>
      <WidgetLabel
        label={element.label}
        disabled={disabled}
        labelVisibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
      >
        {element.help && (
          <WidgetLabelHelpIcon content={element.help} label={element.label} />
        )}
      </WidgetLabel>
      <StyledTimeFieldContainer>
        <StyledTimeInputWrapper
          data-testid="stTimeInputTimeDisplay"
          data-disabled={disabled || undefined}
          onFocus={handleFocus}
          onBlur={handleBlur}
          data-has-error={validationError ? "" : undefined}
          onKeyDownCapture={handleKeyCapture}
          onPaste={handlePaste}
        >
          <I18nProvider locale={locale}>
            <StyledTimeField
              aria-label={element.label}
              aria-describedby={
                validationError ? validationErrorId : undefined
              }
              isInvalid={!!validationError}
              value={
                isNullOrUndefined(displayValue)
                  ? null
                  : stringToTime(displayValue)
              }
              onChange={handleChange}
              granularity={stepToGranularity(step)}
              hourCycle={hourCycleProp}
              shouldForceLeadingZeros
              isDisabled={disabled}
            >
              <StyledTimeFieldInput>
                {segment => (
                  <StyledTimeSegment segment={segment}>
                    {({ text, isPlaceholder, type }) => {
                      // Override visible text only — React Aria still controls
                      // aria-valuenow/aria-valuetext from the last valid Time, so
                      // screen readers may announce stale values during the brief
                      // error window. Mitigated by role="alert" + aria-invalid.
                      if (pasteOverride) {
                        if (type === "hour") return pasteOverride.hour
                        if (type === "minute") return pasteOverride.minute
                        if (type === "second" && pasteOverride.second)
                          return pasteOverride.second
                      }
                      if (!isPlaceholder) return text
                      if (type === "hour")
                        return placeholderIs12Hour ? "hh" : "HH"
                      if (type === "minute") return "mm"
                      if (type === "second") return "ss"
                      // dayPeriod (AM/PM) — react-aria's default text is correct
                      return text
                    }}
                  </StyledTimeSegment>
                )}
              </StyledTimeFieldInput>
            </StyledTimeField>
          </I18nProvider>
          {validationError && (
            <StyledErrorIconContainer data-testid="stTimeInputError">
              <Tooltip
                content={
                  <StreamlitMarkdown
                    source={`**Error**: ${validationError}`}
                    allowHTML={false}
                  />
                }
                placement={Placement.TOP_RIGHT}
                error
              >
                <Icon content={ErrorOutline} size="base" />
              </Tooltip>
            </StyledErrorIconContainer>
          )}
          {clearable &&
            (!isNullOrUndefined(displayValue) || pasteOverride) && (
              <StyledClearButton
                type="button"
                onClick={handleClear}
                aria-label="Clear time"
                data-testid="stTimeInputClearButton"
                // Removed from tab order: keyboard users clear via
                // Backspace/Delete in segments. Matches NumberInput pattern.
                tabIndex={-1}
                onMouseDown={e => e.preventDefault()}
              >
                <Cancel size={theme.iconSizes.base} aria-hidden="true" />
              </StyledClearButton>
            )}
          {validationError && (
            <StyledVisuallyHidden id={validationErrorId} role="alert">
              {pasteOverride
                ? `Error: time ${pasteOverride.hour}:${pasteOverride.minute}${pasteOverride.second ? `:${pasteOverride.second}` : ""} is invalid. ${validationError}`
                : `Error: ${validationError}`}
            </StyledVisuallyHidden>
          )}
        </StyledTimeInputWrapper>
      </StyledTimeFieldContainer>
      {shouldShowInstructions && (
        <InputInstructions
          dirty={dirty}
          value={displayValue ?? ""}
          inForm={inForm}
          allowEnterToSubmit={allowEnterToSubmit}
        />
      )}
    </div>
  )
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: TimeInputProto
): string | null | undefined {
  const storedValue = widgetMgr.getStringValue(element)
  if (storedValue === undefined) {
    return undefined
  }
  return storedValue ?? null
}

function getDefaultStateFromProto(element: TimeInputProto): string | null {
  return element.default ?? null
}

function getCurrStateFromProto(element: TimeInputProto): string | null {
  return element.value ?? null
}

function updateWidgetMgrState(
  element: TimeInputProto,
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

export default memo(TimeInput)
