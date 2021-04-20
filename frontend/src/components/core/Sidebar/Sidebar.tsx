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

import React, { PureComponent, ReactElement } from "react"
import { ChevronRight, X } from "@emotion-icons/open-iconic"
import Icon from "src/components/shared/Icon"
import Button, { Kind } from "src/components/shared/Button"
import { PageConfig } from "src/autogen/proto"
import { withTheme } from "emotion-theming"
import { Theme } from "src/theme"
import {
  StyledSidebar,
  StyledSidebarCloseButton,
  StyledSidebarCollapsedControl,
  StyledSidebarContent,
} from "./styled-components"
import IsSidebarContext from "./IsSidebarContext"

export interface SidebarProps {
  children?: ReactElement
  initialSidebarState?: PageConfig.SidebarState
  theme: Theme
}

interface State {
  collapsedSidebar: boolean
  lastInnerWidth: number
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
      lastInnerWidth: window ? window.innerWidth : Infinity,
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

  public render = (): ReactElement => {
    const { collapsedSidebar } = this.state
    const { children } = this.props

    // The tabindex is required to support scrolling by arrow keys.
    return (
      <StyledSidebar
        data-testid="stSidebar"
        aria-expanded={!collapsedSidebar}
        ref={this.sidebarRef}
      >
        <StyledSidebarContent isCollapsed={collapsedSidebar}>
          <StyledSidebarCloseButton>
            <Button kind={Kind.ICON} onClick={this.toggleCollapse}>
              <Icon content={X} />
            </Button>
          </StyledSidebarCloseButton>
          {children}
        </StyledSidebarContent>
        <StyledSidebarCollapsedControl isCollapsed={collapsedSidebar}>
          <Button kind={Kind.ICON} onClick={this.toggleCollapse}>
            <Icon content={ChevronRight} />
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
