/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import {Input, Label} from 'reactstrap'
import {Map as ImmutableMap} from 'immutable'
import {dispatchOneOf} from 'lib/immutableProto'
import {PureStreamlitElement, StState} from 'components/shared/StreamlitElement/'
import './Checkbox.scss'

interface Props {
  element: ImmutableMap<string, any>;
  getWidgetState: Function;
  sendBackMsg: Function;
  setWidgetState: Function;
  width: number;
}

interface State extends StState {
  value: any;
}

class Checkbox extends PureStreamlitElement<Props, State> {
  public constructor(props: Props) {
    super(props)

    const {element} = this.props
    const value = element.get('checkbox').get('value')

    this.state = { value }
    this.props.setWidgetState(element.get('id'), value)
  }

  private handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentValue = e.target.checked
    const id = e.target.id

    this.setState({ value: currentValue })
    this.props.setWidgetState(id, currentValue, () => {
      this.props.sendBackMsg({
        type: 'widgetJson',
        widgetJson: JSON.stringify(this.props.getWidgetState())
      })
    })
  }

  public safeRender(): React.ReactNode {
    const {element} = this.props
    const label = element.get('label')
    const id = element.get('id')

    const style = {
      width: this.props.width,
    }

    return (
      <div className="Widget row-widget stCheckbox">
        <Label style={style} check>
          <Input
            type="checkbox"
            id={id}
            checked={this.state.value}
            onChange={this.handleChange}
          />
          <span className="label">{ label }</span>
        </Label>
      </div>
    )
  }
}

export default Checkbox
