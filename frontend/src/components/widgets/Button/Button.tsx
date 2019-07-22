/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Button as UIButton } from 'baseui/button'
import { Map as ImmutableMap } from 'immutable'
import { WidgetStateManager } from 'lib/WidgetStateManager'
import { buttonOverrides } from 'lib/widgetTheme'

interface Props {
  disabled: boolean;
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

class Button extends React.PureComponent<Props> {
  private handleClick = () => {
    const widgetId = this.props.element.get('id')
    this.props.widgetMgr.setTriggerValue(widgetId)
  }

  public render(): React.ReactNode {
    const label = this.props.element.get('label')
    const style = { width: this.props.width }

    return (
      <div className="Widget row-widget stButton" style={style}>
        {/*
        // @ts-ignore */}
        <UIButton overrides={buttonOverrides}
          onClick={this.handleClick}
          disabled={this.props.disabled}
        >
          {label}
        </UIButton>
      </div>
    )
  }
}

export default Button
