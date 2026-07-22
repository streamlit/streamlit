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
  KeyboardEvent,
  memo,
  ReactElement,
  useCallback,
  useRef,
  useState,
} from "react"

import { Cancel } from "@emotion-icons/material-rounded"
import { Time } from "@internationalized/date"
import { TimeField } from "react-aria-components"

import { TimeInput as TimeInputProto } from "@streamlit/protobuf"

import { WidgetLabel } from "~lib/components/widgets/BaseWidget/WidgetLabel"
import { WidgetLabelHelpIcon } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIcon"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import {
  isInForm,
  isNullOrUndefined,
  labelVisibilityProtoValueToEnum,
} from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledClearButton,
  StyledTimeFieldContainer,
  StyledTimeFieldInput,
  StyledTimeInputWrapper,
  StyledTimeSegment,
} from "./styled-components"

export interface Props {
  disabled: boolean
  element: TimeInputProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

/** Converts an HH:MM wire-format string to a React Aria Time object. */
function stringToTime(value: string): Time {
  const [hours, minutes] = value.split(":").map(Number)
  return new Time(hours, minutes)
}

/** Converts a React Aria Time object back to the HH:MM wire format. */
function timeToString(value: Time): string {
  return `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}`
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
  onFormClearedRef.current = () => setDisplayValue(element.default ?? null)

  // Sync from backend when value changes externally (form clear, session
  // state update, setValue call). Uses render-time adjustment pattern:
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  // Gated: only update display when user has no uncommitted local edits
  // (displayValue still matches the last committed value we synced from).
  const [prevValue, setPrevValue] = useState(value)
  if (prevValue !== value) {
    setPrevValue(value)
    if (displayValue === prevValue) {
      setDisplayValue(value)
    }
  }

  // Stable refs used in blur/arrow handlers to avoid stale closure issues.
  const displayValueRef = useRef(displayValue)
  displayValueRef.current = displayValue
  const valueRef = useRef(value)
  valueRef.current = value

  /**
   * Arrow-key presses commit immediately (like the +/- buttons on
   * st.number_input); typed digits commit only on blur. This flag is set
   * in handleArrowKeyCapture and consumed + reset in handleChange so that
   * the two paths share a single commit call-site.
   */
  const commitImmediatelyRef = useRef(false)

  const theme = useEmotionTheme()
  const step = element.step ? Number(element.step) : 900
  const clearable = isNullOrUndefined(element.default) && !disabled
  const inForm = isInForm({ formId: element.formId })

  const stepMins = step / 60
  const stepHours = step / 3600

  /**
   * Called by TimeField on every committed segment change.
   *
   * Typing: only update local display — commit is deferred to blur, matching
   * the behaviour of st.number_input (no spurious on_change calls or fragment
   * reruns while the user is still editing).
   *
   * Arrow keys: commit immediately via commitImmediatelyRef set in
   * handleArrowKeyCapture, matching the st.number_input +/- button behaviour.
   */
  const handleChange = useCallback(
    (newTime: Time | null): void => {
      if (newTime === null && !clearable) {
        commitImmediatelyRef.current = false
        return
      }
      const newValue = newTime ? timeToString(newTime) : null
      setDisplayValue(newValue)
      if (commitImmediatelyRef.current) {
        commitImmediatelyRef.current = false
        setValueWithSource({ value: newValue, fromUi: true })
        if (inForm) {
          updateWidgetMgrState(
            element,
            widgetMgr,
            { value: newValue, fromUi: true },
            fragmentId
          )
        }
      }
    },
    [clearable, setValueWithSource, inForm, element, widgetMgr, fragmentId]
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

  const handleClear = useCallback((): void => {
    setDisplayValue(null)
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

  /**
   * Intercept ArrowUp/Down on the spinbutton segments (capture phase, before
   * react-aria's own handler) so the minute/hour increments honour `step`.
   *
   * Without this, react-aria always increments by ±1 unit regardless of step.
   * The capture phase + stopImmediatePropagation prevents react-aria from also
   * applying its own ±1 change on top of ours.
   *
   * Formula:
   *   ArrowUp   → floor(current / step) * step + step  (next boundary above)
   *   ArrowDown → ceil(current / step)  * step - step  (next boundary below)
   * This ensures that an off-step value always moves toward the nearest valid
   * boundary in the pressed direction, matching the original widget behaviour.
   */
  const handleArrowKeyCapture = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      const target = e.target as HTMLElement
      if (target.getAttribute("role") !== "spinbutton") return
      if (disabled) return

      // Enter commits the current display value, matching st.number_input.
      if (e.key === "Enter") {
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
        return
      }

      if (
        disabled ||
        !displayValue ||
        (e.key !== "ArrowUp" && e.key !== "ArrowDown")
      )
        return

      // Arrow key on an existing value always commits immediately (like the
      // +/- buttons on st.number_input). Set the flag before any step-specific
      // early-returns so it covers both custom-handled and fall-through paths.
      commitImmediatelyRef.current = true

      const segmentType = target.getAttribute("data-type")
      const up = e.key === "ArrowUp"
      const current = stringToTime(displayValue)

      if (segmentType === "minute") {
        // Non-whole-minute steps (e.g. 90s) fall back to react-aria's default ±1.
        // For step=60 (stepMins=1) react-aria's default ±1 is already correct.
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
      }
    },
    [
      disabled,
      displayValue,
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
    <div className="stTimeInput" data-testid="stTimeInput">
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
          onBlur={handleBlur}
          onKeyDownCapture={handleArrowKeyCapture}
        >
          <TimeField
            aria-label={element.label}
            value={
              isNullOrUndefined(displayValue)
                ? null
                : stringToTime(displayValue)
            }
            onChange={handleChange}
            // Always "minute": the wire format is HH:MM, so hiding the minute
            // segment would silently discard values like "12:45" from query-params
            // or session state. `step` controls arrow-key behaviour instead.
            granularity="minute"
            hourCycle={24}
            shouldForceLeadingZeros
            isDisabled={disabled}
          >
            <StyledTimeFieldInput>
              {segment => (
                <StyledTimeSegment segment={segment}>
                  {({ text, isPlaceholder, type }) =>
                    isPlaceholder && type === "hour"
                      ? "HH"
                      : isPlaceholder && type === "minute"
                        ? "mm"
                        : text
                  }
                </StyledTimeSegment>
              )}
            </StyledTimeFieldInput>
          </TimeField>
        </StyledTimeInputWrapper>
        {clearable && !isNullOrUndefined(displayValue) && (
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
      </StyledTimeFieldContainer>
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
