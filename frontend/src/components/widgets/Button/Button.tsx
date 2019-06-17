/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Button as UIButton } from 'reactstrap'
import { Map as ImmutableMap } from 'immutable'
import { PureStreamlitElement, StState } from 'components/shared/StreamlitElement/'

interface Props {
  element: ImmutableMap<string, any>;
  sendBackMsg: (msg: Object) => void;
  width: number;
}

class Button extends PureStreamlitElement<Props, StState> {
  private handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const widgetId = (e.target as HTMLButtonElement).id
    this.props.sendBackMsg({
      type: 'widgetJson',
      widgetJson: JSON.stringify({ [widgetId]: true })
    })
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
