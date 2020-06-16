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

import ErrorElement from "components/shared/ErrorElement"
import { Map as ImmutableMap } from "immutable"
import { logError, logWarning } from "lib/log"
import { Source, WidgetStateManager } from "lib/WidgetStateManager"
import React, { createRef, ReactNode } from "react"
import { ComponentRegistry } from "./ComponentRegistry"

/**
 * The current custom component API version. If our API changes,
 * this value must be incremented. ComponentInstances send their API
 * version in the COMPONENT_READY call.
 */
export const CUSTOM_COMPONENT_API_VERSION = 1

/** Messages from Component -> Streamlit */
export enum ComponentMessageType {
  // A component sends this message when it's ready to receive messages
  // from Streamlit. Streamlit won't send any messages until it gets this.
  // Data: { apiVersion: number }
  COMPONENT_READY = "streamlit:componentReady",

  // The component has a new value. Send it back to Streamlit, which
  // will then re-run the app.
  // Data: { value: any }
  SET_COMPONENT_VALUE = "streamlit:setComponentValue",

  // The component has a new height for its iframe.
  // Data: { height: number }
  SET_FRAME_HEIGHT = "streamlit:setFrameHeight",
}

/** Messages from Streamlit -> Component */
export enum StreamlitMessageType {
  // Sent by Streamlit when the component should re-render.
  // Data: { args: any, disabled: boolean }
  RENDER = "streamlit:render",
}

interface Props {
  registry: ComponentRegistry
  widgetMgr: WidgetStateManager

  disabled: boolean
  element: ImmutableMap<string, any>
  width: number
}

interface State {
  frameHeight?: number
  componentError?: Error
}

/**
 * Our iframe sandbox options.
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#Attributes
 *
 * From that page:
 * "When the embedded document has the same origin as the embedding page, it is
 * strongly discouraged to use both allow-scripts and allow-same-origin, as
 * that lets the embedded document remove the sandbox attribute — making it no
 * more secure than not using the sandbox attribute at all."
 *
 * TODO: we need both allow-scripts (for obvious reasons) *and*
 * allow-same-origin (or else we'll fails CORS checks for loading static
 * resources). Do we need to therefore serve component content from a
 * different origin, somehow?
 */
const SANDBOX_POLICY = [
  // Allows for downloads to occur without a gesture from the user.
  // Experimental; limited browser support.
  // "allow-downloads-without-user-activation",

  // Allows the resource to submit forms. If this keyword is not used, form submission is blocked.
  "allow-forms",

  // Lets the resource open modal windows.
  "allow-modals",

  // Lets the resource lock the screen orientation.
  // "allow-orientation-lock",

  // Lets the resource use the Pointer Lock API.
  // "allow-pointer-lock",

  // Allows popups (such as window.open(), target="_blank", or showModalDialog()). If this keyword is not used, the popup will silently fail to open.
  "allow-popups",

  // Lets the sandboxed document open new windows without those windows inheriting the sandboxing. For example, this can safely sandbox an advertisement without forcing the same restrictions upon the page the ad links to.
  "allow-popups-to-escape-sandbox",

  // Lets the resource start a presentation session.
  // "allow-presentation",

  // If this token is not used, the resource is treated as being from a special origin that always fails the same-origin policy.
  "allow-same-origin",

  // Lets the resource run scripts (but not create popup windows).
  "allow-scripts",

  // Lets the resource request access to the parent's storage capabilities with the Storage Access API.
  // Experimental; limited browser support.
  // "allow-storage-access-by-user-activation",

  // Lets the resource navigate the top-level browsing context (the one named _top).
  // "allow-top-navigation",

  // Lets the resource navigate the top-level browsing context, but only if initiated by a user gesture.
  // "allow-top-navigation-by-user-activation",
].join(" ")

// TODO: catch errors and display them in render()

export class ComponentInstance extends React.PureComponent<Props, State> {
  private iframeRef = createRef<HTMLIFrameElement>()
  // True when we've received the COMPONENT_READY message
  private componentReady = false
  private lastRenderArgs = {}
  private lastRenderDataframes = []

  public constructor(props: Props) {
    super(props)
    // Default to a frameHeight of 0. If this is undefined, browsers
    // default to something > 100 pixels, which can look strange.
    // In the future, we may want to allow component creators to specify
    // the initial frameHeight.
    this.state = { frameHeight: 0 }
  }

  public componentDidMount = (): void => {
    if (this.iframeRef.current == null) {
      // This should not be possible.
      logError(
        `ComponentInstance does not have an iframeRef, and will not receive messages!`
      )
      return
    }

    if (this.iframeRef.current.contentWindow == null) {
      // Nor should this.
      logError(
        `ComponentInstance iframe does not have an iframeRef, and will not receive messages!`
      )
      return
    }

    this.props.registry.registerListener(
      this.iframeRef.current.contentWindow,
      this.onBackMsg
    )
  }

  public componentWillUnmount = (): void => {
    if (
      this.iframeRef.current == null ||
      this.iframeRef.current.contentWindow == null
    ) {
      return
    }

    this.props.registry.deregisterListener(
      this.iframeRef.current.contentWindow
    )
  }

  /**
   * Receive a ComponentBackMsg from our component iframe.
   */
  private onBackMsg = (type: string, data: any): void => {
    switch (type) {
      case ComponentMessageType.COMPONENT_READY:
        // Our component is ready to begin receiving messages. Send off its
        // first render message! It is *not* an error to get multiple
        // COMPONENT_READY messages. This can happen if a component is being
        // served from the webpack dev server, and gets reloaded. We
        // always respond to this message with the most recent render
        // arguments.
        const apiVersion = data["apiVersion"]
        if (apiVersion !== CUSTOM_COMPONENT_API_VERSION) {
          // In the future, we may end up with multiple API versions we
          // need to support. For now, we just have the one.
          this.setState({
            componentError: new Error(
              `Unrecognized component API version: '${apiVersion}'`
            ),
          })
        } else {
          this.componentReady = true
          this.sendForwardMsg(StreamlitMessageType.RENDER, {
            args: this.lastRenderArgs,
            dfs: this.lastRenderDataframes,
          })
        }
        break

      case ComponentMessageType.SET_COMPONENT_VALUE:
        if (!this.componentReady) {
          logWarning(
            `Got ${type} before ${ComponentMessageType.COMPONENT_READY}!`
          )
        } else {
          this.handleSetComponentValue(data, { fromUi: true })
        }
        break

      case ComponentMessageType.SET_FRAME_HEIGHT:
        if (!this.componentReady) {
          logWarning(
            `Got ${type} before ${ComponentMessageType.COMPONENT_READY}!`
          )
        } else {
          this.handleSetFrameHeight(data)
        }
        break

      default:
        logWarning(`Unrecognized ComponentBackMsgType: ${type}`)
    }
  }

  /** The component set a new value. Send it back to Streamlit. */
  private handleSetComponentValue = (data: any, source: Source): void => {
    const value = tryGetValue(data, "value")
    if (value === undefined) {
      logWarning(`handleSetComponentValue: missing 'value' prop`)
      return
    }

    const widgetId: string = this.props.element.get("id")

    // TODO: handle debouncing, or expose some debouncing primitives?
    // TODO: ints, arrays, "button triggers", ... dataframes?

    this.props.widgetMgr.setJsonValue(widgetId, value, source)
  }

  /** The component has a new height. We'll resize the iframe. */
  private handleSetFrameHeight = (data: any): void => {
    const height: number | undefined = tryGetValue(data, "height")
    if (height === undefined) {
      logWarning(`handleSetFrameHeight: missing 'height' prop`)
      return
    }

    this.setState({ frameHeight: height })
  }

  private sendForwardMsg = (type: StreamlitMessageType, data: any): void => {
    if (this.iframeRef.current == null) {
      // This should never happen!
      logWarning("Can't send ForwardMsg; missing our iframe!")
      return
    }

    if (this.iframeRef.current.contentWindow == null) {
      // Nor should this!
      logWarning("Can't send ForwardMsg; iframe has no contentWindow!")
      return
    }

    this.iframeRef.current.contentWindow.postMessage(
      {
        type: type,
        ...data,
      },
      "*"
    )
  }

  public render = (): ReactNode => {
    if (this.state.componentError != null) {
      // If we have an error, display it and bail.
      return (
        <ErrorElement
          name={this.state.componentError.name}
          message={this.state.componentError.message}
        />
      )
    }

    // Parse the component's arguments and src URL.
    // Some of these steps may throw an exception, so we wrap them in a
    // try-catch. If we catch an error, we set this.state.componentError
    // and bail. The error will be displayed in the next call to render,
    // which will be triggered immediately. (This will not cause an infinite
    // loop.)
    let renderArgs: any
    let renderDfs: any
    let src: string
    try {
      // Determine the component iframe's src. If a URL is specified, we just
      // use that. Otherwise, we derive the URL from the component's ID.
      const componentName = this.props.element.get("componentName")
      const url = this.props.element.get("url")
      if (url != null && url !== "") {
        src = url
      } else {
        src = this.props.registry.getComponentURL(componentName, "index.html")
      }

      // Parse arguments
      renderArgs = JSON.parse(this.props.element.get("argsJson"))
      renderDfs = this.props.element.get("argsDataframe").toJS()
    } catch (err) {
      this.setState({ componentError: err })
      return undefined
    }

    if (this.componentReady) {
      // The component has loaded. Send it a new render message immediately.
      this.sendForwardMsg(StreamlitMessageType.RENDER, {
        args: renderArgs,
        dfs: renderDfs,
        disabled: this.props.disabled,
      })
    }

    // We always store the most recent render arguments in order to respond
    // to COMPONENT_READY messages. Components can indicate that they're ready
    // multiple times (this will happen if a plugin auto-reloads itself -
    // for example, if it's being served from a webpack dev server). When
    // component sends the COMPONENT_READY message, we send it the most
    // recent render arguments.
    this.lastRenderArgs = renderArgs
    this.lastRenderDataframes = renderDfs

    // Render the iframe. We set scrolling="no", because we don't want
    // scrollbars to appear; instead, we want components to properly auto-size
    // themselves.
    //
    // Without this, there is a potential for a scrollbar to
    // appear for a brief moment after an iframe's content gets bigger,
    // and before it sends the "setFrameHeight" message back to Streamlit.
    //
    // We may ultimately want to give components control over the "scrolling"
    // property.
    //
    // TODO: make sure horizontal scrolling still works!
    return (
      <iframe
        ref={this.iframeRef}
        src={src}
        width={this.props.width}
        height={this.state.frameHeight}
        allowFullScreen={false}
        scrolling="no"
        sandbox={SANDBOX_POLICY}
      />
    )
  }
}

/** Return the property with the given name, if it exists. */
function tryGetValue(
  obj: any,
  name: string,
  defaultValue: any = undefined
): any {
  return obj.hasOwnProperty(name) ? obj[name] : defaultValue
}
