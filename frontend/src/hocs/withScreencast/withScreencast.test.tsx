import React, { ComponentType } from "react"
import ScreenCastRecorder from "src/lib/ScreenCastRecorder"
import { shallow } from "src/lib/test_util"

import Countdown from "src/components/core/Countdown"
import withScreencast, { ScreenCastHOC } from "./withScreencast"
import {
  ScreencastDialog,
  UnsupportedBrowserDialog,
  VideoRecordedDialog,
} from "./components"

jest.mock("src/lib/ScreenCastRecorder")

const testComponent: ComponentType = () => <div>test</div>

describe("withScreencast HOC", () => {
  it("renders without crashing", () => {
    const WithHoc = withScreencast(testComponent)
    const wrapper = shallow(<WithHoc />)

    expect(wrapper.html()).not.toBeNull()
  })

  it("wrapped component should have screenCast prop", () => {
    const WithHoc = withScreencast(testComponent)
    const wrapper = shallow(<WithHoc />)

    // @ts-ignore
    expect(wrapper.find(testComponent).props().screenCast).toBeDefined()
  })

  describe("Steps", () => {
    const WithHoc = withScreencast(testComponent)
    const wrapper = shallow(<WithHoc />)

    // @ts-ignore
    ScreenCastRecorder.isSupportedBrowser = () => true

    // @ts-ignore
    wrapper
      .find(testComponent)
      .props()
      // @ts-ignore
      .screenCast.startRecording("screencast-filename")

    it("should show a configuration dialog before start recording", () => {
      expect(wrapper.find(ScreencastDialog).length).toBe(1)
    })

    it("should show a countdown after setup", async () => {
      await wrapper
        .find(ScreencastDialog)
        .props()
        .startRecording()

      const countdownWrapper = wrapper.find(Countdown)

      expect(countdownWrapper.length).toBe(1)
    })

    it("should be on recording state after countdown", async () => {
      const countdownWrapper = wrapper.find(Countdown)

      // @ts-ignore
      wrapper.instance().recorder.start = jest.fn().mockReturnValue(true)

      await countdownWrapper.props().endCallback()

      const wrappedComponentProps: {
        screenCast: ScreenCastHOC
      } = wrapper.find(testComponent).props() as any

      expect(wrappedComponentProps.screenCast.currentState).toBe("RECORDING")
    })

    it("should show recorded dialog after recording", async () => {
      const wrappedComponentProps: {
        screenCast: ScreenCastHOC
      } = wrapper.find(testComponent).props() as any

      // @ts-ignore
      wrapper.instance().recorder.stop = jest
        .fn()
        .mockReturnValue(new Blob([]))

      await wrappedComponentProps.screenCast.stopRecording()

      expect(wrapper.state("currentState")).toBe("PREVIEW_FILE")
      expect(wrapper.find(VideoRecordedDialog).length).toBe(1)
    })
  })

  it("should show an unsupported dialog when it's an unsupported browser", () => {
    const WithHoc = withScreencast(testComponent)
    const wrapper = shallow(<WithHoc />)

    // @ts-ignore
    ScreenCastRecorder.isSupportedBrowser = () => false

    // @ts-ignore
    wrapper
      .find(testComponent)
      .props()
      // @ts-ignore
      .screenCast.startRecording("screencast-filename")

    expect(wrapper.find(UnsupportedBrowserDialog).length).toBe(1)
  })

  it("should show an unsupported dialog when it doesn't have a mediaDevices support", () => {
    const WithHoc = withScreencast(testComponent)
    const wrapper = shallow(<WithHoc />)

    Object.defineProperty(window.navigator, "mediaDevices", {
      value: undefined,
      configurable: true,
    })

    // @ts-ignore
    wrapper
      .find(testComponent)
      .props()
      // @ts-ignore
      .screenCast.startRecording("screencast-filename")

    expect(wrapper.find(UnsupportedBrowserDialog).length).toBe(1)
  })
})
