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

import { StreamlitMarkdown } from "components/shared/StreamlitMarkdown"
import React, { ReactNode } from "react"
import { Map as ImmutableMap } from "immutable"

import "assets/css/write.scss"

export interface Props {
  width: number
  element: ImmutableMap<string, any>
}

/**
 * Functional element representing Markdown formatted text.
 */
class Markdown extends React.PureComponent<Props> {
  public render(): ReactNode {
    const { element, width } = this.props
    const body = element.get("body")
    const styleProp = { width }

    const allowHTML = element.get("allowHtml")
    return (
      <div className="markdown-text-container stMarkdown" style={styleProp}>
        <StreamlitMarkdown source={body} allowHTML={allowHTML} />
      </div>
    )
  }
}

export default Markdown
