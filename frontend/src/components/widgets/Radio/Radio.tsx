/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Radio as UIRadio, RadioGroup } from 'baseui/radio'
import { Map as ImmutableMap } from 'immutable'
import { WidgetStateManager } from 'lib/WidgetStateManager'
import { radioOverrides } from 'lib/widgetTheme'

interface Props {
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

interface State {
  value: string;
}

class Radio extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    const widgetId = this.props.element.get('id')
    const value = this.props.element.get('value')

    this.state = { value: value.toString() }
    this.props.widgetMgr.setIntValue(widgetId, value)
  }

  private onChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const value = (e.target as HTMLInputElement).value
    const widgetId = this.props.element.get('id')

    this.setState({ value })
    this.props.widgetMgr.setIntValue(widgetId, parseInt(value, 10))
    this.props.widgetMgr.sendUpdateWidgetsMessage()
  }

  public render(): React.ReactNode {
    const label = this.props.element.get('label')
    const options = this.props.element.get('options')
    const style = { width: this.props.width }

    return (
      <div className="Widget row-widget stRadio" style={style}>
        <label>{label}</label>
        <RadioGroup
          onChange={this.onChange}
          value={this.state.value}
          overrides={radioOverrides}
        >
          {options.map((option: string, idx: number) => (
            <UIRadio key={idx} value={idx.toString()}>{option}</UIRadio>
          ))}
        </RadioGroup>
      </div>
    )
  }
}

export default Radio
