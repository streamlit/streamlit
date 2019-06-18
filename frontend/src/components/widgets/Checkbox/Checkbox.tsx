/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Input, Label } from 'reactstrap'
import { Map as ImmutableMap } from 'immutable'
import { PureStreamlitElement, StState } from 'components/shared/StreamlitElement/'
import './Checkbox.scss'

interface Props {
  element: ImmutableMap<string, any>;
  sendBackMsg: (msg: Object) => void;
  width: number;
}

interface State extends StState {
  value: boolean;
}

class Checkbox extends PureStreamlitElement<Props, State> {
  public constructor(props: Props) {
    super(props)

    const value = this.props.element.get('value')
    this.state = { value }
  }

  private handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const widgetId = e.target.id
    const value = e.target.checked

    this.setState({ value })
    this.props.sendBackMsg({
      type: 'widgetJson',
      widgetJson: JSON.stringify({ [widgetId]: value })
    })
  }

  public safeRender(): React.ReactNode {
    const widgetId = this.props.element.get('id')
    const label = this.props.element.get('label')
    const style = { width: this.props.width }

    return (
      <div className="Widget row-widget stCheckbox">
        <Label style={style} check>
          <Input
            type="checkbox"
            id={widgetId}
            checked={this.state.value}
            onChange={this.handleChange}
          />
          <span className="label">{label}</span>
        </Label>
      </div>
    )
  }
}

export default Checkbox
