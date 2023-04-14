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

import React, { PureComponent, ReactNode } from "react"
import moment from "moment"
import { HotKeys, KeyMap } from "react-hotkeys"
import { enableAllPlugins as enableImmerPlugins } from "immer"
import classNames from "classnames"

// Other local imports.
import { AppContext } from "src/components/core/AppContext"
import AppView from "src/app/components/AppView"
import StatusWidget from "src/app/components/StatusWidget"
import MainMenu, { isLocalhost } from "src/app/components/MainMenu"
import ToolbarActions from "src/app/components/ToolbarActions"
import DeployButton from "src/app/components/DeployButton"
import Header from "src/app/components/Header"
import {
  DialogProps,
  DialogType,
  StreamlitDialog,
} from "src/app/components/StreamlitDialog"
import { ConnectionManager } from "src/app/connection/ConnectionManager"
import { PerformanceEvents } from "src/lib/profiler/PerformanceEvents"
import {
  createFormsData,
  FormsData,
  WidgetStateManager,
} from "src/lib/WidgetStateManager"
import { ConnectionState } from "src/app/connection/ConnectionState"
import { ScriptRunState } from "src/lib/ScriptRunState"
import { SessionEventDispatcher } from "src/app/SessionEventDispatcher"
import {
  getIFrameEnclosingApp,
  hashString,
  isColoredLineDisplayed,
  isDarkTheme,
  isEmbed,
  isTesting,
  isFooterDisplayed,
  isInChildFrame,
  isLightTheme,
  isPaddingDisplayed,
  isScrollingHidden,
  isToolbarDisplayed,
  notUndefined,
  getElementWidgetID,
  generateUID,
  getEmbeddingIdClassName,
  extractPageNameFromPathName,
  setCookie,
} from "src/lib/util/utils"
import { BaseUriParts } from "src/lib/util/UriUtil"
import {
  AppPage,
  BackMsg,
  Config,
  CustomThemeConfig,
  Delta,
  ForwardMsg,
  ForwardMsgMetadata,
  GitInfo,
  IAppPage,
  ICustomThemeConfig,
  IGitInfo,
  Initialize,
  NewSession,
  PageConfig,
  PageInfo,
  PageNotFound,
  PageProfile,
  PagesChanged,
  SessionEvent,
  SessionStatus,
  WidgetStates,
} from "src/autogen/proto"
import { concat, noop, without } from "lodash"

import { RERUN_PROMPT_MODAL_DIALOG } from "src/lib/baseconsts"
import { SessionInfo } from "src/lib/SessionInfo"
import { FileUploadClient } from "src/lib/FileUploadClient"
import { logError, logMessage } from "src/lib/util/log"
import { AppRoot } from "src/lib/AppNode"

import { UserSettings } from "src/app/components/StreamlitDialog/UserSettings"
import { ComponentRegistry } from "src/components/widgets/CustomComponent"
import { handleFavicon } from "src/components/elements/Favicon"

import {
  createAutoTheme,
  createPresetThemes,
  createTheme,
  CUSTOM_THEME_NAME,
  getCachedTheme,
  isPresetTheme,
  ThemeConfig,
  toExportedTheme,
} from "src/theme"
import { DefaultStreamlitEndpoints } from "src/app/connection/DefaultStreamlitEndpoints"
import { SegmentMetricsManager } from "src/app/SegmentMetricsManager"
import { StreamlitEndpoints } from "src/lib/StreamlitEndpoints"

import { StyledApp } from "src/styled-components"

import withHostCommunication, {
  HostCommunicationHOC,
} from "src/hocs/withHostCommunication"

import withScreencast, {
  ScreenCastHOC,
} from "src/app/hocs/withScreencast/withScreencast"

// Used to import fonts + responsive reboot items
import "src/assets/css/theme.scss"
import { ensureError } from "src/lib/util/ErrorHandling"

export interface Props {
  screenCast: ScreenCastHOC
  hostCommunication: HostCommunicationHOC
  theme: {
    activeTheme: ThemeConfig
    availableThemes: ThemeConfig[]
    setTheme: (theme: ThemeConfig) => void
    addThemes: (themes: ThemeConfig[]) => void
    setImportedTheme: (themeInfo: ICustomThemeConfig) => void
  }
}

interface State {
  connectionState: ConnectionState
  elements: AppRoot
  isFullScreen: boolean
  scriptRunId: string
  scriptName: string
  appHash: string | null
  scriptRunState: ScriptRunState
  userSettings: UserSettings
  dialog?: DialogProps | null
  layout: PageConfig.Layout
  initialSidebarState: PageConfig.SidebarState
  menuItems?: PageConfig.IMenuItems | null
  allowRunOnSave: boolean
  scriptFinishedHandlers: (() => void)[]
  developerMode: boolean
  themeHash: string | null
  gitInfo: IGitInfo | null
  formsData: FormsData
  hideTopBar: boolean
  hideSidebarNav: boolean
  appPages: IAppPage[]
  currentPageScriptHash: string
  latestRunTime: number
}

const ELEMENT_LIST_BUFFER_TIMEOUT_MS = 10

// eslint-disable-next-line
declare global {
  interface Window {
    streamlitDebug: any
    iFrameResizer: any
  }
}

export class App extends PureComponent<Props, State> {
  private readonly endpoints: StreamlitEndpoints

  private readonly sessionInfo = new SessionInfo()

  private readonly metricsMgr = new SegmentMetricsManager(this.sessionInfo)

  private readonly sessionEventDispatcher = new SessionEventDispatcher()

  private connectionManager: ConnectionManager | null

  private readonly widgetMgr: WidgetStateManager

  private readonly uploadClient: FileUploadClient

  /**
   * When new Deltas are received, they are applied to `pendingElementsBuffer`
   * rather than directly to `this.state.elements`. We assign
   * `pendingElementsBuffer` to `this.state` on a timer, in order to
   * decouple Delta updates from React re-renders, for performance reasons.
   *
   * (If `pendingElementsBuffer === this.state.elements` - the default state -
   * then we have no pending elements.)
   */
  private pendingElementsBuffer: AppRoot

  private pendingElementsTimerRunning: boolean

  private readonly componentRegistry: ComponentRegistry

  private readonly embeddingId: string = generateUID()

  public constructor(props: Props) {
    super(props)

    // Initialize immerjs
    enableImmerPlugins()

    this.state = {
      connectionState: ConnectionState.INITIAL,
      elements: AppRoot.empty(this.metricsMgr, "Please wait..."),
      isFullScreen: false,
      scriptName: "",
      scriptRunId: "<null>",
      appHash: null,
      scriptRunState: ScriptRunState.NOT_RUNNING,
      userSettings: {
        wideMode: false,
        runOnSave: false,
      },
      layout: PageConfig.Layout.CENTERED,
      initialSidebarState: PageConfig.SidebarState.AUTO,
      menuItems: undefined,
      allowRunOnSave: true,
      scriptFinishedHandlers: [],
      // A hack for now to get theming through. Product to think through how
      // developer mode should be designed in the long term.
      developerMode: window.location.host.includes("localhost"),
      themeHash: null,
      gitInfo: null,
      formsData: createFormsData(),
      appPages: [],
      currentPageScriptHash: "",
      // We set hideTopBar to true by default because this information isn't
      // available on page load (we get it when the script begins to run), so
      // the user would see top bar elements for a few ms if this defaulted to
      // false. hideSidebarNav doesn't have this issue (app pages and the value
      // of the config option are received simultaneously), but we set it to
      // true as well for consistency.
      hideTopBar: true,
      hideSidebarNav: true,
      latestRunTime: performance.now(),
    }

    this.connectionManager = null

    this.widgetMgr = new WidgetStateManager({
      sendRerunBackMsg: this.sendRerunBackMsg,
      formsDataChanged: formsData => this.setState({ formsData }),
    })

    this.endpoints = new DefaultStreamlitEndpoints({
      getServerUri: this.getBaseUriParts,
      csrfEnabled: true,
    })

    this.uploadClient = new FileUploadClient({
      sessionInfo: this.sessionInfo,
      endpoints: this.endpoints,
      // A form cannot be submitted if it contains a FileUploader widget
      // that's currently uploading. We write that state here, in response
      // to a FileUploadClient callback. The FormSubmitButton element
      // reads the state.
      formsWithPendingRequestsChanged: formIds =>
        this.widgetMgr.setFormsWithUploads(formIds),
    })

    this.componentRegistry = new ComponentRegistry(this.endpoints)

    this.pendingElementsTimerRunning = false
    this.pendingElementsBuffer = this.state.elements

    window.streamlitDebug = {
      clearForwardMsgCache: this.debugClearForwardMsgCache,
      disconnectWebsocket: this.debugDisconnectWebsocket,
      shutdownRuntime: this.debugShutdownRuntime,
    }
  }

  /**
   * Global keyboard shortcuts.
   */
  keyMap: KeyMap = {
    RERUN: "r",
    CLEAR_CACHE: "c",
    // We use key up for stop recording to ensure the esc key doesn't trigger
    // other actions (like exiting modals)
    STOP_RECORDING: { sequence: "esc", action: "keyup" },
  }

  keyHandlers = {
    RERUN: () => {
      this.rerunScript()
    },
    CLEAR_CACHE: () => {
      if (isLocalhost() || this.props.hostCommunication.currentState.isOwner) {
        this.openClearCacheDialog()
      }
    },
    STOP_RECORDING: this.props.screenCast.stopRecording,
  }

  componentDidMount(): void {
    // Initialize connection manager here, to avoid
    // "Can't call setState on a component that is not yet mounted." error.
    this.connectionManager = new ConnectionManager({
      sessionInfo: this.sessionInfo,
      endpoints: this.endpoints,
      onMessage: this.handleMessage,
      onConnectionError: this.handleConnectionError,
      connectionStateChanged: this.handleConnectionStateChanged,
      claimHostAuthToken: () =>
        this.props.hostCommunication.currentState.authTokenPromise,
      resetHostAuthToken: this.props.hostCommunication.resetAuthToken,
      setAllowedOriginsResp:
        this.props.hostCommunication.setAllowedOriginsResp,
    })

    if (isScrollingHidden()) {
      document.body.classList.add("embedded")
    }

    // Iframe resizer allows parent pages to get the height of the iframe
    // contents. The parent page can then reset the height to match and
    // avoid unnecessary scrollbars or large embeddings
    if (isInChildFrame()) {
      window.iFrameResizer = {
        heightCalculationMethod: () => {
          const taggedEls = document.querySelectorAll("[data-iframe-height]")
          // Use ceil to avoid fractional pixels creating scrollbars.
          const lowestBounds = Array.from(taggedEls).map(el =>
            Math.ceil(el.getBoundingClientRect().bottom)
          )

          // The higher the value, the further down the page it is.
          // Use maximum value to get the lowest of all tagged elements.
          return Math.max(0, ...lowestBounds)
        },
      }

      // @ts-expect-error
      import("iframe-resizer/js/iframeResizer.contentWindow")
    }

    this.props.hostCommunication.sendMessage({
      type: "SET_THEME_CONFIG",
      themeInfo: toExportedTheme(this.props.theme.activeTheme.emotion),
    })

    this.props.hostCommunication.sendMessage({
      type: "SCRIPT_RUN_STATE_CHANGED",
      scriptRunState: this.state.scriptRunState,
    })

    this.metricsMgr.enqueue("viewReport")

    window.addEventListener("popstate", this.onHistoryChange, false)
  }

  componentDidUpdate(
    prevProps: Readonly<Props>,
    prevState: Readonly<State>
  ): void {
    if (
      prevProps.hostCommunication.currentState.queryParams !==
      this.props.hostCommunication.currentState.queryParams
    ) {
      this.sendRerunBackMsg()
    }
    if (this.props.hostCommunication.currentState.forcedModalClose) {
      this.closeDialog()
    }
    if (this.props.hostCommunication.currentState.scriptRerunRequested) {
      this.rerunScript()
    }
    if (this.props.hostCommunication.currentState.scriptStopRequested) {
      this.stopScript()
    }
    if (this.props.hostCommunication.currentState.cacheClearRequested) {
      this.clearCache()
    }

    const { requestedPageScriptHash } =
      this.props.hostCommunication.currentState
    if (requestedPageScriptHash !== null) {
      this.onPageChange(requestedPageScriptHash)
      this.props.hostCommunication.onPageChanged()
    }
    // @ts-expect-error
    if (window.prerenderReady === false && this.isAppInReadyState(prevState)) {
      // @ts-expect-error
      window.prerenderReady = true
    }
    if (this.state.scriptRunState !== prevState.scriptRunState) {
      this.props.hostCommunication.sendMessage({
        type: "SCRIPT_RUN_STATE_CHANGED",
        scriptRunState: this.state.scriptRunState,
      })
    }
  }

  componentWillUnmount(): void {
    // Needing to disconnect our connection manager + websocket connection is
    // only needed here to handle the case in dev mode where react hot-reloads
    // the client as a result of a source code change. In this scenario, the
    // previous websocket connection is still connected, and the client and
    // server end up in a reconnect loop because the server rejects attempts to
    // connect to an already-connected session.
    //
    // This situation doesn't exist outside of dev mode because the whole App
    // unmounting is either a page refresh or the browser tab closing.
    //
    // The optional chaining on connectionManager is needed to make typescript
    // happy since connectionManager's type is `ConnectionManager | null`,
    // but at this point it should always be set.
    this.connectionManager?.disconnect()

    window.removeEventListener("popstate", this.onHistoryChange, false)
  }

  showError(title: string, errorNode: ReactNode): void {
    logError(errorNode)
    const newDialog: DialogProps = {
      type: DialogType.WARNING,
      title,
      msg: errorNode,
      onClose: () => {},
    }
    this.openDialog(newDialog)
  }

  showDeployError = (
    title: string,
    errorNode: ReactNode,
    onContinue?: () => void
  ): void => {
    this.openDialog({
      type: DialogType.DEPLOY_ERROR,
      title,
      msg: errorNode,
      onContinue,
      onClose: () => {},
      onTryAgain: this.sendLoadGitInfoBackMsg,
    })
  }

  /**
   * Checks if the code version from the backend is different than the frontend
   */
  private hasStreamlitVersionChanged(initializeMsg: Initialize): boolean {
    if (this.sessionInfo.isSet) {
      const currentStreamlitVersion = this.sessionInfo.current.streamlitVersion
      const { environmentInfo } = initializeMsg

      if (
        environmentInfo != null &&
        environmentInfo.streamlitVersion != null
      ) {
        return currentStreamlitVersion != environmentInfo.streamlitVersion
      }
    }

    return false
  }

  /**
   * Called by ConnectionManager when our connection state changes
   */
  handleConnectionStateChanged = (newState: ConnectionState): void => {
    logMessage(
      `Connection state changed from ${this.state.connectionState} to ${newState}`
    )

    this.setState({ connectionState: newState })

    if (newState === ConnectionState.CONNECTED) {
      logMessage("Reconnected to server; requesting a script run")
      this.widgetMgr.sendUpdateWidgetsMessage()
      this.setState({ dialog: null })
    } else {
      setCookie("_xsrf", "")

      if (this.sessionInfo.isSet) {
        this.sessionInfo.clearCurrent()
      }
    }
  }

  handleGitInfoChanged = (gitInfo: IGitInfo): void => {
    this.setState({
      gitInfo,
    })
  }

  /**
   * Callback when we get a message from the server.
   */
  handleMessage = (msgProto: ForwardMsg): void => {
    // We don't have an immutableProto here, so we can't use
    // the dispatchOneOf helper
    const dispatchProto = (obj: any, name: string, funcs: any): any => {
      const whichOne = obj[name]
      if (whichOne in funcs) {
        return funcs[whichOne](obj[whichOne])
      }
      throw new Error(`Cannot handle ${name} "${whichOne}".`)
    }

    try {
      dispatchProto(msgProto, "type", {
        newSession: (newSessionMsg: NewSession) =>
          this.handleNewSession(newSessionMsg),
        sessionStatusChanged: (msg: SessionStatus) =>
          this.handleSessionStatusChanged(msg),
        sessionEvent: (evtMsg: SessionEvent) =>
          this.handleSessionEvent(evtMsg),
        delta: (deltaMsg: Delta) =>
          this.handleDeltaMsg(
            deltaMsg,
            msgProto.metadata as ForwardMsgMetadata
          ),
        pageConfigChanged: (pageConfig: PageConfig) =>
          this.handlePageConfigChanged(pageConfig),
        pageInfoChanged: (pageInfo: PageInfo) =>
          this.handlePageInfoChanged(pageInfo),
        pagesChanged: (pagesChangedMsg: PagesChanged) =>
          this.handlePagesChanged(pagesChangedMsg),
        pageNotFound: (pageNotFound: PageNotFound) =>
          this.handlePageNotFound(pageNotFound),
        gitInfoChanged: (gitInfo: GitInfo) =>
          this.handleGitInfoChanged(gitInfo),
        scriptFinished: (status: ForwardMsg.ScriptFinishedStatus) =>
          this.handleScriptFinished(status),
        pageProfile: (pageProfile: PageProfile) =>
          this.handlePageProfileMsg(pageProfile),
      })
    } catch (e) {
      const err = ensureError(e)
      logError(err)
      this.showError("Bad message format", err.message)
    }
  }

  handlePageConfigChanged = (pageConfig: PageConfig): void => {
    const { title, favicon, layout, initialSidebarState, menuItems } =
      pageConfig

    this.metricsMgr.enqueue("pageConfigChanged", {
      favicon,
      layout,
      initialSidebarState,
    })

    if (title) {
      this.props.hostCommunication.sendMessage({
        type: "SET_PAGE_TITLE",
        title,
      })

      document.title = title
    }

    if (favicon) {
      handleFavicon(
        favicon,
        this.props.hostCommunication.sendMessage,
        this.endpoints
      )
    }

    // Only change layout/sidebar when the page config has changed.
    // This preserves the user's previous choice, and prevents extra re-renders.
    if (layout !== this.state.layout) {
      this.setState((prevState: State) => ({
        layout,
        userSettings: {
          ...prevState.userSettings,
          wideMode: layout === PageConfig.Layout.WIDE,
        },
      }))
    }
    if (initialSidebarState !== this.state.initialSidebarState) {
      this.setState(() => ({
        initialSidebarState,
      }))
    }

    this.setState({ menuItems })
  }

  handlePageInfoChanged = (pageInfo: PageInfo): void => {
    const { queryString } = pageInfo
    const targetUrl =
      document.location.pathname + (queryString ? `?${queryString}` : "")
    window.history.pushState({}, "", targetUrl)

    this.props.hostCommunication.sendMessage({
      type: "SET_QUERY_PARAM",
      queryParams: queryString ? `?${queryString}` : "",
    })
  }

  handlePageNotFound = (pageNotFound: PageNotFound): void => {
    const { pageName } = pageNotFound
    const errMsg = pageName
      ? `You have requested page /${pageName}, but no corresponding file was found in the app's pages/ directory`
      : "The page that you have requested does not seem to exist"
    this.showError("Page not found", `${errMsg}. Running the app's main page.`)

    const currentPageScriptHash = this.state.appPages[0]?.pageScriptHash || ""
    this.setState({ currentPageScriptHash }, () => {
      this.props.hostCommunication.sendMessage({
        type: "SET_CURRENT_PAGE_NAME",
        currentPageName: "",
        currentPageScriptHash,
      })
    })
  }

  handlePagesChanged = (pagesChangedMsg: PagesChanged): void => {
    const { appPages } = pagesChangedMsg
    this.setState({ appPages }, () => {
      this.props.hostCommunication.sendMessage({
        type: "SET_APP_PAGES",
        appPages,
      })
    })
  }

  handlePageProfileMsg = (pageProfile: PageProfile): void => {
    this.metricsMgr.enqueue("pageProfile", {
      ...PageProfile.toObject(pageProfile),
      appId: this.sessionInfo.current.appId,
      numPages: this.state.appPages?.length,
      sessionId: this.sessionInfo.current.sessionId,
      pythonVersion: this.sessionInfo.current.pythonVersion,
      pageScriptHash: this.state.currentPageScriptHash,
      activeTheme: this.props.theme?.activeTheme?.name,
      totalLoadTime: Math.round(
        (performance.now() - this.state.latestRunTime) * 1000
      ),
    })
  }

  /**
   * Handler for ForwardMsg.sessionStatusChanged messages
   * @param statusChangeProto a SessionStatus protobuf
   */
  handleSessionStatusChanged = (statusChangeProto: SessionStatus): void => {
    this.setState((prevState: State) => {
      // Determine our new ScriptRunState
      let { scriptRunState } = prevState
      let { dialog } = prevState

      if (
        statusChangeProto.scriptIsRunning &&
        prevState.scriptRunState !== ScriptRunState.STOP_REQUESTED
      ) {
        // If the script is running, we change our ScriptRunState only
        // if we don't have a pending stop request
        scriptRunState = ScriptRunState.RUNNING

        // If the scriptCompileError dialog is open and the script starts
        // running, close it.
        if (
          dialog != null &&
          dialog.type === DialogType.SCRIPT_COMPILE_ERROR
        ) {
          dialog = undefined
        }
      } else if (
        !statusChangeProto.scriptIsRunning &&
        prevState.scriptRunState !== ScriptRunState.RERUN_REQUESTED &&
        prevState.scriptRunState !== ScriptRunState.COMPILATION_ERROR
      ) {
        // If the script is not running, we change our ScriptRunState only
        // if we don't have a pending rerun request, and we don't have
        // a script compilation failure
        scriptRunState = ScriptRunState.NOT_RUNNING

        this.metricsMgr.enqueue(
          "deltaStats",
          this.metricsMgr.getAndResetDeltaCounter()
        )

        const { availableThemes, activeTheme } = this.props.theme
        const customThemeDefined =
          availableThemes.length > createPresetThemes().length
        this.metricsMgr.enqueue("themeStats", {
          activeThemeName: activeTheme.name,
          customThemeDefined,
        })

        const customComponentCounter =
          this.metricsMgr.getAndResetCustomComponentCounter()
        Object.entries(customComponentCounter).forEach(([name, count]) => {
          this.metricsMgr.enqueue("customComponentStats", {
            name,
            count,
          })
        })
      }

      return {
        userSettings: {
          ...prevState.userSettings,
          runOnSave: Boolean(statusChangeProto.runOnSave),
        },
        dialog,
        scriptRunState,
      }
    })
  }

  /**
   * Handler for ForwardMsg.sessionEvent messages
   * @param sessionEvent a SessionEvent protobuf
   */
  handleSessionEvent = (sessionEvent: SessionEvent): void => {
    this.sessionEventDispatcher.handleSessionEventMsg(sessionEvent)
    if (sessionEvent.type === "scriptCompilationException") {
      this.setState({ scriptRunState: ScriptRunState.COMPILATION_ERROR })
      const newDialog: DialogProps = {
        type: DialogType.SCRIPT_COMPILE_ERROR,
        exception: sessionEvent.scriptCompilationException,
        onClose: () => {},
      }
      this.openDialog(newDialog)
    } else if (
      RERUN_PROMPT_MODAL_DIALOG &&
      sessionEvent.type === "scriptChangedOnDisk"
    ) {
      const newDialog: DialogProps = {
        type: DialogType.SCRIPT_CHANGED,
        onRerun: this.rerunScript,
        onClose: () => {},
        allowRunOnSave: this.state.allowRunOnSave,
      }
      this.openDialog(newDialog)
    }
  }

  /**
   * Handler for ForwardMsg.newSession messages. This runs on each rerun
   * @param newSessionProto a NewSession protobuf
   */
  handleNewSession = (newSessionProto: NewSession): void => {
    const initialize = newSessionProto.initialize as Initialize

    if (this.hasStreamlitVersionChanged(initialize)) {
      window.location.reload()
      return
    }

    // First, handle initialization logic. Each NewSession message has
    // initialization data. If this is the _first_ time we're receiving
    // the NewSession message, we perform some one-time initialization.
    if (!this.sessionInfo.isSet) {
      // We're not initialized. Perform one-time initialization.
      this.handleOneTimeInitialization(newSessionProto)
    }

    const config = newSessionProto.config as Config
    const themeInput = newSessionProto.customTheme as CustomThemeConfig
    const { currentPageScriptHash: prevPageScriptHash } = this.state
    const newPageScriptHash = newSessionProto.pageScriptHash

    // mainPage must be a string as we're guaranteed at this point that
    // newSessionProto.appPages is nonempty and has a truthy pageName.
    // Otherwise, we'd either have no main script or a nameless main script,
    // neither of which can happen.
    const mainPage = newSessionProto.appPages[0] as AppPage
    // We're similarly guaranteed that newPageName will be found / truthy
    // here.
    const newPageName = newSessionProto.appPages.find(
      p => p.pageScriptHash === newPageScriptHash
    )?.pageName as string
    const viewingMainPage = newPageScriptHash === mainPage.pageScriptHash

    const baseUriParts = this.getBaseUriParts()
    if (baseUriParts) {
      const { basePath } = baseUriParts

      const prevPageNameInPath = extractPageNameFromPathName(
        document.location.pathname,
        basePath
      )
      const prevPageName =
        prevPageNameInPath === "" ? mainPage.pageName : prevPageNameInPath
      // It is important to compare `newPageName` with the previous one encoded in the URL
      // to handle new session runs triggered by URL changes through the `onHistoryChange()` callback,
      // e.g. the case where the user clicks the back button.
      // See https://github.com/streamlit/streamlit/pull/6271#issuecomment-1465090690 for the discussion.
      if (prevPageName !== newPageName) {
        const queryString = this.getQueryString()

        const qs = queryString ? `?${queryString}` : ""
        const basePathPrefix = basePath ? `/${basePath}` : ""

        const pagePath = viewingMainPage ? "" : newPageName
        const pageUrl = `${basePathPrefix}/${pagePath}${qs}`

        window.history.pushState({}, "", pageUrl)
      }
    }

    this.processThemeInput(themeInput)
    this.setState(
      {
        allowRunOnSave: config.allowRunOnSave,
        hideTopBar: config.hideTopBar,
        hideSidebarNav: config.hideSidebarNav,
        appPages: newSessionProto.appPages,
        currentPageScriptHash: newPageScriptHash,
        latestRunTime: performance.now(),
      },
      () => {
        this.props.hostCommunication.sendMessage({
          type: "SET_APP_PAGES",
          appPages: newSessionProto.appPages,
        })

        this.props.hostCommunication.sendMessage({
          type: "SET_CURRENT_PAGE_NAME",
          currentPageName: viewingMainPage ? "" : newPageName,
          currentPageScriptHash: newPageScriptHash,
        })
      }
    )

    const { appHash } = this.state
    const { scriptRunId, name: scriptName, mainScriptPath } = newSessionProto

    const newSessionHash = hashString(
      this.sessionInfo.current.installationId + mainScriptPath
    )

    // Set the title and favicon to their default values
    document.title = `${newPageName} · Streamlit`
    handleFavicon(
      `${process.env.PUBLIC_URL}/favicon.png`,
      this.props.hostCommunication.sendMessage,
      this.endpoints
    )

    this.metricsMgr.setMetadata(
      this.props.hostCommunication.currentState.deployedAppMetadata
    )
    this.metricsMgr.setAppHash(newSessionHash)
    this.metricsMgr.clearDeltaCounter()

    this.metricsMgr.enqueue("updateReport", {
      numPages: newSessionProto.appPages.length,
      isMainPage: viewingMainPage,
    })

    if (
      appHash === newSessionHash &&
      prevPageScriptHash === newPageScriptHash
    ) {
      this.setState({
        scriptRunId,
      })
    } else {
      this.clearAppState(newSessionHash, scriptRunId, scriptName)
    }
  }

  /**
   * Performs one-time initialization. This is called from `handleNewSession`.
   */
  handleOneTimeInitialization = (newSessionProto: NewSession): void => {
    const initialize = newSessionProto.initialize as Initialize
    const config = newSessionProto.config as Config

    this.sessionInfo.setCurrent(
      SessionInfo.propsFromNewSessionMessage(newSessionProto)
    )

    this.metricsMgr.initialize({
      gatherUsageStats: config.gatherUsageStats,
    })

    this.metricsMgr.enqueue("createReport", {
      pythonVersion: this.sessionInfo.current.pythonVersion,
    })

    this.handleSessionStatusChanged(initialize.sessionStatus)
  }

  /**
   * Handler called when the history state changes, e.g. `popstate` event.
   */
  onHistoryChange = (): void => {
    const targetAppPage =
      this.state.appPages.find(appPage =>
        // The page name is embedded at the end of the URL path, and if not, we are in the main page.
        // See https://github.com/streamlit/streamlit/blob/1.19.0/frontend/src/App.tsx#L740
        document.location.pathname.endsWith("/" + appPage.pageName)
      ) ?? this.state.appPages[0]
    if (targetAppPage == null) {
      return
    }
    this.onPageChange(targetAppPage.pageScriptHash as string)
  }

  /**
   * Both sets the given theme locally and sends it to the host.
   */
  setAndSendTheme = (themeConfig: ThemeConfig): void => {
    this.props.theme.setTheme(themeConfig)
    this.props.hostCommunication.sendMessage({
      type: "SET_THEME_CONFIG",
      themeInfo: toExportedTheme(themeConfig.emotion),
    })
  }

  createThemeHash = (themeInput: CustomThemeConfig): string => {
    if (!themeInput) {
      // If themeInput is null, then we didn't receive a custom theme for this
      // app from the server. We use a hardcoded string literal for the
      // themeHash in this case.
      return "hash_for_undefined_custom_theme"
    }

    const themeInputEntries = Object.entries(themeInput)
    // Ensure that our themeInput fields are in a consistent order when
    // stringified below. Sorting an array of arrays in javascript sorts by the
    // 0th element of the inner arrays, uses the 1st element to tiebreak, and
    // so on.
    themeInputEntries.sort()
    return hashString(themeInputEntries.join(":"))
  }

  processThemeInput(themeInput: CustomThemeConfig): void {
    const themeHash = this.createThemeHash(themeInput)
    if (themeHash === this.state.themeHash) {
      return
    }
    this.setState({ themeHash })

    const usingCustomTheme = !isPresetTheme(this.props.theme.activeTheme)

    if (themeInput) {
      const customTheme = createTheme(CUSTOM_THEME_NAME, themeInput)
      // For now, users can only add one custom theme.
      this.props.theme.addThemes([customTheme])

      const userPreference = getCachedTheme()
      if (userPreference === null || usingCustomTheme) {
        // Update the theme to be customTheme either if the user hasn't set a
        // preference (developer-provided custom themes should be the default
        // for an app) or if a custom theme is currently active (to ensure that
        // we pick up any new changes to it).
        this.setAndSendTheme(customTheme)
      }
    } else {
      // Remove the custom theme menu option.
      this.props.theme.addThemes([])

      if (usingCustomTheme) {
        this.setAndSendTheme(createAutoTheme())
      }
    }
  }

  /**
   * Handler for ForwardMsg.scriptFinished messages
   * @param status the ScriptFinishedStatus that the script finished with
   */
  handleScriptFinished(status: ForwardMsg.ScriptFinishedStatus): void {
    if (
      status === ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY ||
      status === ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN
    ) {
      const successful =
        status === ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
      window.setTimeout(() => {
        // Set the theme if url query param ?embed_options=[light,dark]_theme is set
        const [light, dark] = this.props.theme.availableThemes.slice(1, 3)
        if (isLightTheme()) {
          this.setAndSendTheme(light)
        } else if (isDarkTheme()) {
          this.setAndSendTheme(dark)
        } else noop() // Do nothing when ?embed_options=[light,dark]_theme is not set

        // Notify any subscribers of this event (and do it on the next cycle of
        // the event loop)
        this.state.scriptFinishedHandlers.map(handler => handler())
      }, 0)

      if (successful) {
        // Clear any stale elements left over from the previous run.
        // (We don't do this if our script had a compilation error and didn't
        // finish successfully.)
        this.setState(
          ({ scriptRunId }) => ({
            // Apply any pending elements that haven't been applied.
            elements: this.pendingElementsBuffer.clearStaleNodes(scriptRunId),
          }),
          () => {
            // We now have no pending elements.
            this.pendingElementsBuffer = this.state.elements
          }
        )

        // Tell the WidgetManager which widgets still exist. It will remove
        // widget state for widgets that have been removed.
        const activeWidgetIds = new Set(
          Array.from(this.state.elements.getElements())
            .map(element => getElementWidgetID(element))
            .filter(notUndefined)
        )
        this.widgetMgr.removeInactive(activeWidgetIds)
      }

      // Tell the ConnectionManager to increment the message cache run
      // count. This will result in expired ForwardMsgs being removed from
      // the cache.
      if (this.connectionManager !== null) {
        this.connectionManager.incrementMessageCacheRunCount(
          this.sessionInfo.current.maxCachedMessageAge
        )
      }
    }
  }

  /*
   * Clear all elements from the state.
   */
  clearAppState(
    appHash: string,
    scriptRunId: string,
    scriptName: string
  ): void {
    this.setState(
      {
        scriptRunId,
        scriptName,
        appHash,
        elements: AppRoot.empty(this.metricsMgr),
      },
      () => {
        this.pendingElementsBuffer = this.state.elements
        this.widgetMgr.removeInactive(new Set([]))
      }
    )
  }

  /**
   * Opens a dialog with the specified state.
   */
  openDialog(dialogProps: DialogProps): void {
    this.setState({ dialog: dialogProps })
  }

  /**
   * Closes the upload dialog if it's open.
   */
  closeDialog = (): void => {
    this.setState({ dialog: undefined })
    this.props.hostCommunication.onModalReset()
  }

  /**
   * Saves a UserSettings object.
   */
  saveSettings = (newSettings: UserSettings): void => {
    const { runOnSave: prevRunOnSave } = this.state.userSettings
    const { runOnSave } = newSettings

    this.setState({ userSettings: newSettings })

    if (prevRunOnSave !== runOnSave && this.isServerConnected()) {
      const backMsg = new BackMsg({ setRunOnSave: runOnSave })
      backMsg.type = "setRunOnSave"
      this.sendBackMsg(backMsg)
    }
  }

  /**
   * Update pendingElementsBuffer with the given Delta and set up a timer to
   * update state.elements. This buffer allows us to process Deltas quickly
   * without spamming React with too many of render() calls.
   */
  handleDeltaMsg = (
    deltaMsg: Delta,
    metadataMsg: ForwardMsgMetadata
  ): void => {
    this.pendingElementsBuffer = this.pendingElementsBuffer.applyDelta(
      this.state.scriptRunId,
      deltaMsg,
      metadataMsg
    )

    if (!this.pendingElementsTimerRunning) {
      this.pendingElementsTimerRunning = true

      // (BUG #685) When user presses stop, stop adding elements to
      // the app immediately to avoid race condition.
      const scriptIsRunning =
        this.state.scriptRunState === ScriptRunState.RUNNING

      setTimeout(() => {
        this.pendingElementsTimerRunning = false
        if (scriptIsRunning) {
          this.setState({ elements: this.pendingElementsBuffer })
        }
      }, ELEMENT_LIST_BUFFER_TIMEOUT_MS)
    }
  }

  /**
   * Test-only method used by e2e tests to test disabling widgets.
   */
  debugShutdownRuntime = (): void => {
    if (this.isServerConnected()) {
      const backMsg = new BackMsg({ debugShutdownRuntime: true })
      backMsg.type = "debugShutdownRuntime"
      this.sendBackMsg(backMsg)
    }
  }

  /**
   * Test-only method used by e2e tests to test reconnect behavior.
   */
  debugDisconnectWebsocket = (): void => {
    if (this.isServerConnected()) {
      const backMsg = new BackMsg({ debugDisconnectWebsocket: true })
      backMsg.type = "debugDisconnectWebsocket"
      this.sendBackMsg(backMsg)
    }
  }

  /**
   * Test-only method used by e2e tests to test fetching cached ForwardMsgs
   * from the server.
   */
  debugClearForwardMsgCache = (): void => {
    if (!isLocalhost()) {
      return
    }

    // It's not a problem that we're mucking around with private fields since
    // this is a test-only method anyway.
    // @ts-expect-error
    this.connectionManager?.connection?.cache.messages.clear()
  }

  /**
   * Reruns the script.
   *
   * @param alwaysRunOnSave a boolean. If true, UserSettings.runOnSave
   * will be set to true, which will result in a request to the Server
   * to enable runOnSave for this session.
   */
  rerunScript = (alwaysRunOnSave = false): void => {
    this.closeDialog()

    if (!this.isServerConnected()) {
      logError("Cannot rerun script when disconnected from server.")
      return
    }

    if (
      this.state.scriptRunState === ScriptRunState.RUNNING ||
      this.state.scriptRunState === ScriptRunState.RERUN_REQUESTED
    ) {
      // Don't queue up multiple rerunScript requests
      return
    }

    this.metricsMgr.enqueue("rerunScript")

    this.setState({ scriptRunState: ScriptRunState.RERUN_REQUESTED })

    // Note: `rerunScript` is incorrectly called in some places.
    // We can remove `=== true` after adding type information
    if (alwaysRunOnSave === true) {
      // Update our run-on-save setting *before* calling rerunScript.
      // The rerunScript message currently blocks all BackMsgs from
      // being processed until the script has completed executing.
      this.saveSettings({ ...this.state.userSettings, runOnSave: true })
    }

    this.props.hostCommunication.onScriptRerun()
    this.widgetMgr.sendUpdateWidgetsMessage()
  }

  sendLoadGitInfoBackMsg = (): void => {
    if (!this.isServerConnected()) {
      logError("Cannot load git information when disconnected from server.")
      return
    }

    this.sendBackMsg(
      new BackMsg({
        loadGitInfo: true,
      })
    )
  }

  onPageChange = (pageScriptHash: string): void => {
    this.sendRerunBackMsg(undefined, pageScriptHash)
  }

  isAppInReadyState = (prevState: Readonly<State>): boolean => {
    return (
      this.state.connectionState === ConnectionState.CONNECTED &&
      this.state.scriptRunState === ScriptRunState.NOT_RUNNING &&
      prevState.scriptRunState === ScriptRunState.RUNNING &&
      prevState.connectionState === ConnectionState.CONNECTED
    )
  }

  sendRerunBackMsg = (
    widgetStates?: WidgetStates,
    pageScriptHash?: string
  ): void => {
    const baseUriParts = this.getBaseUriParts()
    if (!baseUriParts) {
      // If we don't have a connectionManager or if it doesn't have an active
      // websocket connection to the server (in which case
      // connectionManager.getBaseUriParts() returns undefined), we can't send a
      // rerun backMessage so just return early.
      logError("Cannot send rerun backMessage when disconnected from server.")
      return
    }

    const { currentPageScriptHash } = this.state
    const { basePath } = baseUriParts
    const queryString = this.getQueryString()
    let pageName = ""

    if (pageScriptHash) {
      // The user specified exactly which page to run. We can simply use this
      // value in the BackMsg we send to the server.
    } else if (currentPageScriptHash) {
      // The user didn't specify which page to run, which happens when they
      // click the "Rerun" button in the hamburger menu. In this case, we
      // rerun the current page.
      pageScriptHash = currentPageScriptHash
    } else {
      // We must be in the case where the user is navigating directly to a
      // non-main page of this app. Since we haven't received the list of the
      // app's pages from the server at this point, we fall back to requesting
      // the page to run via pageName, which we extract from
      // document.location.pathname.
      pageName = extractPageNameFromPathName(
        document.location.pathname,
        basePath
      )
      pageScriptHash = ""
    }

    this.sendBackMsg(
      new BackMsg({
        rerunScript: { queryString, widgetStates, pageScriptHash, pageName },
      })
    )

    PerformanceEvents.record({
      name: "RequestedRerun",
      scriptRunState: this.state.scriptRunState,
    })
  }

  /** Requests that the server stop running the script */
  stopScript = (): void => {
    if (!this.isServerConnected()) {
      logError("Cannot stop app when disconnected from server.")
      return
    }

    if (
      this.state.scriptRunState === ScriptRunState.NOT_RUNNING ||
      this.state.scriptRunState === ScriptRunState.STOP_REQUESTED
    ) {
      // Don't queue up multiple stopScript requests
      return
    }

    const backMsg = new BackMsg({ stopScript: true })
    backMsg.type = "stopScript"
    this.sendBackMsg(backMsg)
    this.setState({ scriptRunState: ScriptRunState.STOP_REQUESTED })
    this.props.hostCommunication.onScriptStop()
  }

  /**
   * Shows a dialog asking the user to confirm they want to clear the cache
   */
  openClearCacheDialog = (): void => {
    if (this.isServerConnected()) {
      const newDialog: DialogProps = {
        type: DialogType.CLEAR_CACHE,
        confirmCallback: this.clearCache,
        defaultAction: this.clearCache,
        onClose: () => {},
      }
      // This will be called if enter is pressed.
      this.openDialog(newDialog)
    } else {
      logError("Cannot clear cache: disconnected from server")
    }
  }

  /**
   * Shows a dialog with Deployment instructions
   */
  openDeployDialog = (): void => {
    const deployDialogProps: DialogProps = {
      type: DialogType.DEPLOY_DIALOG,
      onClose: this.closeDialog,
      showDeployError: this.showDeployError,
      gitInfo: this.state.gitInfo,
      isDeployErrorModalOpen:
        this.state.dialog?.type === DialogType.DEPLOY_ERROR,
      metricsMgr: this.metricsMgr,
    }
    this.openDialog(deployDialogProps)
  }

  openThemeCreatorDialog = (): void => {
    const newDialog: DialogProps = {
      type: DialogType.THEME_CREATOR,
      backToSettings: this.settingsCallback,
      onClose: this.closeDialog,
    }
    this.openDialog(newDialog)
  }

  /**
   * Asks the server to clear the st_cache and st_cache_data and st_cache_resource
   */
  clearCache = (): void => {
    this.closeDialog()
    if (this.isServerConnected()) {
      this.metricsMgr.enqueue("clearCache")
      const backMsg = new BackMsg({ clearCache: true })
      backMsg.type = "clearCache"
      this.sendBackMsg(backMsg)
    } else {
      logError("Cannot clear cache: disconnected from server")
    }
    this.props.hostCommunication.onCacheClear()
  }

  /**
   * Sends a message back to the server.
   */
  private sendBackMsg = (msg: BackMsg): void => {
    if (this.connectionManager) {
      logMessage(msg)
      this.connectionManager.sendMessage(msg)
    } else {
      logError(`Not connected. Cannot send back message: ${msg}`)
    }
  }

  /**
   * Updates the app body when there's a connection error.
   */
  handleConnectionError = (errNode: ReactNode): void => {
    this.showError("Connection error", errNode)
  }

  /**
   * Indicates whether we're connected to the server.
   */
  isServerConnected = (): boolean => {
    return this.connectionManager
      ? this.connectionManager.isConnected()
      : false
  }

  settingsCallback = (animateModal = true): void => {
    const newDialog: DialogProps = {
      type: DialogType.SETTINGS,
      isServerConnected: this.isServerConnected(),
      settings: this.state.userSettings,
      allowRunOnSave: this.state.allowRunOnSave,
      onSave: this.saveSettings,
      onClose: () => {},
      developerMode: this.state.developerMode,
      openThemeCreator: this.openThemeCreatorDialog,
      animateModal,
      metricsMgr: this.metricsMgr,
    }
    this.openDialog(newDialog)
  }

  aboutCallback = (): void => {
    const { menuItems } = this.state
    const newDialog: DialogProps = {
      type: DialogType.ABOUT,
      sessionInfo: this.sessionInfo,
      onClose: this.closeDialog,
      aboutSectionMd: menuItems?.aboutSectionMd,
    }
    this.openDialog(newDialog)
  }

  /**
   * Prints the app, if the app is in IFrame
   * it prints the content of the IFrame.
   * Before printing this function ensures the app has fully loaded,
   * by checking if we're in ScriptRunState.NOT_RUNNING state.
   */
  printCallback = (): void => {
    const { scriptRunState } = this.state
    if (scriptRunState !== ScriptRunState.NOT_RUNNING) {
      setTimeout(this.printCallback, 500)
      return
    }
    let windowToPrint
    try {
      const htmlIFrameElement = getIFrameEnclosingApp(this.embeddingId)
      if (htmlIFrameElement && htmlIFrameElement.contentWindow) {
        windowToPrint = htmlIFrameElement.contentWindow.window
      } else {
        windowToPrint = window
      }
    } catch (err) {
      windowToPrint = window
    } finally {
      if (!windowToPrint) windowToPrint = window
      windowToPrint.print()
    }
  }

  screencastCallback = (): void => {
    const { scriptName } = this.state
    const { startRecording } = this.props.screenCast
    const date = moment().format("YYYY-MM-DD-HH-MM-SS")

    startRecording(`streamlit-${scriptName}-${date}`)
  }

  handleFullScreen = (isFullScreen: boolean): void => {
    this.setState({ isFullScreen })
  }

  addScriptFinishedHandler = (func: () => void): void => {
    this.setState((prevState, _) => {
      return {
        scriptFinishedHandlers: concat(prevState.scriptFinishedHandlers, func),
      }
    })
  }

  removeScriptFinishedHandler = (func: () => void): void => {
    this.setState((prevState, _) => {
      return {
        scriptFinishedHandlers: without(
          prevState.scriptFinishedHandlers,
          func
        ),
      }
    })
  }

  getBaseUriParts = (): BaseUriParts | undefined =>
    this.connectionManager
      ? this.connectionManager.getBaseUriParts()
      : undefined

  getQueryString = (): string => {
    const { queryParams } = this.props.hostCommunication.currentState

    const queryString =
      queryParams && queryParams.length > 0
        ? queryParams
        : document.location.search

    return queryString.startsWith("?") ? queryString.substring(1) : queryString
  }

  isInCloudEnvironment = (): boolean => {
    const { menuItems } = this.props.hostCommunication.currentState
    return menuItems && menuItems?.length > 0
  }

  showDeployButton = (): boolean => {
    return isTesting()
    //  for now we always hide deploy button,
    // later on we should allow below logic
    /*
    return (
      isLocalhost() &&
      !this.isInCloudEnvironment() &&
      this.sessionInfo.isSet &&
      !this.sessionInfo.isHello
    )
     */
  }

  deployButtonClicked = (): void => {
    if (!isTesting()) {
      this.metricsMgr.enqueue("deployButtonInApp", { clicked: true })
    }
    this.sendLoadGitInfoBackMsg()
    this.openDeployDialog()
  }

  render(): JSX.Element {
    const {
      allowRunOnSave,
      connectionState,
      dialog,
      elements,
      initialSidebarState,
      menuItems,
      isFullScreen,
      scriptRunId,
      scriptRunState,
      userSettings,
      gitInfo,
      hideTopBar,
      hideSidebarNav,
      currentPageScriptHash,
    } = this.state

    const { hideSidebarNav: hostHideSidebarNav } =
      this.props.hostCommunication.currentState

    const outerDivClass = classNames(
      "stApp",
      getEmbeddingIdClassName(this.embeddingId),
      {
        "streamlit-embedded": isEmbed(),
        "streamlit-wide": userSettings.wideMode,
      }
    )

    const renderedDialog: React.ReactNode = dialog
      ? StreamlitDialog({
          ...dialog,
          onClose: this.closeDialog,
        })
      : null

    // Attach and focused props provide a way to handle Global Hot Keys
    // https://github.com/greena13/react-hotkeys/issues/41
    // attach: DOM element the keyboard listeners should attach to
    // focused: A way to force focus behaviour
    return (
      <AppContext.Provider
        value={{
          initialSidebarState,
          wideMode: userSettings.wideMode,
          isFullScreen,
          setFullScreen: this.handleFullScreen,
          addScriptFinishedHandler: this.addScriptFinishedHandler,
          removeScriptFinishedHandler: this.removeScriptFinishedHandler,
          activeTheme: this.props.theme.activeTheme,
          availableThemes: this.props.theme.availableThemes,
          setTheme: this.setAndSendTheme,
          addThemes: this.props.theme.addThemes,
          sidebarChevronDownshift:
            this.props.hostCommunication.currentState.sidebarChevronDownshift,
          embedded: isEmbed(),
          showPadding: !isEmbed() || isPaddingDisplayed(),
          disableScrolling: isScrollingHidden(),
          showFooter: !isEmbed() || isFooterDisplayed(),
          showToolbar: !isEmbed() || isToolbarDisplayed(),
          showColoredLine: !isEmbed() || isColoredLineDisplayed(),
        }}
      >
        <HotKeys
          keyMap={this.keyMap}
          handlers={this.keyHandlers}
          attach={window}
          focused={true}
        >
          <StyledApp className={outerDivClass}>
            {/* The tabindex below is required for testing. */}
            <Header>
              {!hideTopBar && (
                <>
                  <StatusWidget
                    connectionState={connectionState}
                    sessionEventDispatcher={this.sessionEventDispatcher}
                    scriptRunState={scriptRunState}
                    rerunScript={this.rerunScript}
                    stopScript={this.stopScript}
                    allowRunOnSave={allowRunOnSave}
                  />
                  <ToolbarActions
                    hostToolbarItems={
                      this.props.hostCommunication.currentState.toolbarItems
                    }
                    sendMessageToHost={
                      this.props.hostCommunication.sendMessage
                    }
                  />
                </>
              )}
              {this.showDeployButton() && (
                <DeployButton onClick={this.deployButtonClicked.bind(this)} />
              )}
              <MainMenu
                isServerConnected={this.isServerConnected()}
                quickRerunCallback={this.rerunScript}
                clearCacheCallback={this.openClearCacheDialog}
                settingsCallback={this.settingsCallback}
                aboutCallback={this.aboutCallback}
                printCallback={this.printCallback}
                screencastCallback={this.screencastCallback}
                screenCastState={this.props.screenCast.currentState}
                hostMenuItems={
                  this.props.hostCommunication.currentState.menuItems
                }
                hostIsOwner={this.props.hostCommunication.currentState.isOwner}
                sendMessageToHost={this.props.hostCommunication.sendMessage}
                gitInfo={gitInfo}
                showDeployError={this.showDeployError}
                closeDialog={this.closeDialog}
                isDeployErrorModalOpen={
                  this.state.dialog?.type === DialogType.DEPLOY_ERROR
                }
                loadGitInfo={this.sendLoadGitInfoBackMsg}
                canDeploy={this.sessionInfo.isSet && !this.sessionInfo.isHello}
                menuItems={menuItems}
                metricsMgr={this.metricsMgr}
              />
            </Header>

            <AppView
              endpoints={this.endpoints}
              sessionInfo={this.sessionInfo}
              sendMessageToHost={this.props.hostCommunication.sendMessage}
              elements={elements}
              scriptRunId={scriptRunId}
              scriptRunState={scriptRunState}
              widgetMgr={this.widgetMgr}
              widgetsDisabled={connectionState !== ConnectionState.CONNECTED}
              uploadClient={this.uploadClient}
              componentRegistry={this.componentRegistry}
              formsData={this.state.formsData}
              appPages={this.state.appPages}
              onPageChange={this.onPageChange}
              currentPageScriptHash={currentPageScriptHash}
              hideSidebarNav={hideSidebarNav || hostHideSidebarNav}
              pageLinkBaseUrl={
                this.props.hostCommunication.currentState.pageLinkBaseUrl
              }
            />
            {renderedDialog}
          </StyledApp>
        </HotKeys>
      </AppContext.Provider>
    )
  }
}

export default withHostCommunication(withScreencast(App))
