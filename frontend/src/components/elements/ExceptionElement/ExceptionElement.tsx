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

import React from "react"
import { Map as ImmutableMap } from "immutable"
import "./ExceptionElement.scss"

interface Props {
  width: number
  element: ImmutableMap<string, any>
}

/**
 * Functional element representing formatted text.
 */
class ExceptionElement extends React.PureComponent<Props> {
  public render(): React.ReactNode {
    const { element, width } = this.props
    const type = element.get("type")
    let message = element.get("message")
    if (message) {
      message = `: ${message}`
    }
    const stackTrace = element.get("stackTrace")

    // Put it all together into a nice little html view.
    return (
      <div
        className="alert alert-danger exception stException"
        style={{ width }}
      >
        <div className="message">
          <strong>{type}</strong>
          {message}
        </div>
        <div className="stack-trace">
          {stackTrace.map((row: string, indx: string) => (
            <div className="row" key={indx}>
              {row}
            </div>
          ))}
        </div>
      </div>
    )
  }
}

export default ExceptionElement
