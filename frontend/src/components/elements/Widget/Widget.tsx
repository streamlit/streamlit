/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import {Input, Label} from 'reactstrap'
import {Map as ImmutableMap} from 'immutable'
import {dispatchOneOf} from 'lib/immutableProto'
import {PureStreamlitElement, StState} from 'components/shared/StreamlitElement/'

import ButtonWidget from 'components/widgets/Button/'
import CheckboxWidget from 'components/widgets/Checkbox/'
import SliderWidget from 'components/widgets/Slider/'
import TextAreaWidget from 'components/widgets/TextArea/'

import './Widget.scss'

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

class Widget extends PureStreamlitElement<Props, State> {
  public safeRender(): React.ReactNode {
    const {element} = this.props
    const label = element.get('label')
    const id = element.get('id')

    return dispatchOneOf(element, 'type', {
      button: () => <ButtonWidget {...this.props}/>,
      checkbox: () => <CheckboxWidget {...this.props}/>,
      slider: () => <SliderWidget {...this.props}/>,
      textArea: () => <TextAreaWidget {...this.props}/>,
    })
  }
}

export default Widget
