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
  createRef,
  forwardRef,
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import {
  type StyleProps,
  Slider as UISlider,
  StyledInnerTrack as UIStyledInnerTrack,
} from "baseui/slider"
import { pick } from "lodash-es"
import moment from "moment"

import { Slider as SliderProto } from "@streamlit/protobuf"

import { withCalculatedWidth } from "~lib/components/core/Layout/withCalculatedWidth"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import {
  WidgetLabel,
  WidgetLabelHelpIcon,
} from "~lib/components/widgets/BaseWidget"
import {
  useBasicWidgetState,
  ValueWithSource,
} from "~lib/hooks/useBasicWidgetState"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import {
  arrayComparator,
  useExecuteWhenChanged,
} from "~lib/hooks/useExecuteWhenChanged"
import { formatMoment, MomentKind } from "~lib/util/formatMoment"
import { formatNumber } from "~lib/util/formatNumber"
import { labelVisibilityProtoValueToEnum } from "~lib/util/utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledInnerTrackWrapper,
  StyledSlider,
  StyledSliderTickBar,
  StyledThumb,
  StyledThumbValue,
  StyledThumbWrapper,
} from "./styled-components"

interface SliderTickBarProps {
  minLabel: string
  maxLabel: string
  isHovered: boolean
  isDisabled: boolean
}

function SliderTickBar({
  minLabel,
  maxLabel,
  isHovered,
  isDisabled,
}: SliderTickBarProps): ReactElement {
  return (
    <StyledSliderTickBar
      data-testid="stSliderTickBar"
      isHovered={isHovered}
      isDisabled={isDisabled}
    >
      <StreamlitMarkdown
        source={minLabel}
        allowHTML={false}
        inheritFont
        isLabel
      />
      <StreamlitMarkdown
        source={maxLabel}
        allowHTML={false}
        inheritFont
        isLabel
      />
    </StyledSliderTickBar>
  )
}

export interface Props {
  disabled: boolean
  element: SliderProto
  widgetMgr: WidgetStateManager
  width: number
  fragmentId?: string
}

/**
 * Check if this is a select_slider (options-based) rather than a numeric slider.
 */
function isSelectSlider(element: SliderProto): boolean {
  return element.type === SliderProto.Type.SELECT_SLIDER
}

/**
 * Convert string values (formatted options) to indices for select_slider.
 * Returns the indices in the options array that correspond to the string values.
 */
function stringValuesToIndices(
  stringValues: string[],
  options: string[],
  defaultIndices: number[]
): number[] {
  return stringValues.map((str, i) => {
    const index = options.indexOf(str)
    // If not found, fall back to default index for this position
    return index >= 0 ? index : (defaultIndices[i] ?? 0)
  })
}

/**
 * Convert indices to string values (formatted options) for select_slider.
 */
function indicesToStringValues(
  indices: number[],
  options: string[]
): string[] {
  return indices.map(i => options[i] ?? "")
}

function Slider({
  disabled,
  element,
  widgetMgr,
  fragmentId,
}: Props): ReactElement {
  const queryParamBinding = element.queryParamKey
    ? {
        paramKey: element.queryParamKey,
        valueType: isSelectSlider(element)
          ? ("string_array_value" as const)
          : ("double_array_value" as const),
        clearable: false,
        urlFormat: "repeated" as const,
        // select_slider stores indices internally but uses formatted option
        // strings in URLs, so provide the default in URL-compatible format.
        urlDefault: isSelectSlider(element)
          ? indicesToStringValues(element.default, element.options)
          : undefined,
        // Date/time/datetime sliders format microsecond timestamps as ISO
        // strings in URLs (e.g., ?date=2024-06-15 instead of raw micros).
        dateType: isDateTimeType(element) ? getMomentKind(element) : undefined,
      }
    : undefined

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
    formClearBehavior: "resetValueOnly",
    queryParamBinding,
  })

  // We tie the UI to `uiValue` rather than `value` because `value` only
  // updates when the user is done interacting with the slider. If we tied
  // the UI to `value` then the UI would only update when the user is done
  // interacting. So this keeps the UI smooth.
  const [uiValue, setUiValue] = useState(value)
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => setIsHovered(false), [])

  const sliderRef = useRef<HTMLDivElement | null>(null)
  const [thumbRefs] = useState<
    React.MutableRefObject<HTMLDivElement | null>[]
  >([])
  const [thumbValueRefs] = useState<
    React.MutableRefObject<HTMLDivElement | null>[]
  >([])

  const theme = useEmotionTheme()

  // Keep a ref to the latest element so stable callbacks (`renderThumb`) can
  // always read the current format/options without depending on `element` in
  // their dependency arrays (which would hurt referential stability).
  const elementRef = useRef(element)
  elementRef.current = element

  const formattedValueArr = uiValue.map(v => formatValue(v, element))
  const formattedMinValue = formatValue(element.min, element)
  const formattedMaxValue = formatValue(element.max, element)

  // When resetting a form, `value` will change so we need to change `uiValue`
  // to match.
  useEffect(() => {
    setUiValue(value)
  }, [value])

  // For select_slider: when options change, recompute indices from WidgetStateManager.
  // This handles the case where the selected string value exists in both old and new
  // options but at different indices - the UI needs to update to show the correct position.
  useExecuteWhenChanged(
    () => {
      if (!isSelectSlider(element)) return

      // Get current string values from widget manager and convert to new indices
      const stringValues = widgetMgr.getStringArrayValue(element)
      if (stringValues === undefined) return

      const newIndices = stringValuesToIndices(
        stringValues,
        element.options,
        element.default
      )
      setUiValue(newIndices)
    },
    [element.options],
    (prev, curr) => arrayComparator(prev[0], curr[0])
  )

  const handleFinalChange = useCallback(
    ({ value: valueArg }: { value: number[] }): void => {
      setValueWithSource({ value: valueArg, fromUi: true })
      setIsDragging(false)
    },
    [setValueWithSource]
  )

  const handleChange = useCallback(
    ({ value: valueArg }: { value: number[] }): void => {
      setUiValue(valueArg)
      setIsDragging(true)
    },
    []
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: Update to match React best practices
  const renderThumb = useCallback(
    forwardRef<HTMLDivElement, StyleProps>(
      function renderThumb(props, ref): ReactElement {
        const { $thumbIndex, $value } = props
        const thumbIndex = $thumbIndex || 0
        thumbRefs[thumbIndex] = ref as React.MutableRefObject<HTMLDivElement>
        // eslint-disable-next-line @eslint-react/no-create-ref
        thumbValueRefs[thumbIndex] ||= createRef<HTMLDivElement>()

        // TODO: I forget why we don't just pass *all* props through.
        // It seems to work fine, when I try it. But perhaps we need to do
        // more extensive testing before simplifying...
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

        const currentElement = elementRef.current

        // We intentionally re-compute the formatted value here from the latest
        // thumb value and the latest element (via `elementRef`) instead of
        // reading from `formattedValueArr` in the outer closure. This keeps
        // `renderThumb` referentially stable across user interactions while
        // still reflecting changes to formatting-related props like
        // `element.format`.
        const thumbValues = $value ?? [currentElement.min]
        const thumbValue = thumbValues[thumbIndex] ?? currentElement.min
        const formattedValue = formatValue(thumbValue, currentElement)

        return (
          <StyledThumb
            {...passThrough}
            disabled={props.$disabled === true}
            isDragged={props.$isDragged === true}
            ref={thumbRefs[thumbIndex]}
            aria-valuetext={formattedValue}
            aria-label={currentElement.label}
          >
            <StyledThumbValue
              data-testid="stSliderThumbValue"
              disabled={props.$disabled === true}
              ref={thumbValueRefs[thumbIndex]}
            >
              <StreamlitMarkdown
                source={formattedValue}
                allowHTML={false}
                inheritFont
                isLabel
              />
            </StyledThumbValue>
          </StyledThumb>
        )
      }
    ),
    // Only run this on first render, to avoid losing the focus state.
    // Then, when the value written about the thumb needs to change, that
    // happens with the function below instead.
    []
  )

  useLayoutEffect(() => {
    // Keep aria-valuetext in sync with the formatted values for accessibility.
    thumbRefs.forEach((ref, i) => {
      if (ref.current) {
        ref.current.setAttribute("aria-valuetext", formattedValueArr[i])
      }
    })

    // If, after rendering, the thumb value is outside the container (too
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

  // Style that will be applied to BaseWeb's <InnerTrack>.
  const innerTrackStyle = useCallback(
    ({ $disabled }: StyleProps) => ({
      height: theme.spacing.twoXS,
      ...($disabled ? { background: theme.colors.darkenedBgMix25 } : {}),
    }),
    [theme.colors.darkenedBgMix25, theme.spacing.twoXS]
  )

  // Make thumbs not overshoot the slider's track boundaries.
  // We do this by placing the thumbs in the DOM beneath the track.
  // Then we can adjust the padding around the thumbs separately
  // from the dimensions of the track.
  //
  // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: Update to match React best practices
  const renderInnerTrack = useCallback(
    forwardRef<HTMLDivElement, StylePropsWithChildren>(
      function renderInnerTrack(props, ref): ReactElement {
        const { children: thumbs, ...newProps } = props

        return (
          <StyledInnerTrackWrapper>
            {/* Place thumbs inside container with a bit of horiz padding. */}
            <StyledThumbWrapper ref={ref}>{thumbs}</StyledThumbWrapper>
            {/* Place track under thumb container, with no padding. */}
            <UIStyledInnerTrack
              {...newProps}
              style={innerTrackStyle({ $disabled: props.$disabled })}
            />
          </StyledInnerTrackWrapper>
        )
      }
    ),

    // Only run this on first render.
    []
  )

  return (
    <StyledSlider
      ref={sliderRef}
      className="stSlider"
      data-testid="stSlider"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
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
      <UISlider
        min={element.min}
        max={element.max}
        step={element.step}
        value={getValueAsArray(uiValue, element)}
        onChange={handleChange}
        onFinalChange={handleFinalChange}
        disabled={disabled}
        overrides={{
          Thumb: renderThumb,
          Track: {
            style: {
              backgroundColor: "none !important",
              paddingLeft: theme.spacing.none,
              paddingRight: theme.spacing.none,
              // Set padding so total height equals minElementHeight (40px)
              // Total height = paddingTop + innerTrack height + paddingBottom
              paddingTop: `calc((${theme.sizes.minElementHeight} - ${theme.spacing.twoXS}) / 2)`,
              paddingBottom: `calc((${theme.sizes.minElementHeight} - ${theme.spacing.twoXS}) / 2)`,
            },
          },
          InnerTrack: renderInnerTrack,
          // Show min/max labels when hovering the slider or dragging it
          TickBar: {
            component: SliderTickBar,
            props: {
              minLabel: formattedMinValue,
              maxLabel: formattedMaxValue,
              isHovered: isHovered || isDragging,
              isDisabled: disabled,
            },
          },
        }}
      />
    </StyledSlider>
  )
}

function getStateFromWidgetMgr(
  widgetMgr: WidgetStateManager,
  element: SliderProto
): number[] | undefined {
  if (isSelectSlider(element)) {
    // For select_slider, get string values and convert to indices
    const stringValues = widgetMgr.getStringArrayValue(element)
    // No value stored yet - normal case during initial render
    if (stringValues === undefined) {
      return undefined
    }
    return stringValuesToIndices(
      stringValues,
      element.options,
      element.default
    )
  }
  // For regular slider, get numeric values directly
  return widgetMgr.getDoubleArrayValue(element)
}

function getDefaultStateFromProto(element: SliderProto): number[] {
  return element.default
}

function getCurrStateFromProto(element: SliderProto): number[] {
  if (isSelectSlider(element)) {
    // For select_slider, read string values from rawValue and convert to indices
    const rawValues = element.rawValue
    if (rawValues && rawValues.length > 0) {
      return stringValuesToIndices(rawValues, element.options, element.default)
    }
    // Fall back to default indices
    return element.default
  }
  // For regular slider, use numeric value directly
  return element.value
}

function updateWidgetMgrState(
  element: SliderProto,
  widgetMgr: WidgetStateManager,
  vws: ValueWithSource<number[]>,
  fragmentId: string | undefined
): void {
  if (isSelectSlider(element)) {
    // For select_slider, convert indices to string values
    const stringValues = indicesToStringValues(vws.value, element.options)
    widgetMgr.setStringArrayValue(
      element,
      stringValues,
      { fromUi: vws.fromUi },
      fragmentId
    )
  } else {
    // For regular slider, use numeric values directly
    widgetMgr.setDoubleArrayValue(
      element,
      vws.value,
      { fromUi: vws.fromUi },
      fragmentId
    )
  }
}

function isDateTimeType(element: SliderProto): boolean {
  const { dataType } = element
  return (
    dataType === SliderProto.DataType.DATETIME ||
    dataType === SliderProto.DataType.DATE ||
    dataType === SliderProto.DataType.TIME
  )
}

function getMomentKind(element: SliderProto): MomentKind {
  const { dataType } = element
  if (dataType === SliderProto.DataType.DATE) {
    return "date"
  }
  if (dataType === SliderProto.DataType.TIME) {
    return "time"
  }
  return "datetime"
}

function formatValue(value: number, element: SliderProto): string {
  const { format, options } = element

  if (options.length > 0) {
    // select slider does not support format strings, so we just return the option string.
    return options[value] ?? ""
  }

  if (isDateTimeType(element)) {
    // Python datetime uses microseconds, but JS & Moment uses milliseconds
    // The timestamp is always set to the UTC timezone, even so, the actual timezone
    // for this timestamp in the backend could be different.
    // However, the frontend component does not need to know about the actual timezone.
    const momentDate = moment.utc(value / 1000)
    return formatMoment(momentDate, format, getMomentKind(element))
  }

  return formatNumber(value, format)
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
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
  const sliderRect = slider.getBoundingClientRect()
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
  const thumbRect = thumb.getBoundingClientRect()
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
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

  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
  const sliderRect = sliderDiv.getBoundingClientRect()
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
  const thumb1Rect = thumb1Div.getBoundingClientRect()
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
  const thumb2Rect = thumb2Div.getBoundingClientRect()
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
  const thumb1ValueRect = thumb1ValueDiv.getBoundingClientRect()
  // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
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
  // Note: round all values to not have weird decimal pixels (that make our Snapshot tests flaky)
  if (leftAlignedThumb1ValueFitsLeft && rightAlignedThumb2ValueFitsRight) {
    // Align value1 to the left of its thumb.
    thumb1ValueDiv.style.left = ""
    thumb1ValueDiv.style.right = `${Math.round(thumb1Rect.width)}px`

    // Align value2 to the right of its thumb.
    thumb2ValueDiv.style.left = `${Math.round(thumb2Rect.width)}px`
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
    thumb2ValueDiv.style.left = `${Math.round(
      thumb1MidPoint + thumb1ValueOverhang + labelGap - thumb2MidPoint
    )}px`
    thumb2ValueDiv.style.right = ""
  } else {
    fixLabelOverflow(sliderDiv, thumb2Div, thumb2ValueDiv)

    // Make thumb1Value appear to the left of thumb2Value.
    thumb1ValueDiv.style.left = ""
    thumb1ValueDiv.style.right = `${-Math.round(
      thumb2MidPoint - thumb2ValueOverhang - labelGap - thumb1MidPoint
    )}px`
  }
}

interface StylePropsWithChildren extends StyleProps {
  children: React.ReactNode
}

// Note: we shouldn't need `withCalculatedWidth` here, but there is some custom
// ref measurement and style setting logic in this component used for fixing
// overflows that is not properly within the React lifecycle. This leads to race
// conditions in styles being applied outside of React's knowledge, which can
// lead to visually incorrect labels in certain scenarios.
export default withCalculatedWidth(memo(Slider))
