/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Checkbox as UICheckbox } from 'baseui/checkbox'
import { Map as ImmutableMap } from 'immutable'
import { WidgetStateManager } from 'lib/WidgetStateManager'
import { PureStreamlitElement, StState } from 'components/shared/StreamlitElement/'

interface Props {
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

interface State extends StState {
  value: boolean;
}

class Checkbox extends PureStreamlitElement<Props, State> {
  public constructor(props: Props) {
    super(props)

    const widgetId = this.props.element.get('id')
    const value = this.props.element.get('value')

    this.state = { value }
    this.props.widgetMgr.setBoolValue(widgetId, value)
  }

  private handleChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const widgetId = this.props.element.get('id')
    const value = (e.target as HTMLInputElement).checked

    this.setState({ value })
    this.props.widgetMgr.setBoolValue(widgetId, value)
    this.props.widgetMgr.sendUpdateWidgetsMessage()
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
