/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Slider as UISlider } from 'baseui/slider'
import { Map as ImmutableMap } from 'immutable'
import { debounce } from 'lib/util'
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
  public state: State = {}
  private setWidgetValue: () => void

  public constructor(props: Props) {
    super(props)
    this.setWidgetValue = debounce(200, this.setWidgetValueRaw.bind(this))
  }

  /**
   * Return the user-entered value, or the widget's default value
   * if the user hasn't interacted with it yet.
   */
  private get valueOrDefault(): number[] {
    if (this.state.value === undefined) {
      return this.props.element.get('value').toArray()
    } else {
      return this.state.value
    }
  }

  private handleChange = ({ value }: SliderValue) => {
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
      <div className="Widget stSlider" style={style}>
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
