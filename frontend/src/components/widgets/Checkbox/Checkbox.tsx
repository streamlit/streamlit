/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
// @ts-ignore
import { Checkbox as UICheckbox } from 'baseui/checkbox';
import { Map as ImmutableMap } from 'immutable'
import { PureStreamlitElement, StState } from 'components/shared/StreamlitElement/'

interface Props {
  element: ImmutableMap<string, any>;
  sendBackMsg: (msg: Object) => void;
  width: number;
}

interface State extends StState {
  value: boolean;
}

class Checkbox extends PureStreamlitElement<Props, State> {
  private widgetId: string

  public constructor(props: Props) {
    super(props)

    // Re-review the setting of the widget Id.
    // Compare with the Button which does things differently
    this.widgetId = this.props.element.get('id')
    console.log(this.widgetId)
    this.state = { value: this.props.element.get('value') }
  }

  private handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked

    this.setState({ value })
    this.props.sendBackMsg({
      type: 'widgetJson',
      widgetJson: JSON.stringify({ [this.widgetId]: value })
    })
  }

  public safeRender(): React.ReactNode {
    const label = this.props.element.get('label')
    const style = { width: this.props.width }

    return (
      <div className="Widget row-widget stCheckbox" style={style}>
        <UICheckbox checked={this.state.value} onChange={this.handleChange}>
          {label}
        </UICheckbox>
      </div>
    )
  }
}

export default Checkbox
