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

import React, { useState, useCallback, useEffect } from "react"
import { Link, withRouter } from "react-router-dom"
import { useStreamlitAppUrl, useStreamlitAppCommands } from "@streamlit/lib"
import { Dropdown } from "react-bootstrap"
import { Trans } from "react-i18next"

function Sidebar({ location }) {
  const [state, setState] = useState({})
  const { appPages } = useStreamlitAppUrl()
  const { changePage } = useStreamlitAppCommands()

  const toggleMenuState = useCallback(
    menuState => {
      if (state[menuState]) {
        setState({ [menuState]: false })
      } else if (Object.keys(state).length === 0) {
        setState({ [menuState]: true })
      } else {
        Object.keys(state).forEach(i => {
          setState({ [i]: false })
        })
        setState({ [menuState]: true })
      }
    },
    [state]
  )

  const isPathActive = useCallback(
    path => {
      return location.pathname.startsWith(path)
    },
    [location]
  )

  const onRouteChanged = useCallback(() => {
    document.querySelector("#sidebar").classList.remove("active")
    Object.keys(state).forEach(i => {
      setState({ [i]: false })
    })

    const dropdownPaths = [
      { path: "/apps", state: "appsMenuOpen" },
      { path: "/basic-ui", state: "basicUiMenuOpen" },
      { path: "/form-elements", state: "formElementsMenuOpen" },
      { path: "/tables", state: "tablesMenuOpen" },
      { path: "/icons", state: "iconsMenuOpen" },
      { path: "/charts", state: "chartsMenuOpen" },
      { path: "/user-pages", state: "userPagesMenuOpen" },
      { path: "/error-pages", state: "errorPagesMenuOpen" },
    ]

    dropdownPaths.forEach(obj => {
      if (isPathActive(obj.path)) {
        setState({ [obj.state]: true })
      }
    })
  }, [state, isPathActive])

  useEffect(() => {
    onRouteChanged()
  }, [location, onRouteChanged])

  useEffect(() => {
    // add className 'hover-open' to sidebar navitem while hover in sidebar-icon-only menu
    const body = document.querySelector("body")
    document.querySelectorAll(".sidebar .nav-item").forEach(el => {
      el.addEventListener("mouseover", function () {
        if (body.classList.contains("sidebar-icon-only")) {
          el.classList.add("hover-open")
        }
      })
      el.addEventListener("mouseout", function () {
        if (body.classList.contains("sidebar-icon-only")) {
          el.classList.remove("hover-open")
        }
      })
    })
  })

  return (
    <nav className="sidebar sidebar-offcanvas" id="sidebar">
      <div className="text-center sidebar-brand-wrapper d-flex align-items-center">
        <a className="sidebar-brand brand-logo" href="index.html">
          <img src={require("../../assets/images/logo.svg")} alt="logo" />
        </a>
        <a className="sidebar-brand brand-logo-mini pt-3" href="index.html">
          <img src={require("../../assets/images/logo-mini.svg")} alt="logo" />
        </a>
      </div>
      <ul className="nav">
        <li className="nav-item nav-profile not-navigation-link">
          <div className="nav-link">
            <Dropdown>
              <Dropdown.Toggle className="nav-link user-switch-dropdown-toggler p-0 toggle-arrow-hide bg-transparent border-0 w-100">
                <div className="d-flex justify-content-between align-items-start">
                  <div className="profile-image">
                    <img
                      className="img-xs rounded-circle"
                      src={require("../../assets/images/faces/face8.jpg")}
                      alt="profile"
                    />
                    <div className="dot-indicator bg-success"></div>
                  </div>
                  <div className="text-wrapper">
                    <p className="profile-name">Allen Moreno</p>
                    <p className="designation">Premium user</p>
                  </div>
                </div>
              </Dropdown.Toggle>
              <Dropdown.Menu className="preview-list navbar-dropdown">
                <Dropdown.Item
                  className="dropdown-item p-0 preview-item d-flex align-items-center"
                  href="!#"
                  onClick={evt => evt.preventDefault()}
                >
                  <div className="d-flex">
                    <div className="py-3 px-4 d-flex align-items-center justify-content-center">
                      <i className="mdi mdi-bookmark-plus-outline mr-0"></i>
                    </div>
                    <div className="py-3 px-4 d-flex align-items-center justify-content-center border-left border-right">
                      <i className="mdi mdi-account-outline mr-0"></i>
                    </div>
                    <div className="py-3 px-4 d-flex align-items-center justify-content-center">
                      <i className="mdi mdi-alarm-check mr-0"></i>
                    </div>
                  </div>
                </Dropdown.Item>
                <Dropdown.Item
                  className="dropdown-item preview-item d-flex align-items-center text-small"
                  onClick={evt => evt.preventDefault()}
                >
                  <Trans>Manage Accounts</Trans>
                </Dropdown.Item>
                <Dropdown.Item
                  className="dropdown-item preview-item d-flex align-items-center text-small"
                  onClick={evt => evt.preventDefault()}
                >
                  <Trans>Change Password</Trans>
                </Dropdown.Item>
                <Dropdown.Item
                  className="dropdown-item preview-item d-flex align-items-center text-small"
                  onClick={evt => evt.preventDefault()}
                >
                  <Trans>Check Inbox</Trans>
                </Dropdown.Item>
                <Dropdown.Item
                  className="dropdown-item preview-item d-flex align-items-center text-small"
                  onClick={evt => evt.preventDefault()}
                >
                  <Trans>Sign Out</Trans>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </li>
        {appPages.map((page, index) => {
          return (
            <li
              key={page.pageScriptHash}
              className={
                isPathActive(`/${page.pageName}`)
                  ? "nav-item active"
                  : "nav-item"
              }
            >
              <Link
                className="nav-link"
                to={`/${page.pageName}`}
                onClick={() => {
                  changePage(page.pageScriptHash)
                }}
              >
                <i className="mdi mdi-television menu-icon"></i>
                <span className="menu-title">
                  <Trans>{page.pageName.replace(/_/g, " ")}</Trans>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default withRouter(Sidebar)
