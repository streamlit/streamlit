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
  useRequiredContext,
} from "@streamlit/lib"
import { IAppPage, IGitInfo, Logo, PageConfig } from "@streamlit/protobuf"

// Type for AppContext props
type AppContextValues = {
  widgetsDisabled: boolean
  gitInfo: IGitInfo | null
  showToolbar: boolean
}

// Type for LibContext props
type LibContextValues = {
  isFullScreen: boolean
  setFullScreen: (value: boolean) => void
  libConfig: LibConfig
  locale: typeof window.navigator.language
  componentRegistry: ComponentRegistry
}

// Type for NavigationContext props
type NavigationContextValues = {
  pageLinkBaseUrl: string
  currentPageScriptHash: string
  onPageChange: (pageScriptHash: string) => void
  navSections: string[]
  appPages: IAppPage[]
}

// Type for SidebarConfigContext props
type SidebarConfigContextValues = {
  initialSidebarState: PageConfig.SidebarState
  appLogo: Logo | null
  sidebarChevronDownshift: number
  expandSidebarNav: boolean
  hideSidebarNav: boolean
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
    NavigationContextValues &
    SidebarConfigContextValues &
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
  widgetsDisabled,
  gitInfo,
  showToolbar,
  // LibContext
  isFullScreen,
  setFullScreen,
  libConfig,
  locale,
  componentRegistry,
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
  // Children passed through
  children,
}: StreamlitContextProviderProps) => {
  // Memoized object for AppContext values
  const appContextProps = useMemo<AppContextProps>(
    () => ({
      widgetsDisabled,
      gitInfo,
      showToolbar,
    }),
    [widgetsDisabled, gitInfo, showToolbar]
  )

  // Memoized object for LibContext values
  const libContextProps = useMemo<LibContextProps>(
    () => ({
      isFullScreen,
      setFullScreen,
      libConfig,
      locale,
      componentRegistry,
    }),
    [isFullScreen, setFullScreen, libConfig, locale, componentRegistry]
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
        <SidebarConfigContext.Provider value={sidebarConfigContextProps}>
          <ThemeContext.Provider value={themeContextProps}>
            <NavigationContext.Provider value={navigationContextProps}>
              <FormsContext.Provider value={formsContextProps}>
                <ScriptRunContext.Provider value={scriptRunContextProps}>
                  {children}
                </ScriptRunContext.Provider>
              </FormsContext.Provider>
            </NavigationContext.Provider>
          </ThemeContext.Provider>
        </SidebarConfigContext.Provider>
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
