/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { pick } from "lodash"
import { SharedProps, Slider as UISlider } from "baseui/slider"
import { withTheme } from "emotion-theming"
import { sprintf } from "sprintf-js"
import { WidgetStateManager, Source } from "src/lib/WidgetStateManager"
import { Slider as SliderProto } from "src/autogen/proto"
import { debounce } from "src/lib/utils"
import moment from "moment"
import {
  StyledWidgetLabel,
  StyledWidgetLabelHelp,
} from "src/components/widgets/BaseWidget"
import TooltipIcon from "src/components/shared/TooltipIcon"
import { Placement } from "src/components/shared/Tooltip"
import { Theme } from "src/theme"
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
  theme: Theme
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
  public state: State

  private sliderRef = React.createRef<HTMLDivElement>()

  private readonly setWidgetValueDebounced: (source: Source) => void

  public constructor(props: Props) {
    super(props)
    this.setWidgetValueDebounced = debounce(
      DEBOUNCE_TIME_MS,
      this.setWidgetValueImmediately.bind(this)
    )
    this.state = { value: this.initialValue }
  }

  get initialValue(): number[] {
    const widgetId = this.props.element.id
    const storedValue = this.props.widgetMgr.getDoubleArrayValue(widgetId)
    return storedValue !== undefined ? storedValue : this.props.element.default
  }

  public componentDidMount = (): void => {
    this.setWidgetValueImmediately({ fromUi: false })
  }

  private setWidgetValueImmediately = (source: Source): void => {
    const widgetId = this.props.element.id
    this.props.widgetMgr.setDoubleArrayValue(
      widgetId,
      this.state.value,
      source
    )
  }

  private handleChange = ({ value }: { value: number[] }): void => {
    this.setState({ value }, () =>
      this.setWidgetValueDebounced({ fromUi: true })
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
      return moment(value / 1000).format(format)
    }

    if (options.length > 0) {
      return sprintf(format, options[value])
    }

    return sprintf(format, value)
  }

  // eslint-disable-next-line react/display-name
  private renderThumb = React.forwardRef<HTMLDivElement, SharedProps>(
    (props: SharedProps, ref): JSX.Element => {
      const { $value, $thumbIndex } = props
      const formattedValue = this.formatValue($value[$thumbIndex])
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
          isDisabled={props.$disabled}
          ref={ref}
          aria-valuetext={formattedValue}
        >
          <StyledThumbValue
            data-testid="stThumbValue"
            isDisabled={props.$disabled}
          >
            {formattedValue}
          </StyledThumbValue>
        </StyledThumb>
      )
    }
  )

  private renderTickBar = (): JSX.Element => {
    const { max, min } = this.props.element

    return (
      <StyledTickBar data-testid="stTickBar">
        <StyledTickBarItem data-testid="stTickBarMin">
          {this.formatValue(min)}
        </StyledTickBarItem>
        <StyledTickBarItem data-testid="stTickBarMax">
          {this.formatValue(max)}
        </StyledTickBarItem>
      </StyledTickBar>
    )
  }

  public render = (): React.ReactNode => {
    const { disabled, element, theme, width } = this.props
    const { colors, fonts, fontSizes } = theme
    const style = { width }

    return (
      <div ref={this.sliderRef} className="stSlider" style={style}>
        <StyledWidgetLabel>{element.label}</StyledWidgetLabel>
        {element.help && (
          <StyledWidgetLabelHelp>
            <TooltipIcon
              content={element.help}
              placement={Placement.TOP_RIGHT}
            />
          </StyledWidgetLabelHelp>
        )}
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
                paddingTop: fontSizes.twoThirdSmDefault,
              },
            },
            Thumb: this.renderThumb,
            Tick: {
              style: {
                fontFamily: fonts.monospace,
                fontSize: fontSizes.smDefault,
              },
            },
            Track: {
              style: {
                paddingBottom: 0,
                paddingLeft: 0,
                paddingRight: 0,
                paddingTop: fontSizes.twoThirdSmDefault,
              },
            },
            InnerTrack: {
              style: ({ $disabled }: SharedProps) => ({
                height: "4px",
                ...($disabled
                  ? { background: colors.transparentDarkenedBgMix60 }
                  : {}),
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
