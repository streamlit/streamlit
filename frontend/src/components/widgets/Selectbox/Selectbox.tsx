/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import {logWarning} from 'lib/log'
import React from 'react'
import { Select as UISelect } from 'baseui/select'
import { Map as ImmutableMap } from 'immutable'
import { WidgetStateManager } from 'lib/WidgetStateManager'

interface Props {
  disabled: boolean;
  element: ImmutableMap<string, any>;
  widgetMgr: WidgetStateManager;
  width: number;
}

interface State {
  /**
   * The value specified by the user via the UI. If the user didn't touch this
   * widget's UI, it's undefined.
   */
  value?: number;
}

interface SelectOption {
  label: string;
  value: string;
}

class Selectbox extends React.PureComponent<Props, State> {
  public state: State = {}

  private get valueOrDefault(): SelectOption[] | undefined {
    const value = this.state.value === undefined ?
      this.props.element.get('value') as number :
      this.state.value

    return [{
      'value': value.toString(),
      'label': this.props.element.get('options')[value],
    }]
  }

  private onChange = (data: any) => {
    const widgetId = this.props.element.get('id')
    const selectedValue: SelectOption[] = data['value']

    if (selectedValue.length === 0) {
      logWarning('No value selected!')
      return
    }

    const valueId = selectedValue[0].value
    const index = parseInt(valueId, 10)

    this.setState({ value: index })
    this.props.widgetMgr.setIntValue(widgetId, index)
  }

  public render(): React.ReactNode {
    const label = this.props.element.get('label')
    const options = this.props.element.get('options')
    const style = { width: this.props.width }

    let selectOptions: SelectOption[] = []
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
          value={this.valueOrDefault}
          clearable={false}
          disabled={this.props.disabled}
        />
      </div>
    )
  }
}

export default Selectbox
