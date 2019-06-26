/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Input as UIInput } from 'baseui/input'
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

class Input extends PureStreamlitElement<Props, State> {
  public constructor(props: Props) {
    super(props)

    const widgetId = this.props.element.get('id')
    const value = this.props.element.get('value')

    // TODO should we set the value to the state even if it's undefined?
    this.state = { value }
    if (value) {
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
    const style = { width: this.props.width }

    return (
      <div className="Widget row-widget stInput" style={style}>
        <UIInput onChange={this.onChange} value={this.state.value}>
          {label}
        </UIInput>
      </div>
    )
  }
}

export default Input
