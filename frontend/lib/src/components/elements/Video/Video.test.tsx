/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { Video as VideoProto } from "@streamlit/protobuf"

import * as UseResizeObserver from "~lib/hooks/useResizeObserver"
import { mockEndpoints } from "~lib/mocks/mocks"
import { render, renderWithContexts } from "~lib/test_util"
import { WidgetStateManager as ElementStateManager } from "~lib/WidgetStateManager"

import Video, { VideoProps } from "./Video"

// Mock StreamlitConfig using global mock state (see vitest.setup.ts)
vi.mock("@streamlit/utils", async () => {
  const actual = await vi.importActual("@streamlit/utils")
  return {
    ...actual,
    get StreamlitConfig() {
      return globalThis.__mockStreamlitConfig
    },
  }
})

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
    mockGetElementState.mockReturnValue(false) // By default, assume autoplay is not prevented

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

  it("does not autoplay if preventAutoplay is set", async () => {
    mockGetElementState.mockReturnValueOnce(true) // Autoplay should be prevented
    const props = getProps({ autoplay: true, id: "uniqueVideoId" })
    render(<Video {...props} />)
    const videoElement = await screen.findByTestId("stVideo")
    expect(videoElement).not.toHaveAttribute("autoPlay")
  })

  it("autoplays if preventAutoplay is not set and autoplay is true", async () => {
    mockGetElementState.mockReturnValueOnce(false) // Autoplay is not prevented
    const props = getProps({ autoplay: true, id: "uniqueVideoId" })
    render(<Video {...props} />)
    const videoElement = await screen.findByTestId("stVideo")
    expect(videoElement).toHaveAttribute("autoPlay")
  })

  it("treats undefined stored preventAutoplay state as falsy and records prevention", async () => {
    mockGetElementState.mockReturnValueOnce(undefined)
    const props = getProps({ autoplay: true, id: "uniqueVideoId" })
    render(<Video {...props} />)
    expect(await screen.findByTestId("stVideo")).toHaveAttribute("autoPlay")
    expect(mockSetElementState).toHaveBeenCalledWith(
      props.element.id,
      "preventAutoplay",
      true
    )
  })

  it("does not autoplay when the element has no id even if autoplay is true", async () => {
    render(<Video {...getProps({ autoplay: true })} />)
    expect(await screen.findByTestId("stVideo")).not.toHaveAttribute(
      "autoPlay"
    )
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

    it("adds end, loop, playlist, autoplay, and mute query params to the embed URL", async () => {
      const props = getProps({
        type: VideoProto.Type.YOUTUBE_IFRAME,
        url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        startTime: 5,
        endTime: 99,
        loop: true,
        autoplay: true,
        muted: true,
      })
      render(<Video {...props} />)
      const iframe = await screen.findByTestId("stVideo")
      expect(iframe).toBeInstanceOf(HTMLIFrameElement)
      const src = new URL(iframe.getAttribute("src") ?? "")
      expect(src.searchParams.get("start")).toBe("5")
      expect(src.searchParams.get("end")).toBe("99")
      expect(src.searchParams.get("loop")).toBe("1")
      expect(src.searchParams.get("playlist")).toBe("dQw4w9WgXcQ")
      expect(src.searchParams.get("autoplay")).toBe("1")
      expect(src.searchParams.get("mute")).toBe("1")
    })

    it("does not append playlist when the embed path has no video id", async () => {
      const props = getProps({
        type: VideoProto.Type.YOUTUBE_IFRAME,
        url: "https://www.youtube.com/embed/",
        loop: true,
      })
      render(<Video {...props} />)
      const iframe = await screen.findByTestId("stVideo")
      const src = new URL(iframe.getAttribute("src") ?? "")
      expect(src.searchParams.get("loop")).toBe("1")
      expect(src.searchParams.get("playlist")).toBeNull()
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

    it("sets currentTime from startTime on loadedmetadata", async () => {
      const { rerender } = render(<Video {...getProps({ startTime: 12 })} />)
      const video: HTMLVideoElement = await screen.findByTestId("stVideo")
      video.currentTime = 0
      fireEvent.loadedMetadata(video)
      expect(video.currentTime).toBe(12)

      rerender(<Video {...getProps({ startTime: 3 })} />)
      video.currentTime = 0
      fireEvent.loadedMetadata(video)
      expect(video.currentTime).toBe(3)
    })
  })

  describe("endTime and loop (timeupdate / ended)", () => {
    it("pauses once when playback reaches endTime without loop", async () => {
      const user = userEvent.setup()
      const props = getProps({ endTime: 10, startTime: 2, loop: false })
      render(<Video {...props} />)
      const video: HTMLVideoElement = await screen.findByTestId("stVideo")
      const pauseSpy = vi.spyOn(video, "pause").mockImplementation(() => {})

      await user.click(video)
      video.currentTime = 9
      fireEvent.timeUpdate(video)
      expect(pauseSpy).not.toHaveBeenCalled()

      video.currentTime = 10
      fireEvent.timeUpdate(video)
      expect(pauseSpy).toHaveBeenCalledTimes(1)

      fireEvent.timeUpdate(video)
      expect(pauseSpy).toHaveBeenCalledTimes(1)
    })

    it("seeks to startTime and plays when endTime is reached with loop", async () => {
      const user = userEvent.setup()
      const props = getProps({
        endTime: 10,
        startTime: 4,
        loop: true,
      })
      render(<Video {...props} />)
      const video: HTMLVideoElement = await screen.findByTestId("stVideo")
      const playSpy = vi.spyOn(video, "play").mockResolvedValue(undefined)

      await user.click(video)
      video.currentTime = 10
      fireEvent.timeUpdate(video)
      expect(video.currentTime).toBe(4)
      expect(playSpy).toHaveBeenCalledTimes(1)
    })

    it("seeks and plays on ended when loop is enabled", async () => {
      const user = userEvent.setup()
      const props = getProps({ loop: true, startTime: 7 })
      render(<Video {...props} />)
      const video: HTMLVideoElement = await screen.findByTestId("stVideo")
      const playSpy = vi.spyOn(video, "play").mockResolvedValue(undefined)

      await user.click(video)
      video.currentTime = 99
      fireEvent.ended(video)
      expect(video.currentTime).toBe(7)
      expect(playSpy).toHaveBeenCalledTimes(1)
    })

    it("unmounts cleanly when endTime is set (timeupdate listener cleanup)", () => {
      const props = getProps({ endTime: 5 })
      const { unmount } = render(<Video {...props} />)
      expect(() => unmount()).not.toThrow()
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

      const trackElements = screen.getAllByTestId("stVideoSubtitle")
      expect(trackElements).toHaveLength(2)

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

    it("does not call checkSourceUrlResponse when subtitles is unset on the element", () => {
      const base = VideoProto.create({
        url: "https://www.w3schools.com/html/mov_bbb.mp4",
        type: VideoProto.Type.UNUSED,
        startTime: 0,
      })
      Reflect.deleteProperty(base, "subtitles")
      const props: VideoProps = {
        element: base,
        endpoints: mockEndpoints({
          buildMediaURL: buildMediaURL,
          sendClientErrorToHost: sendClientErrorToHost,
        }),
        elementMgr: elementMgrMock as unknown as ElementStateManager,
      }
      render(<Video {...props} />)
      expect(props.endpoints.checkSourceUrlResponse).not.toHaveBeenCalled()
    })
  })

  describe("muted", () => {
    it("passes muted through to the video element", async () => {
      render(<Video {...getProps({ muted: true })} />)
      const video: HTMLVideoElement = await screen.findByTestId("stVideo")
      expect(video.muted).toBe(true)
    })
  })

  describe("crossOrigin attribute", () => {
    it.each([
      { resourceCrossOriginMode: "anonymous" },
      { resourceCrossOriginMode: "use-credentials" },
      { resourceCrossOriginMode: undefined },
    ] as const)(
      "don't set crossOrigin attribute when StreamlitConfig.BACKEND_BASE_URL is not set",
      async ({ resourceCrossOriginMode }) => {
        const props = getProps({ url: "/media/mockVideoFile.mp4" })
        renderWithContexts(<Video {...props} />, {
          libConfigContext: {
            resourceCrossOriginMode,
          },
        })
        const videoElement = await screen.findByTestId("stVideo")
        expect(videoElement).not.toHaveAttribute("crossOrigin")
      }
    )

    it("sets crossOrigin to 'anonymous' when in dev mode with subtitles regardless of resourceCrossOriginMode", async () => {
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = "development"

      try {
        const props = getProps({
          subtitles: [{ url: "https://mock.subtitle.url" }],
        })
        renderWithContexts(<Video {...props} />, {
          libConfigContext: {
            resourceCrossOriginMode: undefined,
          },
        })
        const videoElement = await screen.findByTestId("stVideo")
        expect(videoElement).toHaveAttribute("crossOrigin", "anonymous")
      } finally {
        process.env.NODE_ENV = originalNodeEnv
      }
    })

    describe("with BACKEND_BASE_URL set", () => {
      beforeEach(() => {
        globalThis.__mockStreamlitConfig.BACKEND_BASE_URL =
          "https://backend.example.com:8080/app"
      })

      afterEach(() => {
        globalThis.__mockStreamlitConfig = {}
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
          expected: "anonymous",
          resourceCrossOriginMode: "anonymous" as const,
          url: "https://backend.example.com:8080/media/video.mp4",
          scenario: "same origin as BACKEND_BASE_URL with anonymous mode",
        },
        {
          expected: "use-credentials",
          resourceCrossOriginMode: "use-credentials" as const,
          url: "https://backend.example.com:8080/media/video.mp4",
          scenario:
            "same origin as BACKEND_BASE_URL with use-credentials mode",
        },
      ])(
        "sets crossOrigin to $expected when $scenario",
        async ({ expected, resourceCrossOriginMode, url }) => {
          const props = getProps({ url })
          renderWithContexts(<Video {...props} />, {
            libConfigContext: {
              resourceCrossOriginMode: resourceCrossOriginMode as
                | "anonymous"
                | "use-credentials"
                | undefined,
            },
          })
          const videoElement = await screen.findByTestId("stVideo")
          expect(videoElement).toHaveAttribute("crossOrigin", expected)
        }
      )

      it.each([
        {
          resourceCrossOriginMode: undefined,
          url: "/media/video.mp4",
          scenario: "relative URL with undefined mode",
        },
        {
          resourceCrossOriginMode: undefined,
          url: "https://backend.example.com:8080/media/video.mp4",
          scenario: "same origin as BACKEND_BASE_URL with undefined mode",
        },
        {
          resourceCrossOriginMode: "anonymous" as const,
          url: "https://external.example.com/media/video.mp4",
          scenario: "different hostname than BACKEND_BASE_URL",
        },
        {
          resourceCrossOriginMode: "anonymous" as const,
          url: "https://backend.example.com:9000/media/video.mp4",
          scenario: "different port than BACKEND_BASE_URL",
        },
        {
          resourceCrossOriginMode: "anonymous" as const,
          url: "http://backend.example.com:8080/media/video.mp4",
          scenario: "different protocol than BACKEND_BASE_URL",
        },
      ])(
        "does not set crossOrigin when $scenario",
        async ({ resourceCrossOriginMode, url }) => {
          const props = getProps({ url })
          renderWithContexts(<Video {...props} />, {
            libConfigContext: {
              resourceCrossOriginMode,
            },
          })
          const videoElement = await screen.findByTestId("stVideo")
          expect(videoElement).not.toHaveAttribute("crossOrigin")
        }
      )
    })
  })
})
