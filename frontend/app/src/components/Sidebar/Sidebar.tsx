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

import React, { PureComponent, ReactElement, ReactNode } from "react"
import { ChevronRight, Close } from "@emotion-icons/material-outlined"
import { withTheme } from "@emotion/react"
import { Resizable } from "re-resizable"

import {
  Icon,
  Button,
  Kind,
  localStorageAvailable,
  StreamlitEndpoints,
} from "@streamlit/lib"

import { IAppPage, PageConfig } from "src/autogen/proto"
import { Theme } from "src/theme"

import {
  StyledSidebar,
  StyledSidebarCloseButton,
  StyledSidebarContent,
  StyledSidebarCollapsedControl,
  StyledSidebarUserContent,
  StyledResizeHandle,
} from "./styled-components"
import IsSidebarContext from "./IsSidebarContext"
import SidebarNav from "./SidebarNav"

export interface SidebarProps {
  endpoints: StreamlitEndpoints
  chevronDownshift: number
  children?: ReactElement
  initialSidebarState?: PageConfig.SidebarState
  theme: Theme
  hasElements: boolean
  appPages: IAppPage[]
  onPageChange: (pageName: string) => void
  currentPageScriptHash: string
  hideSidebarNav: boolean
  pageLinkBaseUrl: string
}

interface State {
  collapsedSidebar: boolean
  sidebarWidth: string
  lastInnerWidth: number

  // When hovering the nav
  hideScrollbar: boolean
}

class Sidebar extends PureComponent<SidebarProps, State> {
  private mediumBreakpointPx: number

  static readonly minWidth = "336"

  public static calculateMaxBreakpoint(value: string): number {
    // We subtract a margin of 0.02 to use as a max-width
    return parseInt(value, 10) - 0.02
  }

  private sidebarRef = React.createRef<HTMLDivElement>()

  constructor(props: SidebarProps) {
    super(props)
    this.mediumBreakpointPx = Sidebar.calculateMaxBreakpoint(
      props.theme.breakpoints.md
    )

    const cachedSidebarWidth = localStorageAvailable()
      ? localStorage.getItem("sidebarWidth")
      : undefined

    this.state = {
      collapsedSidebar: Sidebar.shouldCollapse(props, this.mediumBreakpointPx),
      sidebarWidth: cachedSidebarWidth || Sidebar.minWidth,
      lastInnerWidth: window ? window.innerWidth : Infinity,
      hideScrollbar: false,
    }
  }

  componentDidUpdate(prevProps: any): void {
    this.mediumBreakpointPx = Sidebar.calculateMaxBreakpoint(
      this.props.theme.breakpoints.md
    )
    // Immediately expand/collapse sidebar when initialSidebarState changes.
    if (this.props.initialSidebarState !== prevProps.initialSidebarState) {
      this.setState({
        collapsedSidebar: Sidebar.shouldCollapse(
          this.props,
          this.mediumBreakpointPx
        ),
      })
    }
  }

  static shouldCollapse(
    props: SidebarProps,
    mediumBreakpointPx: number
  ): boolean {
    switch (props.initialSidebarState) {
      case PageConfig.SidebarState.EXPANDED:
        return false
      case PageConfig.SidebarState.COLLAPSED:
        return true
      case PageConfig.SidebarState.AUTO:
      default: {
        // Expand sidebar only if browser width > MEDIUM_BREAKPOINT_PX
        const { innerWidth } = window || {}
        return innerWidth ? innerWidth <= mediumBreakpointPx : false
      }
    }
  }

  componentDidMount(): void {
    window.addEventListener("resize", this.checkMobileOnResize)
    document.addEventListener("mousedown", this.handleClickOutside)
  }

  componentWillUnmount(): void {
    window.removeEventListener("resize", this.checkMobileOnResize)
    document.removeEventListener("mousedown", this.handleClickOutside)
  }

  handleClickOutside = (event: any): void => {
    if (this.sidebarRef && window) {
      const { current } = this.sidebarRef
      const { innerWidth } = window

      if (
        current &&
        !current.contains(event.target) &&
        innerWidth <= this.mediumBreakpointPx
      ) {
        this.setState({ collapsedSidebar: true })
      }
    }
  }

  setSidebarWidth = (width: number): void => {
    const newWidth = width.toString()

    this.setState({ sidebarWidth: newWidth })

    if (localStorageAvailable()) {
      window.localStorage.setItem("sidebarWidth", newWidth)
    }
  }

  resetSidebarWidth = (event: any): void => {
    // Double clicking on the resize handle resets sidebar to default width
    if (event.detail === 2) {
      this.setState({ sidebarWidth: Sidebar.minWidth })
      if (localStorageAvailable()) {
        window.localStorage.setItem("sidebarWidth", Sidebar.minWidth)
      }
    }
  }

  checkMobileOnResize = (): boolean => {
    if (!window) return false

    const { innerWidth } = window

    // Collapse the sidebar if the window was narrowed and is now mobile-sized
    if (
      innerWidth < this.state.lastInnerWidth &&
      innerWidth <= this.mediumBreakpointPx
    ) {
      this.setState({ collapsedSidebar: true })
    }
    this.setState({ lastInnerWidth: innerWidth })

    return true
  }

  toggleCollapse = (): void => {
    const { collapsedSidebar } = this.state

    this.setState({ collapsedSidebar: !collapsedSidebar })
  }

  hideScrollbar = (newValue: boolean): void => {
    this.setState({ hideScrollbar: newValue })
  }

  // BUG(tvst): X button should have same color as hamburger.
  // BUG(tvst): X and > buttons should have same margins as hamburger.
  public render(): ReactNode {
    const { collapsedSidebar, sidebarWidth, hideScrollbar } = this.state
    const {
      appPages,
      chevronDownshift,
      children,
      hasElements,
      onPageChange,
      currentPageScriptHash,
      hideSidebarNav,
      pageLinkBaseUrl,
    } = this.props

    const hasPageNavAbove = appPages.length > 1 && !hideSidebarNav

    // The tabindex is required to support scrolling by arrow keys.
    return (
      <>
        {collapsedSidebar && (
          <StyledSidebarCollapsedControl
            chevronDownshift={chevronDownshift}
            isCollapsed={collapsedSidebar}
            data-testid="collapsedControl"
          >
            <Button kind={Kind.HEADER_BUTTON} onClick={this.toggleCollapse}>
              <Icon content={ChevronRight} size="lg" />
            </Button>
          </StyledSidebarCollapsedControl>
        )}
        <Resizable
          data-testid="stSidebar"
          aria-expanded={!collapsedSidebar}
          enable={{
            top: false,
            right: true,
            bottom: false,
            left: false,
          }}
          handleStyles={{ right: { width: "8px", right: "-6px" } }}
          handleComponent={{
            right: <StyledResizeHandle onClick={this.resetSidebarWidth} />,
          }}
          size={{ width: sidebarWidth, height: "100%" }}
          as={StyledSidebar}
          onResizeStop={(e, direction, ref, d) => {
            const newWidth = parseInt(sidebarWidth, 10) + d.width
            this.setSidebarWidth(newWidth)
          }}
          // Props part of StyledSidebar, but not Resizable component
          // @ts-expect-error
          isCollapsed={collapsedSidebar}
          sidebarWidth={sidebarWidth}
        >
          <StyledSidebarContent
            hideScrollbar={hideScrollbar}
            ref={this.sidebarRef}
          >
            <StyledSidebarCloseButton>
              <Button kind={Kind.HEADER_BUTTON} onClick={this.toggleCollapse}>
                <Icon content={Close} size="lg" />
              </Button>
            </StyledSidebarCloseButton>
            {!hideSidebarNav && (
              <SidebarNav
                endpoints={this.props.endpoints}
                appPages={appPages}
                collapseSidebar={this.toggleCollapse}
                currentPageScriptHash={currentPageScriptHash}
                hasSidebarElements={hasElements}
                hideParentScrollbar={this.hideScrollbar}
                onPageChange={onPageChange}
                pageLinkBaseUrl={pageLinkBaseUrl}
              />
            )}
            <StyledSidebarUserContent hasPageNavAbove={hasPageNavAbove}>
              {children}
            </StyledSidebarUserContent>
          </StyledSidebarContent>
        </Resizable>
      </>
    )
  }
}

function SidebarWithProvider(props: SidebarProps): ReactElement {
  return (
    <IsSidebarContext.Provider value={true}>
      <Sidebar {...props} />
    </IsSidebarContext.Provider>
  )
}

export default withTheme(SidebarWithProvider)
