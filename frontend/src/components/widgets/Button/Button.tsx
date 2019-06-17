/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Button as UIButton } from 'reactstrap'
import { Map as ImmutableMap } from 'immutable'
import { PureStreamlitElement, StState } from 'components/shared/StreamlitElement/'
import { WidgetState } from 'components/core/ReportView/'

interface Props {
  element: ImmutableMap<string, any>;
  getWidgetState: () => WidgetState;
  sendBackMsg: (msg: Object) => void;
  setWidgetState: (key: string, value: any) => void;
  width: number;
}

class Button extends PureStreamlitElement<Props, StState> {
  public constructor(props: Props) {
    super(props)

    const widgetId = this.props.element.get('id')
    const value = false
    this.props.setWidgetState(widgetId, value)
  }

  private handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLButtonElement
    this.props.setWidgetState(target.id, true)
    this.props.sendBackMsg({
      type: 'widgetJson',
      widgetJson: JSON.stringify(this.props.getWidgetState())
    })
    this.props.setWidgetState(target.id, false)
  }

  public safeRender(): React.ReactNode {
    const widgetId = this.props.element.get('id')
    const label = this.props.element.get('label')
    const style = { width: this.props.width }

    return (
      <div className="Widget row-widget stButton">
        <UIButton id={widgetId} style={style} onClick={this.handleClick}>
          {label}
        </UIButton>
      </div>
    )
  }
}

export default Button
