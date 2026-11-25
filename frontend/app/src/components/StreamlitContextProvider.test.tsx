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

import { type ComponentProps, useContext } from "react"

import { render, screen } from "@testing-library/react"

import {
  createFormsData,
  LibConfigContext,
  lightTheme,
  RenderTimingContext,
  RenderTimingTracker,
  ScriptRunState,
} from "@streamlit/lib"
import { Config, PageConfig } from "@streamlit/protobuf"

import StreamlitContextProvider from "./StreamlitContextProvider"

const getProps = (): ComponentProps<typeof StreamlitContextProvider> => ({
  isFullScreen: false,
  setFullScreen: vi.fn(),
  locale: "en-US",
  mapboxToken: undefined,
  enforceDownloadInNewTab: undefined,
  resourceCrossOriginMode: undefined,
  showErrorLinks: Config.ShowErrorLinks.SHOW_ERROR_LINKS_AUTO,
  disableDataExport: false,
  pageLinkBaseUrl: "",
  currentPageScriptHash: "",
  onPageChange: vi.fn(),
  navSections: [],
  appPages: [],
  initialSidebarState: PageConfig.SidebarState.AUTO,
  appLogo: null,
  sidebarChevronDownshift: 0,
  expandSidebarNav: false,
  hideSidebarNav: false,
  activeTheme: lightTheme,
  setTheme: vi.fn(),
  availableThemes: [],
  stopScript: vi.fn(),
  scriptRunState: ScriptRunState.NOT_RUNNING,
  scriptRunId: "script-run-id",
  fragmentIdsThisRun: [],
  scriptRunFinishedSequence: 0,
  scriptRunFinishedFragmentIds: [],
  formsData: createFormsData(),
})

const ContextConsumer = (): React.ReactElement => {
  const { disableDataExport } = useContext(LibConfigContext)

  return (
    <span data-testid="disable-data-export">{String(disableDataExport)}</span>
  )
}

describe("StreamlitContextProvider", () => {
  it("forwards disableDataExport to LibConfigContext", () => {
    render(
      <StreamlitContextProvider {...getProps()} disableDataExport={true}>
        <ContextConsumer />
      </StreamlitContextProvider>
    )

    expect(screen.getByTestId("disable-data-export")).toHaveTextContent("true")
  })

  it("provides the render timing tracker, or null without one", () => {
    const tracker = new RenderTimingTracker({ onReport: vi.fn() })
    const TrackerConsumer = (): React.ReactElement => {
      const provided = useContext(RenderTimingContext)
      return (
        <span data-testid="tracker">
          {provided === null ? "none" : String(provided === tracker)}
        </span>
      )
    }

    const { rerender } = render(
      <StreamlitContextProvider {...getProps()}>
        <TrackerConsumer />
      </StreamlitContextProvider>
    )
    expect(screen.getByTestId("tracker")).toHaveTextContent("none")

    rerender(
      <StreamlitContextProvider {...getProps()} renderTimingTracker={tracker}>
        <TrackerConsumer />
      </StreamlitContextProvider>
    )
    expect(screen.getByTestId("tracker")).toHaveTextContent("true")
    tracker.dispose()
  })
})
