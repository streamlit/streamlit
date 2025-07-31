/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React, { PureComponent, ReactNode } from "react"

import { screen } from "@testing-library/react"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { render } from "~lib/test_util"

import withFullScreenWrapper from "./withFullScreenWrapper"

interface TestProps {
  width: number
  isFullScreen: boolean
  label: string
  height?: number
  expand: () => void
  collapse: () => void
}

class TestComponent extends PureComponent<TestProps> {
  public override render = (): ReactNode => (
    <>
      <div>{this.props.label}</div>
      <div>
        {this.props.isFullScreen ? "isFullScreen" : "NOT isFullScreen"}
      </div>
    </>
  )
}

const getProps = (props: Partial<TestProps> = {}): TestProps => ({
  width: 100,
  isFullScreen: false,
  expand: vi.fn(),
  collapse: vi.fn(),
  label: "label",
  ...props,
})

const WrappedTestComponent = withFullScreenWrapper(TestComponent)

describe("withFullScreenWrapper HOC", () => {
  beforeEach(() => {
    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
  })

  it("renders without crashing", () => {
    render(<WrappedTestComponent {...getProps()} />)

    expect(screen.getByTestId("stFullScreenFrame")).toBeInTheDocument()
  })

  it("renders a component wrapped with FullScreenWrapper", () => {
    const props = getProps()
    render(<WrappedTestComponent {...props} />)

    expect(screen.getByTestId("stFullScreenFrame")).toHaveStyle(`width: 100%`)
  })

  it("renders FullScreenWrapper with specified height", () => {
    const props = getProps({ width: 123, label: "label", height: 455 })
    render(<WrappedTestComponent {...props} />)

    expect(screen.getByTestId("stFullScreenFrame")).toHaveStyle(`width: 100%`)
    expect(screen.getByTestId("stFullScreenFrame")).toHaveStyle(
      `height: ${props.height}`
    )
  })

  it("passes unrelated props to wrapped component", () => {
    const props = getProps()
    render(<WrappedTestComponent {...props} />)

    expect(screen.getByTestId("stFullScreenFrame")).toBeInTheDocument()
    expect(screen.getByText(`${props.label}`)).toBeInTheDocument()
  })

  it("defines `displayName`", () => {
    expect(WrappedTestComponent.displayName).toEqual(
      "withFullScreenWrapper(TestComponent)"
    )
  })
})
