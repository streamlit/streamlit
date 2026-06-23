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

import {
  memo,
  PropsWithChildren,
  RefObject,
  useCallback,
  useMemo,
  useRef,
} from "react"

import {
  BackendOperationClient,
  BackendOperationContext,
  BackendOperationContextProps,
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
  SkillsInstallContext,
  SkillsInstallContextProps,
  ThemeConfig,
  ThemeContext,
  ThemeContextProps,
  ViewStateContext,
  ViewStateContextProps,
} from "@streamlit/lib"
import { Config, IAppPage, Logo, PageConfig } from "@streamlit/protobuf"

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
  showErrorLinks?: Config.ShowErrorLinks
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
  initialSidebarWidth?: number
  appLogo: Logo | null
  sidebarChevronDownshift: number
  expandSidebarNav: boolean
  sidebarNavVisibleItems?: number
  hideSidebarNav: boolean
  appRootRef?: RefObject<HTMLDivElement> | null
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

type BackendOperationContextValues = {
  backendOperationClient?: BackendOperationClient
}

type SkillsInstallContextValues = {
  /** Whether the in-error "install skills" callout is allowed to show. */
  skillsInstallEnabled?: boolean
  /** One-click install handler (already tagged with the errorCallout surface). */
  onInstallSkills?: () => Promise<string | undefined>
  /** Impression callback fired once when the callout first appears. */
  onSkillsCalloutShown?: () => void
}

type StreamlitContextProviderProps = PropsWithChildren<
  ViewStateContextValues &
    LibConfigContextValues &
    NavigationContextValues &
    SidebarConfigContextValues &
    ThemeContextValues &
    ScriptRunContextValues &
    FormsContextValues &
    BackendOperationContextValues &
    SkillsInstallContextValues
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
  showErrorLinks,
  // NavigationContext
  pageLinkBaseUrl,
  currentPageScriptHash,
  onPageChange,
  navSections,
  appPages,
  // SidebarConfigContext
  initialSidebarState,
  initialSidebarWidth,
  appLogo,
  sidebarChevronDownshift,
  expandSidebarNav,
  sidebarNavVisibleItems,
  hideSidebarNav,
  appRootRef,
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
  // BackendOperationContext
  backendOperationClient,
  // SkillsInstallContext
  skillsInstallEnabled,
  onInstallSkills,
  onSkillsCalloutShown,
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
      showErrorLinks,
    }),
    [
      locale,
      mapboxToken,
      enforceDownloadInNewTab,
      resourceCrossOriginMode,
      showErrorLinks,
    ]
  )

  // Memoized object for SidebarConfigContext values
  const sidebarConfigContextProps = useMemo<SidebarConfigContextProps>(
    () => ({
      initialSidebarState,
      initialSidebarWidth,
      appLogo,
      sidebarChevronDownshift,
      expandSidebarNav,
      sidebarNavVisibleItems,
      hideSidebarNav,
      appRootRef,
      isSidebarLocked: initialSidebarState === PageConfig.SidebarState.LOCKED,
    }),
    [
      initialSidebarState,
      initialSidebarWidth,
      appLogo,
      sidebarChevronDownshift,
      expandSidebarNav,
      sidebarNavVisibleItems,
      hideSidebarNav,
      appRootRef,
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

  const formsContextProps: FormsContextProps = useMemo(
    () => ({
      formsData,
    }),
    [formsData]
  )

  const backendOperationContextProps: BackendOperationContextProps =
    useMemo<BackendOperationContextProps>(
      () => ({
        backendOperationClient,
      }),
      [backendOperationClient]
    )

  // A single shared slot so at most one in-error "install skills" callout shows
  // app-wide even when several error boxes are on screen. The first eligible
  // ExceptionElement to mount claims it; the ref lives here so the lib-level
  // callout stays stateless. A ref (not state) avoids re-rendering the whole
  // app subtree when the claim changes.
  const skillsCalloutOwnerRef = useRef<symbol | null>(null)
  const claimSkillsCallout = useCallback((token: symbol): boolean => {
    if (
      skillsCalloutOwnerRef.current === null ||
      skillsCalloutOwnerRef.current === token
    ) {
      skillsCalloutOwnerRef.current = token
      return true
    }
    return false
  }, [])
  const releaseSkillsCallout = useCallback((token: symbol): void => {
    if (skillsCalloutOwnerRef.current === token) {
      skillsCalloutOwnerRef.current = null
    }
  }, [])

  const skillsInstallContextProps = useMemo<SkillsInstallContextProps>(
    () => ({
      enabled: skillsInstallEnabled ?? false,
      onInstall: onInstallSkills ?? (() => Promise.resolve(undefined)),
      onShown: onSkillsCalloutShown ?? ((): void => {}),
      claimCallout: claimSkillsCallout,
      releaseCallout: releaseSkillsCallout,
    }),
    [
      skillsInstallEnabled,
      onInstallSkills,
      onSkillsCalloutShown,
      claimSkillsCallout,
      releaseSkillsCallout,
    ]
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
            <BackendOperationContext.Provider
              value={backendOperationContextProps}
            >
              <ViewStateContext.Provider value={viewStateContextProps}>
                <ScriptRunContext.Provider value={scriptRunContextProps}>
                  <FormsContext.Provider value={formsContextProps}>
                    <SkillsInstallContext.Provider
                      value={skillsInstallContextProps}
                    >
                      {children}
                    </SkillsInstallContext.Provider>
                  </FormsContext.Provider>
                </ScriptRunContext.Provider>
              </ViewStateContext.Provider>
            </BackendOperationContext.Provider>
          </NavigationContext.Provider>
        </ThemeContext.Provider>
      </SidebarConfigContext.Provider>
    </LibConfigContext.Provider>
  )
}

export default memo(StreamlitContextProvider)
