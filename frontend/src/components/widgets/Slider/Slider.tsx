/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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
import { Slider as UISlider } from "baseui/slider"
import { withTheme } from "emotion-theming"
import { sprintf } from "sprintf-js"
import { WidgetStateManager, Source } from "lib/WidgetStateManager"
import { Slider as SliderProto } from "autogen/proto"
import { debounce } from "lib/utils"
import moment from "moment"
import { StyledWidgetLabel } from "components/widgets/BaseWidget"
import { transparentize } from "color2k"
import { Theme } from "theme"
import {
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
    const storedValue = this.props.widgetMgr.getDoubleArrayValue(
      this.props.element
    )
    return storedValue !== undefined ? storedValue : this.props.element.default
  }

  public componentDidMount = (): void => {
    // Attach click event listener to slider knobs.
    this.getAllSliderRoles().forEach((knob, index) => {
      knob.addEventListener("click", this.handleClick)
      this.setAriaValueText(knob, index)
    })
    this.setWidgetValueImmediately({ fromUi: false })
  }

  public componentDidUpdate = (): void => {
    this.getAllSliderRoles().forEach((knob, index) => {
      this.setAriaValueText(knob, index)
    })
  }

  public componentWillUnmount = (): void => {
    // Remove click event listener from slider knobs.
    this.getAllSliderRoles().forEach(knob => {
      knob.removeEventListener("click", this.handleClick)
    })
  }

  private setWidgetValueImmediately = (source: Source): void => {
    this.props.widgetMgr.setDoubleArrayValue(
      this.props.element,
      this.state.value,
      source
    )
  }

  private getAllSliderRoles = (): Element[] => {
    if (!this.sliderRef.current) {
      return []
    }

    const knobSelector = '[role="slider"]'
    const knobs = this.sliderRef.current.querySelectorAll(knobSelector)

    return Array.from(knobs)
  }

  private setAriaValueText = (sliderRoleRef: Element, index: number): void => {
    // Setting `aria-valuetext` helps screen readers read options and dates
    const { options } = this.props.element
    if (options.length > 0 || this.isDateTimeType()) {
      const { value } = this
      if (index < value.length) {
        sliderRoleRef.setAttribute(
          "aria-valuetext",
          this.formatValue(value[index])
        )
      }
    }
  }

  private handleChange = ({ value }: { value: number[] }): void => {
    this.setState({ value }, () =>
      this.setWidgetValueDebounced({ fromUi: true })
    )
  }

  private handleClick = (e: Event): void => {
    const knob = e.target as HTMLElement
    knob.focus()
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

  private renderThumbValue = (data: {
    $thumbIndex: number
    $value: any
  }): JSX.Element => (
    <StyledThumbValue
      data-testid="stThumbValue"
      isDisabled={this.props.disabled}
    >
      {this.formatValue(data.$value[data.$thumbIndex])}
    </StyledThumbValue>
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
    const { colors, fonts, fontSizes, radii } = theme
    const style = { width }

    return (
      <div ref={this.sliderRef} className="stSlider" style={style}>
        <StyledWidgetLabel>{element.label}</StyledWidgetLabel>
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
            Thumb: {
              style: ({ $disabled }: { $disabled: boolean }) => ({
                backgroundColor: $disabled ? colors.gray : colors.primary,
                borderTopLeftRadius: "100%",
                borderTopRightRadius: "100%",
                borderBottomLeftRadius: "100%",
                borderBottomRightRadius: "100%",
                borderTopStyle: "none",
                borderBottomStyle: "none",
                borderRightStyle: "none",
                borderLeftStyle: "none",
                boxShadow: "none",
                height: radii.xl,
                width: radii.xl,
                ":focus": {
                  boxShadow: `0 0 0 0.2rem ${transparentize(
                    colors.primary,
                    0.5
                  )}`,
                  outline: "none",
                },
              }),
            },
            InnerThumb: {
              style: {
                display: "none",
              },
            },
            Tick: {
              style: {
                fontFamily: fonts.mono,
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
              style: ({ $disabled }: { $disabled: boolean }) =>
                $disabled ? { background: colors.lightGray } : {},
            },
            ThumbValue: this.renderThumbValue,
            TickBar: this.renderTickBar,
          }}
        />
      </div>
    )
  }
}

export default withTheme(Slider)
