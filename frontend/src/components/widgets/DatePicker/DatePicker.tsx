/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Datepicker as UIDatePicker } from 'baseui/datepicker'
import { Map as ImmutableMap } from 'immutable'
import moment from 'moment'
import { WidgetStateManager } from 'lib/WidgetStateManager'

interface Props {
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

interface State {
  value: Date;
}

class DatePicker extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    const widgetId = this.props.element.get('id')
    const value = this.props.element.get('value')

    this.state = {
      value: moment(value, 'YYYY/MM/DD').toDate(),
    }
    this.props.widgetMgr.setStringValue(widgetId, value)
  }

  private dateToString = (date: Date): string => {
    return moment(date).format('YYYY/MM/DD')
  }

  private handleChange = (e: any): void => {
    const widgetId = this.props.element.get('id')

    this.setState({ value: e.date })
    this.props.widgetMgr.setStringValue(widgetId, this.dateToString(e.date))
    this.props.widgetMgr.sendUpdateWidgetsMessage()
  }

  public render(): React.ReactNode {
    const label = this.props.element.get('label')
    const style = { width: this.props.width }

    return (
      <div className="Widget stDate" style={style}>
        <p className="label">{label}</p>
        <UIDatePicker
          formatString="yyyy/MM/dd"
          value={this.state.value}
          onChange={this.handleChange}
        />
      </div>
    )
  }
}

export default DatePicker
