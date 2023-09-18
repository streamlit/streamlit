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
import "@testing-library/jest-dom"
import { fireEvent, screen } from "@testing-library/react"
import { render } from "@streamlit/lib/src/test_util"
import Pagination, { Props } from "./Pagination"

const getProps = (props: Partial<Props> = {}): Props => ({
  className: "",
  currentPage: 1,
  totalPages: 2,
  pageSize: 3,
  onNext: jest.fn(),
  onPrevious: jest.fn(),
  ...props,
})

describe("Pagination widget", () => {
  const props = getProps()
  render(<Pagination {...props} />)

  it("renders without crashing", () => {
    expect(screen.getByTestId("stPagination")).toBeInTheDocument()
  })

  it("should show current and total pages", () => {
    const defaultProps = getProps({
      currentPage: 1,
      totalPages: 10,
    })
    render(<Pagination {...defaultProps} />)
    expect(screen.getByText("Showing page 1 of 10")).toBeInTheDocument()
  })

  it("should be able to go to previous page", () => {
    render(<Pagination {...props} />)
    const prevPaginationButton = screen.getAllByTestId("baseButton-minimal")[0]
    fireEvent.click(prevPaginationButton)
    expect(props.onPrevious).toHaveBeenCalledTimes(1)
  })

  it("should be able to go to next page", () => {
    render(<Pagination {...props} />)
    const nextPaginationButton = screen.getAllByTestId("baseButton-minimal")[1]
    fireEvent.click(nextPaginationButton)
    expect(props.onNext).toHaveBeenCalledTimes(1)
  })
})
