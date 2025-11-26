/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React, { memo, PropsWithChildren, useMemo } from "react"

import {
  DownloadContext,
  DownloadContextProps,
  FormsContext,
  FormsContextProps,
  FormsData,
  LibConfigContext,
  LibConfigContextProps,
  NavigationContext,
  NavigationContextProps,
  ScriptRunContext,
  ScriptRunContextProps,
  ScriptRunState,
  SidebarConfigContext,
  SidebarConfigContextProps,
  ThemeConfig,
  ThemeContext,
  ThemeContextProps,
  ViewStateContext,
  ViewStateContextProps,
} from "@streamlit/lib"
import {
  DeferredFileResponse,
  IAppPage,
  Logo,
  PageConfig,
} from "@streamlit/protobuf"

type ViewStateContextValues = {
  isFullScreen: boolean
  setFullScreen: (value: boolean) => void
}

type LibConfigContextValues = {
  locale: typeof window.navigator.language
  // Selected libConfig properties
  mapboxToken?: string
  enforceDownloadInNewTab?: boolean
  resourceCrossOriginMode?: undefined | "anonymous" | "use-credentials"
}

type NavigationContextValues = {
  pageLinkBaseUrl: string
  currentPageScriptHash: string
  onPageChange: (pageScriptHash: string) => void
  navSections: string[]
  appPages: IAppPage[]
}

type SidebarConfigContextValues = {
  initialSidebarState: PageConfig.SidebarState
  appLogo: Logo | null
  sidebarChevronDownshift: number
  expandSidebarNav: boolean
  hideSidebarNav: boolean
}

type ThemeContextValues = {
  activeTheme: ThemeConfig
  setTheme: (theme: ThemeConfig) => void
  availableThemes: ThemeConfig[]
}

type ScriptRunContextValues = {
  scriptRunState: ScriptRunState
  scriptRunId: string
  fragmentIdsThisRun: Array<string>
}

type FormsContextValues = {
  formsData: FormsData
}

type DownloadContextValues = {
  requestDeferredFile?: (fileId: string) => Promise<DeferredFileResponse>
}

export type StreamlitContextProviderProps = PropsWithChildren<
  ViewStateContextValues &
    LibConfigContextValues &
    NavigationContextValues &
    SidebarConfigContextValues &
    ThemeContextValues &
    ScriptRunContextValues &
    FormsContextValues &
    DownloadContextValues
>

/**
 * Provider component for all contexts within the Streamlit App.
 * This centralizes the context values in one place.
 */
const StreamlitContextProvider: React.FC<StreamlitContextProviderProps> = ({
  // ViewStateContext
  isFullScreen,
  setFullScreen,
  // LibConfigContext
  locale,
  mapboxToken,
  enforceDownloadInNewTab,
  resourceCrossOriginMode,
  // NavigationContext
  pageLinkBaseUrl,
  currentPageScriptHash,
  onPageChange,
  navSections,
  appPages,
  // SidebarConfigContext
  initialSidebarState,
  appLogo,
  sidebarChevronDownshift,
  expandSidebarNav,
  hideSidebarNav,
  // ThemeContext
  activeTheme,
  setTheme,
  availableThemes,
  // ScriptRunContext
  scriptRunState,
  scriptRunId,
  fragmentIdsThisRun,
  // FormsContext
  formsData,
  // DownloadContext
  requestDeferredFile,
  // Children passed through
  children,
}: StreamlitContextProviderProps) => {
  // Memoized object for LibConfigContext values
  const libConfigContextProps = useMemo<LibConfigContextProps>(
    () => ({
      locale,
      mapboxToken,
      enforceDownloadInNewTab,
      resourceCrossOriginMode,
    }),
    [locale, mapboxToken, enforceDownloadInNewTab, resourceCrossOriginMode]
  )

  // Memoized object for SidebarConfigContext values
  const sidebarConfigContextProps = useMemo<SidebarConfigContextProps>(
    () => ({
      initialSidebarState,
      appLogo,
      sidebarChevronDownshift,
      expandSidebarNav,
      hideSidebarNav,
    }),
    [
      initialSidebarState,
      appLogo,
      sidebarChevronDownshift,
      expandSidebarNav,
      hideSidebarNav,
    ]
  )

  // Memoized object for ThemeContext values
  const themeContextProps = useMemo<ThemeContextProps>(
    () => ({
      activeTheme,
      setTheme,
      availableThemes,
    }),
    [activeTheme, setTheme, availableThemes]
  )

  // Memoized object for NavigationContext values
  const navigationContextProps = useMemo<NavigationContextProps>(
    () => ({
      pageLinkBaseUrl,
      currentPageScriptHash,
      onPageChange,
      navSections,
      appPages,
    }),
    [
      pageLinkBaseUrl,
      currentPageScriptHash,
      onPageChange,
      navSections,
      appPages,
    ]
  )

  // Memoized object for ViewStateContext values
  const viewStateContextProps = useMemo<ViewStateContextProps>(
    () => ({
      isFullScreen,
      setFullScreen,
    }),
    [isFullScreen, setFullScreen]
  )

  // Memoized object for ScriptRunContext values
  const scriptRunContextProps = useMemo<ScriptRunContextProps>(
    () => ({
      scriptRunState,
      scriptRunId,
      fragmentIdsThisRun,
    }),
    [scriptRunState, scriptRunId, fragmentIdsThisRun]
  )

  const formsContextProps: FormsContextProps = {
    formsData,
  }

  const downloadContextProps: DownloadContextProps =
    useMemo<DownloadContextProps>(
      () => ({
        requestDeferredFile,
      }),
      [requestDeferredFile]
    )

  /**
   * Providers conceptually grouped by stability (most to least) as follows:
   * Layer 1: App-level static configuration providers:
   *   LibConfigContext & SidebarConfigContext
   * Layer 2: User theme preference provider:
   *   ThemeContext
   * Layer 3: App interaction providers:
   *   NavigationContext, ViewStateContext, ScriptRunContext, FormsContext
   */
  return (
    <LibConfigContext.Provider value={libConfigContextProps}>
      <SidebarConfigContext.Provider value={sidebarConfigContextProps}>
        <ThemeContext.Provider value={themeContextProps}>
          <NavigationContext.Provider value={navigationContextProps}>
            <DownloadContext.Provider value={downloadContextProps}>
              <ViewStateContext.Provider value={viewStateContextProps}>
                <ScriptRunContext.Provider value={scriptRunContextProps}>
                  <FormsContext.Provider value={formsContextProps}>
                    {children}
                  </FormsContext.Provider>
                </ScriptRunContext.Provider>
              </ViewStateContext.Provider>
            </DownloadContext.Provider>
          </NavigationContext.Provider>
        </ThemeContext.Provider>
      </SidebarConfigContext.Provider>
    </LibConfigContext.Provider>
  )
}

export default memo(StreamlitContextProvider)
