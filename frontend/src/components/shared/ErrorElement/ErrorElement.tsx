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
  error: Error;
  width?: number;
}

class ErrorElement extends React.PureComponent<Props> {
  public render(): React.ReactNode {
    const error = this.props.error

    // Remove first line from stack (because it's just the error message) and
    // trim indentation.
    const stack = error.stack ? error.stack.split('\n') : []
    stack.shift()
    const cleanedStack = stack
      .map(s => s.trim())
      .join('\n')

    return (
      <Alert
        color="danger" style={{width: this.props.width}}>
        <strong>{error.name}:</strong>{' '}{error.message}
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
