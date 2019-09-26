/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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

import Icon from "../Icon"

import "./Sidebar.scss"

interface Props {
  children?: ReactElement
  onChange: Function
}

interface State {
  collapsedSidebar: boolean
}

const MOBILE_BREAKPOINT = 746

class Sidebar extends PureComponent<Props, State> {
  public static defaultProps: Partial<Props> = {
    onChange: () => {},
  }

  constructor(props: Props) {
    super(props)

    const { innerWidth } = window || {}

    this.state = {
      collapsedSidebar: innerWidth ? innerWidth <= MOBILE_BREAKPOINT : false,
    }
  }

  componentDidMount() {
    window.addEventListener("resize", this.checkMobileOnResize)
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.checkMobileOnResize)
  }

  checkMobileOnResize = () => {
    if (!window) return false

    const { innerWidth } = window

    if (innerWidth <= MOBILE_BREAKPOINT)
      this.setState({ collapsedSidebar: true })
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

    return (
      <section className={sectionClassName}>
        <div className="sidebar-content">
          <span onClick={this.toggleCollapse} className="sidebar-close">
            <Icon type="x" />
          </span>

          {children}
        </div>
        <span
          className="sidebar-collapse-control"
          onClick={this.toggleCollapse}
        >
          <Icon type="account-login" />
        </span>
      </section>
    )
  }
}

export default Sidebar
