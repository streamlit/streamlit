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

import React, { PureComponent, ReactElement } from "react"
import ScreenCastRecorder from "src/lib/ScreenCastRecorder"
import { shallow } from "src/lib/test_util"

import Countdown from "src/app/components/Countdown"
import withScreencast, { ScreenCastHOC } from "./withScreencast"
import {
  ScreencastDialog,
  UnsupportedBrowserDialog,
  VideoRecordedDialog,
} from "./components"

jest.mock("src/lib/ScreenCastRecorder")

interface TestProps {
  screenCast: ScreenCastHOC

  /**
   * A property that's not related to the withScreencast wrapper.
   * We test that the wrapper passes unrelated props to its wrapped component.
   */
  unrelatedProp: string
}

class TestComponent extends PureComponent<TestProps> {
  public render = (): ReactElement => <div>test</div>
}

const WrappedTestComponent = withScreencast(TestComponent)

describe("withScreencast HOC", () => {
  it("renders without crashing", () => {
    const wrapper = shallow(
      <WrappedTestComponent unrelatedProp={"mockLabel"} />
    )
    expect(wrapper.html()).not.toBeNull()
  })

  it("wrapped component should have screenCast prop", () => {
    const wrapper = shallow(
      <WrappedTestComponent unrelatedProp={"mockLabel"} />
    )
    expect(wrapper.find(TestComponent).props().screenCast).toBeDefined()
  })

  it("passes other props to wrapped component", () => {
    const wrapper = shallow(
      <WrappedTestComponent unrelatedProp={"mockLabel"} />
    )
    expect(wrapper.find(TestComponent).props().unrelatedProp).toBe("mockLabel")
  })

  it("defines displayName", () => {
    expect(WrappedTestComponent.displayName).toBe(
      "withScreencast(TestComponent)"
    )
  })

  describe("Steps", () => {
    const wrapper = shallow(
      <WrappedTestComponent unrelatedProp={"mockLabel"} />
    )

    ScreenCastRecorder.isSupportedBrowser = () => true

    wrapper
      .find(TestComponent)
      .props()
      .screenCast.startRecording("screencast-filename")

    it("shows a configuration dialog before start recording", () => {
      expect(wrapper.find(ScreencastDialog).length).toBe(1)
    })

    it("shows a countdown after setup", async () => {
      await wrapper.find(ScreencastDialog).props().startRecording()

      const countdownWrapper = wrapper.find(Countdown)

      expect(countdownWrapper.length).toBe(1)
    })

    it("is in recording state after countdown", async () => {
      const countdownWrapper = wrapper.find(Countdown)

      // @ts-expect-error
      wrapper.instance().recorder.start = jest.fn().mockReturnValue(true)

      await countdownWrapper.props().endCallback()

      const wrappedComponentProps = wrapper.find(TestComponent).props()
      expect(wrappedComponentProps.screenCast.currentState).toBe("RECORDING")
    })

    it("shows recorded dialog after recording", async () => {
      const wrappedComponentProps = wrapper.find(TestComponent).props()

      // @ts-expect-error
      wrapper.instance().recorder.stop = jest
        .fn()
        .mockReturnValue(new Blob([]))

      await wrappedComponentProps.screenCast.stopRecording()

      expect(wrapper.state("currentState")).toBe("PREVIEW_FILE")
      expect(wrapper.find(VideoRecordedDialog).length).toBe(1)
    })
  })

  it("shows an unsupported dialog when it's an unsupported browser", () => {
    const wrapper = shallow(
      <WrappedTestComponent unrelatedProp={"mockLabel"} />
    )

    ScreenCastRecorder.isSupportedBrowser = () => false

    wrapper
      .find(TestComponent)
      .props()
      .screenCast.startRecording("screencast-filename")

    expect(wrapper.find(UnsupportedBrowserDialog).length).toBe(1)
  })

  it("shows an unsupported dialog when it doesn't have a mediaDevices support", () => {
    const wrapper = shallow(
      <WrappedTestComponent unrelatedProp={"mockLabel"} />
    )

    Object.defineProperty(window.navigator, "mediaDevices", {
      value: undefined,
      configurable: true,
    })

    wrapper
      .find(TestComponent)
      .props()
      .screenCast.startRecording("screencast-filename")

    expect(wrapper.find(UnsupportedBrowserDialog).length).toBe(1)
  })
})
