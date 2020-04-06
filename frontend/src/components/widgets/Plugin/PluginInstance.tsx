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

import { Map as ImmutableMap } from "immutable"
import { logWarning } from "lib/log"
import { WidgetStateManager } from "lib/WidgetStateManager"
import React, { createRef, ReactNode } from "react"
import { PluginRegistry } from "./PluginRegistry"

/** Messages from Plugin -> Streamlit */
enum PluginBackMsgType {
  // A plugin sends this message when it's ready to receive messages
  // from Streamlit. Streamlit won't send any messages until it gets this.
  // No data.
  PLUGIN_READY = "pluginReady",

  // TODO: Widget update messages
}

/** Messages from Streamlit -> Plugin */
enum PluginForwardMsgType {
  // Sent by Streamlit when the plugin should re-render.
  // Data: args: any - the args JSON dict sent from the backend
  RENDER = "render",
}

export interface Props {
  registry: PluginRegistry
  widgetMgr: WidgetStateManager

  disabled: boolean
  element: ImmutableMap<string, any>
  width: number
}

// TODO: catch errors and display them in render()

export class PluginInstance extends React.PureComponent<Props> {
  private iframeRef = createRef<HTMLIFrameElement>()
  // True when we've received the PLUGIN_READY message
  private pluginReady = false
  private pendingRenderArgs = {}

  public constructor(props: Props) {
    super(props)
    // TODO: Do *not* listen for messages in each PluginInstance.
    // Instead, a central plugin message processor should dispatch
    // messages to PluginInstances as appropriate.
    window.addEventListener("message", this.onMessageEvent)
  }

  public componentWillUnmount = (): void => {
    window.removeEventListener("message", this.onMessageEvent)
  }

  /** True if the message comes from our iframe */
  private isIFrameMessage(event: MessageEvent): boolean {
    if (this.iframeRef.current == null) {
      // we have no iframe
      return false
    }

    if (this.iframeRef.current.contentWindow == null) {
      // We have no iframe contentWindow. This should never happen;
      // an iframe will have a contentWindow as soon as it's loaded.
      return false
    }

    return event.source == this.iframeRef.current.contentWindow
  }

  private onMessageEvent = (event: MessageEvent): void => {
    if ("isStreamlitMessage" in event.data && this.isIFrameMessage(event)) {
      const type = event.data["type"]
      this.onBackMsg(type, event.data)
    } else {
      console.log("onMessageEvent (non-plugin)")
    }
  }

  private onBackMsg = (type: string, data: any): void => {
    switch (type) {
      case PluginBackMsgType.PLUGIN_READY:
        if (this.pluginReady) {
          logWarning(`Got multiple PLUGIN_READY messages!`)
        } else {
          // Our plugin is ready to begin receiving messages. Send off its
          // first render message!
          this.pluginReady = true
          this.sendForwardMsg(PluginForwardMsgType.RENDER, {
            args: this.pendingRenderArgs,
          })
        }
        break

      default:
        logWarning(`Unrecognized PluginBackMsg: ${type}`)
    }
  }

  private sendForwardMsg = (type: PluginForwardMsgType, data: any): void => {
    if (this.iframeRef.current == null) {
      // This should never happen
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
        isStreamlitMessage: true,
        type: type,
        ...data,
      },
      "*"
    )
  }

  public render = (): ReactNode => {
    const pluginId = this.props.element.get("pluginId")
    const src = this.props.registry.getPluginURL(pluginId, "index.html")

    const renderArgs = JSON.parse(this.props.element.get("argsJson"))
    if (this.pluginReady) {
      // The plugin has loaded. Send it a new render message immediately.
      this.sendForwardMsg(PluginForwardMsgType.RENDER, { args: renderArgs })
    } else {
      // The plugin hasn't yet loaded. Save these render args; we'll
      // send the RENDER message as soon as the plugin is ready.
      this.pendingRenderArgs = renderArgs
    }

    // Render the iframe
    return (
      <iframe
        ref={this.iframeRef}
        src={src}
        width={this.props.width}
        allowFullScreen={false}
      />
    )
  }
}
