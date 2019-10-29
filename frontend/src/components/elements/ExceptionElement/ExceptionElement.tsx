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

import { StreamlitMarkdown } from "components/shared/StreamlitMarkdown"
import { Map as ImmutableMap } from "immutable"
import React, { ReactNode } from "react"
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
    const message = element.get("message")
    const stackTrace = element.get("stackTrace")

    // On the backend, we use the StreamlitException type for errors that
    // originate from inside Streamlit. These errors have Markdown-formatted
    // messages, and so we wrap those messages inside our Markdown renderer.
    let messageNode: ReactNode = message
    if (element.get("messageIsMarkdown")) {
      messageNode = <StreamlitMarkdown source={message} allowHTML={false} />
    } else if (message) {
      messageNode = `: ${message}`
    }

    // Put it all together into a nice little html view.
    return (
      <div
        className="alert alert-danger exception stException"
        style={{ width }}
      >
        <div className="message">
          <div className="type">{type}</div>
          {messageNode}
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
