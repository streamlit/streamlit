/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, {
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import pick from "lodash/pick"
import { StyleProps, Slider as UISlider } from "baseui/slider"
import { useTheme } from "@emotion/react"
import { sprintf } from "sprintf-js"
import moment from "moment"

import { WidgetStateManager } from "@streamlit/lib/src/WidgetStateManager"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "@streamlit/lib/src/useBasicWidgetState"
import { Slider as SliderProto } from "@streamlit/lib/src/proto"
import {
  debounce,
  labelVisibilityProtoValueToEnum,
} from "@streamlit/lib/src/util/utils"
import {
  StyledWidgetLabelHelp,
  WidgetLabel,
} from "@streamlit/lib/src/components/widgets/BaseWidget"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"

import {
  StyledThumb,
  StyledThumbValue,
  StyledTickBar,
  StyledTickBarItem,
} from "./styled-components"

const DEBOUNCE_TIME_MS = 200

export interface Props {
  disabled: boolean
  element: SliderProto
  widgetMgr: WidgetStateManager
  width: number
  fragmentId?: string
}

function Slider({
  disabled,
  element,
  widgetMgr,
  width,
  fragmentId,
}: Props): ReactElement {
  const [value, setValueWithSource] = useBasicWidgetState<
    number[],
    SliderProto
  >({
    getStateFromWidgetMgr,
    getDefaultStateFromProto,
    getCurrStateFromProto,
    updateWidgetMgrState,
    element,
    widgetMgr,
    fragmentId,
  })

  // We tie the UI to `uiValue` rather than `value` becase `value` only updates
  // every DEBOUNCE_TIME_MS. If we tied the UI to `value` then the UI would only
  // update every DEBOUNCE_TIME_MS as well. So this keeps the UI smooth.
  const [uiValue, setUiValue] = useState(value)

  const sliderRef = useRef<HTMLDivElement | null>(null)
  const [thumbRefs] = useState<
    React.MutableRefObject<HTMLDivElement | null>[]
  >([])
  const [thumbValueRefs] = useState<
    React.MutableRefObject<HTMLDivElement | null>[]
  >([])

  const { colors, fonts, fontSizes, spacing } = useTheme()
  const style = { width }

  const formattedValueArr = uiValue.map(v => formatValue(v, element))
  const formattedMinValue = formatValue(element.min, element)
  const formattedMaxValue = formatValue(element.max, element)
  const thumbAriaLabel = element.label

  // Check the thumb value's alignment vs. slider container
  useEffect((): void => {
    const sliderDiv = sliderRef.current ?? null
    const thumb1Div = thumbRefs[0].current
    const thumb2Div = thumbRefs[1]?.current
    const thumb1ValueDiv = thumbValueRefs[0].current
    const thumb2ValueDiv = thumbValueRefs[1]?.current
    // Minimum gap between thumb values (in px)
    const labelGap = 16

    // Handles label alignment over each thumb
    alignValueOnThumb(sliderDiv, thumb1Div, thumb1ValueDiv)
    alignValueOnThumb(sliderDiv, thumb2Div, thumb2ValueDiv)

    // Checks & handles label spacing when two thumb values & they overlap
    if (
      sliderDiv &&
      thumb1Div &&
      thumb2Div &&
      thumb1ValueDiv &&
      thumb2ValueDiv
    ) {
      const slider = sliderDiv.getBoundingClientRect()
      const thumb1 = thumb1Div.getBoundingClientRect()
      const thumb2 = thumb2Div.getBoundingClientRect()
      const thumb1Value = thumb1ValueDiv.getBoundingClientRect()
      const thumb2Value = thumb2ValueDiv.getBoundingClientRect()

      // Check if thumb values are overlapping or too close together
      if (thumb1Value.right + labelGap > thumb2Value.left) {
        // Check whether to shift 1st thumb value left or 2nd thumb value right
        const moveLeft =
          thumb2Value.left - labelGap - thumb1Value.width > slider.left

        if (moveLeft) {
          thumb1ValueDiv.style.right = `${
            thumb2Value.width + labelGap - (thumb2.right - thumb1.right)
          }px`
        } else {
          thumb2ValueDiv.style.left = `${
            thumb1Value.width + labelGap - (thumb2.left - thumb1.left)
          }px`
        }
      }
    }
  })

  // Update the thumb numbers via DOM manipulation to avoid a redraw, which
  // drops the widget's focus state.
  useEffect(() => {
    thumbValueRefs.map((ref, i) => {
      if (!ref.current) {
        return
      }
      ref.current.innerText = formattedValueArr[i]
    })

    thumbRefs.map((ref, i) => {
      if (!ref.current) {
        return
      }
      ref.current.setAttribute("aria-valuetext", formattedValueArr[i])
    })
  })

  // When resetting a form, `value` will change so we need to change `uiValue`
  // to match.
  useEffect(() => {
    if (value !== uiValue) {
      setUiValue(value)
    }
    // Don't include `uiValue` in the deps below or the slider will become
    // jittery.
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [value])

  const debouncedSetValueWithSource = useCallback(
    debounce(DEBOUNCE_TIME_MS, (value: number[]): void => {
      setValueWithSource({ value, fromUi: true })
    }),
    [setValueWithSource]
  )

  const handleChange = useCallback(
    ({ value }: { value: number[] }): void => {
      setUiValue(value)
      debouncedSetValueWithSource(value)
    },
    [setValueWithSource]
  )

  const renderTickBar = useCallback((): ReactElement => {
    return (
      <StyledTickBar data-testid="stSliderTickBar">
        <StyledTickBarItem
          disabled={disabled}
          data-testid="stSliderTickBarMin"
        >
          {formattedMinValue}
        </StyledTickBarItem>
        <StyledTickBarItem
          disabled={disabled}
          data-testid="stSliderTickBarMax"
        >
          {formattedMaxValue}
        </StyledTickBarItem>
      </StyledTickBar>
    )
    // Only run this on first render. No real reason, just nicer.
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [])

  const renderThumb = useCallback(
    /* eslint-disable react/display-name */
    React.forwardRef<HTMLDivElement, StyleProps>(
      (props: StyleProps, ref): ReactElement => {
        const { $thumbIndex } = props
        const thumbIndex = $thumbIndex || 0
        thumbRefs[thumbIndex] = ref as React.MutableRefObject<HTMLDivElement>
        thumbValueRefs[thumbIndex] ||= React.createRef<HTMLDivElement>()

        const passThrough = pick(props, [
          "role",
          "style",
          "aria-valuemax",
          "aria-valuemin",
          "aria-valuenow",
          "tabIndex",
          "onKeyUp",
          "onKeyDown",
          "onMouseEnter",
          "onMouseLeave",
          "draggable",
        ])

        const formattedValue = formattedValueArr[thumbIndex]

        return (
          <StyledThumb
            {...passThrough}
            disabled={props.$disabled === true}
            ref={thumbRefs[thumbIndex]}
            aria-valuetext={formattedValue}
            aria-label={thumbAriaLabel}
          >
            <StyledThumbValue
              data-testid="stSliderThumbValue"
              disabled={props.$disabled === true}
              ref={thumbValueRefs[thumbIndex]}
            >
              {formattedValue}
            </StyledThumbValue>
          </StyledThumb>
        )
      }
    ),
    // Only run this on first render, to avoid losing the focus state.
    /* eslint-disable react-hooks/exhaustive-deps */
    []
  )

  const innerTrackStyle = useCallback(
    ({ $disabled }: StyleProps) => ({
      height: "4px",
      ...($disabled ? { background: colors.darkenedBgMix25 } : {}),
    }),
    []
  )

  return (
    <div
      ref={sliderRef}
      className="stSlider"
      data-testid="stSlider"
      style={style}
    >
      <WidgetLabel
        label={element.label}
        disabled={disabled}
        labelVisibility={labelVisibilityProtoValueToEnum(
          element.labelVisibility?.value
        )}
      >
        {element.help && (
          <StyledWidgetLabelHelp>
            <TooltipIcon
              content={element.help}
              placement={Placement.TOP_RIGHT}
            />
          </StyledWidgetLabelHelp>
        )}
      </WidgetLabel>
      <UISlider
        min={element.min}
        max={element.max}
        step={element.step}
        value={getValueAsArray(uiValue, element)}
        onChange={handleChange}
        disabled={disabled}
        overrides={{
          Root: {
            style: {
              paddingTop: spacing.twoThirdsSmFont,
            },
          },
          Thumb: renderThumb,
          Tick: {
            style: {
              fontFamily: fonts.monospace,
              fontSize: fontSizes.sm,
            },
          },
          Track: {
            style: {
              backgroundColor: "none !important",
              paddingBottom: spacing.none,
              paddingLeft: spacing.none,
              paddingRight: spacing.none,
              paddingTop: spacing.twoThirdsSmFont,
            },
          },
          InnerTrack: {
            style: innerTrackStyle,
          },
          TickBar: renderTickBar,
        }}
      />
    </div>
  )
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: SliderProto
): number[] | undefined {
  return widgetMgr.getDoubleArrayValue(element)
}

function getDefaultStateFromProto(element: SliderProto): number[] {
  return element.default
}

function getCurrStateFromProto(element: SliderProto): number[] {
  return element.value
}

function updateWidgetMgrState(
  element: SliderProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<number[]>,
  fragmentId?: string
): void {
  widgetMgr.setDoubleArrayValue(
    element,
    vws.value,
    { fromUi: vws.fromUi },
    fragmentId
  )
}

function isDateTimeType(element: SliderProto): boolean {
  const { dataType } = element
  return (
    dataType === SliderProto.DataType.DATETIME ||
    dataType === SliderProto.DataType.DATE ||
    dataType === SliderProto.DataType.TIME
  )
}

function formatValue(value: number, element: SliderProto): string {
  const { format, options } = element
  if (isDateTimeType(element)) {
    // Python datetime uses microseconds, but JS & Moment uses milliseconds
    // The timestamp is always set to the UTC timezone, even so, the actual timezone
    // for this timestamp in the backend could be different.
    // However, the frontend component does not need to know about the actual timezone.
    return moment.utc(value / 1000).format(format)
  }

  if (options.length > 0) {
    return sprintf(format, options[value])
  }

  return sprintf(format, value)
}

/**
 * Return the value of the slider. This will either be an array with
 * one value (for a single value slider), or an array with two
 * values (for a range slider).
 */
function getValueAsArray(value: number[], element: SliderProto): number[] {
  const { min, max } = element
  let start = value[0]
  let end = value.length > 1 ? value[1] : value[0]
  // Adjust the value if it's out of bounds.
  if (start > end) {
    start = end
  }
  if (start < min) {
    start = min
  }
  if (start > max) {
    start = max
  }
  if (end < min) {
    end = min
  }
  if (end > max) {
    end = max
  }
  return value.length > 1 ? [start, end] : [start]
}

function alignValueOnThumb(
  slider: HTMLDivElement | null,
  thumb: HTMLDivElement | null,
  thumbValue: HTMLDivElement | null
): void {
  if (slider && thumb && thumbValue) {
    const sliderPosition = slider.getBoundingClientRect()
    const thumbPosition = thumb.getBoundingClientRect()
    const thumbValuePosition = thumbValue.getBoundingClientRect()

    const thumbMidpoint = thumbPosition.left + thumbPosition.width / 2
    const thumbValueOverflowsLeft =
      thumbMidpoint - thumbValuePosition.width / 2 < sliderPosition.left
    const thumbValueOverflowsRight =
      thumbMidpoint + thumbValuePosition.width / 2 > sliderPosition.right

    thumbValue.style.left = thumbValueOverflowsLeft ? "0" : ""
    thumbValue.style.right = thumbValueOverflowsRight ? "0" : ""
  }
}

export default memo(Slider)
