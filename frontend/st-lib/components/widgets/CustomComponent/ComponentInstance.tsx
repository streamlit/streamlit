/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  ArrowDataframe,
  ComponentInstance as ComponentInstanceProto,
  ISpecialArg,
  SpecialArg as SpecialArgProto,
} from "src/autogen/proto"
import Alert from "src/components/elements/Alert"
import { Kind } from "src/components/shared/AlertContainer"
import ErrorElement from "src/components/shared/ErrorElement"
import { withTheme } from "@emotion/react"
import { ensureError } from "src/lib/ErrorHandling"
import {
  DEFAULT_IFRAME_FEATURE_POLICY,
  DEFAULT_IFRAME_SANDBOX_POLICY,
} from "src/lib/IFrameUtil"
import { logError, logWarning } from "src/lib/log"
import { Timer } from "src/lib/Timer"
import { Source, WidgetStateManager } from "src/lib/WidgetStateManager"
import queryString from "query-string"
import React, { createRef, ReactNode } from "react"
import { Theme, toExportedTheme } from "src/theme"
import { COMMUNITY_URL, COMPONENT_DEVELOPER_URL } from "src/urls"
import { ComponentRegistry } from "./ComponentRegistry"
import { ComponentMessageType, StreamlitMessageType } from "./enums"

/**
 * The current custom component API version. If our API changes,
 * this value must be incremented. ComponentInstances send their API
 * version in the COMPONENT_READY call.
 */
export const CUSTOM_COMPONENT_API_VERSION = 1

/**
 * If we haven't received a COMPONENT_READY message this many seconds
 * after the component has been created, explain to the user that there
 * may be a problem with their component, and offer troubleshooting advice.
 */
export const COMPONENT_READY_WARNING_TIME_MS = 3000

export interface Props {
  registry: ComponentRegistry
  widgetMgr: WidgetStateManager

  disabled: boolean
  element: ComponentInstanceProto
  width: number
  theme: Theme
}

export interface State {
  componentError?: Error

  // True if the component hasn't sent the READY message, and
  // `COMPONENT_READY_WARNING_TIME_MS` has elapsed.
  readyTimeout: boolean
}

interface DataframeArg {
  key: string
  value: any
}

export class ComponentInstance extends React.PureComponent<Props, State> {
  private readonly iframeRef = createRef<HTMLIFrameElement>()

  // True when we've received the COMPONENT_READY message
  private componentReady = false

  // The most recent JSON and bytes args we've received from Python.
  private curArgs: { [name: string]: any } = {}

  // The most recent Arrow Dataframe args we've received from Python.
  private curDataframeArgs: DataframeArg[] = []

  // The most recent frame height we've received from the frontend.
  private frameHeight = 0

  // The most recent iframe.contentWindow that we've registered to
  // receive messages from.
  private contentWindow?: Window

  private readonly componentReadyWarningTimer = new Timer()

  public constructor(props: Props) {
    super(props)
    this.state = { componentError: undefined, readyTimeout: false }
  }

  public componentDidMount = (): void => {
    this.maybeRegisterIFrameListener()

    // Start a timer. If we haven't gotten the COMPONENT_READY message
    // after a short time, we'll display a warning to the user.
    this.componentReadyWarningTimer.setTimeout(
      () => this.setState({ readyTimeout: true }),
      COMPONENT_READY_WARNING_TIME_MS
    )
  }

  public componentWillUnmount = (): void => {
    this.deregisterIFrameListener()
    this.componentReadyWarningTimer.cancel()
  }

  public componentDidUpdate = (): void => {
    // It's possible for our iframe to be re-mounted after an update.
    // When this happens, we need to de-register our previous iframe message
    // listener, and register a listener for the current iframe.
    this.maybeRegisterIFrameListener()
  }

  /**
   * Return our iframe's contentWindow.
   * (This is implemented as a function so that we can mock it in a test.)
   */
  private getIFrameContentWindow(): Window | null | undefined {
    return this.iframeRef.current?.contentWindow
  }

  /**
   * Register our iframe's contentWindow with our ComponentRegistry, if it's
   * non-null and not already registered.
   */
  private maybeRegisterIFrameListener = (): void => {
    // Early-out if our contentWindow has not changed since the last
    // time this function was called.
    const currContentWindow = this.getIFrameContentWindow()
    if (this.contentWindow === currContentWindow) {
      return
    }

    // De-register our current listener first
    this.deregisterIFrameListener()

    if (currContentWindow == null) {
      // This shouldn't be possible.
      logError(
        `ComponentInstance iframe does not have a contentWindow, and will not receive messages!`
      )
      this.contentWindow = undefined
      return
    }

    this.contentWindow = currContentWindow
    this.props.registry.registerListener(this.contentWindow, this.onBackMsg)
  }

  /** De-register our contentWindow listener, if we've registered one. */
  private deregisterIFrameListener = (): void => {
    if (this.contentWindow == null) {
      return
    }

    this.props.registry.deregisterListener(this.contentWindow)
    this.contentWindow = undefined
  }

  /**
   * Receive a ComponentBackMsg from our component iframe.
   */
  private onBackMsg = (type: string, data: any): void => {
    switch (type) {
      case ComponentMessageType.COMPONENT_READY: {
        // Our component is ready to begin receiving messages. Send off its
        // first render message! It is *not* an error to get multiple
        // COMPONENT_READY messages. This can happen if a component is being
        // served from the webpack dev server, and gets reloaded. We
        // always respond to this message with the most recent render
        // arguments.
        const { apiVersion } = data
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
          this.sendRenderMessage()
        }

        // If our warning timer was running, cancel it. If we were showing
        // the componentReadyTimeout warning, stop showing it.
        this.componentReadyWarningTimer.cancel()
        this.setState({ readyTimeout: false })
        break
      }

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

    const { element } = this.props
    const { dataType } = data
    if (dataType === "dataframe") {
      this.props.widgetMgr.setArrowValue(element, value, source)
    } else if (dataType === "bytes") {
      this.props.widgetMgr.setBytesValue(element, value, source)
    } else {
      this.props.widgetMgr.setJsonValue(element, value, source)
    }
  }

  /** The component has a new height. Resize its iframe. */
  private handleSetFrameHeight = (data: any): void => {
    const height: number | undefined = tryGetValue(data, "height")
    if (height === undefined) {
      logWarning(`handleSetFrameHeight: missing 'height' prop`)
      return
    }

    if (height === this.frameHeight) {
      // Nothing to do!
      return
    }

    if (this.iframeRef.current == null) {
      // This should not be possible.
      logWarning(`handleSetFrameHeight: missing our iframeRef!`)
      return
    }

    // We shove our new frameHeight directly into our iframe, to avoid
    // triggering a re-render. Otherwise, components will receive the RENDER
    // event several times during startup (because they will generally
    // immediately change their frameHeight after mounting). This is wasteful,
    // and it also breaks certain components.
    this.frameHeight = height
    this.iframeRef.current.height = this.frameHeight.toString()
  }

  /** Send a message to the component through its iframe. */
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
        type,
        ...data,
      },
      "*"
    )
  }

  /**
   * Send a RENDER message to the component with the most recent arguments
   * received from Python.
   */
  private sendRenderMessage = (): void => {
    // NB: if you change or remove any of the arguments here, you'll break
    // existing components. You can *add* more arguments safely, but any
    // other modifications require a CUSTOM_COMPONENT_API_VERSION bump.
    this.sendForwardMsg(StreamlitMessageType.RENDER, {
      args: this.curArgs,
      dfs: this.curDataframeArgs,
      disabled: this.props.disabled,
      theme: toExportedTheme(this.props.theme),
    })
  }

  private renderError = (error: Error): ReactNode => {
    return <ErrorElement name={error.name} message={error.message} />
  }

  private renderComponentReadyTimeoutWarning = (): ReactNode => {
    const message =
      `Your app is having trouble loading the **${this.props.element.componentName}** component. ` +
      `\n\n(The app is attempting to load the component from **${this.props.element.url}**, and hasn't ` +
      `received its **"${ComponentMessageType.COMPONENT_READY}"** message.)` +
      "\n- If this is a development build, have you started the dev server?" +
      "\n- If this is a release build, have you compiled the frontend?" +
      `\n\nFor more troubleshooting help, please see the [Streamlit Component docs](${COMPONENT_DEVELOPER_URL}) ` +
      `or visit our [forums](${COMMUNITY_URL}).`

    return (
      <Alert width={this.props.width} body={message} kind={Kind.WARNING} />
    )
  }

  public render(): ReactNode {
    // If we have an error, display it and bail.
    if (this.state.componentError != null) {
      return this.renderError(this.state.componentError)
    }

    // If we've timed out waiting for the READY message from the component,
    // display a warning.
    const warns = this.state.readyTimeout
      ? this.renderComponentReadyTimeoutWarning()
      : null

    // Parse the component's arguments and src URL.
    // Some of these steps may throw an exception, so we wrap them in a
    // try-catch. If we catch an error, we show the error message to the user.
    let newArgs: { [name: string]: any }
    const newDataframeArgs: DataframeArg[] = []
    let src: string
    let componentName: string
    try {
      // Determine the component iframe's src. If a URL is specified, we just
      // use that. Otherwise, we derive the URL from the component's ID.
      componentName = this.props.element.componentName
      const { url } = this.props.element
      if (url != null && url !== "") {
        src = url
      } else {
        src = this.props.registry.getComponentURL(componentName, "index.html")
      }

      // Add streamlitUrl query parameter to src.
      src = queryString.stringifyUrl({
        url: src,
        query: { streamlitUrl: window.location.href },
      })

      // Parse arguments. Our JSON arguments are just stored in a JSON string.
      newArgs = JSON.parse(this.props.element.jsonArgs)

      // Some notes re: data marshalling:
      //
      // Non-JSON arguments are sent from Python in the "specialArgs"
      // protobuf list. We get DataFrames and Bytes from this list (and
      // any further non-JSON datatypes we add support for down the road will
      // also go into it).
      //
      // We don't forward raw protobuf objects onto the iframe, however.
      // Instead, JSON args and Bytes args are shipped to the iframe together
      // in a plain old JS Object called `args`.
      //
      // But! Because dataframes are delivered as instances of our custom
      // "ArrowTable" class, they can't be sent to the iframe in this same
      // `args` object. Instead, raw DataFrame data is delivered to the iframe
      // in a separate Array. The iframe then constructs the required
      // ArrowTable instances and inserts them into the `args` array itself.
      this.props.element.specialArgs.forEach((ispecialArg: ISpecialArg) => {
        const specialArg = ispecialArg as SpecialArgProto
        const { key } = specialArg
        switch (specialArg.value) {
          case "arrowDataframe":
            newDataframeArgs.push({
              key,
              value: ArrowDataframe.toObject(
                specialArg.arrowDataframe as ArrowDataframe
              ),
            })
            break

          case "bytes":
            newArgs[key] = specialArg.bytes
            break

          default:
            throw new Error(
              `Unrecognized SpecialArg type: ${specialArg.value}`
            )
        }
      })
    } catch (e) {
      const error = ensureError(e)
      return this.renderError(error)
    }

    // We always store the most recent render arguments in order to respond
    // to COMPONENT_READY messages. Components can indicate that they're ready
    // multiple times (this will happen if a plugin auto-reloads itself -
    // for example, if it's being served from a webpack dev server). When a
    // component sends the COMPONENT_READY message, we send it the most
    // recent arguments.
    this.curArgs = newArgs
    this.curDataframeArgs = newDataframeArgs

    if (this.componentReady) {
      // The component has loaded. Send it a new render message immediately.
      // This must happen *after* the above "last args" are saved, because
      // the render message uses them.
      this.sendRenderMessage()
    }

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
      <>
        {warns}
        <iframe
          allow={DEFAULT_IFRAME_FEATURE_POLICY}
          ref={this.iframeRef}
          src={src}
          width={this.props.width}
          height={this.frameHeight}
          scrolling="no"
          sandbox={DEFAULT_IFRAME_SANDBOX_POLICY}
          title={componentName}
        />
      </>
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

export default withTheme(ComponentInstance)
