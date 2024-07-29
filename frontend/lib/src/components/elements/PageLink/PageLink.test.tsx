/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { fireEvent, screen } from "@testing-library/react"

import "@testing-library/jest-dom"
import { customRenderLibContext, render } from "@streamlit/lib/src/test_util"
import IsSidebarContext from "@streamlit/lib/src/components/core/IsSidebarContext"
import { PageLink as PageLinkProto } from "@streamlit/lib/src/proto"

import PageLink, { Props } from "./PageLink"

const getProps = (
  elementProps: Partial<PageLinkProto> = {},
  widgetProps: Partial<Props> = {}
): Props => ({
  element: PageLinkProto.create({
    label: "Label",
    page: "streamlit_app",
    pageScriptHash: "main_page_hash",
    useContainerWidth: null,
    ...elementProps,
  }),
  width: 250,
  disabled: false,
  ...widgetProps,
})

const mockOnPageChange = jest.fn()

describe("PageLink", () => {
  beforeEach(() => {
    mockOnPageChange.mockClear()
  })

  it("renders without crashing", () => {
    const props = getProps()
    render(<PageLink {...props} />)

    const pageLink = screen.getByRole("link")
    expect(pageLink).toBeInTheDocument()
  })

  it("has correct className and style", () => {
    const props = getProps()
    render(<PageLink {...props} />)

    const pageLink = screen.getByTestId("stPageLink")

    expect(pageLink).toHaveClass("row-widget")
    expect(pageLink).toHaveClass("stPageLink")
    expect(pageLink).toHaveStyle(`width: ${props.width}px`)
  })

  it("renders a label within the button", () => {
    const props = getProps()
    render(<PageLink {...props} />)

    const pageLink = screen.getByRole("link", {
      name: `${props.element.label}`,
    })

    expect(pageLink).toBeInTheDocument()
  })

  it("handles the disabled prop", () => {
    const props = getProps({}, { disabled: true })
    render(<PageLink {...props} />)

    const pageLink = screen.getByRole("link")
    expect(pageLink).toHaveAttribute("disabled")
  })

  it("follows useContainerWidth property if set to true", () => {
    const props = getProps({ useContainerWidth: true })
    render(<PageLink {...props} />)
    const pageNavLink = screen.getByTestId("stPageLink-NavLink")
    expect(pageNavLink).toHaveStyle("width: 250px")
  })

  it("follows useContainerWidth property if set to false", () => {
    const props = getProps({ useContainerWidth: false })
    render(<PageLink {...props} />)
    const pageNavLink = screen.getByTestId("stPageLink-NavLink")
    expect(pageNavLink).toHaveStyle("width: fit-content")
  })

  it("useContainerWidth true by default in the sidebar", () => {
    const props = getProps()
    render(
      <IsSidebarContext.Provider value={true}>
        <PageLink {...props} />
      </IsSidebarContext.Provider>
    )
    const pageNavLink = screen.getByTestId("stPageLink-NavLink")
    expect(pageNavLink).toHaveStyle("width: 250px")
  })

  it("useContainerWidth false by default in the main page", () => {
    const props = getProps()
    render(
      <IsSidebarContext.Provider value={false}>
        <PageLink {...props} />
      </IsSidebarContext.Provider>
    )
    const pageNavLink = screen.getByTestId("stPageLink-NavLink")
    expect(pageNavLink).toHaveStyle("width: fit-content")
  })

  it("triggers onPageChange with pageScriptHash when clicked", () => {
    const props = getProps()

    customRenderLibContext(<PageLink {...props} />, {
      onPageChange: mockOnPageChange,
    })

    const pageNavLink = screen.getByTestId("stPageLink-NavLink")
    fireEvent.click(pageNavLink)
    expect(mockOnPageChange).toHaveBeenCalledWith("main_page_hash")
  })

  it("does not trigger onPageChange when disabled", () => {
    const props = getProps({}, { disabled: true })

    customRenderLibContext(<PageLink {...props} />, {
      onPageChange: mockOnPageChange,
    })

    const pageNavLink = screen.getByTestId("stPageLink-NavLink")
    fireEvent.click(pageNavLink)
    expect(mockOnPageChange).not.toHaveBeenCalled()
  })

  it("does not trigger onPageChange for external links", () => {
    const props = getProps({ page: "http://example.com", external: true })

    customRenderLibContext(<PageLink {...props} />, {
      onPageChange: mockOnPageChange,
    })

    const pageNavLink = screen.getByTestId("stPageLink-NavLink")
    fireEvent.click(pageNavLink)
    expect(mockOnPageChange).not.toHaveBeenCalled()
  })
})
