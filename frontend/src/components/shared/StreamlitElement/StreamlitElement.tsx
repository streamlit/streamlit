/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Superclasses that should be used for all Streamlit report
 * elements. These handle errors for you automatically. All you have to do is,
 * instead of implementing a render() method, you implement a safeRender()
 * method.
 */

import Error from '../Error'
import ErrorBoundary from '../ErrorBoundary'
import React from 'react'

interface Props {
  width: number;
}

export abstract class StreamlitElement<P extends Props, S = {}>
  extends React.Component<P, S> {

  public render(): React.ReactNode {
    return handleErrors(this.props, () => this.safeRender())
  }

  abstract safeRender(): React.ReactNode;
}

export abstract class PureStreamlitElement<P extends Props, S = {}>
  extends React.PureComponent<P, S> {

  public render(): React.ReactNode {
    return handleErrors(this.props, () => this.safeRender())
  }

  abstract safeRender(): React.ReactNode;
}

function handleErrors(
  props: Props,
  fn: () => React.ReactNode,
): React.ReactNode {

  try {
    return (
      <ErrorBoundary width={props.width}>{fn()}</ErrorBoundary>
    )
  } catch (e) {
    return (
      <Error width={props.width} error={e}/>
    )
  }
}
