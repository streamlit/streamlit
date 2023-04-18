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

import React from "react"
import { shallow, mount } from "src/lib/test_util"
import { Markdown as MarkdownProto } from "src/lib/proto"
import Markdown, { MarkdownProps } from "./Markdown"
import {
  InlineTooltipIcon,
  StyledLabelHelpWrapper,
} from "src/lib/components/shared/TooltipIcon"

const getProps = (
  elementProps: Partial<MarkdownProps> = {}
): MarkdownProps => ({
  element: MarkdownProto.create({
    body:
      "Emphasis, aka italics, with *asterisks* or _underscores_." +
      "Combined emphasis with **asterisks and _underscores_**." +
      "[I'm an inline-style link with title](https://www.https://streamlit.io/ Streamlit)",
    allowHtml: false,
    ...elementProps,
  }),
  width: 100,
})

describe("Markdown element", () => {
  it("renders markdown as expected", () => {
    const props = getProps()
    const wrap = shallow(<Markdown {...props} />)
    const elem = wrap.get(0)
    expect(elem.props.className.includes("stMarkdown")).toBeTruthy()
    expect(elem.props.style.width).toBe(100)
  })
  /* MAYBE ADD TESTS?
  a) unit tests with different Markdown formatted text
  b) allow_html property
  */
})

describe("Markdown element with help", () => {
  it("renders markdown with help tooltip as expected", () => {
    const props = getProps({ help: "help text" })
    const wrapper = mount(<Markdown {...props} />)
    const inlineTooltipIcon = wrapper.children().find(InlineTooltipIcon)
    expect(inlineTooltipIcon.exists()).toBe(true)
    expect(inlineTooltipIcon.props().content).toBe("help text")
    expect(wrapper.children().find(StyledLabelHelpWrapper).exists()).toBe(true)
  })
})
