/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Displays a Python Exception in the Report.
 */

import React from 'react'
import {Map as ImmutableMap} from 'immutable'
import './ExceptionElement.scss'

interface Props {
  width: number;
  element: ImmutableMap<string, any>;
}

/**
  * Functional element representing formatted text.
  */
class ExceptionElement extends React.PureComponent<Props> {
  public render(): React.ReactNode {
    const {element, width} = this.props
    const type = element.get('type')
    let message = element.get('message')
    if (message) { message = `: ${message}` }
    const stackTrace = element.get('stackTrace')

    // Put it all together into a nice little html view.
    return (
      <div className="alert alert-danger exception stException" style={{width}}>
        <div className="message"><strong>{type}</strong>{message}</div>
        <div className="stack-trace">{
          stackTrace.map((row: string, indx: string) =>
            <div className="row" key={indx}>{row}</div>
          )
        }</div>
      </div>
    )
  }
}

export default ExceptionElement
