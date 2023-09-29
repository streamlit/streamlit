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
import { Video as VideoProto } from "@streamlit/lib/src/proto"
import { mockEndpoints } from "@streamlit/lib/src/mocks/mocks"

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
    render(<Video {...props} />)

    expect(screen.getByTestId("stVideo")).toBeInTheDocument()
  })

  it("has correct style", () => {
    const props = getProps()
    render(<Video {...props} />)
    const video = screen.getByTestId("stVideo")

    expect(video).toHaveAttribute("class", "stVideo")
    expect(video).toHaveStyle("width: 0px; height: 528px;")
  })

  it("has controls", () => {
    const props = getProps()
    render(<Video {...props} />)

    expect(screen.getByTestId("stVideo")).toHaveAttribute("controls")
  })

  it("creates its `src` attribute using buildMediaURL", () => {
    render(<Video {...getProps({ url: "/media/mockVideoFile.mp4" })} />)
    expect(buildMediaURL).toHaveBeenCalledWith("/media/mockVideoFile.mp4")
    expect(screen.getByTestId("stVideo")).toHaveAttribute(
      "src",
      "https://mock.media.url"
    )
  })

  describe("YouTube", () => {
    it("renders a youtube iframe", () => {
      const props = getProps({
        type: VideoProto.Type.YOUTUBE_IFRAME,
      })
      render(<Video {...props} />)
      expect(document.body).toMatchSnapshot()
    })

    it("renders a youtube iframe with an starting time", () => {
      const props = getProps({
        type: VideoProto.Type.YOUTUBE_IFRAME,
        startTime: 10,
      })
      render(<Video {...props} />)
      expect(document.body).toMatchSnapshot()
    })
  })

  describe("updateTime", () => {
    const props = getProps()

    it("sets the current time to startTime on render", () => {
      render(<Video {...props} />)
      const videoElement = screen.getByTestId("stVideo") as HTMLMediaElement
      expect(videoElement.currentTime).toBe(0)
    })

    it("updates the current time when startTime is changed", () => {
      const { rerender } = render(<Video {...props} />)
      const videoElement = screen.getByTestId("stVideo") as HTMLMediaElement
      expect(videoElement.currentTime).toBe(0)

      rerender(<Video {...getProps({ startTime: 10 })} />)
      expect(videoElement.currentTime).toBe(10)
    })
  })
})
