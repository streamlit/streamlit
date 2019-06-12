/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import {Button as UIButton} from 'reactstrap'
import {Map as ImmutableMap} from 'immutable'
import {PureStreamlitElement, StState} from 'components/shared/StreamlitElement/'

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

class Button extends PureStreamlitElement<Props, State> {
  public constructor(props: Props) {
    super(props)

    const {element} = this.props
    const value = false

    this.state = { value }
    this.props.setWidgetState(element.get('id'), value)
  }

  private handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLButtonElement
    this.props.setWidgetState(target.id, true, () => {
      this.props.sendBackMsg({
        type: 'widgetJson',
        widgetJson: JSON.stringify(this.props.getWidgetState())
      })
      this.props.setWidgetState(target.id, false)
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
      // @ts-ignore
      <div className="Widget row-widget stButton">
        <UIButton id={id} style={style} onClick={this.handleClick}>
          { label }
        </UIButton>
      </div>
    )
  }
}

export default Button
