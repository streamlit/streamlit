import React from "react"
import { shallow } from "enzyme"
import { ChevronTop, ChevronBottom } from "@emotion-icons/open-iconic"
import { SortDirection } from "./SortDirection"

import { StyledDataFrameCornerCell } from "./styled-components"
import DataFrameCell, { DataFrameCellProps } from "./DataFrameCell"

const getProps = (
  props: Partial<DataFrameCellProps> = {}
): DataFrameCellProps => ({
  CellType: StyledDataFrameCornerCell,
  columnIndex: 0,
  rowIndex: 0,
  style: { height: 25, left: 0, position: "absolute", top: 0, width: 32 },
  contents: "",
  sortedByUser: false,
  columnSortDirection: SortDirection.ASCENDING,
  ...props,
})

describe("DataFrameCell Element", () => {
  it("renders without crashing", () => {
    const props = getProps()
    const wrapper = shallow(<DataFrameCell {...props} />)

    expect(wrapper.find(StyledDataFrameCornerCell).length).toBe(1)
    expect(wrapper.prop("children")).toStrictEqual(["", ""])
  })

  describe("render a sortIcon if it's sorted by the user", () => {
    it("should render ascending icon", () => {
      const props = getProps({
        sortedByUser: true,
      })
      const wrapper = shallow(<DataFrameCell {...props} />)

      expect(wrapper.find("Icon").prop("content")).toBe(ChevronTop)
    })

    it("should render descending icon", () => {
      const props = getProps({
        sortedByUser: true,
        columnSortDirection: SortDirection.DESCENDING,
      })
      const wrapper = shallow(<DataFrameCell {...props} />)

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

  describe("title", () => {
    it("should show sort by ascending", () => {
      const props = getProps({
        headerClickedCallback: jest.fn().mockReturnValue(1),
      })
      const wrapper = shallow(<DataFrameCell {...props} />)

      expect(wrapper.find(StyledDataFrameCornerCell).prop("title")).toBe(
        'Sorted by column "" (ascending)'
      )
    })

    it("should show sort by descending", () => {
      const props = getProps({
        headerClickedCallback: jest.fn().mockReturnValue(1),
        columnSortDirection: SortDirection.DESCENDING,
      })
      const wrapper = shallow(<DataFrameCell {...props} />)

      expect(wrapper.find(StyledDataFrameCornerCell).prop("title")).toBe(
        'Sorted by column "" (descending)'
      )
    })

    it("should show sort when sorting is not specified", () => {
      const props = getProps({
        headerClickedCallback: jest.fn().mockReturnValue(1),
        columnSortDirection: undefined,
        contents: "contenido",
      })
      const wrapper = shallow(<DataFrameCell {...props} />)

      expect(wrapper.find(StyledDataFrameCornerCell).prop("title")).toBe(
        'Sort by column "contenido"'
      )
    })
  })
})
