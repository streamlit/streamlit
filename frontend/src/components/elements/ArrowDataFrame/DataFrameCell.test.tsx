/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from "react"
import { shallow } from "enzyme"
import { ChevronTop, ChevronBottom } from "@emotion-icons/open-iconic"
import Tooltip from "src/components/shared/Tooltip"
import { mount } from "src/lib/test_util"

import { SortDirection } from "./SortDirection"
import { StyledDataFrameCornerCell } from "./styled-components"
import DataFrameCell, { DataFrameCellProps } from "./DataFrameCell"

const getProps = (
  props: Partial<DataFrameCellProps> = {}
): DataFrameCellProps => ({
  CellType: StyledDataFrameCornerCell,
  columnIndex: 0,
  rowIndex: 0,
  className: "",
  contents: "",
  sortedByUser: false,
  columnSortDirection: SortDirection.ASCENDING,
  style: {},
  isNumeric: false,
  ...props,
})

describe("DataFrameCell Element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = mount(<DataFrameCell {...props} />)

    expect(wrapper.find(StyledDataFrameCornerCell).length).toBe(1)

    const tooltipContents = wrapper.find(Tooltip).prop("content")
    expect(tooltipContents).toStrictEqual("")
  })

  describe("the alignment of the contents", () => {
    it("should be to the right when numeric", () => {
      const props = getProps({
        isNumeric: true,
      })
      const wrapper = mount(<DataFrameCell {...props} />)

      expect(wrapper.find("StyledEllipsizedDiv").props().style.textAlign).toBe(
        "right"
      )
    })

    it("should be to the left when non-numeric", () => {
      const props = getProps({
        isNumeric: false,
      })
      const wrapper = mount(<DataFrameCell {...props} />)

      expect(wrapper.find("StyledEllipsizedDiv").props().style.textAlign).toBe(
        undefined
      )
    })
  })

  describe("render a sortIcon if it's sorted by the user", () => {
    it("should render ascending icon", () => {
      const props = getProps({
        sortedByUser: true,
      })
      const wrapper = mount(<DataFrameCell {...props} />)

      expect(wrapper.find("Icon").prop("content")).toBe(ChevronTop)
    })

    it("should render descending icon", () => {
      const props = getProps({
        sortedByUser: true,
        columnSortDirection: SortDirection.DESCENDING,
      })
      const wrapper = mount(<DataFrameCell {...props} />)

      expect(wrapper.find("Icon").prop("content")).toBe(ChevronBottom)
    })

    it("should only render sort icon in the top row", () => {
      const props = getProps({
        sortedByUser: true,
        columnSortDirection: SortDirection.DESCENDING,
        rowIndex: 1,
      })
      const wrapper = shallow(<DataFrameCell {...props} />)

      expect(wrapper.find("Icon").length).toBeFalsy()
    })

    it("should not render if it's undefined", () => {
      const props = getProps({
        sortedByUser: true,
        columnSortDirection: undefined,
      })
      const wrapper = shallow(<DataFrameCell {...props} />)

      expect(wrapper.find("Icon").length).toBeFalsy()
    })
  })

  it("should handle onClick", () => {
    const props = getProps({
      headerClickedCallback: jest.fn().mockReturnValue(1),
    })
    const wrapper = shallow(<DataFrameCell {...props} />)

    // @ts-ignore
    const result = wrapper.find(StyledDataFrameCornerCell).prop("onClick")()

    expect(props.headerClickedCallback).toHaveBeenCalledWith(0)
    expect(result).toBe(1)
  })

  describe("tooltip", () => {
    it("should show sort by ascending", () => {
      const props = getProps({
        headerClickedCallback: jest.fn().mockReturnValue(1),
      })
      const wrapper = mount(<DataFrameCell {...props} />)

      const tooltipContents = wrapper.find(Tooltip).prop("content")
      expect(tooltipContents).toBe("Sorted by this index column (ascending)")
    })

    it("should show sort by descending", () => {
      const props = getProps({
        headerClickedCallback: jest.fn().mockReturnValue(1),
        columnSortDirection: SortDirection.DESCENDING,
      })
      const wrapper = mount(<DataFrameCell {...props} />)

      const tooltipContents = wrapper.find(Tooltip).prop("content")
      expect(tooltipContents).toBe("Sorted by this index column (descending)")
    })

    it("should show sort when sorting is not specified", () => {
      const props = getProps({
        headerClickedCallback: jest.fn().mockReturnValue(1),
        columnSortDirection: undefined,
        contents: "contenido",
      })
      const wrapper = mount(<DataFrameCell {...props} />)

      const tooltipContents = wrapper.find(Tooltip).prop("content")
      expect(tooltipContents).toBe('Sort by "contenido"')
    })
  })
})
