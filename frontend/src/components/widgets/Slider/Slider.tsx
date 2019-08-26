/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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

import React from 'react'
import { Slider as UISlider } from 'baseui/slider'
import { Map as ImmutableMap } from 'immutable'
import { debounce } from 'lib/utils'
import { WidgetStateManager } from 'lib/WidgetStateManager'
import { sliderOverrides } from 'lib/widgetTheme'

interface Props {
  disabled: boolean;
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, it's undefined.
   */
  value?: number[];
}

interface SliderValue {
  value: number[];
}

class Slider extends React.PureComponent<Props, State> {
  private sliderRef = React.createRef<HTMLDivElement>()
  private setWidgetValue: () => void
  public state: State = {}

  public constructor(props: Props) {
    super(props)
    this.setWidgetValue = debounce(200, this.setWidgetValueRaw.bind(this))
  }

  public componentDidMount = () => {
    // Attach click event listener to slider knobs.
    if (this.sliderRef.current) {
      const knobSelector = '[role="slider"]'
      const knobs = this.sliderRef.current.querySelectorAll(knobSelector)
      knobs.forEach(knob => knob.addEventListener('click', this.handleClick))
    }
  }

  public componentWillUnmount = () => {
    // Remove click event listener from slider knobs.
    if (this.sliderRef.current) {
      const knobSelector = '[role="slider"]'
      const knobs = this.sliderRef.current.querySelectorAll(knobSelector)
      knobs.forEach(knob => knob.removeEventListener('click', this.handleClick))
    }
  }

  /**
   * Return the user-entered value, or the widget's default value
   * if the user hasn't interacted with it yet.
   */
  private get valueOrDefault(): number[] {
    const min = this.props.element.get('min')
    const max = this.props.element.get('max')
    const value = this.state.value === undefined
      ? this.props.element.get('value').toArray()
      : this.state.value

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

  private handleClick = (e: Event): void => {
    (e.target as HTMLElement).focus()
  }

  private handleChange = ({ value }: SliderValue): void => {
    this.setState({ value })
    this.setWidgetValue()
  }

  private setWidgetValueRaw(): void {
    if (!this.state.value) {
      throw new Error('Assert error: value is undefined')
    }
    const widgetId = this.props.element.get('id')
    this.props.widgetMgr.setFloatArrayValue(widgetId, this.state.value)
  }

  public render(): React.ReactNode {
    const { element, width } = this.props
    const label = element.get('label')
    const min = element.get('min')
    const max = element.get('max')
    const step = element.get('step')
    const style = { width }

    return (
      <div ref={this.sliderRef} className="Widget stSlider" style={style}>
        <label>{label}</label>
        <UISlider
          min={min}
          max={max}
          step={step}
          value={this.valueOrDefault}
          onChange={this.handleChange}
          disabled={this.props.disabled}
          overrides={sliderOverrides}
        />
      </div>
    )
  }
}

export default Slider
