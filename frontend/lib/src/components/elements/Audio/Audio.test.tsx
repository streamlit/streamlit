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

import { Audio as AudioProto } from "@streamlit/protobuf"

import { mockEndpoints } from "~lib/mocks/mocks"
import { render, renderWithContexts } from "~lib/test_util"
import { WidgetStateManager as ElementStateManager } from "~lib/WidgetStateManager"

import Audio, { AudioProps } from "./Audio"

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

describe("Audio Element", () => {
  const buildMediaURL = vi.fn().mockReturnValue("https://mock.media.url")
  const sendClientErrorToHost = vi.fn()

  const mockSetElementState = vi.fn()
  const mockGetElementState = vi.fn()
  const elementMgrMock = {
    setElementState: mockSetElementState,
    getElementState: mockGetElementState,
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  }

  const getProps = (elementProps: Partial<AudioProto> = {}): AudioProps => ({
    element: AudioProto.create({
      startTime: 0,
      url: "/media/mockAudioFile.wav",
      ...elementProps,
    }),
    endpoints: mockEndpoints({
      buildMediaURL: buildMediaURL,
      sendClientErrorToHost: sendClientErrorToHost,
    }),
    elementMgr: elementMgrMock as unknown as ElementStateManager,
  })

  it("renders without crashing", () => {
    render(<Audio {...getProps()} />)
    const audioElement = screen.getByTestId("stAudio")
    expect(audioElement).toBeInTheDocument()
    expect(audioElement).toHaveClass("stAudio")
  })

  it("has controls", () => {
    render(<Audio {...getProps()} />)
    expect(screen.getByTestId("stAudio")).toHaveAttribute("controls")
  })

  it("creates its `src` attribute using buildMediaURL", () => {
    render(<Audio {...getProps()} />)
    const audioElement = screen.getByTestId("stAudio")
    expect(buildMediaURL).toHaveBeenCalledWith("/media/mockAudioFile.wav")
    expect(audioElement).toHaveAttribute("src", "https://mock.media.url")
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetElementState.mockReturnValue(false) // By default, assume autoplay is not prevented
  })

  it("does not autoplay if preventAutoplay is set", () => {
    mockGetElementState.mockReturnValueOnce(true) // Autoplay should be prevented
    const props = getProps({ autoplay: true, id: "uniqueAudioId" })
    render(<Audio {...props} />)
    const audioElement = screen.getByTestId("stAudio")
    expect(audioElement).not.toHaveAttribute("autoPlay")
  })

  it("autoplays if preventAutoplay is not set and autoplay is true", () => {
    mockGetElementState.mockReturnValueOnce(false) // Autoplay is not prevented
    const props = getProps({ autoplay: true, id: "uniqueAudioId" })
    render(<Audio {...props} />)
    const audioElement = screen.getByTestId("stAudio")
    expect(audioElement).toHaveAttribute("autoPlay")
  })

  it("calls setElementState to prevent future autoplay on first autoplay", () => {
    mockGetElementState.mockReturnValueOnce(false) // Autoplay is not prevented initially
    const props = getProps({ autoplay: true, id: "uniqueAudioId" })
    render(<Audio {...props} />)
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
    const props = getProps({ autoplay: true, id: "uniqueAudioId" })
    render(<Audio {...props} />)
    expect(mockSetElementState).not.toHaveBeenCalled()
  })

  it("updates time when the prop is changed", () => {
    const props = getProps({
      url: "http://localhost:80/media/sound.wav",
    })

    const { rerender } = render(<Audio {...props} />)
    let audioElement: HTMLAudioElement = screen.getByTestId("stAudio")

    expect(audioElement.currentTime).toBe(0)

    const newProps = getProps({ startTime: 10 })
    rerender(<Audio {...newProps} />)

    audioElement = screen.getByTestId("stAudio")

    expect(audioElement.currentTime).toBe(10)
  })

  it("sends an CLIENT_ERROR message when the audio source fails to load", () => {
    const props = getProps()
    render(<Audio {...props} />)
    const audioElement = screen.getByTestId("stAudio")
    expect(audioElement).toBeInTheDocument()

    fireEvent.error(audioElement)

    expect(sendClientErrorToHost).toHaveBeenCalledWith(
      "Audio",
      "Audio source failed to load",
      "onerror triggered",
      "https://mock.media.url/"
    )
  })

  describe("crossOrigin attribute", () => {
    it.each([
      { resourceCrossOriginMode: "anonymous" },
      { resourceCrossOriginMode: "use-credentials" },
      { resourceCrossOriginMode: undefined },
    ] as const)(
      "don't set crossOrigin attribute when StreamlitConfig.BACKEND_BASE_URL is not set",
      ({ resourceCrossOriginMode }) => {
        const props = getProps()
        renderWithContexts(<Audio {...props} />, {
          libConfigContext: {
            resourceCrossOriginMode,
          },
        })
        const audioElement = screen.getByTestId("stAudio")
        expect(audioElement).not.toHaveAttribute("crossOrigin")
      }
    )

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
          resourceCrossOriginMode: "anonymous" as const,
          url: "/media/audio.wav",
          scenario: "relative URL with anonymous mode",
        },
        {
          expected: "use-credentials",
          resourceCrossOriginMode: "use-credentials" as const,
          url: "/media/audio.wav",
          scenario: "relative URL with use-credentials mode",
        },
        {
          expected: "anonymous",
          resourceCrossOriginMode: "anonymous" as const,
          url: "https://backend.example.com:8080/media/audio.wav",
          scenario: "same origin as BACKEND_BASE_URL with anonymous mode",
        },
        {
          expected: "use-credentials",
          resourceCrossOriginMode: "use-credentials" as const,
          url: "https://backend.example.com:8080/media/audio.wav",
          scenario:
            "same origin as BACKEND_BASE_URL with use-credentials mode",
        },
      ])(
        "sets crossOrigin to $expected when $scenario",
        ({ expected, resourceCrossOriginMode, url }) => {
          const props = getProps({ url })
          renderWithContexts(<Audio {...props} />, {
            libConfigContext: {
              resourceCrossOriginMode,
            },
          })
          const audioElement = screen.getByTestId("stAudio")
          expect(audioElement).toHaveAttribute("crossOrigin", expected)
        }
      )

      it.each([
        {
          resourceCrossOriginMode: undefined,
          url: "/media/audio.wav",
          scenario: "relative URL with undefined mode",
        },
        {
          resourceCrossOriginMode: undefined,
          url: "https://backend.example.com:8080/media/audio.wav",
          scenario: "same origin as BACKEND_BASE_URL with undefined mode",
        },
        {
          resourceCrossOriginMode: "anonymous" as const,
          url: "https://external.example.com/media/audio.wav",
          scenario: "different hostname than BACKEND_BASE_URL",
        },
        {
          resourceCrossOriginMode: "anonymous" as const,
          url: "https://backend.example.com:9000/media/audio.wav",
          scenario: "different port than BACKEND_BASE_URL",
        },
        {
          resourceCrossOriginMode: "anonymous" as const,
          url: "http://backend.example.com:8080/media/audio.wav",
          scenario: "different protocol than BACKEND_BASE_URL",
        },
      ])(
        "does not set crossOrigin when $scenario",
        ({ resourceCrossOriginMode, url }) => {
          const props = getProps({ url })
          renderWithContexts(<Audio {...props} />, {
            libConfigContext: {
              resourceCrossOriginMode,
            },
          })
          const audioElement = screen.getByTestId("stAudio")
          expect(audioElement).not.toHaveAttribute("crossOrigin")
        }
      )
    })
  })
})
