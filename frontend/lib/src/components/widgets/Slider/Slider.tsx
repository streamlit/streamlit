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

  // We tie the UI to `uiValue` rather than `value` because `value` only updates
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

  // When resetting a form, `value` will change so we need to change `uiValue`
  // to match.
  useEffect(() => {
    setUiValue(value)
  }, [value])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetValueWithSource = useCallback(
    debounce(DEBOUNCE_TIME_MS, (value: number[]): void => {
      setValueWithSource({ value, fromUi: true })
    }) as (value: number[]) => void,
    []
  )

  const handleChange = useCallback(
    ({ value }: { value: number[] }): void => {
      setUiValue(value)
      debouncedSetValueWithSource(value)
    },
    [debouncedSetValueWithSource]
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
  }, [formattedMinValue, formattedMaxValue, disabled])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const renderThumb = useCallback(
    React.forwardRef<HTMLDivElement, StyleProps>(function renderThumb(
      props: StyleProps,
      ref
    ): ReactElement {
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
    }),
    // Only run this on first render, to avoid losing the focus state.
    // Then, when the value written about the thumb needs to change, that
    // happens with the function below instead.
    []
  )

  useEffect(() => {
    // Update the numbers on the thumb via DOM manipulation to avoid a redraw,
    // which drops the widget's focus state.
    thumbValueRefs.map((ref, i) => {
      if (ref.current) {
        ref.current.innerText = formattedValueArr[i]
      }
    })

    thumbRefs.map((ref, i) => {
      if (ref.current) {
        ref.current.setAttribute("aria-valuetext", formattedValueArr[i])
      }
    })

    // If, after rendering, the thumb value's is outside the container (too
    // far left or too far right), bring it inside. Or if there are two
    // thumbs and their values overlap, fix that.
    const sliderDiv = sliderRef.current ?? null
    const thumb1Div = thumbRefs[0].current
    const thumb2Div = thumbRefs[1]?.current
    const thumb1ValueDiv = thumbValueRefs[0].current
    const thumb2ValueDiv = thumbValueRefs[1]?.current

    fixLabelPositions(
      sliderDiv,
      thumb1Div,
      thumb2Div,
      thumb1ValueDiv,
      thumb2ValueDiv
    )
  })

  const innerTrackStyle = useCallback(
    ({ $disabled }: StyleProps) => ({
      height: spacing.twoXS,
      ...($disabled ? { background: colors.darkenedBgMix25 } : {}),
    }),
    [colors, spacing]
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
          Thumb: renderThumb,
          Tick: {
            style: {
              fontFamily: fonts.monospace,
            },
          },
          Track: {
            style: {
              backgroundColor: "none !important",
              paddingBottom: spacing.none,
              paddingLeft: spacing.none,
              paddingRight: spacing.none,
              // Add additional padding to fit the thumb value
              // which uses a fontSizes.sm.
              paddingTop: `calc(${fontSizes.sm} * 1.35)`,
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

function fixLabelPositions(
  sliderDiv: HTMLDivElement | null,
  thumb1Div: HTMLDivElement | null,
  thumb2Div: HTMLDivElement | null,
  thumb1ValueDiv: HTMLDivElement | null,
  thumb2ValueDiv: HTMLDivElement | null
): void {
  if (!sliderDiv || !thumb1Div || !thumb1ValueDiv) {
    return
  }

  fixLabelOverflow(sliderDiv, thumb1Div, thumb1ValueDiv)

  if (thumb2Div && thumb2ValueDiv) {
    fixLabelOverflow(sliderDiv, thumb2Div, thumb2ValueDiv)

    // If two thumbs.
    fixLabelOverlap(
      sliderDiv,
      thumb1Div,
      thumb2Div,
      thumb1ValueDiv,
      thumb2ValueDiv
    )
  }
}

function fixLabelOverflow(
  slider: HTMLDivElement,
  thumb: HTMLDivElement,
  thumbValue: HTMLDivElement
): void {
  const sliderRect = slider.getBoundingClientRect()
  const thumbRect = thumb.getBoundingClientRect()
  const thumbValueRect = thumbValue.getBoundingClientRect()

  const thumbMidpoint = thumbRect.left + thumbRect.width / 2
  const thumbValueOverflowsLeft =
    thumbMidpoint - thumbValueRect.width / 2 < sliderRect.left
  const thumbValueOverflowsRight =
    thumbMidpoint + thumbValueRect.width / 2 > sliderRect.right

  thumbValue.style.left = thumbValueOverflowsLeft ? "0" : ""
  thumbValue.style.right = thumbValueOverflowsRight ? "0" : ""
}

/**
 * Goals:
 * - Keep the thumb values near their respective thumbs.
 * - Keep thumb values within the bounds of the slider.
 * - Avoid visual jank while moving the thumbs
 */
function fixLabelOverlap(
  sliderDiv: HTMLDivElement,
  thumb1Div: HTMLDivElement,
  thumb2Div: HTMLDivElement,
  thumb1ValueDiv: HTMLDivElement,
  thumb2ValueDiv: HTMLDivElement
): void {
  const labelGap = 24

  const sliderRect = sliderDiv.getBoundingClientRect()
  const thumb1Rect = thumb1Div.getBoundingClientRect()
  const thumb2Rect = thumb2Div.getBoundingClientRect()
  const thumb1ValueRect = thumb1ValueDiv.getBoundingClientRect()
  const thumb2ValueRect = thumb2ValueDiv.getBoundingClientRect()

  const sliderMidpoint = sliderRect.left + sliderRect.width / 2
  const thumb1MidPoint = thumb1Rect.left + thumb1Rect.width / 2
  const thumb2MidPoint = thumb2Rect.left + thumb2Rect.width / 2

  const centeredThumb1ValueFitsLeft =
    thumb1MidPoint - thumb1ValueRect.width / 2 >= sliderRect.left

  const centeredThumb2ValueFitsRight =
    thumb2MidPoint + thumb2ValueRect.width / 2 <= sliderRect.right

  const leftAlignedThumb1ValueFitsLeft =
    thumb1Rect.left - thumb1ValueRect.width >= sliderRect.left

  const rightAlignedThumb2ValueFitsRight =
    thumb2Rect.right + thumb2ValueRect.width <= sliderRect.right

  const thumb1ValueOverhang = centeredThumb1ValueFitsLeft
    ? thumb1ValueRect.width / 2
    : thumb1ValueRect.width

  const thumb2ValueOverhang = centeredThumb2ValueFitsRight
    ? thumb2ValueRect.width / 2
    : thumb2ValueRect.width

  const thumb1ValueInnerEdge = thumb1MidPoint + thumb1ValueOverhang
  const thumb2ValueInnerEdge = thumb2MidPoint - thumb2ValueOverhang
  const thumbsAreFarApart =
    thumb2ValueInnerEdge - thumb1ValueInnerEdge > labelGap

  // If thumbs are far apart, just handle each separately.
  //
  // 1. Center values on their thumbs, like this:
  //
  //        [thumb1Value]       [thumb1Value]
  // |--------[thumb1]-------------[thumb2]-------------------|
  //
  //
  // 2. If one of the thumbs is so close to the edge that centering would cause
  // the value to overflow past the edge, align the value away from the edge.
  // (This is the normal fixLabelOverflow() behavior)
  //
  // For example, let's say thumb1 moved to the left:
  //
  //     [thumb1Value]          [thumb2Value]
  // |---[thumb1]------------------[thumb2]-------------------|
  //
  //
  if (thumbsAreFarApart) {
    fixLabelOverflow(sliderDiv, thumb1Div, thumb1ValueDiv)
    fixLabelOverflow(sliderDiv, thumb2Div, thumb2ValueDiv)
    return
  }

  // If thumbs are close, try different things...

  // 3. If thumbs are so close that centering would cause values to
  // overlap, then place the values to the side of their thumbs, away from
  // the opposing thumbs:
  //
  // For example, if starting from case #1 above we moved thumb1 to the
  // right:
  //
  //      [thumb1Value]                    [thumb2Value]
  // |-----------------[thumb1]----[thumb2]-------------------|
  //
  if (leftAlignedThumb1ValueFitsLeft && rightAlignedThumb2ValueFitsRight) {
    // Align value1 to the left of its thumb.
    thumb1ValueDiv.style.left = ""
    thumb1ValueDiv.style.right = `${thumb1Rect.width}px`

    // Align value2 to the right of its thumb.
    thumb2ValueDiv.style.left = `${thumb2Rect.width}px`
    thumb2ValueDiv.style.right = ""

    return
  }

  // 4. If one of the thumbs is so close to the edge that doing the outward
  // alignment from #3 would cause its value to overflow past the edge, then
  // try centering the value. And place the other thumb's value right next to
  // it, to avoid overlaps.
  //
  // For example, if we moved thumb1 and thumb2 to the left by the same
  // amount:
  //
  //    [thumb1Value][thumb2Value]
  // |----[thumb1]--[thumb2]----------------------------------|
  //
  //
  // 5. If one of the thumbs is so close to the edge that doing the center
  // alignment from #4 would cause its value to overflow past the edge, then
  // align it with its thumb, pointing inward. And, like in #4, place the
  // other thumb's value right next to it to avoid overlaps.
  //
  // For example, if we moved thumb1 to the left, and moved thumb2 even more:
  //
  //   [thumb1Value][thumb2Value]
  // |-[thumb1]--[thumb2]-------------------------------------|
  //

  const jointThumbsAreOnLeftHalf = thumb1MidPoint < sliderMidpoint

  if (jointThumbsAreOnLeftHalf) {
    fixLabelOverflow(sliderDiv, thumb1Div, thumb1ValueDiv)

    // Make thumb2Value appear to the right of thumb1Value.
    thumb2ValueDiv.style.left = `${
      thumb1MidPoint + thumb1ValueOverhang + labelGap - thumb2MidPoint
    }px`
    thumb2ValueDiv.style.right = ""
  } else {
    fixLabelOverflow(sliderDiv, thumb2Div, thumb2ValueDiv)

    // Make thumb1Value appear to the left of thumb2Value.
    thumb1ValueDiv.style.left = ""
    thumb1ValueDiv.style.right = `${-(
      thumb2MidPoint -
      thumb2ValueOverhang -
      labelGap -
      thumb1MidPoint
    )}px`
  }
}

export default memo(Slider)
