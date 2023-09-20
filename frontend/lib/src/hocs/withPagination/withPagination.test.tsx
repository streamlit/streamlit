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
import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"
import { render } from "@streamlit/lib/src/test_util"

import withPagination, { Props as HocProps } from "./withPagination"

const TestComponent: React.ComponentType = () => <div>test</div>

const getProps = (props: Partial<HocProps> = {}): HocProps => ({
  items: [{}, {}, {}, {}],
  pageSize: 2,
  resetOnAdd: true,
  ...props,
})

describe("withPagination HOC", () => {
  const setState = jest.fn()
  const useStateSpy = jest.spyOn(React, "useState")
  // @ts-expect-error
  useStateSpy.mockImplementation(init => [init, setState])

  it("renders without crashing", () => {
    const props = getProps()
    const WithHoc = withPagination(TestComponent)
    render(<WithHoc {...props} />)

    expect(screen.getByText("test")).toBeInTheDocument()
    expect(screen.getByTestId("stPagination")).toBeInTheDocument()
  })

  it("should render a paginated component", () => {
    const props = getProps({
      pageSize: 3,
      items: [{}, {}, {}, {}],
    })
    const WithHoc = withPagination(TestComponent)
    render(<WithHoc {...props} />)
    expect(screen.getByText("test")).toBeInTheDocument()
    expect(screen.getByTestId("stPagination")).toBeInTheDocument()
    expect(screen.getByText("Showing page 1 of 2")).toBeInTheDocument()
  })

  it("should render component without pagination", () => {
    const props = getProps({
      pageSize: 5,
      items: [{}, {}, {}, {}],
    })
    const WithHoc = withPagination(TestComponent)
    render(<WithHoc {...props} />)
    expect(screen.getByText("test")).toBeInTheDocument()
    expect(screen.queryByTestId("stPagination")).not.toBeInTheDocument()
  })

  it("should reset on add", () => {
    const props = getProps()
    const WithHoc = withPagination(TestComponent)
    const { rerender } = render(<WithHoc {...props} />)
    const newProps = getProps({ items: props.items.concat([{}]) })
    rerender(<WithHoc {...newProps} />)

    expect(screen.getByText("Showing page 1 of 3")).toBeInTheDocument()
  })
})
