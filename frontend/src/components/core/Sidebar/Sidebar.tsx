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

import React, { PureComponent, ReactElement } from "react"
import classNames from "classnames"
import Icon from "components/shared/Icon"
import Button, { Kind } from "components/shared/Button"
import { PageConfig } from "autogen/proto"

import "./Sidebar.scss"

interface Props {
  children?: ReactElement
  initialSidebarState?: PageConfig.SidebarState
  onChange: (collapsedSidebar: boolean) => void
}

interface State {
  collapsedSidebar: boolean
}

// Bootstrap medium breakpoint. See
// https://getbootstrap.com/docs/4.3/layout/overview/.
const MEDIUM_BREAKPOINT_PX = 991.98

class Sidebar extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    onChange: () => {},
  }

  private sidebarRef = React.createRef<HTMLDivElement>()

  constructor(props: Props) {
    super(props)
    this.state = { collapsedSidebar: Sidebar.shouldCollapse(props) }
  }

  componentDidUpdate(prevProps: any): void {
    // Immediately expand/collapse sidebar when initialSidebarState changes.
    if (this.props.initialSidebarState !== prevProps.initialSidebarState) {
      this.setState({ collapsedSidebar: Sidebar.shouldCollapse(this.props) })
    }
  }

  static shouldCollapse(props: Props): boolean {
    switch (props.initialSidebarState) {
      case PageConfig.SidebarState.EXPANDED:
        return false
      case PageConfig.SidebarState.COLLAPSED:
        return true
      case PageConfig.SidebarState.AUTO:
      default: {
        // Expand sidebar only if browser width > MEDIUM_BREAKPOINT_PX
        const { innerWidth } = window || {}
        return innerWidth ? innerWidth <= MEDIUM_BREAKPOINT_PX : false
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
        innerWidth <= MEDIUM_BREAKPOINT_PX
      ) {
        this.setState({ collapsedSidebar: true })
      }
    }
  }

  checkMobileOnResize = (): boolean => {
    if (!window) return false

    const { innerWidth } = window

    if (innerWidth <= MEDIUM_BREAKPOINT_PX)
      this.setState({ collapsedSidebar: true })

    return true
  }

  toggleCollapse = (): void => {
    const { collapsedSidebar } = this.state
    const { onChange } = this.props

    this.setState({ collapsedSidebar: !collapsedSidebar }, () => {
      const { collapsedSidebar } = this.state

      onChange(collapsedSidebar)
    })
  }

  public render = (): ReactElement => {
    const { collapsedSidebar } = this.state
    const { children } = this.props

    const sectionClassName = classNames("sidebar", {
      "--collapsed": collapsedSidebar,
    })

    // The tabindex is required to support scrolling by arrow keys.
    return (
      <section className={sectionClassName} ref={this.sidebarRef}>
        <div className="sidebar-content">
          <div className="sidebar-close">
            <Button kind={Kind.ICON} onClick={this.toggleCollapse}>
              <Icon type="x" />
            </Button>
          </div>

          {children}
        </div>
        <div className="sidebar-collapse-control">
          <Button kind={Kind.ICON} onClick={this.toggleCollapse}>
            <Icon type="chevron-right" />
          </Button>
        </div>
      </section>
    )
  }
}

export default Sidebar
