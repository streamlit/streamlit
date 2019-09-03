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
import { Map as ImmutableMap, List } from 'immutable'
import { WidgetStateManager } from 'lib/WidgetStateManager'
import { sliderOverrides } from 'lib/widgetTheme'
import { debounce } from 'lib/utils'

interface Props {
  disabled: boolean;
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, the default value is used.
   */
  value: number[];
}

class Slider extends React.PureComponent<Props, State> {
  private sliderRef = React.createRef<HTMLDivElement>()
  private setWidgetValue: () => void
  public state: State = {
    value: this.props.element.get('default').toJS()
  }

  public constructor(props: Props) {
    super(props)
    this.setWidgetValue = debounce(200, this.setWidgetValueRaw.bind(this))
  }

  public componentDidUpdate = (prevProps: Props): void => {
    // Reset the widget state when the default value changes
    const oldDefaultValue: List<number> = prevProps.element.get('default')
    const newDefaultValue: List<number> = this.props.element.get('default')
    if (!oldDefaultValue.equals(newDefaultValue)) {
      this.setState({ value: newDefaultValue.toJS() }, this.setWidgetValue)
    }
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

  private setWidgetValueRaw = (): void => {
    const widgetId: string = this.props.element.get('id')
    this.props.widgetMgr.setFloatArrayValue(widgetId, this.state.value)
  }

  private handleChange = ({ value }: { value: number[] }): void => {
    this.setState({ value }, this.setWidgetValue)
  }

  private handleClick = (e: Event): void => {
    (e.target as HTMLElement).focus()
  }

  private get value(): number[] {
    const min = this.props.element.get('min')
    const max = this.props.element.get('max')
    const value = this.state.value
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

  public render = (): React.ReactNode => {
    const style = { width: this.props.width }
    const label = this.props.element.get('label')
    const min = this.props.element.get('min')
    const max = this.props.element.get('max')
    const step = this.props.element.get('step')

    return (
      <div ref={this.sliderRef} className="Widget stSlider" style={style}>
        <label>{label}</label>
        <UISlider
          min={min}
          max={max}
          step={step}
          value={this.value}
          onChange={this.handleChange}
          disabled={this.props.disabled}
          overrides={sliderOverrides}
        />
      </div>
    )
  }
}

export default Slider
