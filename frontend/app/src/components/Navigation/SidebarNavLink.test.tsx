/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { render } from "@streamlit/lib"

import SidebarNavLink, { SidebarNavLinkProps } from "./SidebarNavLink"

const getProps = (
  props: Partial<SidebarNavLinkProps> = {}
): SidebarNavLinkProps => ({
  isActive: false,
  pageUrl: "https://www.example.com",
  icon: "",
  onClick: vi.fn(),
  children: "Test",
  widgetsDisabled: false,
  ...props,
})

describe("SidebarNavLink", () => {
  it("renders without crashing", () => {
    render(<SidebarNavLink {...getProps()} />)

    const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
    expect(sidebarNavLink).toHaveTextContent("Test")
    expect(sidebarNavLink).toHaveAttribute("href", "https://www.example.com")
  })

  it("has the correct href & text", () => {
    render(<SidebarNavLink {...getProps()} />)

    const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
    expect(sidebarNavLink).toHaveAttribute("href", "https://www.example.com")
    expect(sidebarNavLink).toHaveTextContent("Test")
  })

  it("renders with material icon", () => {
    render(<SidebarNavLink {...getProps({ icon: ":material/page:" })} />)

    screen.getByTestId("stSidebarNavLink")

    const materialIcon = screen.getByTestId("stIconMaterial")
    expect(materialIcon).toHaveTextContent("page")
  })

  it("renders with emoji icon", () => {
    render(<SidebarNavLink {...getProps({ icon: "🚀" })} />)

    screen.getByTestId("stSidebarNavLink")

    const emojiIcon = screen.getByTestId("stIconEmoji")
    expect(emojiIcon).toHaveTextContent("🚀")
  })

  it("renders a non-active page properly", () => {
    render(<SidebarNavLink {...getProps()} />)

    const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
    expect(sidebarNavLink).not.toHaveAttribute("aria-current")
  })

  it("renders an active page properly", () => {
    render(<SidebarNavLink {...getProps({ isActive: true })} />)

    const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
    expect(sidebarNavLink).toHaveAttribute("aria-current", "page")
  })

  it("renders when widgets are disabled", () => {
    render(<SidebarNavLink {...getProps({ widgetsDisabled: true })} />)

    screen.getByTestId("stSidebarNavLinkContainer")
    const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
    expect(sidebarNavLink).toHaveStyle("pointer-events: none")
  })

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<SidebarNavLink {...getProps({ onClick })} />)

    const sidebarNavLink = screen.getByTestId("stSidebarNavLink")
    await user.click(sidebarNavLink)

    expect(onClick).toHaveBeenCalled()
  })

  describe("when isTopNav is true", () => {
    it("renders successfully with isTopNav prop", () => {
      render(<SidebarNavLink {...getProps({ isTopNav: true })} />)

      const sidebarNavLink = screen.getByTestId("stTopNavLink")
      expect(sidebarNavLink).toHaveTextContent("Test")
    })

    it("maintains active state functionality for top nav", () => {
      render(
        <SidebarNavLink {...getProps({ isTopNav: true, isActive: true })} />
      )

      const sidebarNavLink = screen.getByTestId("stTopNavLink")
      expect(sidebarNavLink).toHaveAttribute("aria-current", "page")
    })

    it("handles disabled state for top nav", () => {
      render(
        <SidebarNavLink
          {...getProps({ isTopNav: true, widgetsDisabled: true })}
        />
      )

      screen.getByTestId("stTopNavLinkContainer")
      const sidebarNavLink = screen.getByTestId("stTopNavLink")
      expect(sidebarNavLink).toHaveStyle("pointer-events: none")
    })
  })
})
