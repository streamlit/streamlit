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

import React, { PureComponent, ReactNode } from "react"
import classNames from "classnames"

import Block from "components/core/Block/"
import Sidebar from "components/core/Sidebar"
import { ReportRunState } from "lib/ReportRunState"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { FileUploadClient } from "lib/FileUploadClient"

import { ThemeProvider } from "baseui"
import { BlockElement } from "lib/DeltaParser"
import { mainWidgetTheme, sidebarWidgetTheme } from "lib/widgetTheme"

import "./ReportView.scss"
import "./Widget.scss"

interface Elements {
  main: BlockElement
  sidebar: BlockElement
}

interface Props {
  elements: Elements

  // The unique ID for the most recent run of the report.
  reportId: string

  reportRunState: ReportRunState

  /**
   * If true, "stale" elements (that is, elements that were created during a previous
   * run of a currently-running report) will be faded out.
   *
   * (When we're viewing a shared report, this is set to false.)
   */
  showStaleElementIndicator: boolean

  widgetMgr: WidgetStateManager

  uploadClient: FileUploadClient

  // Disable the widgets when not connected to the server.
  widgetsDisabled: boolean

  // Wide mode
  wide: boolean
}

/**
 * Renders a Streamlit report. Reports consist of 0 or more elements.
 */
class ReportView extends PureComponent<Props> {
  private hasSidebar = (): boolean => !this.props.elements.sidebar.isEmpty()

  public render = (): ReactNode => {
    const { wide } = this.props

    const reportViewClassName = classNames("reportview-container", {
      "--wide": wide,
    })

    // The tabindex is required to support scrolling by arrow keys.
    return (
      <div className={reportViewClassName}>
        {this.hasSidebar() && (
          <Sidebar>
            <div className="block-container">
              <ThemeProvider theme={sidebarWidgetTheme}>
                <Block
                  elements={this.props.elements.sidebar}
                  reportId={this.props.reportId}
                  reportRunState={this.props.reportRunState}
                  showStaleElementIndicator={
                    this.props.showStaleElementIndicator
                  }
                  widgetMgr={this.props.widgetMgr}
                  widgetsDisabled={this.props.widgetsDisabled}
                  uploadClient={this.props.uploadClient}
                />
              </ThemeProvider>
            </div>
          </Sidebar>
        )}
        <section className="main" tabIndex={0}>
          <div className="block-container">
            <ThemeProvider theme={mainWidgetTheme}>
              <Block
                elements={this.props.elements.main}
                reportId={this.props.reportId}
                reportRunState={this.props.reportRunState}
                showStaleElementIndicator={
                  this.props.showStaleElementIndicator
                }
                widgetMgr={this.props.widgetMgr}
                widgetsDisabled={this.props.widgetsDisabled}
                uploadClient={this.props.uploadClient}
              />
            </ThemeProvider>
          </div>

          <footer>
            Made with <a href="//streamlit.io">Streamlit</a>
          </footer>
        </section>
      </div>
    )
  }
}

export default ReportView
