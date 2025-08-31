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

import React, { FC, PureComponent, ReactNode } from "react"

import { screen } from "@testing-library/react"

import { ElementFullscreenContext } from "~lib/components/shared/ElementFullscreen/ElementFullscreenContext"
import * as UseFullscreen from "~lib/components/shared/ElementFullscreen/useFullscreen"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
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

// Test component that consumes the ElementFullscreenContext
const TestContextConsumer: FC = () => {
  const { width, height, expanded } = useRequiredContext(
    ElementFullscreenContext
  )

  return (
    <div data-testid="context-consumer">
      <div data-testid="context-width">{width}</div>
      <div data-testid="context-height">{height ?? "undefined"}</div>
      <div data-testid="context-expanded">{expanded.toString()}</div>
    </div>
  )
}

const WrappedTestComponent = withFullScreenWrapper(TestComponent)
const WrappedContextConsumer = withFullScreenWrapper(TestContextConsumer)

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

  it("provides correct ElementFullscreenContext values in normal mode", () => {
    render(<WrappedContextConsumer />)

    // Width comes from ResizeObserver mock
    expect(screen.getByTestId("context-width")).toHaveTextContent("250")
    expect(screen.getByTestId("context-height")).toHaveTextContent("undefined")
    // Not expanded in normal mode
    expect(screen.getByTestId("context-expanded")).toHaveTextContent("false")
  })

  it("provides correct ElementFullscreenContext values in fullscreen mode", () => {
    // Mock fullscreen state
    vi.spyOn(UseFullscreen, "useFullscreen").mockReturnValue({
      expanded: true,
      fullHeight: 800,
      fullWidth: 1200,
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
    })

    render(<WrappedContextConsumer />)

    expect(screen.getByTestId("context-width")).toHaveTextContent("1200")
    expect(screen.getByTestId("context-height")).toHaveTextContent("800")
    expect(screen.getByTestId("context-expanded")).toHaveTextContent("true")
  })
})
