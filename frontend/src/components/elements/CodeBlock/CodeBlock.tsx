/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Syntax-highlighted code block.
 */

import Prism from 'prismjs';
import React from 'react';
import {PureStreamlitElement} from '../util/StreamlitElement';

// Prism language definition files.
// These must come after the prismjs import because they modify Prism.languages
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-c';

import './CodeBlock.scss';

interface Props {
  language?: string;
  value: string;
  width: number;
}

/**
 * Renders a code block with syntax highlighting, via Prismjs
 */
class CodeBlock extends PureStreamlitElement<Props> {
  public safeRender(): React.ReactNode {
    if (this.props.language == null) {
      return (
        <pre><code>{this.props.value}</code></pre>
      );
    }

    // Language definition keys are lowercase
    let lang = Prism.languages[this.props.language.toLowerCase()];
    if (lang === undefined) {
      console.warn(`No syntax highlighting for ${this.props.language}; defaulting to Python`);
      lang = Prism.languages.python;
    }

    const html = Prism.highlight(this.props.value, lang, '');
    const cls = `language-${this.props.language}`;

    return (
      <pre className={cls}>
        <code dangerouslySetInnerHTML={{ __html: html }} className={cls} />
      </pre>
    );
  }
}

export default CodeBlock;
