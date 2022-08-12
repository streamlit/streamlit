import React from "react"
import { mount } from "src/lib/test_util"

import { Radio as UIRadio, RadioGroup, ALIGN } from "baseui/radio"
import { LabelVisibilityOptions } from "src/lib/utils"
import { lightTheme } from "src/theme"
import Radio, { Props } from "./Radio"

const getProps = (props: Partial<Props> = {}): Props => ({
  width: 0,
  disabled: false,
  horizontal: false,
  value: 0,
  onChange: () => {},
  options: ["a", "b", "c"],
  label: "Label",
  theme: lightTheme.emotion,
  ...props,
})

describe("Radio widget", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<Radio {...props} />)

    expect(wrapper.find(RadioGroup).length).toBe(1)
    expect(wrapper.find(UIRadio).length).toBe(3)
  })

  it("renders without crashing if no label is provided", () => {
    const props = getProps({ label: undefined })
    const wrapper = mount(<Radio {...props} />)
    expect(wrapper.find(RadioGroup).length).toBe(1)
    expect(wrapper.find(UIRadio).length).toBe(3)
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when hidden", () => {
    const props = getProps({
      labelVisibility: LabelVisibilityOptions.Hidden,
    })
    const wrapper = mount(<Radio {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityOptions.Hidden
    )
  })

  it("pass labelVisibility prop to StyledWidgetLabel correctly when collapsed", () => {
    const props = getProps({
      labelVisibility: LabelVisibilityOptions.Collapsed,
    })
    const wrapper = mount(<Radio {...props} />)
    expect(wrapper.find("StyledWidgetLabel").prop("labelVisibility")).toEqual(
      LabelVisibilityOptions.Collapsed
    )
  })

  it("has correct className and style", () => {
    const props = getProps()
    const wrapper = mount(<Radio {...props} />)
    const wrappedDiv = wrapper.find("div").first()

    const { className, style } = wrappedDiv.props()
    // @ts-ignore
    const splittedClassName = className.split(" ")

    expect(splittedClassName).toContain("row-widget")
    expect(splittedClassName).toContain("stRadio")

    // @ts-ignore
    expect(style.width).toBe(getProps().width)
  })

  it("renders a label", () => {
    const props = getProps()
    const wrapper = mount(<Radio {...props} />)
    expect(wrapper.find("StyledWidgetLabel").text()).toBe(props.label)
  })

  it("has a default value", () => {
    const props = getProps()
    const wrapper = mount(<Radio {...props} />)
    expect(wrapper.find(RadioGroup).prop("value")).toBe(props.value.toString())
  })

  it("can be disabled", () => {
    const props = getProps()
    const wrapper = mount(<Radio {...props} />)
    expect(wrapper.find(RadioGroup).prop("disabled")).toBe(props.disabled)
  })

  it("can be horizontally aligned", () => {
    const props = getProps({ horizontal: true })
    const wrapper = mount(<Radio {...props} />)
    expect(wrapper.find(RadioGroup).prop("align")).toBe(ALIGN.horizontal)
  })

  it("has the correct options", () => {
    const props = getProps()
    const wrapper = mount(<Radio {...props} />)
    const options = wrapper.find(UIRadio)

    options.forEach((option, index) => {
      expect(option.prop("value")).toBe(index.toString())
      expect(option.prop("children")).toBe(props.options[index])
    })
  })

  it("shows a message when there are no options to be shown", () => {
    const props = getProps({ options: [] })
    const wrapper = mount(<Radio {...props} />)

    expect(wrapper.find(UIRadio).length).toBe(1)
    expect(wrapper.find(UIRadio).prop("children")).toBe(
      "No options to select."
    )
  })

  it("handles value changes", () => {
    const props = getProps()
    const wrapper = mount(<Radio {...props} />)

    // @ts-ignore
    wrapper.find(RadioGroup).prop("onChange")({
      target: {
        value: "1",
      },
    } as React.ChangeEvent<HTMLInputElement>)
    wrapper.update()

    expect(wrapper.find(RadioGroup).prop("value")).toBe("1")
  })
})
