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

import {
  fireEvent,
  RenderResult,
  screen,
  within,
} from "@testing-library/react"

import { mockEndpoints, render } from "@streamlit/lib"
import { Logo, PageConfig } from "@streamlit/protobuf"
import { AppContextProps } from "@streamlit/app/src/components/AppContext"
import * as StreamlitContextProviderModule from "@streamlit/app/src/components/StreamlitContextProvider"

import Sidebar, { SidebarProps } from "./Sidebar"

vi.mock("~lib/util/Hooks", async () => ({
  __esModule: true,
  ...(await vi.importActual("~lib/util/Hooks")),
  useIsOverflowing: vi.fn(),
}))

const buildMediaURL = vi.fn((url: string) => url)
const sendClientErrorToHost = vi.fn()
const mockEndpointProp = mockEndpoints({
  buildMediaURL,
  sendClientErrorToHost,
})

function renderSidebar(props: Partial<SidebarProps> = {}): RenderResult {
  return render(
    <Sidebar
      endpoints={mockEndpointProp}
      chevronDownshift={0}
      hasElements
      {...props}
    />
  )
}

function getContextOutput(context: Partial<AppContextProps>): AppContextProps {
  return {
    initialSidebarState: PageConfig.SidebarState.AUTO,
    pageLinkBaseUrl: "",
    currentPageScriptHash: "",
    onPageChange: vi.fn(),
    navSections: [],
    appPages: [],
    appLogo: null,
    sidebarChevronDownshift: 0,
    expandSidebarNav: false,
    hideSidebarNav: false,
    widgetsDisabled: false,
    gitInfo: null,
    ...context,
  }
}

describe("Sidebar Component", () => {
  beforeEach(() => {
    vi.spyOn(StreamlitContextProviderModule, "useAppContext").mockReturnValue(
      getContextOutput({})
    )
  })

  it("should render without crashing", () => {
    renderSidebar({})

    expect(screen.getByTestId("stSidebar")).toBeInTheDocument()
  })

  it("should render expanded", () => {
    renderSidebar({
      initialSidebarState: PageConfig.SidebarState.EXPANDED,
    })

    expect(screen.getByTestId("stSidebar")).toHaveAttribute(
      "aria-expanded",
      "true"
    )
  })

  it("should render collapsed", () => {
    renderSidebar({
      initialSidebarState: PageConfig.SidebarState.COLLAPSED,
    })

    expect(screen.getByTestId("stSidebar")).toHaveAttribute(
      "aria-expanded",
      "false"
    )
  })

  it("should collapse on toggle if expanded", () => {
    renderSidebar({
      initialSidebarState: PageConfig.SidebarState.EXPANDED,
    })

    expect(screen.getByTestId("stSidebar")).toHaveAttribute(
      "aria-expanded",
      "true"
    )

    // Click the close sidebar <
    // TODO: Utilize user-event instead of fireEvent
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.mouseOver(screen.getByTestId("stSidebarHeader"))
    const sidebarCollapseButton = within(
      screen.getByTestId("stSidebarCollapseButton")
    ).getByRole("button")
    // TODO: Utilize user-event instead of fireEvent
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.click(sidebarCollapseButton)

    expect(screen.getByTestId("stSidebar")).toHaveAttribute(
      "aria-expanded",
      "false"
    )
  })

  it("should expand on toggle if collapsed", () => {
    renderSidebar({
      initialSidebarState: PageConfig.SidebarState.COLLAPSED,
    })

    expect(screen.getByTestId("stSidebar")).toHaveAttribute(
      "aria-expanded",
      "false"
    )

    // Click the expand sidebar > button
    const expandButton = within(
      screen.getByTestId("stSidebarCollapsedControl")
    ).getByRole("button")
    // TODO: Utilize user-event instead of fireEvent
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.click(expandButton)

    expect(screen.getByTestId("stSidebar")).toHaveAttribute(
      "aria-expanded",
      "true"
    )
  })

  it("shows/hides the collapse arrow when hovering over top of sidebar", () => {
    // Update the mock to return a context with appPages
    vi.spyOn(StreamlitContextProviderModule, "useAppContext").mockReturnValue(
      getContextOutput({
        appPages: [
          { pageName: "first_page", pageScriptHash: "page_hash" },
          { pageName: "second_page", pageScriptHash: "page_hash2" },
        ],
      })
    )

    renderSidebar()

    // Hidden when not hovering near the top of sidebar
    expect(screen.getByTestId("stSidebarCollapseButton")).toHaveStyle(
      "display: none"
    )

    // Hover over the sidebar header
    // TODO: Utilize user-event instead of fireEvent
    // eslint-disable-next-line testing-library/prefer-user-event
    fireEvent.mouseOver(screen.getByTestId("stSidebarHeader"))

    // Displays the collapse <
    expect(screen.getByTestId("stSidebarCollapseButton")).toHaveStyle(
      "display: inline"
    )
  })

  it("has no top padding if no SidebarNav is displayed", () => {
    // Update the mock to return a context with appPages
    vi.spyOn(StreamlitContextProviderModule, "useAppContext").mockReturnValue(
      getContextOutput({
        appPages: [{ pageName: "streamlit_app", pageScriptHash: "page_hash" }],
      })
    )
    renderSidebar()

    expect(screen.getByTestId("stSidebarUserContent")).toHaveStyle(
      "padding-top: 0"
    )
  })

  it("has small padding if the SidebarNav is displayed", () => {
    // Update the mock to return a context with appPages
    vi.spyOn(StreamlitContextProviderModule, "useAppContext").mockReturnValue(
      getContextOutput({
        appPages: [
          { pageName: "streamlit_app", pageScriptHash: "page_hash" },
          { pageName: "streamlit_app2", pageScriptHash: "page_hash2" },
        ],
      })
    )
    renderSidebar()

    expect(screen.getByTestId("stSidebarUserContent")).toHaveStyle(
      "padding-top: 1.5rem"
    )
  })

  it("uses the default chevron spacing if chevronDownshift is zero", () => {
    renderSidebar({
      chevronDownshift: 0,
      initialSidebarState: PageConfig.SidebarState.COLLAPSED,
    })

    expect(screen.getByTestId("stSidebarCollapsedControl")).toHaveStyle(
      "top: 1.25rem"
    )
  })

  it("uses the given chevron spacing if chevronDownshift is nonzero", () => {
    renderSidebar({
      chevronDownshift: 50,
      initialSidebarState: PageConfig.SidebarState.COLLAPSED,
    })

    expect(screen.getByTestId("stSidebarCollapsedControl")).toHaveStyle(
      "top: 50px"
    )
  })

  it("renders SidebarNav component", () => {
    // Update the mock to return a context with appPages
    vi.spyOn(StreamlitContextProviderModule, "useAppContext").mockReturnValue(
      getContextOutput({
        appPages: [
          {
            pageName: "first page",
            pageScriptHash: "page_hash",
            urlPathname: "first_page",
          },
          {
            pageName: "second page",
            pageScriptHash: "page_hash2",
            urlPathname: "second_page",
          },
        ],
      })
    )
    renderSidebar()

    expect(screen.getByTestId("stSidebarNav")).toBeInTheDocument()

    const sidebarAppPages = screen.getAllByRole("listitem")
    expect(sidebarAppPages).toHaveLength(2)
    expect(sidebarAppPages[0]).toHaveTextContent("first page")
    expect(sidebarAppPages[1]).toHaveTextContent("second page")
  })

  it("can hide SidebarNav with the hideSidebarNav option", () => {
    // Update the mock to return a context with hideSidebarNav set to true
    vi.spyOn(StreamlitContextProviderModule, "useAppContext").mockReturnValue(
      getContextOutput({
        hideSidebarNav: true,
        appPages: [
          { pageName: "streamlit_app", pageScriptHash: "page_hash" },
          { pageName: "streamlit_app2", pageScriptHash: "page_hash2" },
        ],
      })
    )
    renderSidebar()

    expect(screen.queryByTestId("stSidebarNav")).not.toBeInTheDocument()
  })

  it("applies scrollbarGutter style to sidebar content", () => {
    // Asserts behavior to prevent layout shifts when the scrollbars
    // appear and disappear.
    // @see https://github.com/streamlit/streamlit/issues/10310
    renderSidebar({})

    const sidebarContent = screen.getByTestId("stSidebarContent")
    const styles = window.getComputedStyle(sidebarContent)

    expect(styles.scrollbarGutter).toBe("stable both-edges")
  })

  describe("handles appLogo rendering", () => {
    const imageOnly = Logo.create({
      image:
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
    })

    const imageWithLink = Logo.create({
      image:
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
      link: "www.example.com",
    })

    const fullAppLogo = Logo.create({
      image:
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
      link: "www.example.com",
      iconImage: "https://docs.streamlit.io/logo.svg",
    })

    const logoWithSize = Logo.create({
      image:
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
      link: "www.example.com",
      iconImage: "https://docs.streamlit.io/logo.svg",
      size: "small",
    })

    it("renders spacer if no logo provided", () => {
      // Mock returns a context with appLogo set to null by default
      renderSidebar()
      const sidebarLogoSpacer = within(
        screen.getByTestId("stSidebar")
      ).getByTestId("stLogoSpacer")
      expect(sidebarLogoSpacer).toBeInTheDocument()
    })

    it("renders logo when sidebar collapsed - uses iconImage if provided", () => {
      // Update the mock to return a context with appLogo set to fullAppLogo
      vi.spyOn(
        StreamlitContextProviderModule,
        "useAppContext"
      ).mockReturnValue(
        getContextOutput({
          appLogo: fullAppLogo,
        })
      )
      const sourceSpy = vi.spyOn(mockEndpointProp, "buildMediaURL")
      renderSidebar({
        initialSidebarState: PageConfig.SidebarState.COLLAPSED,
      })

      const openSidebarContainer = screen.getByTestId(
        "stSidebarCollapsedControl"
      )
      expect(openSidebarContainer).toBeInTheDocument()
      const collapsedLogo = within(openSidebarContainer).getByTestId(
        "stHeaderLogo"
      )
      expect(collapsedLogo).toBeInTheDocument()
      expect(sourceSpy).toHaveBeenCalledWith(
        "https://docs.streamlit.io/logo.svg"
      )
    })

    it("renders logo when sidebar collapsed - defaults to image if no iconImage", () => {
      // Update the mock to return a context with appLogo
      vi.spyOn(
        StreamlitContextProviderModule,
        "useAppContext"
      ).mockReturnValue(
        getContextOutput({
          appLogo: imageOnly,
        })
      )
      const sourceSpy = vi.spyOn(mockEndpointProp, "buildMediaURL")
      renderSidebar({
        initialSidebarState: PageConfig.SidebarState.COLLAPSED,
      })
      const openSidebarContainer = screen.getByTestId(
        "stSidebarCollapsedControl"
      )
      expect(openSidebarContainer).toBeInTheDocument()
      const collapsedLogo = within(openSidebarContainer).getByTestId(
        "stHeaderLogo"
      )
      expect(collapsedLogo).toBeInTheDocument()
      expect(sourceSpy).toHaveBeenCalledWith(
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png"
      )
    })

    it("renders logo's image param when sidebar expanded", () => {
      // Update the mock to return a context with appLogo
      vi.spyOn(
        StreamlitContextProviderModule,
        "useAppContext"
      ).mockReturnValue(
        getContextOutput({
          appLogo: fullAppLogo,
        })
      )
      const sourceSpy = vi.spyOn(mockEndpointProp, "buildMediaURL")
      renderSidebar({})
      const sidebarLogoContainer = screen.getByTestId("stSidebarHeader")
      expect(sidebarLogoContainer).toBeInTheDocument()
      const sidebarLogo = within(sidebarLogoContainer).getByTestId(
        "stSidebarLogo"
      )
      expect(sidebarLogo).toBeInTheDocument()
      expect(sourceSpy).toHaveBeenCalledWith(
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png"
      )
    })

    it("renders logo - default image has no link & medium size", () => {
      // Update the mock to return a context with appLogo
      vi.spyOn(
        StreamlitContextProviderModule,
        "useAppContext"
      ).mockReturnValue(
        getContextOutput({
          appLogo: imageOnly,
        })
      )
      renderSidebar()

      const sidebarLogoLink = within(
        screen.getByTestId("stSidebar")
      ).queryByTestId("stLogoLink")
      expect(sidebarLogoLink).not.toBeInTheDocument()
      const sidebarLogo = within(screen.getByTestId("stSidebar")).getByTestId(
        "stSidebarLogo"
      )
      expect(sidebarLogo).toHaveStyle({ height: "1.5rem" })
    })

    it("renders logo - image has link if provided", () => {
      // Update the mock to return a context with appLogo
      vi.spyOn(
        StreamlitContextProviderModule,
        "useAppContext"
      ).mockReturnValue(
        getContextOutput({
          appLogo: imageWithLink,
        })
      )
      renderSidebar()

      const sidebarLogoLink = within(
        screen.getByTestId("stSidebar")
      ).getByTestId("stLogoLink")
      expect(sidebarLogoLink).toHaveAttribute("href", "www.example.com")
      const sidebarLogo = within(screen.getByTestId("stSidebar")).getByTestId(
        "stSidebarLogo"
      )
      expect(sidebarLogo).toHaveStyle({ height: "1.5rem" })
    })

    it("renders logo - small size when specified", () => {
      // Update the mock to return a context with appLogo
      vi.spyOn(
        StreamlitContextProviderModule,
        "useAppContext"
      ).mockReturnValue(
        getContextOutput({
          appLogo: logoWithSize,
        })
      )
      renderSidebar()

      const sidebarLogo = within(screen.getByTestId("stSidebar")).getByTestId(
        "stSidebarLogo"
      )
      expect(sidebarLogo).toHaveStyle({ height: "1.25rem" })
    })

    it("sends an CLIENT_ERROR message when the logo source fails to load", () => {
      // Update the mock to return a context with appLogo
      vi.spyOn(
        StreamlitContextProviderModule,
        "useAppContext"
      ).mockReturnValue(
        getContextOutput({
          appLogo: fullAppLogo,
        })
      )
      renderSidebar()

      const sidebarLogo = within(
        screen.getByTestId("stSidebarHeader")
      ).getByTestId("stSidebarLogo")
      expect(sidebarLogo).toBeInTheDocument()

      fireEvent.error(sidebarLogo)

      expect(sendClientErrorToHost).toHaveBeenCalledWith(
        "Sidebar Logo",
        "Logo source failed to load",
        "onerror triggered",
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png"
      )
    })
  })
})
