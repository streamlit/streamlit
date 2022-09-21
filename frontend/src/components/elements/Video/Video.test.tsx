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
import { mount } from "src/lib/test_util"
import { Video as VideoProto } from "src/autogen/proto"

import Video, { VideoProps } from "./Video"

const getProps = (elementProps: Partial<VideoProto> = {}): VideoProps => ({
  element: VideoProto.create({
    url: "https://www.w3schools.com/html/mov_bbb.mp4",
    type: VideoProto.Type.UNUSED,
    startTime: 0,
    ...elementProps,
  }),
  width: 0,
})

describe("Video Element", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<Video {...props} />)

    expect(wrapper.find("video").length).toBe(1)
  })

  it("should have correct style", () => {
    const props = getProps()
    const wrapper = mount(<Video {...props} />)
    const videoWrapper = wrapper.find("video")

    expect(videoWrapper.prop("className")).toContain("stVideo")
    expect(videoWrapper.prop("style")).toStrictEqual({
      width: props.width,
      height: 528,
    })
  })

  it("should have controls", () => {
    const props = getProps()
    const wrapper = mount(<Video {...props} />)

    expect(wrapper.find("video").prop("controls")).toBeDefined()
  })

  it("should build url correctly if it starts with /media", () => {
    const props = getProps({
      url: "/media/url.test.mp4",
    })
    const wrapper = mount(<Video {...props} />)

    expect(wrapper.find("video").prop("src")).toBe(
      "http://localhost:80/media/url.test.mp4"
    )
  })

  describe("YouTube", () => {
    it("should render a youtube iframe", () => {
      const props = getProps({
        type: VideoProto.Type.YOUTUBE_IFRAME,
      })
      const wrapper = mount(<Video {...props} />)
      const iframeWrapper = wrapper.find("iframe")

      expect(iframeWrapper.props()).toMatchSnapshot()
    })

    it("should render a youtube iframe with an starting time", () => {
      const props = getProps({
        type: VideoProto.Type.YOUTUBE_IFRAME,
        startTime: 10,
      })
      const wrapper = mount(<Video {...props} />)
      const iframeWrapper = wrapper.find("iframe")

      expect(iframeWrapper.props()).toMatchSnapshot()
    })
  })

  describe("updateTime", () => {
    const props = getProps()
    const wrapper = mount(<Video {...props} />)
    const videoElement: HTMLVideoElement = wrapper.find("video").getDOMNode()

    it("should set the current time to startTime on mount", () => {
      videoElement.dispatchEvent(new Event("loadedmetadata"))
      expect(videoElement.currentTime).toBe(0)
    })

    it("should update the current time when startTime is changed", () => {
      wrapper.setProps(getProps({ startTime: 10 }))
      videoElement.dispatchEvent(new Event("loadedmetadata"))
      expect(videoElement.currentTime).toBe(10)
    })
  })
})
