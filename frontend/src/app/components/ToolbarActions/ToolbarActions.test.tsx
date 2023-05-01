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
      <ActionButton {...getProps({ label: undefined })} />
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
    hostToolbarItems: [
      { key: "favorite", icon: "star.svg" },
      { key: "share", label: "Share" },
    ],
    sendMessageToHost: jest.fn(),
    ...extended,
  })

  it("renders without crashing", () => {
    const wrapper = shallow(<ToolbarActions {...getProps()} />)
    expect(wrapper).toMatchSnapshot()
  })

  it("calls sendMessageToHost with correct args when clicked", () => {
    const props = getProps()
    const wrapper = shallow(<ToolbarActions {...props} />)

    wrapper.find(ActionButton).at(0).simulate("click")
    expect(props.sendMessageToHost).toHaveBeenLastCalledWith({
      type: "TOOLBAR_ITEM_CALLBACK",
      key: "favorite",
    })

    wrapper.find(ActionButton).at(1).simulate("click")
    expect(props.sendMessageToHost).toHaveBeenLastCalledWith({
      type: "TOOLBAR_ITEM_CALLBACK",
      key: "share",
    })
  })
})
