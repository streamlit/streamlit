import React from "react"

import { shallow } from "src/lib/test_util"

import { StyledActionButtonIcon } from "./styled-components"
import ToolbarActions, {
  ActionButton,
  ActionButtonProps,
  ToolbarActionsProps,
} from "./ToolbarActions"

describe("ActionButton", () => {
  const getProps = (
    extended?: Partial<ActionButtonProps>
  ): ActionButtonProps => ({
    borderless: false,
    label: "the label",
    icon: "star.svg",
    onClick: jest.fn(),
    ...extended,
  })

  it("renders without crashing and matches snapshot", () => {
    const wrapper = shallow(<ActionButton {...getProps()} />)

    expect(wrapper).toMatchSnapshot()
    expect(wrapper.find(StyledActionButtonIcon)).toHaveLength(1)
    expect(wrapper.find("span")).toHaveLength(1)
  })

  it("does not render icon if not provided", () => {
    const wrapper = shallow(
      <ActionButton {...getProps({ icon: undefined })} />
    )

    expect(wrapper).toMatchSnapshot()
    expect(wrapper.find(StyledActionButtonIcon).exists()).toBe(false)
    expect(wrapper.find("span")).toHaveLength(1)
  })

  it("does not render label if not provided", () => {
    const wrapper = shallow(
      <ActionButton {...getProps({ label: undefined, borderless: true })} />
    )

    expect(wrapper).toMatchSnapshot()
    expect(wrapper.find(StyledActionButtonIcon)).toHaveLength(1)
    expect(wrapper.find("span").exists()).toBe(false)
  })
})

describe("ToolbarActions", () => {
  const getProps = (
    extended?: Partial<ToolbarActionsProps>
  ): ToolbarActionsProps => ({
    s4aToolbarItems: [
      { key: "favorite", icon: "star.svg" },
      { key: "share", label: "Share" },
    ],
    sendS4AMessage: jest.fn(),
    ...extended,
  })

  it("renders without crashing", () => {
    const wrapper = shallow(<ToolbarActions {...getProps()} />)
    expect(wrapper).toMatchSnapshot()
  })

  it("calls sendS4AMessage with correct args when clicked", () => {
    const props = getProps()
    const wrapper = shallow(<ToolbarActions {...props} />)

    wrapper
      .find(ActionButton)
      .at(0)
      .simulate("click")
    expect(props.sendS4AMessage).toHaveBeenLastCalledWith({
      type: "TOOLBAR_ITEM_CALLBACK",
      key: "favorite",
    })

    wrapper
      .find(ActionButton)
      .at(1)
      .simulate("click")
    expect(props.sendS4AMessage).toHaveBeenLastCalledWith({
      type: "TOOLBAR_ITEM_CALLBACK",
      key: "share",
    })
  })
})
