/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { render } from "src/lib/test_util"
import React from "react"
import StreamlitSyntaxHighlighter, {
  StreamlitSyntaxHighlighterProps,
} from "./StreamlitSyntaxHighlighter"

const getStreamlitSyntaxHighlighterProps = (
  props: Partial<StreamlitSyntaxHighlighterProps> = {}
): StreamlitSyntaxHighlighterProps => ({
  children: [
    `import streamlit as st

st.write("Hello")
`,
  ],
  ...props,
})

describe("CustomCodeTag Element", () => {
  it("should render without crashing", () => {
    const props = getStreamlitSyntaxHighlighterProps()
    const { baseElement } = render(<StreamlitSyntaxHighlighter {...props} />)

    expect(baseElement.querySelectorAll("pre code")).toHaveLength(1)
  })

  it("should render as plaintext", () => {
    const props = getStreamlitSyntaxHighlighterProps({ language: "plaintext" })
    const { baseElement } = render(<StreamlitSyntaxHighlighter {...props} />)

    expect(baseElement.querySelector("pre code")?.outerHTML).toBe(
      '<code class="language-plaintext" style="white-space: pre;"><span>import streamlit as st\n' +
        "</span>\n" +
        'st.write("Hello")\n' +
        "</code>"
    )
  })

  it("should render as plaintext if no language specified", () => {
    const props = getStreamlitSyntaxHighlighterProps({ language: "plaintext" })
    const { baseElement } = render(<StreamlitSyntaxHighlighter {...props} />)

    expect(baseElement.querySelector("pre code")?.outerHTML).toBe(
      '<code class="language-plaintext" style="white-space: pre;"><span>import streamlit as st\n' +
        "</span>\n" +
        'st.write("Hello")\n' +
        "</code>"
    )
  })

  it("should render as python", () => {
    const props = getStreamlitSyntaxHighlighterProps({ language: "python" })
    const { baseElement } = render(<StreamlitSyntaxHighlighter {...props} />)
    expect(
      baseElement.querySelector("pre code .token.string")?.innerHTML
    ).toBe('"Hello"')
  })
})
