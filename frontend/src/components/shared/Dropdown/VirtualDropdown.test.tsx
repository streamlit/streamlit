import React, { ReactElement } from "react"
import { shallow, mount } from "src/lib/test_util"

import VirtualDropdown from "./VirtualDropdown"

interface OptionProps {
  item?: { value: string }
}

function Option(props: OptionProps): ReactElement {
  return <span className={props.item ? props.item.value : "nothing"} />
}

describe("VirtualDropdown element", () => {
  it("renders a StyledEmptyState when it has no children", () => {
    const wrapper = shallow(<VirtualDropdown />)

    expect(wrapper.find("StyledEmptyState").exists()).toBeTruthy()
  })

  it("renders a StyledEmptyState when it has children with no item", () => {
    const wrapper = shallow(
      <VirtualDropdown>
        <Option />
      </VirtualDropdown>
    )

    expect(wrapper.find("StyledEmptyState").exists()).toBeTruthy()
  })

  it("renders a FixedSizeList when it has children", () => {
    const wrapper = mount(
      <VirtualDropdown>
        <Option item={{ value: "abc" }} />
      </VirtualDropdown>
    )

    expect(wrapper.find("FixedSizeListItem").exists()).toBeTruthy()
  })
})
