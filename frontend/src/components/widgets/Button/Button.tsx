/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Button as UIButton } from 'baseui/button'
import { Map as ImmutableMap } from 'immutable'
import { WidgetStateManager } from 'lib/WidgetStateManager'
import { PureStreamlitElement, StState } from 'components/shared/StreamlitElement/'

interface Props {
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

class Button extends PureStreamlitElement<Props, StState> {
  private handleClick = (e: React.SyntheticEvent<HTMLButtonElement>) => {
    const widgetId = this.props.element.get('id')

    this.props.widgetMgr.setTriggerValue(widgetId, true)
    this.props.widgetMgr.sendUpdateWidgetsMessage()
  }

  public safeRender(): React.ReactNode {
    const label = this.props.element.get('label')
    const style = { width: this.props.width }

    return (
      <div className="Widget row-widget stButton" style={style}>
        <UIButton onClick={this.handleClick}>
          {label}
        </UIButton>
      </div>
    )
  }
}

export default Button
