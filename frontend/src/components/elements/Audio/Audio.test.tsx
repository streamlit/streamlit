import React from "react"
import { mount, shallow } from "src/lib/test_util"

import { Audio as AudioProto } from "src/autogen/proto"
import Audio, { AudioProps } from "./Audio"

const getProps = (elementProps: Partial<AudioProto> = {}): AudioProps => ({
  element: AudioProto.create({
    startTime: 0,
    url: "/media/08a569df5f3bd617f11b7d137861a3bef91379309ce95bdb9ff04a38.wav",
    ...elementProps,
  }),
  width: 0,
})

describe("Audio Element", () => {
  const props = getProps()
  const wrapper = shallow(<Audio {...props} />)
  const audioElement = wrapper.find("audio")

  it("renders without crashing", () => {
    expect(audioElement.length).toBe(1)
  })

  it("should have controls", () => {
    expect(audioElement.prop("controls")).toBeDefined()
  })

  describe("should have a src", () => {
    it("when the url starts with media", () => {
      expect(audioElement.prop("src")).toBe(
        "http://localhost:80/media/08a569df5f3bd617f11b7d137861a3bef91379309ce95bdb9ff04a38.wav"
      )
    })

    it("when it's a complete url", () => {
      const props = getProps({
        url: "http://localhost:80/media/sound.wav",
      })
      const wrapper = shallow(<Audio {...props} />)
      const audioElement = wrapper.find("audio")

      expect(audioElement.prop("src")).toBe(props.element.url)
    })
  })

  it("should update time when the prop is changed", () => {
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
