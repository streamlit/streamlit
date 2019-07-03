/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Select as UISelect } from 'baseui/select'
import { Map as ImmutableMap } from 'immutable'
import { WidgetStateManager } from 'lib/WidgetStateManager'

interface Props {
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

interface State {
  value: { value: string; label: string }[];
}

class Selectbox extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    const widgetId = this.props.element.get('id')
    const valueId = this.props.element.get('value')

    const value = [{
      'value': valueId.toString(),
      'label': this.props.element.get('options')[valueId],
    }]

    this.state = { value }
    this.props.widgetMgr.setIntValue(widgetId, valueId)
  }

  private onChange = (data: any) => {
    const widgetId = this.props.element.get('id')
    const value = data['value']
    const valueId = value[0]['value']

    this.setState({ value })
    this.props.widgetMgr.setIntValue(widgetId, parseInt(valueId, 10))
    this.props.widgetMgr.sendUpdateWidgetsMessage()
  }

  public render(): React.ReactNode {
    const label = this.props.element.get('label')
    const options = this.props.element.get('options')
    const style = { width: this.props.width }

    let selectOptions: { value: string; label: string }[] = []
    options.forEach((option: string, idx: number) => (
      selectOptions.push({
        'label': option,
        'value': idx.toString(),
      })
    ))

    return (
      <div className="Widget row-widget stSelectbox" style={style}>
        <label>{label}</label>
        <UISelect
          options={selectOptions}
          labelKey="label"
          valueKey="value"
          onChange={this.onChange}
          value={this.state.value}
          clearable={false}
        />
      </div>
    )
  }
}

export default Selectbox
