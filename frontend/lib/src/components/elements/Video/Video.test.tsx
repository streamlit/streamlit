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

import React from "react"

import { fireEvent, screen } from "@testing-library/react"

import { Video as VideoProto } from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { mockEndpoints } from "~lib/mocks/mocks"
import { render, renderWithContexts } from "~lib/test_util"
import { WidgetStateManager as ElementStateManager } from "~lib/WidgetStateManager"

import Video, { VideoProps } from "./Video"

describe("Video Element", () => {
  let buildMediaURL = vi.fn().mockReturnValue("https://mock.media.url")
  const sendClientErrorToHost = vi.fn()

  const mockSetElementState = vi.fn()
  const mockGetElementState = vi.fn()
  const elementMgrMock = {
    setElementState: mockSetElementState,
    getElementState: mockGetElementState,
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }

  const getProps = (elementProps: Partial<VideoProto> = {}): VideoProps => ({
    element: VideoProto.create({
      url: "https://www.w3schools.com/html/mov_bbb.mp4",
      type: VideoProto.Type.UNUSED,
      startTime: 0,
      ...elementProps,
    }),
    endpoints: mockEndpoints({
      buildMediaURL: buildMediaURL,
      sendClientErrorToHost: sendClientErrorToHost,
    }),
    elementMgr: elementMgrMock as unknown as ElementStateManager,
  })

  beforeEach(() => {
    vi.clearAllMocks()

    vi.spyOn(UseResizeObserver, "useResizeObserver").mockReturnValue({
      elementRef: { current: null },
      values: [250],
    })
  })

  it("renders without crashing", async () => {
    const props = getProps()
    render(<Video {...props} />)

    const videoElement = await screen.findByTestId("stVideo")
    expect(videoElement).toBeInTheDocument()
    expect(videoElement.classList).toContain("stVideo")
  })

  it("has controls", async () => {
    const props = getProps()
    render(<Video {...props} />)

    expect(await screen.findByTestId("stVideo")).toHaveAttribute("controls")
  })

  it("creates its `src` attribute using buildMediaURL", async () => {
    render(<Video {...getProps({ url: "/media/mockVideoFile.mp4" })} />)
    expect(buildMediaURL).toHaveBeenCalledWith("/media/mockVideoFile.mp4")
    expect(await screen.findByTestId("stVideo")).toHaveAttribute(
      "src",
      "https://mock.media.url"
    )
  })

  it("sends an CLIENT_ERROR message when the video source fails to load", () => {
    const props = getProps()
    render(<Video {...props} />)
    const videoElement = screen.getByTestId("stVideo")
    expect(videoElement).toBeInTheDocument()

    fireEvent.error(videoElement)

    expect(sendClientErrorToHost).toHaveBeenCalledWith(
      "Video",
      "Video source failed to load",
      "onerror triggered",
      "https://mock.media.url/"
    )
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetElementState.mockReturnValue(false) // By default, assume autoplay is not prevented
  })

  it("does not autoplay if preventAutoplay is set", async () => {
    mockGetElementState.mockReturnValueOnce(true) // Autoplay should be prevented
    const props = getProps({ autoplay: true, id: "uniqueVideoId" })
    render(<Video {...props} />)
    const audioElement = await screen.findByTestId("stVideo")
    expect(audioElement).not.toHaveAttribute("autoPlay")
  })

  it("autoplays if preventAutoplay is not set and autoplay is true", async () => {
    mockGetElementState.mockReturnValueOnce(false) // Autoplay is not prevented
    const props = getProps({ autoplay: true, id: "uniqueVideoId" })
    render(<Video {...props} />)
    const audioElement = await screen.findByTestId("stVideo")
    expect(audioElement).toHaveAttribute("autoPlay")
  })

  it("calls setElementState to prevent future autoplay on first autoplay", () => {
    mockGetElementState.mockReturnValueOnce(false) // Autoplay is not prevented initially
    const props = getProps({ autoplay: true, id: "uniqueVideoId" })
    render(<Video {...props} />)
    expect(mockSetElementState).toHaveBeenCalledTimes(1)
    expect(mockSetElementState).toHaveBeenCalledWith(
      props.element.id,
      "preventAutoplay",
      true
    )
  })

  // Test to ensure that setElementState is not called again if autoplay is already prevented
  it("does not call setElementState again if autoplay is already prevented", () => {
    mockGetElementState.mockReturnValueOnce(true) // Autoplay is already prevented
    const props = getProps({ autoplay: true, id: "uniqueVideoId" })
    render(<Video {...props} />)
    expect(mockSetElementState).not.toHaveBeenCalled()
  })

  describe("YouTube", () => {
    it("renders a youtube iframe", async () => {
      const props = getProps({
        type: VideoProto.Type.YOUTUBE_IFRAME,
      })
      render(<Video {...props} />)
      const videoElement = await screen.findByTestId("stVideo")
      expect(videoElement).toBeInstanceOf(HTMLIFrameElement)
      expect(videoElement).toHaveAttribute(
        "src",
        "https://www.w3schools.com/html/mov_bbb.mp4"
      )
    })

    it("renders a youtube iframe with an starting time", async () => {
      const props = getProps({
        type: VideoProto.Type.YOUTUBE_IFRAME,
        startTime: 10,
      })
      render(<Video {...props} />)
      const videoElement = await screen.findByTestId("stVideo")
      expect(videoElement).toBeInstanceOf(HTMLIFrameElement)
      expect(videoElement).toHaveAttribute(
        "src",
        "https://www.w3schools.com/html/mov_bbb.mp4?start=10"
      )
    })
  })

  describe("updateTime", () => {
    const props = getProps()

    it("sets the current time to startTime on render", async () => {
      render(<Video {...props} />)
      const videoElement: HTMLMediaElement =
        await screen.findByTestId("stVideo")
      expect(videoElement.currentTime).toBe(0)
    })

    it("updates the current time when startTime is changed", async () => {
      const { rerender } = render(<Video {...props} />)
      const videoElement: HTMLMediaElement =
        await screen.findByTestId("stVideo")
      expect(videoElement.currentTime).toBe(0)

      rerender(<Video {...getProps({ startTime: 10 })} />)
      expect(videoElement.currentTime).toBe(10)
    })
  })

  describe("subtitles", () => {
    it("renders subtitles properly", () => {
      const props = getProps({
        subtitles: [
          { url: "https://mock.subtitle.url" },
          { url: "https://mock.subtitle.url2" },
        ],
      })
      props.endpoints.buildMediaURL = vi.fn(url => url)
      render(<Video {...props} />)

      // check that track elements are rendered
      const trackElements = screen.getAllByTestId("stVideoSubtitle")
      expect(trackElements).toHaveLength(2)

      // check that the track element has the correct src
      expect(trackElements[0]).toHaveAttribute(
        "src",
        "https://mock.subtitle.url"
      )
      expect(trackElements[1]).toHaveAttribute(
        "src",
        "https://mock.subtitle.url2"
      )
    })

    it("checks the subtitles src url(s) on mount", () => {
      buildMediaURL = vi.fn(url => url)
      const props = getProps({
        subtitles: [
          { url: "https://mock.subtitle.url" },
          { url: "https://mock.subtitle.url2" },
        ],
      })
      props.endpoints.buildMediaURL = buildMediaURL
      render(<Video {...props} />)

      expect(props.endpoints.checkSourceUrlResponse).toHaveBeenCalledTimes(2)
      expect(props.endpoints.checkSourceUrlResponse).toHaveBeenNthCalledWith(
        1,
        "https://mock.subtitle.url",
        "Video Subtitle"
      )
      expect(props.endpoints.checkSourceUrlResponse).toHaveBeenNthCalledWith(
        2,
        "https://mock.subtitle.url2",
        "Video Subtitle"
      )
    })

    it("does not call checkSourceUrlResponse if there are no subtitles", () => {
      const props = getProps()
      render(<Video {...props} />)
      expect(props.endpoints.checkSourceUrlResponse).not.toHaveBeenCalled()
    })
  })

  describe("crossOrigin attribute", () => {
    it.each([
      { resourceCrossOriginMode: "anonymous" },
      { resourceCrossOriginMode: "use-credentials" },
      { resourceCrossOriginMode: undefined },
    ] as const)(
      "don't set crossOrigin attribute when window.__streamlit?.BACKEND_BASE_URL is not set",
      async ({ resourceCrossOriginMode }) => {
        const props = getProps({ url: "/media/mockVideoFile.mp4" })
        renderWithContexts(<Video {...props} />, {
          libConfig: { resourceCrossOriginMode },
        })
        const videoElement = await screen.findByTestId("stVideo")
        expect(videoElement).not.toHaveAttribute("crossOrigin")
      }
    )

    it("sets crossOrigin to 'anonymous' when in dev mode with subtitles regardless of resourceCrossOriginMode", async () => {
      // Store original NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      const props = getProps({
        subtitles: [{ url: "https://mock.subtitle.url" }],
      })
      renderWithContexts(<Video {...props} />, {
        libConfig: { resourceCrossOriginMode: undefined },
      })
      const videoElement = await screen.findByTestId("stVideo")
      expect(videoElement).toHaveAttribute("crossOrigin", "anonymous")

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv
    })

    describe("with BACKEND_BASE_URL set", () => {
      const originalStreamlit = window.__streamlit

      beforeEach(() => {
        window.__streamlit = {
          BACKEND_BASE_URL: "https://backend.example.com:8080/app",
        }
      })

      afterEach(() => {
        window.__streamlit = originalStreamlit
      })

      it.each([
        {
          expected: "anonymous",
          resourceCrossOriginMode: "anonymous",
          url: "/media/video.mp4",
          scenario: "relative URL with anonymous mode",
        },
        {
          expected: "use-credentials",
          resourceCrossOriginMode: "use-credentials",
          url: "/media/video.mp4",
          scenario: "relative URL with use-credentials mode",
        },
        {
          expected: undefined,
          resourceCrossOriginMode: undefined,
          url: "/media/video.mp4",
          scenario: "relative URL with undefined mode",
        },
        {
          expected: "anonymous",
          resourceCrossOriginMode: "anonymous",
          url: "https://backend.example.com:8080/media/video.mp4",
          scenario: "same origin as BACKEND_BASE_URL with anonymous mode",
        },
        {
          expected: "use-credentials",
          resourceCrossOriginMode: "use-credentials",
          url: "https://backend.example.com:8080/media/video.mp4",
          scenario:
            "same origin as BACKEND_BASE_URL with use-credentials mode",
        },
        {
          expected: undefined,
          resourceCrossOriginMode: undefined,
          url: "https://backend.example.com:8080/media/video.mp4",
          scenario: "same origin as BACKEND_BASE_URL with undefined mode",
        },
        {
          expected: undefined,
          resourceCrossOriginMode: "anonymous",
          url: "https://external.example.com/media/video.mp4",
          scenario: "different hostname than BACKEND_BASE_URL",
        },
        {
          expected: undefined,
          resourceCrossOriginMode: "anonymous",
          url: "https://backend.example.com:9000/media/video.mp4",
          scenario: "different port than BACKEND_BASE_URL",
        },
        {
          expected: undefined,
          resourceCrossOriginMode: "anonymous",
          url: "http://backend.example.com:8080/media/video.mp4",
          scenario: "different protocol than BACKEND_BASE_URL",
        },
      ] as const)(
        "sets crossOrigin to $expected when $scenario",
        async ({ expected, resourceCrossOriginMode, url }) => {
          const props = getProps({ url })
          renderWithContexts(<Video {...props} />, {
            libConfig: { resourceCrossOriginMode },
          })
          const videoElement = await screen.findByTestId("stVideo")
          if (expected) {
            expect(videoElement).toHaveAttribute("crossOrigin", expected)
          } else {
            expect(videoElement).not.toHaveAttribute("crossOrigin")
          }
        }
      )
    })
  })
})
