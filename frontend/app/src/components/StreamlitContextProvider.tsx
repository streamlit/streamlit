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
  AppContext,
  AppContextProps,
} from "@streamlit/app/src/components/AppContext"
import {
  ComponentRegistry,
  FormsContext,
  FormsContextProps,
  FormsData,
  LibConfig,
  LibContext,
  LibContextProps,
  ScriptRunContext,
  ScriptRunContextProps,
  ScriptRunState,
  ThemeConfig,
  ThemeContext,
  ThemeContextProps,
  useRequiredContext,
} from "@streamlit/lib"
import { IAppPage, IGitInfo, Logo, PageConfig } from "@streamlit/protobuf"

// Type for AppContext props
type AppContextValues = {
  initialSidebarState: PageConfig.SidebarState
  pageLinkBaseUrl: string
  currentPageScriptHash: string
  onPageChange: (pageScriptHash: string) => void
  navSections: string[]
  appPages: IAppPage[]
  appLogo: Logo | null
  sidebarChevronDownshift: number
  expandSidebarNav: boolean
  hideSidebarNav: boolean
  widgetsDisabled: boolean
  gitInfo: IGitInfo | null
  showToolbar: boolean
}

// Type for LibContext props
type LibContextValues = {
  isFullScreen: boolean
  setFullScreen: (value: boolean) => void
  onPageChange: (pageScriptHash: string) => void
  currentPageScriptHash: string
  libConfig: LibConfig
  locale: typeof window.navigator.language
  componentRegistry: ComponentRegistry
}

// Type for ThemeContext props
type ThemeContextValues = {
  activeTheme: ThemeConfig
  setTheme: (theme: ThemeConfig) => void
  availableThemes: ThemeConfig[]
}

// Type for ScriptRunContext props
type ScriptRunContextValues = {
  scriptRunState: ScriptRunState
  scriptRunId: string
  fragmentIdsThisRun: Array<string>
}

type FormsContextValues = {
  formsData: FormsData
}

export type StreamlitContextProviderProps = PropsWithChildren<
  AppContextValues &
    LibContextValues &
    ThemeContextValues &
    ScriptRunContextValues &
    FormsContextValues
>

/**
 * Provider component for all contexts within the Streamlit App.
 * This centralizes the context values in one place.
 */
const StreamlitContextProvider: React.FC<StreamlitContextProviderProps> = ({
  // AppContext
  initialSidebarState,
  pageLinkBaseUrl,
  navSections,
  appPages,
  appLogo,
  sidebarChevronDownshift,
  expandSidebarNav,
  hideSidebarNav,
  widgetsDisabled,
  gitInfo,
  showToolbar,
  // LibContext
  isFullScreen,
  setFullScreen,
  libConfig,
  locale,
  componentRegistry,
  // ThemeContext
  activeTheme,
  setTheme,
  availableThemes,
  // ScriptRunContext
  scriptRunState,
  scriptRunId,
  fragmentIdsThisRun,
  // Used in both AppContext and LibContext
  currentPageScriptHash,
  onPageChange,
  // FormsContext
  formsData,
  // Children passed through
  children,
}: StreamlitContextProviderProps) => {
  // Memoized object for AppContext values
  const appContextProps = useMemo<AppContextProps>(
    () => ({
      initialSidebarState,
      pageLinkBaseUrl,
      currentPageScriptHash,
      onPageChange,
      navSections,
      appPages,
      appLogo,
      sidebarChevronDownshift,
      expandSidebarNav,
      hideSidebarNav,
      widgetsDisabled,
      gitInfo,
      showToolbar,
    }),
    [
      initialSidebarState,
      pageLinkBaseUrl,
      currentPageScriptHash,
      onPageChange,
      navSections,
      appPages,
      appLogo,
      sidebarChevronDownshift,
      expandSidebarNav,
      hideSidebarNav,
      widgetsDisabled,
      gitInfo,
      showToolbar,
    ]
  )

  // Memoized object for LibContext values
  const libContextProps = useMemo<LibContextProps>(
    () => ({
      isFullScreen,
      setFullScreen,
      onPageChange,
      currentPageScriptHash,
      libConfig,
      locale,
      componentRegistry,
    }),
    [
      isFullScreen,
      setFullScreen,
      onPageChange,
      currentPageScriptHash,
      libConfig,
      locale,
      componentRegistry,
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

  // Memoized object for ScriptRunContext values
  const scriptRunContextProps = useMemo<ScriptRunContextProps>(
    () => ({
      scriptRunState,
      scriptRunId,
      fragmentIdsThisRun,
    }),
    [scriptRunState, scriptRunId, fragmentIdsThisRun]
  )

  // formsData is not a stable reference, so memoization does not help
  // eslint-disable-next-line @eslint-react/no-unstable-context-value
  const formsContextProps: FormsContextProps = {
    formsData,
  }

  return (
    <AppContext.Provider value={appContextProps}>
      <LibContext.Provider value={libContextProps}>
        <ThemeContext.Provider value={themeContextProps}>
          <FormsContext.Provider value={formsContextProps}>
            <ScriptRunContext.Provider value={scriptRunContextProps}>
              {children}
            </ScriptRunContext.Provider>
          </FormsContext.Provider>
        </ThemeContext.Provider>
      </LibContext.Provider>
    </AppContext.Provider>
  )
}

/**
 * Custom hook to access AppContext values in components.
 * Throws an error if used outside of an AppContext.Provider.
 */
export const useAppContext = (): AppContextProps => {
  return useRequiredContext(AppContext)
}

export default memo(StreamlitContextProvider)
