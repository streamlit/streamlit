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
  // "allow-same-origin",

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

/**
 * Our iframe `allow` policy options.
 * See https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#Attributes
 */
const FEATURE_POLICY = [
  // Controls whether the current document is allowed to gather information about the acceleration of the device through the Accelerometer interface.
  "accelerometer",

  // Controls whether the current document is allowed to gather information about the amount of light in the environment around the device through the AmbientLightSensor interface.
  "ambient-light-sensor",

  // Controls whether the current document is allowed to autoplay media requested through the HTMLMediaElement interface. When this policy is disabled and there were no user gestures, the Promise returned by HTMLMediaElement.play() will reject with a DOMException. The autoplay attribute on <audio> and <video> elements will be ignored.
  "autoplay",

  // Controls whether the use of the Battery Status API is allowed. When this policy is disabled, the Promise returned by Navigator.getBattery() will reject with a NotAllowedError DOMException.
  "battery",

  // Controls whether the current document is allowed to use video input devices. When this policy is disabled, the Promise returned by getUserMedia() will reject with a NotAllowedError DOMException.
  "camera",

  // Controls whether or not the current document is permitted to use the getDisplayMedia() method to capture screen contents. When this policy is disabled, the promise returned by getDisplayMedia() will reject with a NotAllowedError if permission is not obtained to capture the display's contents.
  // "display-capture",

  // Controls whether the current document is allowed to set document.domain. When this policy is disabled, attempting to set document.domain will fail and cause a SecurityError DOMException to be be thrown.
  "document-domain",

  // Controls whether the current document is allowed to use the Encrypted Media Extensions API (EME). When this policy is disabled, the Promise returned by Navigator.requestMediaKeySystemAccess() will reject with a DOMException.
  "encrypted-media",

  // Controls whether tasks should execute in frames while they're not being rendered (e.g. if an iframe is hidden or display: none).
  //"execution-while-not-rendered",

  // Controls whether tasks should execute in frames while they're outside of the visible viewport.
  //"execution-while-out-of-viewport",

  // Controls whether the current document is allowed to use Element.requestFullScreen(). When this policy is disabled, the returned Promise rejects with a TypeError DOMException.
  // "fullscreen",

  // Controls whether the current document is allowed to use the Geolocation Interface. When this policy is disabled, calls to getCurrentPosition() and watchPosition() will cause those functions' callbacks to be invoked with a PositionError code of PERMISSION_DENIED.
  "geolocation",

  // Controls whether the current document is allowed to gather information about the orientation of the device through the Gyroscope interface.
  "gyroscope",

  // Controls whether the current document is allowed to show layout animations.
  "layout-animations",

  // Controls whether the current document is allowed to display images in legacy formats.
  "legacy-image-formats",

  // Controls whether the current document is allowed to gather information about the orientation of the device through the Magnetometer interface.
  "magnetometer",

  // Controls whether the current document is allowed to use audio input devices. When this policy is disabled, the Promise returned by MediaDevices.getUserMedia() will reject with a NotAllowedError.
  "microphone",

  // Controls whether the current document is allowed to use the Web MIDI API. When this policy is disabled, the Promise returned by Navigator.requestMIDIAccess() will reject with a DOMException.
  "midi",

  // Controls the availability of mechanisms that enables the page author to take control over the behavior of spatial navigation, or to cancel it outright.
  // "navigation-override",

  // Controls whether the current document is allowed to download and display large images.
  "oversized-images",

  // Controls whether the current document is allowed to use the Payment Request API. When this policy is enabled, the PaymentRequest() constructor will throw a SecurityError DOMException.
  "payment",

  // Controls whether the current document is allowed to play a video in a Picture-in-Picture mode via the corresponding API.
  "picture-in-picture",

  // Controls whether the current document is allowed to use the Web Authentication API to retreive already stored public-key credentials, i.e. via navigator.credentials.get({publicKey: ..., ...}).
  "publickey-credentials-get",

  // Controls whether the current document is allowed to make synchronous XMLHttpRequest requests.
  "sync-xhr",

  // Controls whether the current document is allowed to use the WebUSB API.
  "usb",

  // Controls whether the current document is allowed to use the WebVR API. When this policy is disabled, the Promise returned by Navigator.getVRDisplays() will reject with a DOMException. Keep in mind that the WebVR standard is in the process of being replaced with WebXR.
  "vr ",

  // Controls whether the current document is allowed to use Wake Lock API to indicate that device should not enter power-saving mode.
  "wake-lock",

  // Controls whether or not the current document is allowed to use the WebXR Device API to interact with a WebXR session.
  "xr-spatial-tracking",
].join("; ")

// TODO: catch errors and display them in render()

export class ComponentInstance extends React.PureComponent<Props, State> {
  private iframeRef = createRef<HTMLIFrameElement>()
  // True when we've received the COMPONENT_READY message
  private componentReady = false
  private lastRenderArgs = {}
  private lastRenderDataframes = []
  private frameHeight = 0

  public constructor(props: Props) {
    super(props)
    this.state = {}
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
    let componentName: string
    try {
      // Determine the component iframe's src. If a URL is specified, we just
      // use that. Otherwise, we derive the URL from the component's ID.
      componentName = this.props.element.get("componentName")
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
        allow={FEATURE_POLICY}
        ref={this.iframeRef}
        src={src}
        width={this.props.width}
        height={this.frameHeight}
        allowFullScreen={false}
        scrolling="no"
        sandbox={SANDBOX_POLICY}
        title={componentName}
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
