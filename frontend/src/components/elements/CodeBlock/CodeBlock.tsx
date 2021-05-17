/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import Prism, { Grammar } from "prismjs"
import React, { ReactElement } from "react"

// Prism language definition files.
// These must come after the prismjs import because they modify Prism.languages
import "prismjs/components/prism-bash"
import "prismjs/components/prism-c"
import "prismjs/components/prism-css"
import "prismjs/components/prism-json"
import "prismjs/components/prism-jsx"
import "prismjs/components/prism-python"
import "prismjs/components/prism-sql"
import "prismjs/components/prism-toml"
import "prismjs/components/prism-typescript"
import "prismjs/components/prism-yaml"

import { logWarning } from "src/lib/log"

import CopyButton from "./CopyButton"
import {
  StyledPre,
  StyledCodeBlock,
  StyledCopyButtonContainer,
} from "./styled-components"

interface CodeTagProps {
  language?: string | null
  value: string
}

export interface CodeBlockProps extends CodeTagProps {}

/**
 * Renders code tag with highlighting based on requested language.
 */
function CodeTag({ language, value }: CodeTagProps): ReactElement {
  // language is explicitly null; don't highlight
  if (language === null) {
    return <code>{value}</code>
  }

  // no language provided; we'll default to python
  if (language === undefined) {
    logWarning(`No language provided, defaulting to Python`)
  }

  const languageKey = (language || "python").toLowerCase()

  // language provided, but not supported; don't highlight
  const lang: Grammar = Prism.languages[languageKey]
  if (!lang) {
    logWarning(`No syntax highlighting for ${language}.`)
    return <code>{value}</code>
  }

  // language provided & supported; return highlighted code
  return (
    <code
      className={`language-${languageKey}`}
      dangerouslySetInnerHTML={{
        __html: value && Prism.highlight(value, lang, ""),
      }}
    />
  )
}

/**
 * Renders a code block with syntax highlighting, via Prismjs
 */
export default function CodeBlock({
  language,
  value,
}: CodeBlockProps): ReactElement {
  return (
    <StyledCodeBlock className="stCodeBlock">
      {value && (
        <StyledCopyButtonContainer>
          <CopyButton text={value} />
        </StyledCopyButtonContainer>
      )}
      <StyledPre>
        <CodeTag language={language} value={value} />
      </StyledPre>
    </StyledCodeBlock>
  )
}
