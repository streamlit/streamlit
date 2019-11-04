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

import classNames from "classnames"
import { Map as ImmutableMap } from "immutable"

import "assets/css/write.scss"

/* Move to MARKDOWN
// @ts-ignore
import { InlineMath, BlockMath } from "react-katex"
// @ts-ignore
import RemarkMathPlugin from "remark-math"
import "katex/dist/katex.min.css"
*/

export interface Props {
  width: number
  element: ImmutableMap<string, any>
}

/**
 * Functional element representing preformatted (plain) text.
 */
class Text extends React.PureComponent<Props> {
  public render(): ReactNode {
    const { element, width } = this.props
    const body = element.get("body")
    const styleProp = { width }

    return (
      <div className={classNames("fixed-width", "stText")} style={styleProp}>
        {body}
      </div>
    )

    /* move to Markdown
    const renderers = {
      code: CodeBlock,
      link: linkWithTargetBlank,
      linkReference: linkReferenceHasParens,
      inlineMath: (props: { value: string }) => (
        <InlineMath>{props.value}</InlineMath>
      ),
      math: (props: { value: string }) => <BlockMath>{props.value}</BlockMath>,
    }
    const plugins = [RemarkMathPlugin]
      
        const allowHTML = element.get("allowHtml")
        const astPlugins = allowHTML ? [htmlParser()] : []

        return (
          <div className="markdown-text-container stText" style={{ width }}>
            <ReactMarkdown
              source={body}
              escapeHtml={!allowHTML}
              astPlugins={astPlugins}
              plugins={plugins}
              renderers={renderers}
            />
          </div>
        )
    */
  }
}

export default Text
