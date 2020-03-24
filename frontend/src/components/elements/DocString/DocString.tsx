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

import React, { PureComponent } from "react"
import { Map as ImmutableMap } from "immutable"
import "./DocString.scss"

export interface Props {
  width: number
  element: ImmutableMap<string, any>
}

/**
 * Functional element representing formatted text.
 */
class DocString extends PureComponent<Props> {
  public render(): React.ReactNode {
    const { element, width } = this.props

    const name = element.get("name")
    const module = element.get("module")
    const docString = element.get("docString")
    const type = element.get("type")
    const signature = element.get("signature")

    const moduleHtml = (
      <span className="doc-module" key="module">
        {module}.
      </span>
    )
    const nameHtml = (
      <span className="doc-name" key="name">
        {name}
      </span>
    )
    const signatureHtml = (
      <span className="doc-signature" key="signature">
        {signature}
      </span>
    )
    const typeHtml = (
      <span key="type" className="doc-type">
        {type}
      </span>
    )

    // Put it all together into a nice little html view.
    return (
      <div className="doc-containter" style={{ width }}>
        <div className="doc-header">
          {name
            ? [
                module ? moduleHtml : "",
                nameHtml,
                signature ? signatureHtml : "",
              ]
            : [typeHtml]}
        </div>
        <div className="doc-string">{docString}</div>
      </div>
    )
  }
}

export default DocString
