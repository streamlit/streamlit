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
  value: number[];
}

interface SliderValue {
  value: number[];
}

class Slider extends React.PureComponent<Props, State> {
  private sendUpdateWidgetsMessage: any

  public constructor(props: Props) {
    super(props)

    const { element, widgetMgr } = props
    const widgetId = element.get('id')
    const value = element.get('value').toArray()

    this.sendUpdateWidgetsMessage = debounce(200,
      widgetMgr.sendUpdateWidgetsMessage.bind(widgetMgr))

    this.state = { value }
    widgetMgr.setFloatArrayValue(widgetId, value)
  }

  private handleChange = ({ value }: SliderValue) => {
    const widgetId = this.props.element.get('id')

    this.setState({ value })
    this.props.widgetMgr.setFloatArrayValue(widgetId, value)
    this.sendUpdateWidgetsMessage()
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
          value={this.state.value}
          onChange={this.handleChange}
          disabled={this.props.disabled}
          overrides={sliderOverrides}
        />
      </div>
    )
  }
}

export default Slider
