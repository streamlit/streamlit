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

import React, { ReactNode } from "react"
import { Map as ImmutableMap } from "immutable"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { PluginRegistry } from "./PluginRegistry"

export interface Props {
  registry: PluginRegistry
  widgetMgr: WidgetStateManager

  disabled: boolean
  element: ImmutableMap<string, any>
  width: number
}

export interface State {}

export class PluginInstance extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    this.state = {}
  }

  public render = (): ReactNode => {
    const pluginId = this.props.element.get("pluginId")
    const src = this.props.registry.getPluginURL(pluginId, "index.html")
    return (
      <iframe src={src} width={this.props.width} allowFullScreen={false} />
    )

    // // Render the actual plugin!
    // const args = JSON.parse(this.props.element.get("argsJson"))
    // return this.state.plugin.render(args)
  }
}
