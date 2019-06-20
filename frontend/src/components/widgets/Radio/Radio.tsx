/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
// @ts-ignore
import { Radio as UIRadio, RadioGroup } from 'baseui/radio';
import { Map as ImmutableMap } from 'immutable'
import { PureStreamlitElement, StState } from 'components/shared/StreamlitElement/'

interface Props {
  element: ImmutableMap<string, any>;
  sendBackMsg: (msg: Object) => void;
  width: number;
}

interface State extends StState {
  value: any;
}

class Radio extends PureStreamlitElement<Props, State> {
  public constructor(props: Props) {
    super(props)
    this.state = { value: this.props.element.get('value') }
  }

  private onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const widgetId = this.props.element.get('id')

    this.setState({ value })

    this.props.sendBackMsg({
      type: 'widgetJson',
      widgetJson: JSON.stringify({ [widgetId]: value })
    })
  }

  public safeRender(): React.ReactNode {
    const label = this.props.element.get('label')
    const options = this.props.element.get('options')
    const style = { width: this.props.width }

    return (
      <div className="Widget row-widget stRadio" style={style}>
        <RadioGroup
          name={label}
          onChange={this.onChange}
          value={this.state.value}
        >
          {options.map((opt: ImmutableMap<string, any>, idx: string) => (
            <UIRadio key={idx} value={opt.get('key')}>{opt.get('value')}</UIRadio>
          ))}
        </RadioGroup>
      </div>
    )
  }
}

export default Radio
