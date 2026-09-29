/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { useContext } from "react"

import { render, screen } from "@testing-library/react"

import {
  createFormsData,
  LibConfigContext,
  lightTheme,
  ScriptRunState,
} from "@streamlit/lib"
import { Config, PageConfig } from "@streamlit/protobuf"

import StreamlitContextProvider from "./StreamlitContextProvider"

const ContextConsumer = (): React.ReactElement => {
  const { disableDataExport } = useContext(LibConfigContext)

  return (
    <span data-testid="disable-data-export">{String(disableDataExport)}</span>
  )
}

describe("StreamlitContextProvider", () => {
  it("forwards disableDataExport to LibConfigContext", () => {
    render(
      <StreamlitContextProvider
        isFullScreen={false}
        setFullScreen={vi.fn()}
        locale="en-US"
        mapboxToken={undefined}
        enforceDownloadInNewTab={undefined}
        resourceCrossOriginMode={undefined}
        showErrorLinks={Config.ShowErrorLinks.SHOW_ERROR_LINKS_AUTO}
        disableDataExport={true}
        pageLinkBaseUrl=""
        currentPageScriptHash=""
        onPageChange={vi.fn()}
        navSections={[]}
        appPages={[]}
        initialSidebarState={PageConfig.SidebarState.AUTO}
        appLogo={null}
        sidebarChevronDownshift={0}
        expandSidebarNav={false}
        hideSidebarNav={false}
        activeTheme={lightTheme}
        setTheme={vi.fn()}
        availableThemes={[]}
        stopScript={vi.fn()}
        scriptRunState={ScriptRunState.NOT_RUNNING}
        scriptRunId="script-run-id"
        fragmentIdsThisRun={[]}
        scriptRunFinishedSequence={0}
        scriptRunFinishedFragmentIds={[]}
        formsData={createFormsData()}
      >
        <ContextConsumer />
      </StreamlitContextProvider>
    )

    expect(screen.getByTestId("disable-data-export")).toHaveTextContent("true")
  })
})
