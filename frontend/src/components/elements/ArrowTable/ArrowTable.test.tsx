import React from "react"
import { mount } from "src/lib/test_util"

import { UNICODE, EMPTY } from "src/lib/mocks/arrow"
import { Quiver } from "src/lib/Quiver"
import { ArrowTable, TableProps } from "./ArrowTable"

const getProps = (data: Uint8Array): TableProps => ({
  element: new Quiver({ data }),
})

describe("st._arrow_table", () => {
  it("renders without crashing", () => {
    const props = getProps(UNICODE)
    const wrapper = mount(<ArrowTable {...props} />)

    expect(wrapper.find("StyledTable").length).toBe(1)
    expect(wrapper.find("StyledTableContainer").length).toBe(1)
    expect(wrapper.find("StyledEmptyTableCell").exists()).toBeFalsy()
  })

  it("renders an empty row", () => {
    const props = getProps(EMPTY)
    const wrapper = mount(<ArrowTable {...props} />)

    expect(wrapper.find("StyledTable").length).toBe(1)
    expect(wrapper.find("StyledTableContainer").length).toBe(1)
    expect(wrapper.find("StyledEmptyTableCell").exists()).toBeTruthy()
  })
})
