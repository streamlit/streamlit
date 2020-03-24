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

import Alert from "components/elements/Alert"
import ErrorElement from "components/shared/ErrorElement"
import { Map as ImmutableMap } from "immutable"
import { WidgetStateManager } from "lib/WidgetStateManager"
import React from "react"
import ReactJson from "react-json-view"
import { makeElementWithInfoText } from "../../../lib/utils"
import { PluginRegistry } from "./PluginRegistry"

export interface Props {
  registry: PluginRegistry
  widgetMgr: WidgetStateManager

  disabled: boolean
  element: ImmutableMap<string, any>
  width: number
}

export interface State {
  pluginCode?: string
  pluginCodeError?: Error
}

export class PluginInstance extends React.PureComponent<Props, State> {
  public constructor(props: Props) {
    super(props)

    this.state = {
      pluginCode: undefined,
      pluginCodeError: undefined,
    }
    this.initPlugin()
  }

  /** Fetch our plugin code from the registry. */
  private initPlugin = (): void => {
    this.props.registry
      .getPlugin(this.props.element.get("pluginId"))
      .then(code => this.setState({ pluginCode: code }))
      .catch(error => this.setState({ pluginCodeError: error }))
  }

  public render = (): JSX.Element => {
    // If we failed to download the plugin, show an error.
    if (this.state.pluginCodeError != null) {
      return (
        <ErrorElement
          width={this.props.width}
          name={"Error loading plugin"}
          message={this.state.pluginCodeError.message}
        />
      )
    }

    // If we're retrieving our plugin, show a loading alert
    if (this.state.pluginCode === undefined) {
      return (
        <Alert
          element={makeElementWithInfoText("Loading...").get("alert")}
          width={this.props.width}
        />
      )
    }

    // Render the actual plugin!
    const styleProp = { width: this.props.width }
    const bodyObject = JSON.parse(this.props.element.get("jsonArgs"))

    return (
      <>
        <div className="json-text-container stJson" style={styleProp}>
          <ReactJson
            src={bodyObject}
            displayDataTypes={false}
            displayObjectSize={false}
            name={false}
            style={{ font: "" }} // Unset so we can style via a CSS file.
          />
        </div>
        <div>{this.state.pluginCode}</div>
      </>
    )
  }
}
