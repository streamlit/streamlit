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
      "don't set crossOrigin attribute when window.__streamlit?.BACKEND_BASE_URL is not set",
      ({ resourceCrossOriginMode }) => {
        const props = getProps()
        renderWithContexts(<Audio {...props} />, {
          libConfig: { resourceCrossOriginMode },
        })
        const audioElement = screen.getByTestId("stAudio")
        expect(audioElement).not.toHaveAttribute("crossOrigin")
      }
    )

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
          url: "/media/audio.wav",
          scenario: "relative URL with anonymous mode",
        },
        {
          expected: "use-credentials",
          resourceCrossOriginMode: "use-credentials",
          url: "/media/audio.wav",
          scenario: "relative URL with use-credentials mode",
        },
        {
          expected: undefined,
          resourceCrossOriginMode: undefined,
          url: "/media/audio.wav",
          scenario: "relative URL with undefined mode",
        },
        {
          expected: "anonymous",
          resourceCrossOriginMode: "anonymous",
          url: "https://backend.example.com:8080/media/audio.wav",
          scenario: "same origin as BACKEND_BASE_URL with anonymous mode",
        },
        {
          expected: "use-credentials",
          resourceCrossOriginMode: "use-credentials",
          url: "https://backend.example.com:8080/media/audio.wav",
          scenario:
            "same origin as BACKEND_BASE_URL with use-credentials mode",
        },
        {
          expected: undefined,
          resourceCrossOriginMode: undefined,
          url: "https://backend.example.com:8080/media/audio.wav",
          scenario: "same origin as BACKEND_BASE_URL with undefined mode",
        },
        {
          expected: undefined,
          resourceCrossOriginMode: "anonymous",
          url: "https://external.example.com/media/audio.wav",
          scenario: "different hostname than BACKEND_BASE_URL",
        },
        {
          expected: undefined,
          resourceCrossOriginMode: "anonymous",
          url: "https://backend.example.com:9000/media/audio.wav",
          scenario: "different port than BACKEND_BASE_URL",
        },
        {
          expected: undefined,
          resourceCrossOriginMode: "anonymous",
          url: "http://backend.example.com:8080/media/audio.wav",
          scenario: "different protocol than BACKEND_BASE_URL",
        },
      ] as const)(
        "sets crossOrigin to $expected when $scenario",
        ({ expected, resourceCrossOriginMode, url }) => {
          const props = getProps({ url })
          renderWithContexts(<Audio {...props} />, {
            libConfig: { resourceCrossOriginMode },
          })
          const audioElement = screen.getByTestId("stAudio")
          if (expected) {
            expect(audioElement).toHaveAttribute("crossOrigin", expected)
          } else {
            expect(audioElement).not.toHaveAttribute("crossOrigin")
          }
        }
      )
    })
  })
})
