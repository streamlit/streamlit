/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React from 'react'
import { Map as ImmutableMap } from 'immutable'
import { dispatchOneOf } from 'lib/immutableProto'
import { PureStreamlitElement, StState } from 'components/shared/StreamlitElement/'
import { WidgetState } from 'components/core/ReportView/'
import ButtonWidget from 'components/widgets/Button/'
import CheckboxWidget from 'components/widgets/Checkbox/'
import SliderWidget from 'components/widgets/Slider/'
import TextAreaWidget from 'components/widgets/TextArea/'
import './Widget.scss'

interface Props {
  element: ImmutableMap<string, any>;
  getWidgetState: () => WidgetState;
  sendBackMsg: (msg: Object) => void;
  setWidgetState: (key: string, value: any) => void;
  width: number;
}

class Widget extends PureStreamlitElement<Props, StState> {
  public safeRender(): React.ReactNode {
    return dispatchOneOf(this.props.element, 'type', {
      button: () => <ButtonWidget {...this.props} />,
      checkbox: () => <CheckboxWidget {...this.props} />,
      slider: () => <SliderWidget {...this.props} />,
      textArea: () => <TextAreaWidget {...this.props} />,
    })
  }
}

export default Widget
