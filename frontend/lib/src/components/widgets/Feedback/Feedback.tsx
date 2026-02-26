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

import { memo, ReactElement, useCallback, useMemo, useRef } from "react"

import { Feedback as FeedbackProto, streamlit } from "@streamlit/protobuf"

import { shouldWidthStretch } from "~lib/components/core/Layout/utils"
import { DynamicIcon } from "~lib/components/shared/Icon"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledFeedbackButton,
  StyledFeedbackButtonGroup,
  StyledFeedbackContainer,
} from "./styled-components"

// Icon definitions for each feedback type
const THUMBS_ICONS = [":material/thumb_up:", ":material/thumb_down:"]

const FACES_ICONS = [
  ":material/sentiment_sad:",
  ":material/sentiment_dissatisfied:",
  ":material/sentiment_neutral:",
  ":material/sentiment_satisfied:",
  ":material/sentiment_very_satisfied:",
]

const STAR_ICON = ":material/star:"
const STAR_FILLED_ICON = ":material/star_filled:"
const NUM_STARS = 5

export interface Props {
  disabled: boolean
  element: FeedbackProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
  widthConfig: streamlit.IWidthConfig | undefined | null
}

interface FeedbackOption {
  icon: string
  selectedIcon: string
  // The value/index to return when this option is selected
  value: number
}

/**
 * Get the feedback options based on the feedback type.
 * Returns an array of options with icon, selectedIcon, and the value to return.
 */
function getFeedbackOptions(
  feedbackType: FeedbackProto.FeedbackType
): FeedbackOption[] {
  switch (feedbackType) {
    case FeedbackProto.FeedbackType.FACES:
      return FACES_ICONS.map((icon, index) => ({
        icon,
        selectedIcon: icon,
        value: index,
      }))
    case FeedbackProto.FeedbackType.STARS:
      return Array.from({ length: NUM_STARS }, (_, index) => ({
        icon: STAR_ICON,
        selectedIcon: STAR_FILLED_ICON,
        value: index,
      }))
    default:
      // Default to thumbs (includes THUMBS case)
      // Display order: thumbs-up (value=1), thumbs-down (value=0)
      return [
        { icon: THUMBS_ICONS[0], selectedIcon: THUMBS_ICONS[0], value: 1 },
        { icon: THUMBS_ICONS[1], selectedIcon: THUMBS_ICONS[1], value: 0 },
      ]
  }
}

/**
 * Get a descriptive aria-label for a feedback option based on the feedback type.
 */
function getAriaLabel(
  optionValue: number,
  feedbackType: FeedbackProto.FeedbackType
): string {
  switch (feedbackType) {
    case FeedbackProto.FeedbackType.THUMBS:
      return optionValue === 1 ? "Thumbs up" : "Thumbs down"
    case FeedbackProto.FeedbackType.FACES: {
      const faceLabels = [
        "Very dissatisfied",
        "Dissatisfied",
        "Neutral",
        "Satisfied",
        "Very satisfied",
      ]
      return faceLabels[optionValue] ?? `Rating ${optionValue + 1}`
    }
    case FeedbackProto.FeedbackType.STARS:
      return `${optionValue + 1} out of ${NUM_STARS} stars`
    default:
      return `Rating ${optionValue + 1}`
  }
}

/**
 * Determines if a feedback option should be shown as selected.
 * For stars, all options up to and including the selected one are shown as selected.
 * For thumbs and faces, only the exact selected option is shown as selected.
 */
function isOptionSelected(
  optionValue: number,
  selectedValue: number | null,
  feedbackType: FeedbackProto.FeedbackType
): boolean {
  if (selectedValue === null) {
    return false
  }

  if (feedbackType === FeedbackProto.FeedbackType.STARS) {
    // For stars, show all options up to and including the selected value
    return optionValue <= selectedValue
  }

  // For thumbs and faces, only show the exact selected option
  return optionValue === selectedValue
}

// Type for feedback value - can be null (no selection) or an integer
type FeedbackValue = number | null

/**
 * Get the feedback state from the widget manager.
 * Uses string as wire format to distinguish three states:
 * - undefined: No UI interaction yet
 * - "": User explicitly cleared
 * - "2": User selected value 2
 */
function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: FeedbackProto
): FeedbackValue | undefined {
  const stringValue = widgetMgr.getStringValue(element)
  if (stringValue === undefined) {
    return undefined // No UI interaction yet
  }
  if (stringValue === "") {
    return null // User explicitly cleared
  }
  return parseInt(stringValue, 10) // User selected a value
}

function getDefaultStateFromProto(element: FeedbackProto): FeedbackValue {
  // Use nullish coalescing - protobuf returns undefined when optional field is not set
  return element.default ?? null
}

function getCurrStateFromProto(element: FeedbackProto): FeedbackValue {
  // Use nullish coalescing - protobuf returns undefined when optional field is not set
  return element.value ?? null
}

/**
 * Update the widget manager state with the feedback value.
 * Converts int | null to string wire format:
 * - null -> "" (empty string = cleared)
 * - 2 -> "2" (string representation of value)
 */
function updateWidgetMgrState(
  element: FeedbackProto,
  widgetMgr: WidgetStateManager,
  valueWithSource: ValueWithSource<FeedbackValue>,
  fragmentId: string | undefined
): void {
  const stringValue =
    valueWithSource.value === null ? "" : String(valueWithSource.value)
  widgetMgr.setStringValue(
    element,
    stringValue,
    { fromUi: valueWithSource.fromUi },
    fragmentId
  )
}

function Feedback(props: Readonly<Props>): ReactElement {
  const { disabled, element, fragmentId, widgetMgr, widthConfig } = props
  const { type } = element

  const [hookValue, setValueWithSource] = useBasicWidgetState<
    FeedbackValue,
    FeedbackProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
    formClearBehavior: "resetValueOnly",
  })

  // Use element.value (from session_state) as the source of truth when set.
  // The hook's value may lag behind due to effect timing, so prefer element.value.
  const value = element.value ?? hookValue

  const containerWidth = shouldWidthStretch(widthConfig)

  const options = useMemo(() => getFeedbackOptions(type), [type])
  const buttonRefsRef = useRef<(HTMLButtonElement | null)[]>([])

  const handleClick = useCallback(
    (optionValue: number): void => {
      // Toggle selection: if clicking on already selected option, deselect
      const newValue = value === optionValue ? null : optionValue
      setValueWithSource({ value: newValue, fromUi: true })
    },
    [value, setValueWithSource]
  )

  /**
   * Handle keyboard navigation for the feedback buttons (roving tabindex pattern).
   * Arrow keys move focus between buttons, Enter/Space selects the focused option.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, currentIndex: number): void => {
      let newIndex: number

      switch (event.key) {
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault()
          newIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1
          break
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault()
          newIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0
          break
        case " ":
        case "Enter":
          event.preventDefault()
          handleClick(options[currentIndex].value)
          return
        default:
          return
      }

      // Focus the new button using ref
      buttonRefsRef.current[newIndex]?.focus()
    },
    [options, handleClick]
  )

  return (
    <StyledFeedbackContainer
      className="stFeedback"
      data-testid="stFeedback"
      containerWidth={containerWidth}
    >
      <StyledFeedbackButtonGroup
        role="radiogroup"
        aria-label="Feedback rating"
      >
        {options.map((option, index) => {
          const isSelected = isOptionSelected(option.value, value, type)
          const icon = isSelected ? option.selectedIcon : option.icon

          return (
            <StyledFeedbackButton
              key={option.value}
              ref={el => {
                buttonRefsRef.current[index] = el
              }}
              type="button"
              role="radio"
              aria-checked={value === option.value}
              aria-label={getAriaLabel(option.value, type)}
              tabIndex={
                value === option.value || (value === null && index === 0)
                  ? 0
                  : -1
              }
              disabled={disabled}
              isSelected={isSelected}
              onClick={() => handleClick(option.value)}
              onKeyDown={e => handleKeyDown(e, index)}
              data-testid={
                isSelected ? "stFeedbackButtonActive" : "stFeedbackButton"
              }
            >
              <DynamicIcon iconValue={icon} size="lg" />
            </StyledFeedbackButton>
          )
        })}
      </StyledFeedbackButtonGroup>
    </StyledFeedbackContainer>
  )
}

export default memo(Feedback)
