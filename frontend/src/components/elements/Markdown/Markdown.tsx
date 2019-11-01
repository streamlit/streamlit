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

import React, { ReactNode } from "react"

import ReactMarkdown from "react-markdown"
import { Map as ImmutableMap } from "immutable"
import { linkWithTargetBlank, linkReferenceHasParens } from "lib/markdown_util"
import CodeBlock from "../CodeBlock"

// html-parser has no Typescript definitions.
// @ts-ignore
import htmlParser from "react-markdown/plugins/html-parser"

import "assets/css/write.scss"

interface Props {
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
    const renderers = {
      code: CodeBlock,
      link: linkWithTargetBlank,
      linkReference: linkReferenceHasParens,
    }
    const styleProp = { width }

    const allowHTML = element.get("allowHtml")
    const astPlugins = allowHTML ? [htmlParser()] : []

    return (
      <div className="markdown-text-container stMarkdown" style={styleProp}>
        <ReactMarkdown
          source={body}
          escapeHtml={!allowHTML}
          astPlugins={astPlugins}
          renderers={renderers}
        />
      </div>
    )
  }
}

export default Markdown
