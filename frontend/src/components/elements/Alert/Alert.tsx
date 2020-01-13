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

import classNames from "classnames"
import { Map as ImmutableMap } from "immutable"
import { Alert as AlertProto } from "autogen/proto"
import { StreamlitMarkdown } from "components/shared/StreamlitMarkdown"

import "./Alert.scss"
import "assets/css/write.scss"

// classes defined in assets/css/theme.scss
const ALERT_CSS_CLASS = ImmutableMap({
  [AlertProto.Format.SUCCESS]: "alert-success",
  [AlertProto.Format.INFO]: "alert-info",
  [AlertProto.Format.WARNING]: "alert-warning",
  [AlertProto.Format.ERROR]: "alert-danger",
})

export function getAlertCSSClass(format: number): string {
  const cname = ALERT_CSS_CLASS.get(format.toString())
  if (cname) {
    return cname
  } else {
    throw new Error(`Unexpected alert type: ${format}`)
  }
}

export interface Props {
  width: number
  element: ImmutableMap<string, any>
}

/**
 * Functional element representing error/warning/info/success boxes
 * which may be formatted in Markdown.
 */
class Alert extends React.PureComponent<Props> {
  public render(): ReactNode {
    const { element, width } = this.props
    const body = element.get("body")
    const format = element.get("format")

    return (
      <div
        className={classNames("alert", getAlertCSSClass(format), "stAlert")}
        style={{ width }}
      >
        <div className="markdown-text-container">
          <StreamlitMarkdown source={body} allowHTML={false} />
        </div>
      </div>
    )
  }
}

export default Alert
