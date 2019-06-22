/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 *
 * @fileoverview A component that draws an error on the screen. This is for
 * internal use only. That is, this should not be an element that a user
 * purposefully places in a Streamlit report. For that, see
 * st.exception / Exception.tsx or st.error / Text.tsx.
 */

import React from 'react'
import {Alert} from 'reactstrap'

export interface Props {
  name: string;
  message: string;
  stack?: string;
  width?: number;
}

class ErrorElement extends React.PureComponent<Props> {
  public render(): React.ReactNode {
    const {name, message, stack} = this.props

    // Remove first line from stack (because it's just the error message) and
    // trim indentation.
    const stackArray = stack ? stack.split('\n') : []
    stackArray.shift()
    const cleanedStack = stackArray
      .map(s => s.trim())
      .join('\n')

    return (
      <Alert
        color="danger" style={{width: this.props.width}}>
        <strong>{name}:</strong>{' '}{message}
        {
          stack ?
            <pre className="error"><code>{ cleanedStack }</code></pre>
            : null
        }
      </Alert>
    )
  }
}

export default ErrorElement
