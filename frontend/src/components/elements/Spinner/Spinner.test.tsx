import React from "react"
import { mount } from "src/lib/test_util"

import { BaseProvider, LightTheme } from "baseui"
import { Spinner as SpinnerProto } from "src/autogen/proto"
import Spinner, { SpinnerProps } from "./Spinner"

const getProps = (
  propOverrides: Partial<SpinnerProps> = {}
): SpinnerProps => ({
  element: SpinnerProto.create({
    text: "Loading...",
  }),
  width: 0,
  ...propOverrides,
})

describe("Spinner component", () => {
  it("renders without crashing", () => {
    const wrapper = mount(
      <BaseProvider theme={LightTheme}>
        <Spinner {...getProps()} />
      </BaseProvider>
    )

    expect(wrapper.find("StyledSpinnerContainer").length).toBe(1)
    expect(wrapper.find("StyledSpinnerContainer").html()).toMatchSnapshot()
  })

  it("sets the text and width correctly", () => {
    const wrapper = mount(
      <BaseProvider theme={LightTheme}>
        <Spinner {...getProps({ width: 100 })} />
      </BaseProvider>
    )

    expect(wrapper.find("StreamlitMarkdown").prop("source")).toEqual(
      "Loading..."
    )
    expect(wrapper.find("Spinner").prop("width")).toEqual(100)
  })
})
