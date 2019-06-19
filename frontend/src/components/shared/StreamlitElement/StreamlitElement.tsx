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
   * Error (exception) object to show instead of this element. Fill this in
   * when you get an exception inside a componentDidMount, componentDidUpdate,
   * etc.
   */
  error?: Error | null;
}

export abstract class StreamlitElement<P extends StProps, S extends StState>
  extends React.Component<P, S> {

  public render(): React.ReactNode {
    return renderHandlingErrors(
      this.state, this.props, () => this.safeRender())
  }

  public componentDidMount(): void {
    try {
      this.safeComponentDidMount()
    } catch (exception) {
      this.setState(exception)
    }
  }

  public shouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any): boolean {
    try {
      return this.safeShouldComponentUpdate(nextProps, nextState, nextContext)
    } catch (exception) {
      this.setState(exception)
    }
    return true
  }

  public componentDidUpdate(prevProps: Readonly<P>, prevState: Readonly<S>): void {
    try {
      this.safeComponentDidUpdate(prevProps, prevState)
    } catch (exception) {
      this.setState(exception)
    }
  }

  public componentWillUnmount(): void {
    try {
      this.safeComponentWillUnmount()
    } catch (exception) {
      this.setState(exception)
    }
  }

  public componentDidCatch(error: Error, i: React.ErrorInfo): void {
    try {
      this.safeComponentDidCatch(error, i)
    } catch (exception) {
      this.setState(exception)
    }
  }

  public abstract safeRender(): React.ReactNode

  public safeShouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>, nextContext: any): boolean {
    return true
  }

  public safeComponentDidMount(): void {}
  public safeComponentDidUpdate(prevProps: Readonly<P>, prevState: Readonly<S>): void {}
  public safeComponentWillUnmount(): void {}
  public safeComponentDidCatch(error: Error, i: React.ErrorInfo): void {}

  // Less common methods (implement these as needed).
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

  public componentDidMount(): void {
    try {
      this.safeComponentDidMount()
    } catch (exception) {
      this.setState(exception)
    }
  }

  public componentDidUpdate(prevProps: Readonly<P>, prevState: Readonly<S>): void {
    try {
      this.safeComponentDidUpdate(prevProps, prevState)
    } catch (exception) {
      this.setState(exception)
    }
  }

  public componentWillUnmount(): void {
    try {
      this.safeComponentWillUnmount()
    } catch (exception) {
      this.setState(exception)
    }
  }

  public componentDidCatch(error: Error, i: React.ErrorInfo): void {
    try {
      this.safeComponentDidCatch(error, i)
    } catch (exception) {
      this.setState(exception)
    }
  }

  public abstract safeRender(): React.ReactNode

  public safeComponentDidMount(): void {}
  public safeComponentDidUpdate(prevProps: Readonly<P>, prevState: Readonly<S>): void {}
  public safeComponentWillUnmount(): void {}
  public safeComponentDidCatch(error: Error, i: React.ErrorInfo): void {}

  // Less common methods (implement these as needed).
  //public safeGetDerivedStateFromProps(P, S): S {}
  //public getDerivedStateFromError(): S {}
  //public safeGetSnapshotBeforeUpdate(P, S): Object {}
}


function renderHandlingErrors(
  state: StState|null,
  props: StProps,
  fn: () => React.ReactNode,
): React.ReactNode {
  if (state != null && state.error) {
    return (
      <ErrorElement width={props.width} error={state.error}/>
    )
  }

  try {
    return (
      <ErrorBoundary width={props.width}>{fn()}</ErrorBoundary>
    )
  } catch (error) {
    return (
      <ErrorElement width={props.width} error={error}/>
    )
  }
}
