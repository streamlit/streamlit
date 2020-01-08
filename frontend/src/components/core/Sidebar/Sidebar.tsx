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
import { Button } from "reactstrap"

import "./Sidebar.scss"

interface Props {
  children?: ReactElement
  onChange: Function
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

    const { innerWidth } = window || {}

    this.state = {
      collapsedSidebar: innerWidth
        ? innerWidth <= MEDIUM_BREAKPOINT_PX
        : false,
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
          <Button
            outline
            onClick={this.toggleCollapse}
            className="sidebar-close"
          >
            <Icon type="x" />
          </Button>

          {children}
        </div>
        <Button
          outline
          onClick={this.toggleCollapse}
          className="sidebar-collapse-control"
        >
          <Icon type="chevron-right" />
        </Button>
      </section>
    )
  }
}

export default Sidebar
