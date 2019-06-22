/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Superclasses that should be used for all Streamlit report
 * elements. These handle errors for you automatically. All you have to do is,
 * instead of implementing a render() method, you implement a safeRender()
 * method.
 */

import ErrorElement from '../ErrorElement'
import ErrorBoundary from '../ErrorBoundary'
import React from 'react'

export interface StProps {
  /**
   * The component's width.
   */
  width: number;
}

export interface StState {
  /**
   * Error name of the error to show instead of this element. Fill this in
   * when you get an exception inside a componentDidMount, componentDidUpdate,
   * etc.
   */
  errorName?: string;
  /**
   * The message for the error above.
   */
  errorMessage?: string;
  /**
   * The stack of the error above.
   */
  errorStack?: string;
}

export abstract class StreamlitElement<P extends StProps, S extends StState>
  extends React.Component<P, S> {

  public render(): React.ReactNode {
    return renderHandlingErrors(
      this.state, this.props, () => this.safeRender())
  }

  private setErrorState(error: Error): void {
    this.setState({
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    })
  }

  public componentDidMount(): void {
    try {
      this.safeComponentDidMount()
    } catch (error) {
      this.setErrorState(error)
    }
  }

  public shouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any): boolean {
    if (this.state && nextState && this.state.errorName != null &&
      this.state.errorName === nextState.errorName &&
      this.state.errorMessage === nextState.errorMessage &&
      this.state.errorStack === nextState.errorStack) {
      return false
    }

    try {
      return this.safeShouldComponentUpdate(nextProps, nextState, nextContext)
    } catch (error) {
      this.setErrorState(error)
    }
    return true
  }

  public componentDidUpdate(prevProps: Readonly<P>, prevState: Readonly<S>): void {
    try {
      this.safeComponentDidUpdate(prevProps, prevState)
    } catch (error) {
      this.setErrorState(error)
    }
  }

  public componentWillUnmount(): void {
    try {
      this.safeComponentWillUnmount()
    } catch (error) {
      this.setErrorState(error)
    }
  }

  public abstract safeRender(): React.ReactNode

  public safeShouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any): boolean {
    return true
  }

  public safeComponentDidMount(): void {}
  public safeComponentDidUpdate(prevProps: Readonly<P>, prevState: Readonly<S>): void {}
  public safeComponentWillUnmount(): void {}

  // Less common methods (implement these as needed).
  //public safeComponentDidCatch(error: Error, i: React.ErrorInfo): void {}
  //public safeGetDerivedStateFromProps(P, S): S {}
  //public getDerivedStateFromError(): S {}
  //public safeGetSnapshotBeforeUpdate(P, S): Object {}
}

export abstract class PureStreamlitElement<P extends StProps, S extends StState>
  extends React.PureComponent<P, S> {

  public render(): React.ReactNode {
    return renderHandlingErrors(
      this.state, this.props, () => this.safeRender())
  }

  private setErrorState(error: Error): void {
    this.setState({
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    })
  }

  public componentDidMount(): void {
    try {
      this.safeComponentDidMount()
    } catch (error) {
      this.setErrorState(error)
    }
  }

  public componentDidUpdate(prevProps: Readonly<P>, prevState: Readonly<S>): void {
    try {
      this.safeComponentDidUpdate(prevProps, prevState)
    } catch (error) {
      this.setErrorState(error)
    }
  }

  public componentWillUnmount(): void {
    try {
      this.safeComponentWillUnmount()
    } catch (error) {
      this.setErrorState(error)
    }
  }

  public abstract safeRender(): React.ReactNode

  public safeComponentDidMount(): void {}
  public safeComponentDidUpdate(prevProps: Readonly<P>, prevState: Readonly<S>): void {}
  public safeComponentWillUnmount(): void {}

  // Less common methods (implement these as needed).
  //public safeComponentDidCatch(error: Error, i: React.ErrorInfo): void {}
  //public safeGetDerivedStateFromProps(P, S): S {}
  //public getDerivedStateFromError(): S {}
  //public safeGetSnapshotBeforeUpdate(P, S): Object {}
}


function renderHandlingErrors(
  state: StState|null,
  props: StProps,
  fn: () => React.ReactNode,
): React.ReactNode {
  if (state != null && state.errorName && state.errorMessage) {
    return (
      <ErrorElement width={props.width} name={state.errorName}
        message={state.errorMessage} stack={state.errorStack}/>
    )
  }

  try {
    return (
      <ErrorBoundary width={props.width}>{fn()}</ErrorBoundary>
    )
  } catch (error) {
    return (
      <ErrorElement width={props.width} name={error.name} message={error.message} stack={error.stack}/>
    )
  }
}
