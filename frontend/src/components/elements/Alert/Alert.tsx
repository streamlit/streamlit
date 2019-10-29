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
import ReactMarkdown from "react-markdown"
import { Map as ImmutableMap } from "immutable"
import { Alert as AlertProto } from "autogen/proto"
import { linkWithTargetBlank, linkReferenceHasParens } from "lib/markdown_util"

import "./Alert.scss"

var ALERT_CSS_CLASS: ImmutableMap = {
  [AlertProto.Format.ERROR]: "alert-danger",
  [AlertProto.Format.WARNING]: "alert-warning",
  [AlertProto.Format.INFO]: "alert-warning",
  [AlertProto.Format.SUCCESS]: "alert-success",
}

interface Props {
  width: number
  element: ImmutableMap<string, any>
}

/**
 * Functional element representing error/warning/info/success boxes
 * which are allowed to be formatted in Markdown.
 */
class Alert extends React.PureComponent<Props> {
  public render(): ReactNode {
    const { element, width } = this.props
    const body = element.get("body")
    const format = element.get("format")
    const renderers = {
      link: linkWithTargetBlank,
      linkReference: linkReferenceHasParens,
    }
    const styleProp = { width }

    return (
      <div
        className={classNames("alert", ALERT_CSS_CLASS[format], "stAlert")}
        style={styleProp}
      >
        <div className="markdown-text-container">
          <ReactMarkdown source={body} renderers={renderers} />
        </div>
      </div>
    )
  }
}

export default Alert
