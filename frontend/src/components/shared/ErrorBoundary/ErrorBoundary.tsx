/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 *
 * @fileoverview A component that catches errors that take place when React is
 * asynchronously rendering child components.
 */

import React from 'react'
import ErrorElement from '../ErrorElement'
import {logError} from '../../../lib/log'

export interface Props {
  width?: number;
}

export interface State {
  error?: Error|null;
}

class ErrorBoundary extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)
    this.state = {
      error: null,
    }
  }

  public static getDerivedStateFromError = (error: Error): State => {
    // Return the state update so the next render will show the fallback UI.
    return {
      error: error,
    }
  }

  public componentDidCatch = (error: Error, info: React.ErrorInfo): void => {
    logError(`${error.name}: ${error.message}\n${error.stack}`)
  }

  public render(): React.ReactNode {
    const {error} = this.state

    if (error) {
      return (
        <ErrorElement width={this.props.width} name={error.name} message={error.message} stack={error.stack}/>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
