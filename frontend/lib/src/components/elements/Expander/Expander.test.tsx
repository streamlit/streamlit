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

import { screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import { render } from "@streamlit/lib/src/test_util"
import { Block as BlockProto } from "@streamlit/lib/src/proto"

import Expander, { ExpanderProps } from "./Expander"

const getProps = (
  elementProps: Partial<BlockProto.Expandable> = {},
  props: Partial<ExpanderProps> = {}
): ExpanderProps => ({
  element: BlockProto.Expandable.create({
    label: "hi",
    expanded: true,
    ...elementProps,
  }),
  widgetsDisabled: false,
  isStale: false,
  empty: false,
  ...props,
})

describe("Expander container", () => {
  it("renders without crashing", () => {
    const props = getProps()
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    const expanderContainer = screen.getByTestId("stExpander")
    expect(expanderContainer).toBeInTheDocument()
  })

  it("renders expander label as expected", () => {
    const props = getProps()
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    expect(screen.getByText(props.element.label)).toBeInTheDocument()
  })

  it("should render a expanded component", () => {
    const props = getProps()
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    expect(screen.getByText("test")).toBeVisible()
  })

  it("should render a collapsed component", () => {
    const props = getProps({ expanded: false })
    render(
      <Expander {...props}>
        <div>test</div>
      </Expander>
    )
    expect(screen.queryByText("test")).not.toBeInTheDocument()
  })
})
