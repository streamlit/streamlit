/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Select as UISelect } from 'baseui/select';
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

class Select extends PureStreamlitElement<Props, State> {
  public constructor(props: Props) {
    super(props)

    const widgetId = this.props.element.get('id')
    const valueId = this.props.element.get('value')

    let value = null
    this.props.element.get('options').forEach((opt: ImmutableMap<string, any>) => {
      if (opt.get('value') == valueId){
        value = [{
          'label': opt.get('label'),
          'value': opt.get('value')
        }]
      }
    })

    this.state = { value }
    if (value){
      this.props.widgetMgr.setStringValue(widgetId, valueId)
      this.props.widgetMgr.sendUpdateWidgetsMessage()
    }
  }

  private onChange = (data: any) => {
    const widgetId = this.props.element.get('id')
    const value = data['value']
    const valueId = value[0]['value']

    console.log(value)
    console.log(valueId)

    this.setState({ value })
    this.props.widgetMgr.setStringValue(widgetId, valueId)
    this.props.widgetMgr.sendUpdateWidgetsMessage()
  }

  public safeRender(): React.ReactNode {
    const label = this.props.element.get('label')
    const options = this.props.element.get('options')
    const style = { width: this.props.width }

    let selectOptions: any[] = []
    options.forEach((opt: ImmutableMap<string, any>) => (
      selectOptions.push({
        'label': opt.get('label'),
        'value': opt.get('value')
      })
    ))

    return (
      <div className="Widget row-widget stSelect" style={style}>
        <UISelect
          options={selectOptions}
          labelKey='label'
          valueKey='value'
          onChange={this.onChange}
          value={this.state.value}
        >
          {label}
        </UISelect>
      </div>
    )
  }
}

export default Select
