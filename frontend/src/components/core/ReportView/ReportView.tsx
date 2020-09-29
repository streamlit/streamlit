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

import { PageConfig } from "autogen/proto"

import { ThemeProvider } from "baseui"
import { Theme } from "baseui/theme"
import classNames from "classnames"

import Block from "components/core/Block/"
import Sidebar from "components/core/Sidebar"
import { ComponentRegistry } from "components/widgets/CustomComponent"
import { FileUploadClient } from "lib/FileUploadClient"
import { ReportRunState } from "lib/ReportRunState"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { mainWidgetTheme, sidebarWidgetTheme } from "lib/widgetTheme"
import React, { ReactElement } from "react"
import { BlockNode, ReportRoot } from "lib/ReportNode"

import "./ReportView.scss"
import "./Widget.scss"

export interface ReportViewProps {
  elements: ReportRoot

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

  // Whether the sidebar should start expanded
  initialSidebarState: PageConfig.SidebarState

  componentRegistry: ComponentRegistry
}

/**
 * Renders a Streamlit report. Reports consist of 0 or more elements.
 */
function ReportView(props: ReportViewProps): ReactElement {
  const {
    wide,
    elements,
    initialSidebarState,
    reportId,
    reportRunState,
    showStaleElementIndicator,
    widgetMgr,
    widgetsDisabled,
    uploadClient,
    componentRegistry,
  } = props

  const renderBlock = (theme: Theme, node: BlockNode): ReactElement => (
    <div className="block-container">
      <ThemeProvider theme={theme}>
        <Block
          elements={node}
          reportId={reportId}
          reportRunState={reportRunState}
          showStaleElementIndicator={showStaleElementIndicator}
          widgetMgr={widgetMgr}
          widgetsDisabled={widgetsDisabled}
          uploadClient={uploadClient}
          componentRegistry={componentRegistry}
        />
      </ThemeProvider>
    </div>
  )

  const reportViewClassName = classNames("reportview-container", {
    "--wide": wide,
  })

  // The tabindex is required to support scrolling by arrow keys.
  return (
    <div className={reportViewClassName}>
      {!elements.sidebar.isEmpty && (
        <Sidebar initialSidebarState={initialSidebarState}>
          {renderBlock(sidebarWidgetTheme, elements.sidebar)}
        </Sidebar>
      )}
      <section className="main" tabIndex={0}>
        {renderBlock(mainWidgetTheme, elements.main)}
        <footer>
          Made with <a href="//streamlit.io">Streamlit</a>
        </footer>
      </section>
    </div>
  )
}

export default ReportView
