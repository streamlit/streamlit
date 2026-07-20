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

/**
 * Maps a step value (in seconds) to a React Aria TimeField granularity.
 *
 * Always returns "minute" because the wire format is HH:MM — hiding minutes
 * (hour-only granularity) would silently discard minute components from values
 * like "12:45" that can arrive via query-params or session state.
 *
 * Note: `step` still controls arrow-key behaviour via `handleArrowKeyCapture`.
 */
function stepToGranularity(_stepSeconds: number): "minute" {
  return "minute"
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
    formClearBehavior: "resetValueOnly",
  })

  // Local display state drives the TimeField directly, avoiding the
  // useEffect-delay in useBasicWidgetState that would cause React Aria
  // to see a stale value mid-render and reset its segment edit buffer.
  const [displayValue, setDisplayValue] = useState<string | null>(value)

  // Sync from backend when value changes externally (form clear, session
  // state update, setValue call). Uses render-time adjustment pattern:
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const prevValueRef = useRef(value)
  if (prevValueRef.current !== value) {
    prevValueRef.current = value
    setDisplayValue(value)
  }

  const theme = useEmotionTheme()
  const step = element.step ? Number(element.step) : 900
  const clearable = isNullOrUndefined(element.default) && !disabled

  const stepMins = step / 60
  const stepHours = step / 3600

  const handleChange = useCallback(
    (newTime: Time | null): void => {
      if (newTime === null && !clearable) return
      const newValue = newTime ? timeToString(newTime) : null
      setDisplayValue(newValue)
      setValueWithSource({ value: newValue, fromUi: true })
    },
    [clearable, setValueWithSource]
  )

  const handleClear = useCallback((): void => {
    setDisplayValue(null)
    setValueWithSource({ value: null, fromUi: true })
  }, [setValueWithSource])

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
      if (!displayValue || (e.key !== "ArrowUp" && e.key !== "ArrowDown"))
        return
      const target = e.target as HTMLElement
      if (target.getAttribute("role") !== "spinbutton") return

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
        const wrapped = ((next % 1440) + 1440) % 1440
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
        const wrapped = ((next % 24) + 24) % 24
        handleChange(new Time(wrapped, current.minute))
      }
    },
    [displayValue, step, stepMins, stepHours, handleChange]
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
            granularity={stepToGranularity(step)}
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
