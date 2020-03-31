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
import { WidgetStateManager } from "lib/WidgetStateManager"
import React, { createRef, ReactNode } from "react"
import { PluginRegistry } from "./PluginRegistry"

export interface Props {
  registry: PluginRegistry
  widgetMgr: WidgetStateManager

  disabled: boolean
  element: ImmutableMap<string, any>
  width: number
}

export interface State {}

// TODO: catch errors and display them in render()

export class PluginInstance extends React.PureComponent<Props, State> {
  private iframeRef = createRef<HTMLIFrameElement>()

  public constructor(props: Props) {
    super(props)
  }

  public componentDidMount = (): void => {
    if (this.iframeRef.current == null) {
      throw new Error("Null iframeRef! Something's gone terribly wrong.")
    }

    window.addEventListener("message", this.onPluginMessage)
    this.iframeRef.current.addEventListener("load", this.onFrameLoaded)
  }

  public componentWillUnmount = (): void => {
    window.removeEventListener("message", this.onPluginMessage)
  }

  private onFrameLoaded = (event: Event): void => {
    console.log(`onFrameLoaded: ${event}`)
  }

  private onPluginMessage = (event: MessageEvent): void => {
    console.log(
      `onPluginMessage (origin=${event.origin}, source=${event.source}, data=${event.data})`
    )
  }

  public render = (): ReactNode => {
    const pluginId = this.props.element.get("pluginId")
    const src = this.props.registry.getPluginURL(pluginId, "index.html")
    return (
      <iframe
        ref={this.iframeRef}
        src={src}
        width={this.props.width}
        allowFullScreen={false}
      />
    )

    // // Render the actual plugin!
    // const args = JSON.parse(this.props.element.get("argsJson"))
    // return this.state.plugin.render(args)
  }
}
