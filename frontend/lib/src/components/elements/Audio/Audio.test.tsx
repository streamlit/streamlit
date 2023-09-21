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

import { Audio as AudioProto } from "@streamlit/lib/src/proto"
import { mockEndpoints } from "@streamlit/lib/src/mocks/mocks"
import Audio, { AudioProps } from "./Audio"

describe("Audio Element", () => {
  const buildMediaURL = jest.fn().mockReturnValue("https://mock.media.url")

  const getProps = (elementProps: Partial<AudioProto> = {}): AudioProps => ({
    element: AudioProto.create({
      startTime: 0,
      url: "/media/mockAudioFile.wav",
      ...elementProps,
    }),
    endpoints: mockEndpoints({ buildMediaURL: buildMediaURL }),
    width: 0,
  })

  it("renders without crashing", () => {
    render(<Audio {...getProps()} />)
    expect(screen.getByTestId("stAudio")).toBeInTheDocument()
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

  it("updates time when the prop is changed", () => {
    const props = getProps({
      url: "http://localhost:80/media/sound.wav",
    })

    const { rerender } = render(<Audio {...props} />)
    let audioElement = screen.getByTestId("stAudio") as HTMLAudioElement

    expect(audioElement.currentTime).toBe(0)

    const newProps = getProps({ startTime: 10 })
    rerender(<Audio {...newProps} />)

    audioElement = screen.getByTestId("stAudio") as HTMLAudioElement

    expect(audioElement.currentTime).toBe(10)
  })
})
