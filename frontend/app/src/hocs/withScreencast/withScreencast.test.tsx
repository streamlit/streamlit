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

import React, { PureComponent, ReactElement } from "react"

import { screen } from "@testing-library/react"

import { render } from "@streamlit/lib"

import withScreencast, { ScreenCastHOC, Steps } from "./withScreencast"

vi.mock("@streamlit/app/src/util/ScreenCastRecorder")

interface TestProps {
  screenCast: ScreenCastHOC
  testOverride?: Steps

  /**
   * A property that's not related to the withScreencast wrapper.
   * We test that the wrapper passes unrelated props to its wrapped component.
   */
  unrelatedProp: string
}

class TestComponent extends PureComponent<TestProps> {
  public override render = (): ReactElement => (
    <>
      <div>{this.props.unrelatedProp}</div>
      <div>{this.props.screenCast ? "Screencast" : "Undefined"}</div>
    </>
  )
}

const WrappedTestComponent = withScreencast(TestComponent)

describe("withScreencast HOC", () => {
  it("renders without crashing", () => {
    render(<WrappedTestComponent unrelatedProp={"mockLabel"} />)
    expect(screen.getByTestId("stScreencast")).toBeInTheDocument()
  })

  it("wrapped component should have screenCast prop", () => {
    render(<WrappedTestComponent unrelatedProp={"mockLabel"} />)
    expect(screen.getByText("Screencast")).toBeInTheDocument()
  })

  it("passes other props to wrapped component", () => {
    render(<WrappedTestComponent unrelatedProp={"mockLabel"} />)
    expect(screen.getByText("mockLabel")).toBeInTheDocument()
  })

  it("defines displayName", () => {
    render(<WrappedTestComponent unrelatedProp={"mockLabel"} />)
    expect(WrappedTestComponent.displayName).toBe(
      "withScreencast(TestComponent)"
    )
  })

  describe("Steps", () => {
    it("shows a configuration dialog before start recording", () => {
      render(
        <WrappedTestComponent
          unrelatedProp={"mockLabel"}
          testOverride={"SETUP"}
        />
      )
      expect(screen.getByTestId("stScreencastInstruction")).toBeInTheDocument()
    })

    it("shows a countdown after setup", () => {
      render(
        <WrappedTestComponent
          unrelatedProp={"mockLabel"}
          testOverride={"COUNTDOWN"}
        />
      )
      expect(screen.getByTestId("stCountdown")).toBeInTheDocument()
    })

    it("shows an unsupported dialog when it's an unsupported browser", () => {
      render(
        <WrappedTestComponent
          unrelatedProp={"mockLabel"}
          testOverride={"UNSUPPORTED"}
        />
      )
      expect(
        screen.getByTestId("stUnsupportedBrowserDialog")
      ).toBeInTheDocument()
    })
  })
})
