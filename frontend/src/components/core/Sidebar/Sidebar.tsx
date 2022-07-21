/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
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

import React, { PureComponent, ReactElement, ReactNode } from "react"
import { ChevronRight, Close } from "@emotion-icons/material-outlined"
import { withTheme } from "@emotion/react"
import { Resizable } from 're-resizable'
import { CSSTransition } from 'react-transition-group'

import Icon from "src/components/shared/Icon"
import Button, { Kind } from "src/components/shared/Button"
import { IAppPage, PageConfig } from "src/autogen/proto"
import { Theme } from "src/theme"

import {
  StyledSidebar,
  StyledSidebarCloseButton,
  StyledSidebarCollapsedControl,
  StyledSidebarUserContent,
  StyledSidebarContent,
} from "./styled-components"
import IsSidebarContext from "./IsSidebarContext"
import SidebarNav from "./SidebarNav"

export interface SidebarProps {
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
    this.state = {
      collapsedSidebar: Sidebar.shouldCollapse(props, this.mediumBreakpointPx),
      sidebarWidth: window.localStorage.getItem('sidebarWidth') || "336",
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

    this.setState({ sidebarWidth: newWidth }, function() {
      window.localStorage.setItem('sidebarWidth', newWidth)
    })
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
      <StyledSidebar
        data-testid="stSidebar"
        aria-expanded={!collapsedSidebar}
        ref={this.sidebarRef}
      >
        <Resizable
          data-testid="resizableComponent"
          minWidth={366}
          maxWidth={500}
          size={{ width: sidebarWidth, height: window.innerHeight }}
          as={StyledSidebarContent}
          // style={{ 
          //   borderRight: "4px solid transparent",
          //   // marginLeft: collapsedSidebar ? `-${sidebarWidth}px` : 0,
          //   transform: collapsedSidebar ? `translateX(-${sidebarWidth}px)` : "none",
          //   opacity: collapsedSidebar ? 0 : 1,
          //   transition: "opacity 500ms, transform 500ms",
          // }}
          onResizeStop={(e, direction, ref, d) => {
            const newWidth = parseInt(sidebarWidth) + d.width
            this.setSidebarWidth(newWidth)
          }}
          // @ts-ignore
          isCollapsed={collapsedSidebar}
          hideScrollbar={hideScrollbar}
          sidebarWidth={sidebarWidth}>
          <StyledSidebarContent
            isCollapsed={collapsedSidebar}
            hideScrollbar={hideScrollbar}
            sidebarWidth={sidebarWidth}
          >
            <StyledSidebarCloseButton>
              <Button kind={Kind.HEADER_BUTTON} onClick={this.toggleCollapse}>
                <Icon content={Close} size="lg" />
              </Button>
            </StyledSidebarCloseButton>
            {!hideSidebarNav && (
              <SidebarNav
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
          <StyledSidebarCollapsedControl
            chevronDownshift={chevronDownshift}
            isCollapsed={collapsedSidebar}
          >
            <Button kind={Kind.HEADER_BUTTON} onClick={this.toggleCollapse}>
              <Icon content={ChevronRight} size="lg" />
            </Button>
          </StyledSidebarCollapsedControl>
      </StyledSidebar>
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
