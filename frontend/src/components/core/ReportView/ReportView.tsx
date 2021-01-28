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

import React, { ReactElement } from "react"
import Block from "components/core/Block"
import Sidebar from "components/core/Sidebar"
import { ReportRunState } from "lib/ReportRunState"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { FileUploadClient } from "lib/FileUploadClient"
import { ComponentRegistry } from "components/widgets/CustomComponent"

import ThemeProvider from "components/core/ThemeProvider"
import PageLayoutContext from "components/core/PageLayoutContext"
import { sidebarTheme, sidebarBaseUITheme } from "theme"
import { BlockNode, ReportRoot } from "lib/ReportNode"

import {
  StyledReportViewBlockContainer,
  StyledReportViewContainer,
  StyledReportViewFooter,
  StyledReportViewFooterLink,
  StyledReportViewMain,
} from "./styled-components"

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

  componentRegistry: ComponentRegistry
}

/**
 * Renders a Streamlit report. Reports consist of 0 or more elements.
 */
function ReportView(props: ReportViewProps): ReactElement {
  const {
    elements,
    reportId,
    reportRunState,
    showStaleElementIndicator,
    widgetMgr,
    widgetsDisabled,
    uploadClient,
    componentRegistry,
  } = props

  const { wideMode, initialSidebarState, embedded } = React.useContext(
    PageLayoutContext
  )
  const renderBlock = (node: BlockNode): ReactElement => (
    <StyledReportViewBlockContainer
      className="block-container"
      isWideMode={wideMode}
    >
      <Block
        node={node}
        reportId={reportId}
        reportRunState={reportRunState}
        showStaleElementIndicator={showStaleElementIndicator}
        widgetMgr={widgetMgr}
        widgetsDisabled={widgetsDisabled}
        uploadClient={uploadClient}
        componentRegistry={componentRegistry}
      />
    </StyledReportViewBlockContainer>
  )

  const layout = wideMode ? "wide" : "narrow"
  // The tabindex is required to support scrolling by arrow keys.
  return (
    <StyledReportViewContainer
      className="reportview-container"
      data-testid="stReportViewContainer"
      data-layout={layout}
    >
      {!elements.sidebar.isEmpty && (
        <Sidebar initialSidebarState={initialSidebarState}>
          <ThemeProvider theme={sidebarTheme} baseuiTheme={sidebarBaseUITheme}>
            {renderBlock(elements.sidebar)}
          </ThemeProvider>
        </Sidebar>
      )}
      <StyledReportViewMain
        tabIndex={0}
        isEmbedded={embedded}
        className="main"
      >
        {renderBlock(elements.main)}
        <StyledReportViewFooter isEmbedded={embedded}>
          Made with{" "}
          <StyledReportViewFooterLink href="//streamlit.io">
            Streamlit
          </StyledReportViewFooterLink>
        </StyledReportViewFooter>
      </StyledReportViewMain>
    </StyledReportViewContainer>
  )
}

export default ReportView
