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

import React, { Component } from "react"
import { withRouter } from "react-router-dom"
import "./App.scss"
import AppRoutes from "./AppRoutes"
import Navbar from "./shared/Navbar"
import Sidebar from "./shared/Sidebar"
import SettingsPanel from "./shared/SettingsPanel"
import Footer from "./shared/Footer"
import { withTranslation } from "react-i18next"
import { StreamlitApp } from "@streamlit/lib"

class App extends Component {
  state = {}
  componentDidMount() {
    this.onRouteChanged()
  }
  render() {
    let navbarComponent = !this.state.isFullPageLayout ? <Navbar /> : ""
    let sidebarComponent = !this.state.isFullPageLayout ? <Sidebar /> : ""
    let SettingsPanelComponent = !this.state.isFullPageLayout ? (
      <SettingsPanel />
    ) : (
      ""
    )
    let footerComponent = !this.state.isFullPageLayout ? <Footer /> : ""
    return (
      <StreamlitApp endpoint={window.location.href}>
        <div className="container-scroller">
          {navbarComponent}
          <div className="container-fluid page-body-wrapper">
            {sidebarComponent}
            <div className="main-panel">
              <div className="content-wrapper">
                <AppRoutes />
                {SettingsPanelComponent}
              </div>
              {footerComponent}
            </div>
          </div>
        </div>
      </StreamlitApp>
    )
  }

  componentDidUpdate(prevProps) {
    if (this.props.location !== prevProps.location) {
      this.onRouteChanged()
    }
  }

  onRouteChanged() {
    console.log("ROUTE CHANGED")
    const { i18n } = this.props
    const body = document.querySelector("body")
    if (this.props.location.pathname === "/layout/RtlLayout") {
      body.classList.add("rtl")
      i18n.changeLanguage("ar")
    } else {
      body.classList.remove("rtl")
      i18n.changeLanguage("en")
    }
    window.scrollTo(0, 0)
    const fullPageLayoutRoutes = [
      "/user-pages/login-1",
      "/user-pages/login-2",
      "/user-pages/register-1",
      "/user-pages/register-2",
      "/user-pages/lockscreen",
      "/error-pages/error-404",
      "/error-pages/error-500",
      "/general-pages/landing-page",
    ]
    for (let i = 0; i < fullPageLayoutRoutes.length; i++) {
      if (this.props.location.pathname === fullPageLayoutRoutes[i]) {
        this.setState({
          isFullPageLayout: true,
        })
        document
          .querySelector(".page-body-wrapper")
          .classList.add("full-page-wrapper")
        break
      } else {
        this.setState({
          isFullPageLayout: false,
        })
        document
          .querySelector(".page-body-wrapper")
          .classList.remove("full-page-wrapper")
      }
    }
  }
}

export default withTranslation()(withRouter(App))
