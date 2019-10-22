/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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

import React, { ReactNode, ReactElement } from "react"

import classNames from "classnames"
import ReactJson from "react-json-view"
import { Map as ImmutableMap } from "immutable"
import { Json as JsonProto } from "autogen/proto"

// Ignoring typeScript for this module as it has no ts support
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore

import "./Json.scss"

interface Props {
  width: number
  element: ImmutableMap<string, any>
}

/**
 * Functional element representing formatted text.
 */
class Json extends React.PureComponent<Props> {
  public render(): ReactNode {
    const { element, width } = this.props
    const body = element.get("body")
    const format = element.get("format")
    const styleProp = { width }

    let bodyObject = undefined
    try {
      bodyObject = JSON.parse(body)
    } catch (e) {
      const pos = parseInt(e.message.replace(/[^0-9]/g, ""), 10)
      e.message += `\n${body.substr(0, pos + 1)} ← here`
      throw e
    }
    return (
      <div className="json-text-container stText" style={styleProp}>
        <ReactJson
          src={bodyObject}
          displayDataTypes={false}
          displayObjectSize={false}
          name={false}
          style={{ font: "" }} // Unset so we can style via a CSS file.
        />
      </div>
    )
  }
}

export default Json
