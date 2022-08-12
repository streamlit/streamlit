import React from "react"
import { mount } from "src/lib/test_util"
import { fromJS, Map as ImmutableMap } from "immutable"

import { table, emptyTable } from "./mock"
import { Table, TableProps } from "./Table"

const getProps = (elementProps: Record<string, unknown> = {}): TableProps => ({
  element: fromJS(elementProps) as ImmutableMap<string, any>,
})

describe("Table Element", () => {
  it("renders without crashing", () => {
    const props = getProps(table)
    const wrapper = mount(<Table {...props} />)

    expect(wrapper.find("StyledTable").length).toBe(1)
    expect(wrapper.find("StyledTableContainer").length).toBe(1)
    expect(wrapper.find("StyledEmptyTableCell").exists()).toBeFalsy()
  })

  it("renders an empty row", () => {
    const props = getProps(emptyTable)
    const wrapper = mount(<Table {...props} />)

    expect(wrapper.find("StyledTable").length).toBe(1)
    expect(wrapper.find("StyledTableContainer").length).toBe(1)
    expect(wrapper.find("StyledEmptyTableCell").exists()).toBeTruthy()
  })
})
