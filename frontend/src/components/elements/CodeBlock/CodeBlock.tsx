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

import Prism from "prismjs"
import React, { PureComponent, ReactNode } from "react"

// Prism language definition files.
// These must come after the prismjs import because they modify Prism.languages
import "prismjs/components/prism-jsx"
import "prismjs/components/prism-python"
import "prismjs/components/prism-typescript"
import "prismjs/components/prism-sql"
import "prismjs/components/prism-bash"
import "prismjs/components/prism-json"
import "prismjs/components/prism-yaml"
import "prismjs/components/prism-css"
import "prismjs/components/prism-c"
import CopyButton from "./CopyButton"
import "./CodeBlock.scss"

export interface Props {
  width: number
  language?: string
  value: string
}

/**
 * Renders a code block with syntax highlighting, via Prismjs
 */
class CodeBlock extends PureComponent<Props> {
  public render(): ReactNode {
    if (this.props.language == null) {
      return (
        <div className="stCodeBlock">
          <CopyButton text={this.props.value} />
          <pre>
            <code>{this.props.value}</code>
          </pre>
        </div>
      )
    }

    // Language definition keys are lowercase
    let lang = Prism.languages[this.props.language.toLowerCase()]
    let languageClassName = `language-${this.props.language}`

    if (lang === undefined) {
      console.warn(
        `No syntax highlighting for ${this.props.language}; defaulting to Python`
      )
      lang = Prism.languages.python
      languageClassName = "language-python"
    }

    const safeHtml = this.props.value
      ? Prism.highlight(this.props.value, lang, "")
      : ""

    return (
      <div className="stCodeBlock">
        <CopyButton text={this.props.value} />
        <pre>
          <code
            className={languageClassName}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        </pre>
      </div>
    )
  }
}

export default CodeBlock
