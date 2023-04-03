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

import { Audio as AudioProto } from "src/autogen/proto"
import { mockEndpoints } from "src/lib/mocks/mocks"
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
    const wrapper = shallow(<Audio {...getProps()} />)
    const audioElement = wrapper.find("audio")

    expect(audioElement.length).toBe(1)
  })

  it("has controls", () => {
    const wrapper = shallow(<Audio {...getProps()} />)
    const audioElement = wrapper.find("audio")

    expect(audioElement.prop("controls")).toBeDefined()
  })

  it("creates its `src` attribute using buildMediaURL", () => {
    const wrapper = shallow(<Audio {...getProps()} />)
    const audioElement = wrapper.find("audio")
    expect(buildMediaURL).toHaveBeenCalledWith("/media/mockAudioFile.wav")
    expect(audioElement.prop("src")).toBe("https://mock.media.url")
  })

  it("updates time when the prop is changed", () => {
    const props = getProps({
      url: "http://localhost:80/media/sound.wav",
    })
    const wrapper = mount(<Audio {...props} />)

    const audioElement: HTMLAudioElement = wrapper.find("audio").getDOMNode()
    expect(audioElement.currentTime).toBe(0)

    wrapper.setProps(getProps({ startTime: 10 }))

    expect(audioElement.currentTime).toBe(10)
  })
})
