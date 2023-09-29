/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React from "react"
import { pick } from "lodash"
import { StyleProps, Slider as UISlider } from "baseui/slider"
import { withTheme } from "@emotion/react"
import { sprintf } from "sprintf-js"
import { FormClearHelper } from "@streamlit/lib/src/components/widgets/Form"
import {
  WidgetStateManager,
  Source,
} from "@streamlit/lib/src/WidgetStateManager"
import { Slider as SliderProto } from "@streamlit/lib/src/proto"
import {
  debounce,
  labelVisibilityProtoValueToEnum,
} from "@streamlit/lib/src/util/utils"
import moment from "moment"
import {
  WidgetLabel,
  StyledWidgetLabelHelp,
} from "@streamlit/lib/src/components/widgets/BaseWidget"
import TooltipIcon from "@streamlit/lib/src/components/shared/TooltipIcon"
import { Placement } from "@streamlit/lib/src/components/shared/Tooltip"
import { EmotionTheme } from "@streamlit/lib/src/theme"
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
  theme: EmotionTheme
  widgetMgr: WidgetStateManager
  width: number
}

interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: number[]
}

class Slider extends React.PureComponent<Props, State> {
  private readonly formClearHelper = new FormClearHelper()

  public state: State

  private sliderRef = React.createRef<HTMLDivElement>()

  private thumbRef: React.MutableRefObject<HTMLDivElement>[] = []

  private thumbValueRef: React.RefObject<HTMLDivElement>[] = []

  private readonly commitWidgetValueDebounced: (source: Source) => void

  public constructor(props: Props) {
    super(props)
    this.commitWidgetValueDebounced = debounce(
      DEBOUNCE_TIME_MS,
      this.commitWidgetValue.bind(this)
    )
    this.state = { value: this.initialValue }
  }

  get initialValue(): number[] {
    const storedValue = this.props.widgetMgr.getDoubleArrayValue(
      this.props.element
    )
    return storedValue !== undefined ? storedValue : this.props.element.default
  }

  public componentDidMount(): void {
    // Check thumb value's alignment vs. slider container
    // Delay the alignment to allow the page layout to complete
    setTimeout(() => {
      this.thumbValueAlignment()
    }, 0)

    if (this.props.element.setValue) {
      this.updateFromProtobuf()
    } else {
      this.commitWidgetValue({ fromUi: false })
    }
  }

  public componentDidUpdate(): void {
    this.maybeUpdateFromProtobuf()
  }

  public componentWillUnmount(): void {
    this.formClearHelper.disconnect()
  }

  private maybeUpdateFromProtobuf(): void {
    const { setValue } = this.props.element
    if (setValue) {
      this.updateFromProtobuf()
    }
  }

  private updateFromProtobuf(): void {
    const { value } = this.props.element
    this.props.element.setValue = false
    this.setState({ value }, () => {
      this.commitWidgetValue({ fromUi: false })
    })
  }

  /** Commit state.value to the WidgetStateManager. */
  private commitWidgetValue = (source: Source): void => {
    this.props.widgetMgr.setDoubleArrayValue(
      this.props.element,
      this.state.value,
      source
    )
  }

  /**
   * If we're part of a clear_on_submit form, this will be called when our
   * form is submitted. Restore our default value and update the WidgetManager.
   */
  private onFormCleared = (): void => {
    this.setState(
      (_, prevProps) => {
        return { value: prevProps.element.default }
      },
      () => this.commitWidgetValue({ fromUi: true })
    )
  }

  private handleChange = ({ value }: { value: number[] }): void => {
    this.setState({ value }, () =>
      this.commitWidgetValueDebounced({ fromUi: true })
    )
  }

  /**
   * Return the value of the slider. This will either be an array with
   * one value (for a single value slider), or an array with two
   * values (for a range slider).
   */
  private get value(): number[] {
    const { min, max } = this.props.element
    const { value } = this.state
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

  private isDateTimeType(): boolean {
    const { dataType } = this.props.element
    return (
      dataType === SliderProto.DataType.DATETIME ||
      dataType === SliderProto.DataType.DATE ||
      dataType === SliderProto.DataType.TIME
    )
  }

  private formatValue(value: number): string {
    const { format, options } = this.props.element
    if (this.isDateTimeType()) {
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

  private alignValueOnThumb(
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

  private thumbValueAlignment(): void {
    const sliderDiv = this.sliderRef.current
    const thumb1Div = this.thumbRef[0]?.current
    const thumb2Div = this.thumbRef[1]?.current
    const thumb1ValueDiv = this.thumbValueRef[0]?.current
    const thumb2ValueDiv = this.thumbValueRef[1]?.current
    // Minimum gap between thumb values (in px)
    const labelGap = 16

    // Handles label alignment over each thumb
    this.alignValueOnThumb(sliderDiv, thumb1Div, thumb1ValueDiv)
    this.alignValueOnThumb(sliderDiv, thumb2Div, thumb2ValueDiv)

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
  }

  // eslint-disable-next-line react/display-name
  private renderThumb = React.forwardRef<HTMLDivElement, StyleProps>(
    (props: StyleProps, ref): JSX.Element => {
      const { $value, $thumbIndex } = props
      const thumbIndex = $thumbIndex || 0
      this.thumbRef[thumbIndex] = ref as React.MutableRefObject<HTMLDivElement>
      this.thumbValueRef[thumbIndex] ||= React.createRef<HTMLDivElement>()

      const formattedValue = $value
        ? this.formatValue($value[$thumbIndex as number])
        : ""
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
      const ariaValueText: Record<string, string> = {}

      if (this.props.element.options.length > 0 || this.isDateTimeType()) {
        ariaValueText["aria-valuetext"] = formattedValue
      }

      return (
        <StyledThumb
          {...passThrough}
          disabled={props.$disabled === true}
          ref={this.thumbRef[thumbIndex]}
          aria-valuetext={formattedValue}
          aria-label={this.props.element.label}
        >
          <StyledThumbValue
            className="StyledThumbValue"
            data-testid="stThumbValue"
            disabled={props.$disabled === true}
            ref={this.thumbValueRef[thumbIndex]}
          >
            {formattedValue}
          </StyledThumbValue>
        </StyledThumb>
      )
    }
  )

  private renderTickBar = (): JSX.Element => {
    const { disabled, element } = this.props
    const { max, min } = element

    return (
      <StyledTickBar data-testid="stTickBar">
        <StyledTickBarItem disabled={disabled} data-testid="stTickBarMin">
          {this.formatValue(min)}
        </StyledTickBarItem>
        <StyledTickBarItem disabled={disabled} data-testid="stTickBarMax">
          {this.formatValue(max)}
        </StyledTickBarItem>
      </StyledTickBar>
    )
  }

  public render(): React.ReactNode {
    const { disabled, element, theme, width, widgetMgr } = this.props
    const { colors, fonts, fontSizes, spacing } = theme
    const style = { width }

    // Manage our form-clear event handler.
    this.formClearHelper.manageFormClearListener(
      widgetMgr,
      element.formId,
      this.onFormCleared
    )

    // Check the thumb value's alignment vs. slider container
    this.thumbValueAlignment()

    return (
      <div ref={this.sliderRef} className="stSlider" style={style}>
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
          value={this.value}
          onChange={this.handleChange}
          disabled={disabled}
          overrides={{
            Root: {
              style: {
                paddingTop: spacing.twoThirdsSmFont,
              },
            },
            Thumb: this.renderThumb,
            Tick: {
              style: {
                fontFamily: fonts.monospace,
                fontSize: fontSizes.sm,
              },
            },
            Track: {
              style: {
                backgroundColor: "none !important",
                paddingBottom: 0,
                paddingLeft: 0,
                paddingRight: 0,
                paddingTop: spacing.twoThirdsSmFont,
              },
            },
            InnerTrack: {
              style: ({ $disabled }: StyleProps) => ({
                height: "4px",
                ...($disabled ? { background: colors.darkenedBgMix25 } : {}),
              }),
            },
            TickBar: this.renderTickBar,
          }}
        />
      </div>
    )
  }
}

export default withTheme(Slider)
