/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import hoistNonReactStatics from "hoist-non-react-statics"
import React, { ReactNode } from "react"
import { RenderData, Streamlit } from "./streamlit"
import { ComponentProps } from "./StreamlitComponent"

/**
 * Wrapper for React-based Streamlit components.
 *
 * Bootstraps the communication interface between Streamlit and the component.
 */
export function withStreamlitConnection(
  WrappedComponent: React.ComponentType<ComponentProps>
): React.ComponentType {
  interface WrapperProps {}

  interface WrapperState {
    renderData?: RenderData
    componentError?: Error
  }

  class ComponentWrapper extends React.PureComponent<
    WrapperProps,
    WrapperState
  > {
    /** The most recent frameHeight we've sent to Streamlit. */
    private frameHeight?: number

    public constructor(props: WrapperProps) {
      super(props)
      this.state = {
        renderData: undefined,
        componentError: undefined,
      }
    }

    public static getDerivedStateFromError = (
      error: Error
    ): Partial<WrapperState> => {
      return { componentError: error }
    }

    public componentDidMount = (): void => {
      // Set up event listeners, and signal to Streamlit that we're ready.
      // We won't render the component until we receive the first RENDER_EVENT.
      Streamlit.events.addEventListener(
        Streamlit.RENDER_EVENT,
        this.onRenderEvent
      )
      Streamlit.setComponentReady()
    }

    public componentWillUnmount = (): void => {
      Streamlit.events.removeEventListener(
        Streamlit.RENDER_EVENT,
        this.onRenderEvent
      )
    }

    /**
     * Called by the component when its height has changed. This should be
     * called every time the component changes its DOM - that is, in
     * componentDidMount and componentDidUpdate.
     */
    private updateFrameHeight = (newHeight?: number): void => {
      if (newHeight === undefined) {
        // newHeight is optional. If undefined, it defaults to scrollHeight,
        // which is the entire height of the element minus its border,
        // scrollbar, and margin.
        newHeight = document.body.scrollHeight
      }

      if (this.frameHeight === newHeight) {
        // Don't send a message if our height hasn't changed.
        return
      }

      this.frameHeight = newHeight
      Streamlit.setFrameHeight(this.frameHeight)
    }

    /**
     * Streamlit is telling this component to redraw.
     * We save the render data in State, so that it can be passed to the
     * component in our own render() function.
     */
    private onRenderEvent = (event: Event): void => {
      // Update our state with the newest render data
      const renderEvent = event as CustomEvent<RenderData>
      this.setState({ renderData: renderEvent.detail })
    }

    public render = (): ReactNode => {
      // If our wrapped component threw an error, display it.
      if (this.state.componentError != null) {
        return (
          <div>
            <h1>Component Error</h1>
            <span>{this.state.componentError.message}</span>
          </div>
        )
      }

      // Don't render until we've gotten our first message from Streamlit
      if (this.state.renderData == null) {
        return null
      }

      return (
        <WrappedComponent
          width={window.innerWidth}
          disabled={this.state.renderData.disabled}
          args={this.state.renderData.args}
          setWidgetValue={Streamlit.setWidgetValue}
          updateFrameHeight={this.updateFrameHeight}
        />
      )
    }
  }

  return hoistNonReactStatics(ComponentWrapper, WrappedComponent)
}
