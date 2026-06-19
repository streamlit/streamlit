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

import { memo, ReactElement, useCallback } from "react"

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
 * Only "hour" and "minute" granularities are used because the wire format
 * is always HH:MM — seconds have never been stored or displayed.
 */
function stepToGranularity(stepSeconds: number): "hour" | "minute" {
  return stepSeconds % 3600 === 0 ? "hour" : "minute"
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

  const theme = useEmotionTheme()
  const step = element.step ? Number(element.step) : 900
  const clearable = isNullOrUndefined(element.default) && !disabled

  const handleChange = useCallback(
    (newTime: Time | null): void => {
      // Suppress null mid-edit events for non-clearable widgets to avoid
      // resetting the backend value while the user is still typing.
      if (newTime === null && !clearable) return
      setValueWithSource({
        value: newTime ? timeToString(newTime) : null,
        fromUi: true,
      })
    },
    [clearable, setValueWithSource]
  )

  const handleClear = useCallback((): void => {
    setValueWithSource({ value: null, fromUi: true })
  }, [setValueWithSource])

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
        >
          <TimeField
            aria-label={element.label}
            value={isNullOrUndefined(value) ? null : stringToTime(value)}
            onChange={handleChange}
            granularity={stepToGranularity(step)}
            hourCycle={24}
            shouldForceLeadingZeros
            isDisabled={disabled}
          >
            <StyledTimeFieldInput>
              {segment => <StyledTimeSegment segment={segment} />}
            </StyledTimeFieldInput>
          </TimeField>
        </StyledTimeInputWrapper>
        {clearable && !isNullOrUndefined(value) && (
          <StyledClearButton
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
