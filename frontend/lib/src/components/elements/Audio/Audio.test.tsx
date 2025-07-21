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

import { render, renderWithContexts } from "~lib/test_util"
import { mockEndpoints } from "~lib/mocks/mocks"
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
    it("sets crossOrigin to 'anonymous' when resourceCrossOriginMode is 'anonymous'", () => {
      const props = getProps()
      renderWithContexts(<Audio {...props} />, {
        libConfig: { resourceCrossOriginMode: "anonymous" },
      })
      const audioElement = screen.getByTestId("stAudio")
      expect(audioElement).toHaveAttribute("crossOrigin", "anonymous")
    })

    it("sets crossOrigin to 'use-credentials' when resourceCrossOriginMode is 'use-credentials'", () => {
      const props = getProps()
      renderWithContexts(<Audio {...props} />, {
        libConfig: { resourceCrossOriginMode: "use-credentials" },
      })
      const audioElement = screen.getByTestId("stAudio")
      expect(audioElement).toHaveAttribute("crossOrigin", "use-credentials")
    })

    it("does not set crossOrigin attribute when resourceCrossOriginMode is undefined", () => {
      const props = getProps()
      renderWithContexts(<Audio {...props} />, {
        libConfig: { resourceCrossOriginMode: undefined },
      })
      const audioElement = screen.getByTestId("stAudio")
      expect(audioElement).not.toHaveAttribute("crossOrigin")
    })

    it("does not set crossOrigin attribute when libConfig is empty", () => {
      const props = getProps()
      renderWithContexts(<Audio {...props} />, {
        libConfig: {},
      })
      const audioElement = screen.getByTestId("stAudio")
      expect(audioElement).not.toHaveAttribute("crossOrigin")
    })
  })
})
