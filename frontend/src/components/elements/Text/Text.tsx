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
import React, { ReactNode } from "react"

import classNames from "classnames"
import ReactJson from "react-json-view"
import { Map as ImmutableMap } from "immutable"
import { Text as TextProto } from "autogen/proto"

import "./Text.scss"

function getAlertCSSClass(format: TextProto.Format): string | undefined {
  switch (format) {
    case TextProto.Format.ERROR:
      return "alert-danger"
    case TextProto.Format.WARNING:
      return "alert-warning"
    case TextProto.Format.INFO:
      return "alert-info"
    case TextProto.Format.SUCCESS:
      return "alert-success"
  }
  return undefined
}

interface Props {
  width: number
  element: ImmutableMap<string, any>
}

/**
 * Functional element representing formatted text.
 */
class Text extends React.PureComponent<Props> {
  public render(): ReactNode {
    const { element, width } = this.props
    const body = element.get("body")
    const format = element.get("format")
    const styleProp = { width }

    switch (format) {
      // Plain, fixed width text.
      case TextProto.Format.PLAIN: {
        const props = {
          className: classNames("fixed-width", "stText"),
          style: styleProp,
        }

        return <div {...props}>{body}</div>
      }

      // Markdown.
      case TextProto.Format.MARKDOWN: {
        const allowHTML = element.get("allowHtml")
        return (
          <div className="markdown-text-container stText" style={styleProp}>
            <StreamlitMarkdown source={body} allowHTML={allowHTML} />
          </div>
        )
      }

      // A JSON object. Stored as a string.
      case TextProto.Format.JSON: {
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

      case TextProto.Format.ERROR:
      case TextProto.Format.WARNING:
      case TextProto.Format.INFO:
      case TextProto.Format.SUCCESS: {
        return (
          <div
            className={classNames("alert", getAlertCSSClass(format), "stText")}
            style={styleProp}
          >
            <div className="markdown-text-container">
              <StreamlitMarkdown source={body} allowHTML={false} />
            </div>
          </div>
        )
      }

      default:
        throw new Error(`Invalid Text format:${format}`)
    }
  }
}

export default Text
