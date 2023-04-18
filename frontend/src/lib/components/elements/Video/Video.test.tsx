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
import { mount, shallow } from "src/lib/test_util"
import { Video as VideoProto } from "src/lib/proto"
import { mockEndpoints } from "src/lib/mocks/mocks"

import Video, { VideoProps } from "./Video"

describe("Video Element", () => {
  const buildMediaURL = jest.fn().mockReturnValue("https://mock.media.url")

  const getProps = (elementProps: Partial<VideoProto> = {}): VideoProps => ({
    element: VideoProto.create({
      url: "https://www.w3schools.com/html/mov_bbb.mp4",
      type: VideoProto.Type.UNUSED,
      startTime: 0,
      ...elementProps,
    }),
    endpoints: mockEndpoints({ buildMediaURL: buildMediaURL }),
    width: 0,
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<Video {...props} />)

    expect(wrapper.find("video").length).toBe(1)
  })

  it("has correct style", () => {
    const props = getProps()
    const wrapper = mount(<Video {...props} />)
    const videoWrapper = wrapper.find("video")

    expect(videoWrapper.prop("className")).toContain("stVideo")
    expect(videoWrapper.prop("style")).toStrictEqual({
      width: props.width,
      height: 528,
    })
  })

  it("has controls", () => {
    const props = getProps()
    const wrapper = mount(<Video {...props} />)

    expect(wrapper.find("video").prop("controls")).toBeDefined()
  })

  it("creates its `src` attribute using buildMediaURL", () => {
    const wrapper = shallow(
      <Video {...getProps({ url: "/media/mockVideoFile.mp4" })} />
    )
    const videoElement = wrapper.find("video")
    expect(buildMediaURL).toHaveBeenCalledWith("/media/mockVideoFile.mp4")
    expect(videoElement.prop("src")).toBe("https://mock.media.url")
  })

  describe("YouTube", () => {
    it("renders a youtube iframe", () => {
      const props = getProps({
        type: VideoProto.Type.YOUTUBE_IFRAME,
      })
      const wrapper = mount(<Video {...props} />)
      const iframeWrapper = wrapper.find("iframe")

      expect(iframeWrapper.props()).toMatchSnapshot()
    })

    it("renders a youtube iframe with an starting time", () => {
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

    it("sets the current time to startTime on mount", () => {
      videoElement.dispatchEvent(new Event("loadedmetadata"))
      expect(videoElement.currentTime).toBe(0)
    })

    it("updates the current time when startTime is changed", () => {
      wrapper.setProps(getProps({ startTime: 10 }))
      videoElement.dispatchEvent(new Event("loadedmetadata"))
      expect(videoElement.currentTime).toBe(10)
    })
  })
})
