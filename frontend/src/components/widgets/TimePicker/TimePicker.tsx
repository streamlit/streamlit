/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { TimePicker as UITimePicker } from 'baseui/datepicker'
import { Map as ImmutableMap } from 'immutable'
import { WidgetStateManager } from 'lib/WidgetStateManager'

interface Props {
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

interface State {
  value: Date;
}

class TimePicker extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    const widgetId = this.props.element.get('id')
    const value = this.props.element.get('value')

    this.state = {
      value: this.stringToDate(value),
    }
    this.props.widgetMgr.setStringValue(widgetId, value)
  }

  private stringToDate = (value: string): Date => {
    const [hours, minutes] = value.split(':').map(Number)
    const date = new Date()
    date.setHours(hours)
    date.setMinutes(minutes)
    return date
  }

  private dateToString = (value: Date): string => {
    const hours = value.getHours().toString().padStart(2, '0')
    const minutes = value.getMinutes().toString().padStart(2, '0')
    return hours + ':' + minutes
  }

  private handleChange = (value: Date): void => {
    const widgetId = this.props.element.get('id')

    this.setState({ value })
    this.props.widgetMgr.setStringValue(widgetId, this.dateToString(value))
    this.props.widgetMgr.sendUpdateWidgetsMessage()
  }

  public render(): React.ReactNode {
    const label = this.props.element.get('label')
    const style = { width: this.props.width }

    return (
      <div className="Widget stTime" style={style}>
        <p className="label">{label}</p>
        <UITimePicker
          format="24"
          value={this.state.value}
          onChange={this.handleChange}
        />
      </div>
    )
  }
}

export default TimePicker
