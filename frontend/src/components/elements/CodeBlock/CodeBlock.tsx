/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Syntax-highlighted code block.
 */

import React, { Fragment } from 'react'
import Prism from 'prismjs'
// Prism language definition files.
// These must come after the prismjs import because they modify Prism.languages
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-c'
import { PureStreamlitElement, StProps, StState } from 'components/shared/StreamlitElement/'
import CopyButton from './CopyButton'
import './CodeBlock.scss'

interface Props extends StProps {
  language?: string;
  value: string;
}

/**
 * Renders a code block with syntax highlighting, via Prismjs
 */
class CodeBlock extends PureStreamlitElement<Props, StState> {
  public safeRender(): React.ReactNode {
    if (this.props.language === undefined) {
      return (
        <Fragment>
          <pre>
            <div className="scrollable">
              <code>{this.props.value}</code>
            </div>
          </pre>
          <CopyButton text={this.props.value} />
        </Fragment>
      )
    }

    // Language definition keys are lowercase
    let lang = Prism.languages[this.props.language.toLowerCase()]
    if (lang === undefined) {
      console.warn(`No syntax highlighting for ${this.props.language}; defaulting to Python`)
      lang = Prism.languages.python
    }

    const safeHtml = Prism.highlight(this.props.value, lang, '')
    const languageClassName = `language-${this.props.language}`
    return (
      <Fragment>
        <pre>
          <div className="scrollable">
            <code
              className={languageClassName}
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          </div>
        </pre>
        <CopyButton text={this.props.value} />
      </Fragment>
    )
  }
}

export default CodeBlock
