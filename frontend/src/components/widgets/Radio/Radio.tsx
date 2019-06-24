/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Radio as UIRadio, RadioGroup } from 'baseui/radio';
import { Map as ImmutableMap } from 'immutable'
import { WidgetStateManager } from 'lib/WidgetStateManager'
import { PureStreamlitElement, StState } from 'components/shared/StreamlitElement/'

interface Props {
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

interface State extends StState {
  value: any;
}

class Radio extends PureStreamlitElement<Props, State> {
  public constructor(props: Props) {
    super(props)

    const widgetId = this.props.element.get('id')
    const value = this.props.element.get('value')

    this.state = { value }
    if (value){
      this.props.widgetMgr.setStringValue(widgetId, value)
    }
  }

  private onChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const value = (e.target as HTMLInputElement).value
    const widgetId = this.props.element.get('id')

    this.setState({ value })
    this.props.widgetMgr.setStringValue(widgetId, value)
    this.props.widgetMgr.sendUpdateWidgetsMessage()
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
