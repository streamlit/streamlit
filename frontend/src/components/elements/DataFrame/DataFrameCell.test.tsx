/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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
import { SortDirection } from "./SortDirection"

import Icon from "components/shared/Icon"
import DataFrameCell, { Props } from "./DataFrameCell"

const getProps = (props: Partial<Props> = {}): Props => ({
  columnIndex: 0,
  rowIndex: 0,
  className: "dataframe corner",
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

    expect(wrapper.find("div").length).toBe(1)
    expect(wrapper.prop("children")).toStrictEqual(["", ""])
  })

  describe("render a sortIcon if it's sorted by the user", () => {
    it("should render ascending icon", () => {
      const props = getProps({
        sortedByUser: true,
      })
      const wrapper = shallow(<DataFrameCell {...props} />)

      expect(wrapper.find(Icon).prop("type")).toBe("chevron-top")
    })

    it("should render descending icon", () => {
      const props = getProps({
        sortedByUser: true,
        columnSortDirection: SortDirection.DESCENDING,
      })
      const wrapper = shallow(<DataFrameCell {...props} />)

      expect(wrapper.find(Icon).prop("type")).toBe("chevron-bottom")
    })

    it("should only render sort icon in the top row", () => {
      const props = getProps({
        sortedByUser: true,
        columnSortDirection: SortDirection.DESCENDING,
        rowIndex: 1,
      })
      const wrapper = shallow(<DataFrameCell {...props} />)

      expect(wrapper.find(Icon).length).toBeFalsy()
    })

    it("should not render if it's undefined", () => {
      const props = getProps({
        sortedByUser: true,
        columnSortDirection: undefined,
      })
      const wrapper = shallow(<DataFrameCell {...props} />)

      expect(wrapper.find(Icon).length).toBeFalsy()
    })
  })

  it("should handle onClick", () => {
    const props = getProps({
      headerClickedCallback: jest.fn().mockReturnValue(1),
    })
    const wrapper = shallow(<DataFrameCell {...props} />)

    // @ts-ignore
    const result = wrapper.find("div").prop("onClick")()

    expect(props.headerClickedCallback).toHaveBeenCalledWith(0)
    expect(result).toBe(1)
  })

  describe("title", () => {
    it("should show sort by ascending", () => {
      const props = getProps({
        headerClickedCallback: jest.fn().mockReturnValue(1),
      })
      const wrapper = shallow(<DataFrameCell {...props} />)

      expect(wrapper.find("div").prop("title")).toBe(
        'Sorted by column "" (ascending)'
      )
    })

    it("should show sort by descending", () => {
      const props = getProps({
        headerClickedCallback: jest.fn().mockReturnValue(1),
        columnSortDirection: SortDirection.DESCENDING,
      })
      const wrapper = shallow(<DataFrameCell {...props} />)

      expect(wrapper.find("div").prop("title")).toBe(
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

      expect(wrapper.find("div").prop("title")).toBe(
        'Sort by column "contenido"'
      )
    })
  })
})
