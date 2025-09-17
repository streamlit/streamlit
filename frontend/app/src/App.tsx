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

import React, { PureComponent, ReactNode } from "react"

import classNames from "classnames"
import { enableMapSet, enablePatches } from "immer"
import without from "lodash/without"
import { getLogger } from "loglevel"
import moment from "moment"
import { flushSync } from "react-dom"
import Hotkeys from "react-hot-keys"

import AppView from "@streamlit/app/src/components/AppView"
import DeployButton from "@streamlit/app/src/components/DeployButton"
import MainMenu from "@streamlit/app/src/components/MainMenu"
import StatusWidget from "@streamlit/app/src/components/StatusWidget"
import StreamlitContextProvider from "@streamlit/app/src/components/StreamlitContextProvider"
import {
  ConnectionErrorProps,
  DialogProps,
  ScriptCompileErrorProps,
  StreamlitDialog,
  WarningProps,
} from "@streamlit/app/src/components/StreamlitDialog"
import { DialogType } from "@streamlit/app/src/components/StreamlitDialog/constants"
import { UserSettings } from "@streamlit/app/src/components/StreamlitDialog/UserSettings"
import ToolbarActions from "@streamlit/app/src/components/ToolbarActions"
import withScreencast, {
  ScreenCastHOC,
} from "@streamlit/app/src/hocs/withScreencast/withScreencast"
import { useViewportSize } from "@streamlit/app/src/hooks/useViewportSize"
import { MetricsManager } from "@streamlit/app/src/MetricsManager"
import { SessionEventDispatcher } from "@streamlit/app/src/SessionEventDispatcher"
import { StyledApp } from "@streamlit/app/src/styled-components"
import getBrowserInfo from "@streamlit/app/src/util/getBrowserInfo"
import {
  AppConfig,
  ConnectionManager,
  ConnectionState,
  DefaultStreamlitEndpoints,
  IHostConfigResponse,
  LibConfig,
  parseUriIntoBaseParts,
  StreamlitEndpoints,
} from "@streamlit/connection"
import {
  AppRoot,
  CircularBuffer,
  ComponentRegistry,
  createFormsData,
  createPresetThemes,
  createTheme,
  CUSTOM_THEME_NAME,
  DeployedAppMetadata,
  ensureError,
  extractPageNameFromPathName,
  FileUploadClient,
  FormsData,
  generateUID,
  getCachedTheme,
  getElementId,
  getEmbeddingIdClassName,
  getHostSpecifiedTheme,
  getIFrameEnclosingApp,
  getLocaleLanguage,
  getTimezone,
  getTimezoneOffset,
  getUrl,
  handleFavicon,
  hashString,
  hasLightBackgroundColor,
  HostCommunicationManager,
  IMenuItem,
  isEmbed,
  isInChildFrame,
  isPaddingDisplayed,
  isPresetTheme,
  isScrollingHidden,
  isToolbarDisplayed,
  IToolbarItem,
  mark,
  measure,
  notUndefined,
  preserveEmbedQueryParams,
  PresetThemeName,
  ScriptRunState,
  SessionInfo,
  StreamlitMarkdown,
  ThemeConfig,
  toExportedTheme,
  toThemeInput,
  WidgetStateManager,
} from "@streamlit/lib"
import {
  AuthRedirect,
  AutoRerun,
  BackMsg,
  Config,
  CustomThemeConfig,
  Delta,
  FileURLsResponse,
  ForwardMsg,
  ForwardMsgMetadata,
  GitInfo,
  IAppPage,
  ICustomThemeConfig,
  IGitInfo,
  Initialize,
  Logo,
  Navigation,
  NewSession,
  PageConfig,
  PageInfo,
  PageNotFound,
  PageProfile,
  PagesChanged,
  ParentMessage,
  SessionEvent,
  SessionStatus,
  WidgetStates,
} from "@streamlit/protobuf"
import {
  isLocalhost,
  isNullOrUndefined,
  notNullOrUndefined,
} from "@streamlit/utils"

import { showDevelopmentOptions } from "./showDevelopmentOptions"
// Used to import fonts + responsive reboot items
import "@streamlit/app/src/assets/css/theme.scss"
import { AppNavigation, MaybeStateUpdate } from "./util/AppNavigation"
import { ThemeManager } from "./util/useThemeManager"

// vite config builds global variable PACKAGE_METADATA
declare const PACKAGE_METADATA: {
  version: string
}

export interface Props {
  screenCast: ScreenCastHOC
  theme: ThemeManager
  streamlitExecutionStartedAt: number
  isMobileViewport: boolean
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
  connectionErrorDismissed: boolean
  layout: PageConfig.Layout
  initialSidebarState: PageConfig.SidebarState
  menuItems?: PageConfig.IMenuItems | null
  allowRunOnSave: boolean
  scriptFinishedHandlers: (() => void)[]
  toolbarMode: Config.ToolbarMode
  themeHash: string
  gitInfo: IGitInfo | null
  formsData: FormsData
  hideTopBar: boolean
  hideSidebarNav: boolean
  expandSidebarNav: boolean
  navigationPosition: Navigation.Position
  appPages: IAppPage[]
  navSections: string[]
  // The hash of the current page executing
  currentPageScriptHash: string
  // In MPAv2, the main page is executed before and after the current
  // page. The main page is the script the app is started with, and the current
  // page is the dynamically loaded page-script. In MPAv1, the main page holds
  // no relevance as only one page loads at a time.
  mainScriptHash: string
  latestRunTime: number
  fragmentIdsThisRun: Array<string>
  // host communication info
  isOwner: boolean
  hostMenuItems: IMenuItem[]
  hostToolbarItems: IToolbarItem[]
  hostHideSidebarNav: boolean
  sidebarChevronDownshift: number
  pageLinkBaseUrl: string
  queryParams: string
  deployedAppMetadata: DeployedAppMetadata
  libConfig: LibConfig
  appConfig: AppConfig
  autoReruns: NodeJS.Timeout[]
  inputsDisabled: boolean
  scriptChangedOnDisk: boolean
}

const INITIAL_SCRIPT_RUN_ID = "<null>"

export const LOG = getLogger("App")

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    streamlitDebug: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    iFrameResizer: any
    __streamlit_profiles__?: Record<
      string,
      CircularBuffer<{
        phase: "mount" | "update" | "nested-update"
        actualDuration: number
        baseDuration: number
        startTime: number
        commitTime: number
      }>
    >
  }
}

export class App extends PureComponent<Props, State> {
  private readonly endpoints: StreamlitEndpoints

  private readonly sessionInfo = new SessionInfo()

  private readonly metricsMgr = new MetricsManager(this.sessionInfo)

  private readonly sessionEventDispatcher = new SessionEventDispatcher()

  private connectionManager: ConnectionManager | null

  private readonly widgetMgr: WidgetStateManager

  private readonly hostCommunicationMgr: HostCommunicationManager

  private readonly uploadClient: FileUploadClient

  private readonly componentRegistry: ComponentRegistry

  private readonly embeddingId: string = generateUID()

  private readonly appNavigation: AppNavigation

  private isInitializingConnectionManager: boolean = true

  // Whether we have received a NewSession message after the latest rerun request.
  // This is used to ensure that we only increment the message cache run count after
  // we have received a NewSession message after the latest rerun request.
  // This will allow us to ignore finished messages from previous script runs.
  private hasReceivedNewSession: boolean = false

  public constructor(props: Props) {
    super(props)

    // Initialize immerjs
    enablePatches()
    enableMapSet()

    // Theme hashes are only created for custom theme, and the custom theme
    // may come from localStorage. We need to create the hash here to ensure
    // that the theme is correctly represented.
    let themeHash = this.createThemeHash()
    if (!isPresetTheme(props.theme.activeTheme)) {
      themeHash = this.createThemeHash(
        toThemeInput(props.theme.activeTheme.emotion) as CustomThemeConfig
      )
    }

    this.state = {
      connectionState: ConnectionState.INITIAL,
      elements: AppRoot.empty("", true), // Blank Main Script Hash for initial render
      isFullScreen: false,
      scriptName: "",
      scriptRunId: INITIAL_SCRIPT_RUN_ID,
      appHash: null,
      scriptRunState: ScriptRunState.NOT_RUNNING,
      userSettings: {
        wideMode: false,
        runOnSave: false,
      },
      connectionErrorDismissed: false,
      layout: PageConfig.Layout.CENTERED,
      initialSidebarState: PageConfig.SidebarState.AUTO,
      menuItems: undefined,
      allowRunOnSave: true,
      scriptFinishedHandlers: [],
      themeHash,
      gitInfo: null,
      formsData: createFormsData(),
      appPages: [],
      navSections: [],
      currentPageScriptHash: "",
      mainScriptHash: "",
      // We set hideTopBar to true by default because this information isn't
      // available on page load (we get it when the script begins to run), so
      // the user would see top bar elements for a few ms if this defaulted to
      // false. hideSidebarNav doesn't have this issue (app pages and the value
      // of the config option are received simultaneously), but we set it to
      // true as well for consistency.
      hideTopBar: true,
      hideSidebarNav: true,
      expandSidebarNav: false,
      toolbarMode: Config.ToolbarMode.MINIMAL,
      latestRunTime: performance.now(),
      fragmentIdsThisRun: [],
      // Information sent from the host
      isOwner: false,
      hostMenuItems: [],
      hostToolbarItems: [],
      hostHideSidebarNav: false,
      sidebarChevronDownshift: 0,
      pageLinkBaseUrl: "",
      queryParams: "",
      deployedAppMetadata: {},
      libConfig: {},
      appConfig: {},
      autoReruns: [],
      inputsDisabled: false,
      navigationPosition: Navigation.Position.SIDEBAR,
      scriptChangedOnDisk: false,
    }

    this.connectionManager = null

    this.widgetMgr = new WidgetStateManager({
      sendRerunBackMsg: this.sendRerunBackMsg,
      formsDataChanged: formsData => this.setState({ formsData }),
    })

    this.hostCommunicationMgr = new HostCommunicationManager({
      streamlitExecutionStartedAt: props.streamlitExecutionStartedAt,
      sendRerunBackMsg: this.sendRerunBackMsg,
      closeModal: this.closeDialog,
      stopScript: this.stopScript,
      rerunScript: this.rerunScript,
      clearCache: this.clearCache,
      sendAppHeartbeat: this.sendAppHeartbeat,
      setInputsDisabled: inputsDisabled => {
        this.setState({ inputsDisabled })
      },
      themeChanged: this.handleThemeMessage,
      pageChanged: this.onPageChange,
      isOwnerChanged: isOwner => this.setState({ isOwner }),
      fileUploadClientConfigChanged: config => {
        if (this.endpoints.setFileUploadClientConfig !== undefined) {
          this.endpoints.setFileUploadClientConfig(config)
        }
      },
      hostMenuItemsChanged: hostMenuItems => {
        this.setState({ hostMenuItems })
      },
      hostToolbarItemsChanged: hostToolbarItems => {
        this.setState({ hostToolbarItems })
      },
      hostHideSidebarNavChanged: hostHideSidebarNav => {
        this.setState({ hostHideSidebarNav })
      },
      sidebarChevronDownshiftChanged: sidebarChevronDownshift => {
        this.setState({ sidebarChevronDownshift })
      },
      pageLinkBaseUrlChanged: pageLinkBaseUrl => {
        this.setState({ pageLinkBaseUrl })
      },
      queryParamsChanged: queryParams => {
        this.setState({ queryParams })
      },
      deployedAppMetadataChanged: deployedAppMetadata => {
        this.setState({ deployedAppMetadata })
      },
      restartWebsocketConnection: () => {
        if (!this.connectionManager) {
          // Performing an intentional restart - we want the script to rerun on load
          // so setting RERUN_REQUESTED so handleConnectionStateChanged triggers it
          this.setState({ scriptRunState: ScriptRunState.RERUN_REQUESTED })
          this.initializeConnectionManager()
        }
      },
      terminateWebsocketConnection: () => {
        this.connectionManager?.disconnect()
        this.connectionManager = null
      },
    })

    this.endpoints = new DefaultStreamlitEndpoints({
      getServerUri: this.getBaseUriParts,
      csrfEnabled: true,
      sendClientError: (
        component: string,
        error: string | number,
        message: string,
        source: string,
        customComponentName?: string
      ) => {
        this.hostCommunicationMgr.sendMessageToHost({
          type: "CLIENT_ERROR",
          component,
          error,
          message,
          source,
          customComponentName,
        })
      },
    })

    this.uploadClient = new FileUploadClient({
      sessionInfo: this.sessionInfo,
      endpoints: this.endpoints,
      // A form cannot be submitted if it contains a FileUploader widget
      // that's currently uploading. We write that state here, in response
      // to a FileUploadClient callback. The FormSubmitButton element
      // reads the state.
      formsWithPendingRequestsChanged: formIds =>
        this.widgetMgr.setFormsWithUploadsInProgress(formIds),
      requestFileURLs: this.requestFileURLs,
    })

    this.componentRegistry = new ComponentRegistry(this.endpoints)

    this.appNavigation = new AppNavigation(
      this.hostCommunicationMgr,
      this.maybeUpdatePageUrl,
      this.onPageNotFound,
      this.onPageIconChanged
    )

    window.streamlitDebug = {
      clearForwardMsgCache: this.debugClearForwardMsgCache,
      disconnectWebsocket: this.debugDisconnectWebsocket,
      shutdownRuntime: this.debugShutdownRuntime,
    }
  }

  initializeConnectionManager(): void {
    this.isInitializingConnectionManager = true

    this.connectionManager = new ConnectionManager({
      getLastSessionId: () => this.sessionInfo.last?.sessionId,
      endpoints: this.endpoints,
      onMessage: this.handleMessage,
      onConnectionError: this.handleConnectionError,
      connectionStateChanged: this.handleConnectionStateChanged,
      claimHostAuthToken: this.hostCommunicationMgr.claimAuthToken,
      resetHostAuthToken: this.hostCommunicationMgr.resetAuthToken,
      sendClientError: (
        error: string | number,
        message: string,
        source: string
      ) => {
        this.hostCommunicationMgr.sendMessageToHost({
          type: "CLIENT_ERROR",
          component: "Websocket Connection",
          error,
          message,
          source,
        })
      },
      onHostConfigResp: (response: IHostConfigResponse) => {
        const {
          allowedOrigins,
          useExternalAuthToken,
          disableFullscreenMode,
          enableCustomParentMessages,
          mapboxToken,
          enforceDownloadInNewTab,
          metricsUrl,
          blockErrorDialogs,
          setAnonymousCrossOriginPropertyOnMediaElements,
          resourceCrossOriginMode,
        } = response

        const appConfig: AppConfig = {
          allowedOrigins,
          useExternalAuthToken,
          enableCustomParentMessages,
          blockErrorDialogs,
        }

        const libConfig: LibConfig = {
          mapboxToken,
          disableFullscreenMode,
          enforceDownloadInNewTab,
          resourceCrossOriginMode:
            (resourceCrossOriginMode ??
            setAnonymousCrossOriginPropertyOnMediaElements)
              ? "anonymous"
              : undefined,
        }

        // Set the metrics configuration:
        this.metricsMgr.setMetricsConfig(metricsUrl)
        // Set the allowed origins configuration for the host communication:
        this.hostCommunicationMgr.setAllowedOrigins(appConfig)
        // Set the streamlit-app specific config settings in AppContext:
        this.setAppConfig(appConfig)
        // Set the streamlit-lib specific config settings in LibContext:
        this.setLibConfig(libConfig)
      },
    })

    this.isInitializingConnectionManager = false
  }

  override componentDidMount(): void {
    // Initialize connection manager here, to avoid
    // "Can't call setState on a component that is not yet mounted." error.
    this.initializeConnectionManager()

    mark(this.state.scriptRunState)
    this.hostCommunicationMgr.sendMessageToHost({
      type: "SCRIPT_RUN_STATE_CHANGED",
      scriptRunState: this.state.scriptRunState,
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
            // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Existing usage
            Math.ceil(el.getBoundingClientRect().bottom)
          )

          // The higher the value, the further down the page it is.
          // Use maximum value to get the lowest of all tagged elements.
          return Math.max(0, ...lowestBounds)
        },
      }

      // @ts-expect-error
      void import("iframe-resizer/js/iframeResizer.contentWindow")
    }

    this.hostCommunicationMgr.sendMessageToHost({
      type: "SET_THEME_CONFIG",
      themeInfo: toExportedTheme(this.props.theme.activeTheme.emotion),
    })

    this.metricsMgr.enqueue("viewReport")

    window.addEventListener("popstate", this.onHistoryChange, false)
  }

  override componentDidUpdate(
    _prevProps: Readonly<Props>,
    prevState: Readonly<State>
  ): void {
    // @ts-expect-error
    if (window.prerenderReady === false && this.isAppInReadyState(prevState)) {
      // @ts-expect-error
      window.prerenderReady = true
    }
    if (this.state.scriptRunState !== prevState.scriptRunState) {
      mark(this.state.scriptRunState)

      if (this.state.scriptRunState === ScriptRunState.NOT_RUNNING) {
        try {
          measure(
            "script-run-cycle",
            ScriptRunState.RUNNING,
            ScriptRunState.NOT_RUNNING
          )
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
          // It's okay if this fails, the `measure` call is for debugging/profiling
        }
      }

      this.hostCommunicationMgr.sendMessageToHost({
        type: "SCRIPT_RUN_STATE_CHANGED",
        scriptRunState: this.state.scriptRunState,
      })
    }
  }

  override componentWillUnmount(): void {
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

    this.hostCommunicationMgr.closeHostCommunication()

    window.removeEventListener("popstate", this.onHistoryChange, false)
  }

  /**
   * Checks whether to show error dialog or send error info
   * to be handled by the host.
   */
  maybeShowErrorDialog(
    newDialog: WarningProps | ConnectionErrorProps | ScriptCompileErrorProps,
    errorMsg: string
  ): void {
    // Show dialog only if blockErrorDialogs host config is false
    const { blockErrorDialogs } = this.state.appConfig
    if (!blockErrorDialogs) {
      this.openDialog(newDialog)
    }

    const isScriptCompileError =
      newDialog.type === DialogType.SCRIPT_COMPILE_ERROR
    // script compile error has no title
    const error = isScriptCompileError ? newDialog.type : newDialog.title

    // Send error info to host via postMessage
    this.hostCommunicationMgr.sendMessageToHost({
      type: "CLIENT_ERROR_DIALOG",
      error,
      message: errorMsg,
    })
  }

  showError(
    title: string,
    errorMarkdown: string,
    dialogType:
      | DialogType.WARNING
      | DialogType.CONNECTION_ERROR = DialogType.WARNING
  ): void {
    LOG.error(errorMarkdown)
    const newDialog: WarningProps | ConnectionErrorProps = {
      type: dialogType,
      title,
      msg: <StreamlitMarkdown source={errorMarkdown} allowHTML={false} />,
      onClose: () => {},
    }
    this.maybeShowErrorDialog(newDialog, errorMarkdown)
  }

  showDeployError = (
    title: string,
    errorNode: ReactNode,
    onContinue?: () => void
  ): void => {
    const newDialog: DialogProps = {
      type: DialogType.DEPLOY_ERROR,
      title,
      msg: errorNode,
      onContinue,
      onClose: () => {},
      onTryAgain: this.sendLoadGitInfoBackMsg,
    }
    this.openDialog(newDialog)
  }

  /**
   * Checks if the code version from the backend is different than the frontend
   */
  private hasStreamlitVersionChanged(initializeMsg: Initialize): boolean {
    let currentStreamlitVersion: string | undefined = undefined

    if (
      window.__streamlit
        ?.ENABLE_RELOAD_BASED_ON_HARDCODED_STREAMLIT_VERSION === true
    ) {
      currentStreamlitVersion = PACKAGE_METADATA.version
    } else if (this.sessionInfo.isSet) {
      currentStreamlitVersion = this.sessionInfo.current.streamlitVersion
    }

    if (currentStreamlitVersion) {
      const { environmentInfo } = initializeMsg

      if (
        notNullOrUndefined(environmentInfo) &&
        notNullOrUndefined(environmentInfo.streamlitVersion)
      ) {
        return currentStreamlitVersion != environmentInfo.streamlitVersion
      }
    }

    return false
  }

  /**
   * Handles theme changes from host communication.
   */
  handleThemeMessage = (
    themeName?: PresetThemeName,
    theme?: ICustomThemeConfig
  ): void => {
    const [, lightTheme, darkTheme] = createPresetThemes()
    const isUsingPresetTheme = isPresetTheme(this.props.theme.activeTheme)

    if (themeName === lightTheme.name && isUsingPresetTheme) {
      this.props.theme.setTheme(lightTheme)
    } else if (themeName === darkTheme.name && isUsingPresetTheme) {
      this.props.theme.setTheme(darkTheme)
    } else if (theme) {
      this.props.theme.setImportedTheme(theme)
    }
  }
  /**
   * Called by ConnectionManager when our connection state changes
   */
  handleConnectionStateChanged = (newState: ConnectionState): void => {
    LOG.info(
      `Connection state changed from ${this.state.connectionState} to ${newState}`
    )

    if (newState === ConnectionState.CONNECTED) {
      LOG.info("Reconnected to server.")
      // Reset the connection error dismissed state when we reconnect
      if (this.state.connectionErrorDismissed) {
        this.setState({ connectionErrorDismissed: false })
      }

      // We request a script rerun if:
      //   1. this is the first time we establish a websocket connection to the
      //      server, or
      //   2. our last script run attempt was interrupted by the websocket
      //      connection dropping, or
      //   3. the host explicitly requested a reconnect (we trigger scriptRunState to be RERUN_REQUESTED)
      //   4. there is an indication that the script is using fragments (fragments in last run or auto-rerun),
      //      which might need a rerun to be reinitialized if a new app session got created.

      const lastRunWasInterrupted =
        this.state.scriptRunState === ScriptRunState.RUNNING
      const wasRerunRequested =
        this.state.scriptRunState === ScriptRunState.RERUN_REQUESTED

      if (
        !this.sessionInfo.last ||
        lastRunWasInterrupted ||
        wasRerunRequested ||
        // Script is using fragments (fragments in last run or
        // fragment auto-reruns configured):
        this.state.fragmentIdsThisRun.length > 0 ||
        this.state.autoReruns.length > 0
      ) {
        LOG.info("Requesting a script run.")
        this.widgetMgr.sendUpdateWidgetsMessage(undefined)
        this.setState({ dialog: null })
      } else if (this.state.dialog?.type === DialogType.CONNECTION_ERROR) {
        // Rescind the "Connection error" dialog if currently shown.
        this.setState({ dialog: null })
      }

      this.hostCommunicationMgr.sendMessageToHost({
        type: "WEBSOCKET_CONNECTED",
      })
    } else {
      // If we're starting from the CONNECTED state and going to any other
      // state, we must be disconnecting.
      if (this.state.connectionState === ConnectionState.CONNECTED) {
        this.hostCommunicationMgr.sendMessageToHost({
          type: "WEBSOCKET_DISCONNECTED",
          attemptingToReconnect:
            newState !== ConnectionState.DISCONNECTED_FOREVER,
        })
      }

      if (this.sessionInfo.isSet) {
        this.sessionInfo.disconnect()
      }
    }

    if (this.isInitializingConnectionManager) {
      // If we use `flushSync` while the component is mounting, we will see a warning about
      // "Warning: flushSync was called from inside a lifecycle method."
      // The setState will be applied in the expected render cycle in this case.
      this.setState({ connectionState: newState })
    } else {
      /* eslint-disable-next-line @eslint-react/dom/no-flush-sync --
       * We are using `flushSync` here because there is code that expects every
       * state to be observed. With React batched updates, it is possible that
       * multiple `connectionState` changes are applied in 1 render cycle, leading
       * to the last state change being the only one observed. Utilizing
       * `flushSync` ensures that we apply every state change.
       */
      flushSync(() => {
        this.setState({ connectionState: newState })
      })
    }
  }

  handleGitInfoChanged = (gitInfo: IGitInfo): void => {
    this.setState({
      gitInfo,
    })
  }

  handleCustomParentMessage = (parentMessage: ParentMessage): void => {
    if (this.state.appConfig.enableCustomParentMessages) {
      this.hostCommunicationMgr.sendMessageToHost({
        type: "CUSTOM_PARENT_MESSAGE",
        message: parentMessage.message,
      })
    } else {
      LOG.error(
        "Sending messages to the host is disabled in line with the platform policy."
      )
    }
  }

  /**
   * Callback when we get a message from the server.
   */
  handleMessage = (msgProto: ForwardMsg): void => {
    // We don't have an immutableProto here, so we can't use
    // the dispatchOneOf helper
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
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
        // Deprecated protobuf option as navigation will always inform us of pages
        pagesChanged: (_pagesChangedMsg: PagesChanged) => {},
        pageNotFound: (pageNotFound: PageNotFound) =>
          this.handlePageNotFound(pageNotFound),
        gitInfoChanged: (gitInfo: GitInfo) =>
          this.handleGitInfoChanged(gitInfo),
        scriptFinished: (status: ForwardMsg.ScriptFinishedStatus) =>
          this.handleScriptFinished(status),
        pageProfile: (pageProfile: PageProfile) =>
          this.handlePageProfileMsg(pageProfile),
        autoRerun: (autoRerun: AutoRerun) => this.handleAutoRerun(autoRerun),
        fileUrlsResponse: (fileURLsResponse: FileURLsResponse) =>
          this.uploadClient.onFileURLsResponse(fileURLsResponse),
        parentMessage: (parentMessage: ParentMessage) =>
          this.handleCustomParentMessage(parentMessage),
        logo: (logo: Logo) =>
          this.handleLogo(logo, msgProto.metadata as ForwardMsgMetadata),
        navigation: (navigation: Navigation) =>
          this.handleNavigation(navigation),
        authRedirect: (authRedirect: AuthRedirect) => {
          if (isInChildFrame()) {
            this.hostCommunicationMgr.sendMessageToSameOriginHost({
              type: "REDIRECT_TO_URL",
              url: authRedirect.url,
            })
          } else {
            window.location.href = authRedirect.url
          }
        },
      })
    } catch (e) {
      const err = ensureError(e)
      LOG.error(err)
      this.showError("Bad message format", err.message)
    }
  }

  handleLogo = (logo: Logo, metadata: ForwardMsgMetadata): void => {
    this.setState(prevState => {
      return {
        elements: prevState.elements.appRootWithLogo(logo, {
          // Pass the current page & run ID for cleanup
          activeScriptHash: metadata.activeScriptHash,
          scriptRunId: prevState.scriptRunId,
        }),
      }
    })
  }

  handlePageConfigChanged = (pageConfig: PageConfig): void => {
    const { title, favicon, layout, initialSidebarState, menuItems } =
      pageConfig

    this.appNavigation.handlePageConfigChanged(pageConfig)

    if (title) {
      this.hostCommunicationMgr.sendMessageToHost({
        type: "SET_PAGE_TITLE",
        title,
      })

      document.title = title
    }

    if (favicon) {
      this.onPageIconChanged(favicon)
    }

    // Only change layout/sidebar when the page config has changed.
    // This preserves the user's previous choice/default, and prevents extra re-renders.
    if (
      layout !== this.state.layout &&
      layout !== PageConfig.Layout.LAYOUT_UNSET
    ) {
      this.setState((prevState: State) => ({
        layout,
        userSettings: {
          ...prevState.userSettings,
          wideMode: layout === PageConfig.Layout.WIDE,
        },
      }))
    }

    if (
      initialSidebarState !== this.state.initialSidebarState &&
      initialSidebarState !== PageConfig.SidebarState.SIDEBAR_UNSET
    ) {
      this.setState(() => ({
        initialSidebarState,
      }))
    }

    // Check if menu items defined to prevent unnecessary state updates.
    if (menuItems) {
      // Now that we allow multiple set page config calls, menu items are additive
      // for behavior consistency with other page config properties.
      this.setState((prevState: State) => {
        if (menuItems.clearAboutMd) {
          menuItems.aboutSectionMd = ""
        }
        return {
          menuItems: { ...prevState.menuItems, ...menuItems },
        }
      })
    }
  }

  handlePageInfoChanged = (pageInfo: PageInfo): void => {
    const { queryString } = pageInfo
    const targetUrl =
      document.location.pathname + (queryString ? `?${queryString}` : "")
    window.history.pushState({}, "", targetUrl)

    this.hostCommunicationMgr.sendMessageToHost({
      type: "SET_QUERY_PARAM",
      queryParams: queryString ? `?${queryString}` : "",
    })
  }

  onPageNotFound = (pageName?: string): void => {
    const errMsg = pageName
      ? `You have requested page /${pageName}, but no corresponding file was found in the app's pages/ directory`
      : "The page that you have requested does not seem to exist"
    this.showError("Page not found", `${errMsg}. Running the app's main page.`)
  }

  handlePageNotFound = (pageNotFound: PageNotFound): void => {
    const { pageName } = pageNotFound
    this.maybeSetState(this.appNavigation.handlePageNotFound(pageName))
  }

  onPageIconChanged = (iconUrl: string): void => {
    handleFavicon(
      iconUrl,
      this.hostCommunicationMgr.sendMessageToHost,
      this.endpoints
    )
  }

  handleNavigation = (navigation: Navigation): void => {
    this.setState({ navigationPosition: navigation.position })
    this.maybeSetState(this.appNavigation.handleNavigation(navigation))
  }

  handlePageProfileMsg = (pageProfile: PageProfile): void => {
    const pageProfileObj = PageProfile.toObject(pageProfile)
    const browserInfo = getBrowserInfo()

    this.metricsMgr.enqueue("pageProfile", {
      ...pageProfileObj,
      isFragmentRun: Boolean(pageProfileObj.isFragmentRun),
      numPages: this.state.appPages?.length,
      pageScriptHash: this.state.currentPageScriptHash,
      activeTheme: this.props.theme?.activeTheme?.name,
      totalLoadTime: Math.round(
        (performance.now() - this.state.latestRunTime) * 1000
      ),
      browserInfo,
    })
  }

  handleAutoRerun = (autoRerun: AutoRerun): void => {
    const intervalId = setInterval(() => {
      this.widgetMgr.sendUpdateWidgetsMessage(autoRerun.fragmentId, true)
    }, autoRerun.interval * 1000)

    this.setState((prevState: State) => {
      return {
        autoReruns: [...prevState.autoReruns, intervalId],
      }
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
          notNullOrUndefined(dialog) &&
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
      }

      return {
        userSettings: {
          ...prevState.userSettings,
          runOnSave: Boolean(statusChangeProto.runOnSave),
        },
        dialog,
        scriptRunState,
        // Reset scriptChangedOnDisk when script starts running
        scriptChangedOnDisk: statusChangeProto.scriptIsRunning
          ? false
          : prevState.scriptChangedOnDisk,
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
      this.maybeShowErrorDialog(
        newDialog,
        sessionEvent.scriptCompilationException?.message ?? "No message"
      )
    } else if (sessionEvent.type === "scriptChangedOnDisk") {
      this.setState({ scriptChangedOnDisk: true })
    }
  }

  /**
   * Updates the page url if the page has changed
   * @param mainPageName the name of the main page
   * @param newPageName the name of the new page
   * @param isViewingMainPage whether the user is viewing the main page
   */
  maybeUpdatePageUrl = (
    mainPageName: string,
    newPageName: string,
    isViewingMainPage: boolean
  ): void => {
    const baseUriParts = this.getBaseUriParts()

    if (baseUriParts) {
      let pathname
      if (window.__streamlit?.MAIN_PAGE_BASE_URL) {
        pathname = parseUriIntoBaseParts(
          window.__streamlit.MAIN_PAGE_BASE_URL
        ).pathname
      } else {
        pathname = baseUriParts.pathname
      }

      const prevPageNameInPath = extractPageNameFromPathName(
        document.location.pathname,
        pathname
      )
      const prevPageName =
        prevPageNameInPath === "" ? mainPageName : prevPageNameInPath
      // It is important to compare `newPageName` with the previous one encoded in the URL
      // to handle new session runs triggered by URL changes through the `onHistoryChange()` callback,
      // e.g. the case where the user clicks the back button.
      // See https://github.com/streamlit/streamlit/pull/6271#issuecomment-1465090690 for the discussion.
      if (prevPageName !== newPageName) {
        const pagePath = isViewingMainPage ? "" : newPageName
        const queryString = preserveEmbedQueryParams()
        const qs = queryString ? `?${queryString}` : ""

        const basePathPrefix = pathname === "/" ? "" : pathname

        const pageUrl = `${basePathPrefix}/${pagePath}${qs}`

        window.history.pushState({}, "", pageUrl)
      }
    }
  }

  maybeSetState(stateUpdate: MaybeStateUpdate): void {
    if (stateUpdate) {
      const [newState, callback] = stateUpdate

      this.setState(newState as State, callback)
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

    // Set this flag to indicate that we have received a NewSession message
    // after the latest rerun request:
    this.hasReceivedNewSession = true

    // First, handle initialization logic. Each NewSession message has
    // initialization data. If this is the _first_ time we're receiving
    // the NewSession message (or the first time since disconnect), we
    // perform some one-time initialization.
    if (!this.sessionInfo.isSet || !this.sessionInfo.current.isConnected) {
      // We're not initialized (this is our first time, or we are reconnected)
      this.handleInitialization(newSessionProto)
    }

    const { appHash, currentPageScriptHash: prevPageScriptHash } = this.state
    const {
      scriptRunId,
      name: scriptName,
      mainScriptPath,
      fragmentIdsThisRun,
      pageScriptHash: newPageScriptHash,
      mainScriptHash,
    } = newSessionProto

    if (!fragmentIdsThisRun.length) {
      // This is a normal rerun, remove all the auto reruns intervals
      this.cleanupAutoReruns()

      const config = newSessionProto.config as Config
      const themeInput = newSessionProto.customTheme as CustomThemeConfig

      this.processThemeInput(themeInput)
      this.setState({
        allowRunOnSave: config.allowRunOnSave,
        hideTopBar: config.hideTopBar,
        toolbarMode: config.toolbarMode,
        latestRunTime: performance.now(),
        mainScriptHash,
        // If we're here, the fragmentIdsThisRun variable is always the
        // empty array.
        fragmentIdsThisRun,
      })
      this.maybeSetState(this.appNavigation.handleNewSession(newSessionProto))

      // Set the favicon to its default values
      this.onPageIconChanged(`${import.meta.env.BASE_URL}favicon.png`)
    } else {
      this.setState({
        fragmentIdsThisRun,
        latestRunTime: performance.now(),
      })
    }

    const newSessionHash = hashString(
      this.sessionInfo.current.installationId + mainScriptPath
    )

    this.metricsMgr.setMetadata(this.state.deployedAppMetadata)
    this.metricsMgr.setAppHash(newSessionHash)

    this.metricsMgr.enqueue("updateReport")

    if (
      appHash === newSessionHash &&
      prevPageScriptHash === newPageScriptHash
    ) {
      this.setState({
        scriptRunId,
      })
    } else {
      this.clearAppState(
        newSessionHash,
        scriptRunId,
        scriptName,
        mainScriptHash
      )
    }
  }

  /**
   * Performs initialization based on first connection and reconnection.
   * This is called from `handleNewSession`.
   */
  handleInitialization = (newSessionProto: NewSession): void => {
    const initialize = newSessionProto.initialize as Initialize
    const config = newSessionProto.config as Config

    this.sessionInfo.setCurrent(
      SessionInfo.propsFromNewSessionMessage(newSessionProto)
    )

    // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
    this.metricsMgr.initialize({
      gatherUsageStats: config.gatherUsageStats,
      sendMessageToHost: this.hostCommunicationMgr.sendMessageToHost,
    })

    // Protobuf typing cannot handle complex types, so we need to cast to what
    // we know it should be
    this.handleSessionStatusChanged(initialize.sessionStatus as SessionStatus)
  }

  /**
   * Handler called when the history state changes, e.g. `popstate` event.
   */
  onHistoryChange = (): void => {
    const { currentPageScriptHash } = this.state
    const targetAppPage = this.appNavigation.findPageByUrlPath(
      document.location.pathname
    )

    // do not cause a rerun when an anchor is clicked and we aren't changing pages
    const hasAnchor = document.location.toString().includes("#")
    const isSamePage = targetAppPage?.pageScriptHash === currentPageScriptHash

    if (isNullOrUndefined(targetAppPage) || (hasAnchor && isSamePage)) {
      return
    }
    this.onPageChange(targetAppPage.pageScriptHash as string)
  }

  /**
   * Both sets the given theme locally and sends it to the host.
   */
  setAndSendTheme = (themeConfig: ThemeConfig): void => {
    this.props.theme.setTheme(themeConfig)
    this.hostCommunicationMgr.sendMessageToHost({
      type: "SET_THEME_CONFIG",
      themeInfo: toExportedTheme(themeConfig.emotion),
    })
  }

  createThemeHash = (themeInput?: CustomThemeConfig): string => {
    if (!themeInput) {
      // If themeInput is null, then we didn't receive a custom theme for this
      // app from the server. We use a hardcoded string literal for the
      // themeHash in this case.
      return "hash_for_undefined_custom_theme"
    }

    // Hash the sorted representation of the theme input:
    return hashString(
      JSON.stringify(themeInput, Object.keys(themeInput).sort())
    )
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
        // Reset to the auto theme taking into account any host preferences
        // aka embed query params.
        this.setAndSendTheme(getHostSpecifiedTheme())
      }
    }

    if (
      (themeInput?.fontFaces && themeInput.fontFaces.length > 0) ||
      (themeInput?.fontSources && themeInput.fontSources.length > 0)
    ) {
      // If font faces or font sources are provided, we need to set the imported
      // theme with the theme manager to make the fonts available.
      this.props.theme.setImportedTheme(themeInput)
    }
  }

  /**
   * Handler for ForwardMsg.scriptFinished messages
   * @param status the ScriptFinishedStatus that the script finished with
   */
  handleScriptFinished(status: ForwardMsg.ScriptFinishedStatus): void {
    if (
      status === ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY ||
      status === ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN ||
      status ===
        ForwardMsg.ScriptFinishedStatus.FINISHED_FRAGMENT_RUN_SUCCESSFULLY
    ) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- TODO: Fix this
      Promise.resolve().then(() => {
        // Notify any subscribers of this event (and do it on the next cycle of
        // the event loop)
        this.state.scriptFinishedHandlers.forEach(handler => handler())
      })

      if (
        status === ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY ||
        status ===
          ForwardMsg.ScriptFinishedStatus.FINISHED_FRAGMENT_RUN_SUCCESSFULLY
      ) {
        // Clear any stale elements left over from the previous run.
        // We only do that for completed runs, not for runs that were finished early
        // due to reruns; this is to avoid flickering of elements where they disappear for
        // a moment and then are readded by a new session. After the new session finished,
        // leftover elements will be cleared after finished successfully.
        // We also don't do this if our script had a compilation error and didn't
        // finish successfully.
        this.setState(
          ({ scriptRunId, fragmentIdsThisRun, elements }) => {
            return {
              // Apply any pending elements that haven't been applied.
              elements: elements.clearStaleNodes(
                scriptRunId,
                fragmentIdsThisRun
              ),
            }
          },
          () => {
            // Tell the WidgetManager which widgets still exist. It will remove
            // widget state for widgets that have been removed.
            const activeWidgetIds = new Set(
              // TODO: Update to match React best practices
              // eslint-disable-next-line @eslint-react/no-access-state-in-setstate
              Array.from(this.state.elements.getElements())
                .map(element => getElementId(element))
                .filter(notUndefined)
            )
            this.widgetMgr.removeInactive(activeWidgetIds)
          }
        )
      }

      // Tell the ConnectionManager to increment the message cache run
      // count. This will result in expired ForwardMsgs being removed from
      // the cache. We expect the sessionInfo to be populated at this point,
      // but we have observed race conditions tied to a rerun occurring
      // before a NewSession message is processed. This issue should not
      // disrupt users and is not a critical need for the message cache
      if (
        this.connectionManager !== null &&
        status !== ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN &&
        this.sessionInfo.isSet &&
        // We only increment the message cache run count if we have received
        // a NewSession message after the latest rerun request. This is done
        // to ignore finished messages from previous script runs, which would
        // cause issues with deleting cached messages that are needed for the
        // current script run.
        this.hasReceivedNewSession
      ) {
        this.connectionManager.incrementMessageCacheRunCount(
          this.sessionInfo.current.maxCachedMessageAge,
          this.state.fragmentIdsThisRun
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
    scriptName: string,
    mainScriptHash: string
  ): void {
    this.setState(
      prevState => {
        const nextElements = this.appNavigation.clearPageElements(
          prevState.elements,
          mainScriptHash
        )

        return {
          scriptRunId,
          scriptName,
          appHash,
          elements: nextElements,
        }
      },
      () => {
        const activeWidgetIds = new Set(
          // TODO: Update to match React best practices
          // eslint-disable-next-line @eslint-react/no-access-state-in-setstate
          Array.from(this.state.elements.getElements())
            .map(element => getElementId(element))
            .filter(notUndefined)
        )
        this.widgetMgr.removeInactive(activeWidgetIds)
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
    // If we're closing a connection error dialog, mark it as dismissed
    if (this.state.dialog?.type === DialogType.CONNECTION_ERROR) {
      this.setState({
        dialog: undefined,
        connectionErrorDismissed: true,
      })
    } else {
      this.setState({ dialog: undefined })
    }
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
    // Use functional state update to ensure we have latest elements
    this.setState(prevState => ({
      elements: prevState.elements.applyDelta(
        prevState.scriptRunId,
        deltaMsg,
        metadataMsg
      ),
    }))
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
    this.connectionManager?.websocketConnection?.cache.messages.clear()
  }

  /**
   * Clear all auto reruns that were registered. This should be called whenever
   * the content of the auto rerun function might not be valid anymore and could
   * lead to issues, e.g. when a new full app-rerun session is started or the active page changed.
   */
  cleanupAutoReruns = (): void => {
    this.state.autoReruns.forEach((value: NodeJS.Timeout) => {
      clearInterval(value)
    })
    this.setState({ autoReruns: [] })
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
      LOG.error("Cannot rerun script when disconnected from server.")
      return
    }

    if (
      this.state.scriptRunState === ScriptRunState.RUNNING ||
      this.state.scriptRunState === ScriptRunState.RERUN_REQUESTED
    ) {
      // Don't queue up multiple rerunScript requests
      return
    }

    this.setState({ scriptRunState: ScriptRunState.RERUN_REQUESTED })

    // Note: `rerunScript` is incorrectly called in some places.
    // We can remove `=== true` after adding type information
    if (alwaysRunOnSave === true) {
      // Update our run-on-save setting *before* calling rerunScript.
      // The rerunScript message currently blocks all BackMsgs from
      // being processed until the script has completed executing.
      this.saveSettings({ ...this.state.userSettings, runOnSave: true })
    }

    // Trigger a full app rerun:
    this.widgetMgr.sendUpdateWidgetsMessage(undefined)
  }

  sendLoadGitInfoBackMsg = (): void => {
    if (!this.isServerConnected()) {
      LOG.error("Cannot load git information when disconnected from server.")
      return
    }

    this.sendBackMsg(
      new BackMsg({
        loadGitInfo: true,
      })
    )
  }

  onPageChange = (pageScriptHash: string): void => {
    const { elements, mainScriptHash } = this.state

    // We are about to change the page, so clear all auto reruns
    // This also happens in handleNewSession, but it might be too late compared
    // to small interval values, which might trigger a rerun before the new
    // session message is processed
    this.cleanupAutoReruns()

    // We want to keep widget states for widgets that are still active
    // from the common script
    const nextPageElements = this.appNavigation.clearPageElements(
      elements,
      mainScriptHash
    )
    const activeWidgetIds = new Set(
      Array.from(nextPageElements.getElements())
        .map(element => getElementId(element))
        .filter(notUndefined)
    )

    this.sendRerunBackMsg(
      this.widgetMgr.getActiveWidgetStates(activeWidgetIds),
      undefined,
      pageScriptHash
    )
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
    fragmentId?: string,
    pageScriptHash?: string,
    isAutoRerun?: boolean
  ): void => {
    const baseUriParts = this.getBaseUriParts()
    if (!baseUriParts) {
      // If we don't have a connectionManager or if it doesn't have an active
      // websocket connection to the server (in which case
      // connectionManager.getBaseUriParts() returns undefined), we can't send a
      // rerun backMessage so just return early.
      LOG.error("Cannot send rerun backMessage when disconnected from server.")
      return
    }

    const { currentPageScriptHash } = this.state
    let queryString = this.getQueryString()
    let pageName = ""

    const contextInfo = {
      timezone: getTimezone(),
      timezoneOffset: getTimezoneOffset(),
      locale: getLocaleLanguage(),
      url: getUrl(),
      isEmbedded: isEmbed(),
      colorScheme: this.getThemeColorScheme(),
    }

    if (pageScriptHash) {
      // The user specified exactly which page to run. We can simply use this
      // value in the BackMsg we send to the server.
      if (pageScriptHash != currentPageScriptHash) {
        // clear non-embed query parameters within a page change
        queryString = preserveEmbedQueryParams()
        this.hostCommunicationMgr.sendMessageToHost({
          type: "SET_QUERY_PARAM",
          queryParams: queryString,
        })
      }
    } else if (currentPageScriptHash) {
      // The user didn't specify which page to run, which happens when they
      // click the "Rerun" button in the main menu. In this case, we
      // rerun the current page.
      pageScriptHash = currentPageScriptHash
    } else {
      let pathname
      if (window.__streamlit?.MAIN_PAGE_BASE_URL) {
        pathname = parseUriIntoBaseParts(
          window.__streamlit.MAIN_PAGE_BASE_URL
        ).pathname
      } else {
        pathname = baseUriParts.pathname
      }

      // We must be in the case where the user is navigating directly to a
      // non-main page of this app. Since we haven't received the list of the
      // app's pages from the server at this point, we fall back to requesting
      // the page to run via pageName, which we extract from
      // document.location.pathname.
      pageName = extractPageNameFromPathName(
        document.location.pathname,
        pathname
      )
      pageScriptHash = ""
    }

    const cachedMessageHashes =
      this.connectionManager?.getCachedMessageHashes() ?? []

    this.sendBackMsg(
      new BackMsg({
        rerunScript: {
          queryString,
          widgetStates,
          pageScriptHash,
          pageName,
          fragmentId,
          isAutoRerun,
          cachedMessageHashes,
          contextInfo,
        },
      })
    )
    // Reset hasReceivedNewSession to false to ensure that we are aware
    // if a finished message is from a previous script run.
    this.hasReceivedNewSession = false
  }

  /** Requests that the server stop running the script */
  stopScript = (): void => {
    if (!this.isServerConnected()) {
      LOG.error("Cannot stop app when disconnected from server.")
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
      LOG.error("Cannot clear cache: disconnected from server")
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
      isDeployErrorModalOpen:
        this.state.dialog?.type === DialogType.DEPLOY_ERROR,
      metricsMgr: this.metricsMgr,
    }
    this.openDialog(deployDialogProps)
  }

  openThemeCreatorDialog = (): void => {
    this.metricsMgr.enqueue("menuClick", {
      label: "editTheme",
    })
    const newDialog: DialogProps = {
      type: DialogType.THEME_CREATOR,
      backToSettings: this.settingsCallback,
      onClose: this.closeDialog,
      metricsMgr: this.metricsMgr,
    }
    this.openDialog(newDialog)
  }

  /**
   * Asks the server to clear the st_cache and st_cache_data and st_cache_resource
   */
  clearCache = (): void => {
    this.closeDialog()
    if (this.isServerConnected()) {
      const backMsg = new BackMsg({ clearCache: true })
      backMsg.type = "clearCache"
      this.sendBackMsg(backMsg)
    } else {
      LOG.error("Cannot clear cache: disconnected from server")
    }
  }

  /**
   * Sends an app heartbeat message through the websocket
   */
  sendAppHeartbeat = (): void => {
    if (this.isServerConnected()) {
      const backMsg = new BackMsg({ appHeartbeat: true })
      backMsg.type = "appHeartbeat"
      this.sendBackMsg(backMsg)
    } else {
      LOG.error("Cannot send app heartbeat: disconnected from server")
    }
  }

  /**
   * Sends a message back to the server.
   */
  private sendBackMsg = (msg: BackMsg): void => {
    if (this.connectionManager) {
      LOG.info(msg)
      this.connectionManager.sendMessage(msg)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions -- TODO: Fix this
      LOG.error(`Not connected. Cannot send back message: ${msg}`)
    }
  }

  /**
   * Updates the app body when there's a connection error.
   */
  handleConnectionError = (errMarkdown: string): void => {
    // Don't show the error dialog if it has been dismissed for this session
    if (this.state.connectionErrorDismissed) {
      return
    }

    // This is just a regular error dialog, but with type CONNECTION_ERROR
    // instead of WARNING, so we can rescind the dialog later when reconnected.
    this.showError(
      "Connection error",
      errMarkdown,
      DialogType.CONNECTION_ERROR
    )
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
      sessionInfo: this.sessionInfo,
      isServerConnected: this.isServerConnected(),
      settings: this.state.userSettings,
      allowRunOnSave: this.state.allowRunOnSave,
      onSave: this.saveSettings,
      onClose: () => {},
      developerMode: showDevelopmentOptions(
        this.state.isOwner,
        this.state.toolbarMode
      ),
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
      if (htmlIFrameElement?.contentWindow) {
        windowToPrint = htmlIFrameElement.contentWindow.window
      } else {
        windowToPrint = window
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  /**
   * Set streamlit-lib specific configurations.
   */
  setLibConfig = (libConfig: LibConfig): void => {
    this.setState({ libConfig })
  }

  /**
   * Set streamlit-app specific configurations.
   */
  setAppConfig = (appConfig: AppConfig): void => {
    this.setState({ appConfig })
  }

  addScriptFinishedHandler = (func: () => void): void => {
    this.setState((prevState, _) => {
      return {
        scriptFinishedHandlers: prevState.scriptFinishedHandlers.concat(func),
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

  getBaseUriParts = (): URL | undefined =>
    this.connectionManager
      ? this.connectionManager.getBaseUriParts()
      : undefined

  getQueryString = (): string => {
    const { queryParams } = this.state

    const queryString =
      queryParams && queryParams.length > 0
        ? queryParams
        : document.location.search

    return queryString.startsWith("?") ? queryString.substring(1) : queryString
  }

  getThemeColorScheme = (): string => {
    const { activeTheme } = this.props.theme

    if (hasLightBackgroundColor(activeTheme.emotion)) {
      return "light"
    }
    return "dark"
  }

  isInCloudEnvironment = (): boolean => {
    const { hostMenuItems } = this.state
    return hostMenuItems && hostMenuItems?.length > 0
  }

  showDeployButton = (): boolean => {
    return (
      showDevelopmentOptions(this.state.isOwner, this.state.toolbarMode) &&
      !this.isInCloudEnvironment() &&
      this.sessionInfo.isSet &&
      !this.sessionInfo.isHello
    )
  }

  deployButtonClicked = (): void => {
    this.metricsMgr.enqueue("menuClick", {
      label: "deployButtonInApp",
    })
    this.sendLoadGitInfoBackMsg()
    this.openDeployDialog()
  }

  requestFileURLs = (requestId: string, files: File[]): void => {
    const isConnected = this.isServerConnected()
    const isSessionInfoSet = this.sessionInfo.isSet
    if (isConnected && isSessionInfoSet) {
      const backMsg = new BackMsg({
        fileUrlsRequest: {
          requestId,
          fileNames: files.map(f => f.name),
          sessionId: this.sessionInfo.current.sessionId,
        },
      })
      backMsg.type = "fileUrlsRequest"
      this.sendBackMsg(backMsg)
    } else {
      LOG.warn(
        `Cannot request file URLs (isServerConnected: ${isConnected}, isSessionInfoSet: ${isSessionInfoSet})`
      )
    }
  }

  handleKeyDown = (keyName: string): void => {
    switch (keyName) {
      case "c":
        // CLEAR CACHE
        if (
          showDevelopmentOptions(this.state.isOwner, this.state.toolbarMode)
        ) {
          this.openClearCacheDialog()
        }
        break
      case "r":
        // RERUN
        this.rerunScript()
        break
    }
  }

  handleKeyUp = (keyName: string): void => {
    if (keyName === "esc") {
      this.props.screenCast.stopRecording()
    }
  }

  /**
   * Checks if there are any app-defined menu items configured via st.set_page_config
   */
  private hasAppDefinedMenuItems = (): boolean => {
    const { menuItems } = this.state
    return Boolean(
      menuItems?.aboutSectionMd ||
        (menuItems?.getHelpUrl && !menuItems?.hideGetHelp) ||
        (menuItems?.reportABugUrl && !menuItems?.hideReportABug)
    )
  }

  /**
   * Determines whether the toolbar should be visible based on embed mode,
   * toolbar mode settings, and availability of host menu/toolbar items.
   */
  private shouldShowToolbar = (
    hostMenuItems: IMenuItem[],
    hostToolbarItems: IToolbarItem[]
  ): boolean => {
    // Show toolbar if not embedded or if specifically configured to display in embed mode
    const isToolbarAllowedInEmbed = !isEmbed() || isToolbarDisplayed()

    // Determine if toolbar has content to show based on toolbar mode
    let hasContentToShow: boolean
    if (this.state.toolbarMode === Config.ToolbarMode.MINIMAL) {
      // In minimal mode, only show toolbar if there are menu items to display
      hasContentToShow =
        hostMenuItems.length > 0 ||
        hostToolbarItems.length > 0 ||
        this.hasAppDefinedMenuItems()
    } else {
      // In non-minimal modes, always show the toolbar
      hasContentToShow = true
    }

    return isToolbarAllowedInEmbed && hasContentToShow
  }

  override render(): JSX.Element {
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
      hideTopBar,
      hideSidebarNav,
      expandSidebarNav,
      currentPageScriptHash,
      hostHideSidebarNav,
      pageLinkBaseUrl,
      sidebarChevronDownshift,
      hostMenuItems,
      hostToolbarItems,
      libConfig,
      inputsDisabled,
      appPages,
      navSections,
      navigationPosition,
      scriptChangedOnDisk,
    } = this.state

    // Always use sidebar navigation on mobile, regardless of the server setting
    const effectiveNavigationPosition = this.props.isMobileViewport
      ? Navigation.Position.SIDEBAR
      : navigationPosition

    const developmentMode = showDevelopmentOptions(
      this.state.isOwner,
      this.state.toolbarMode
    )

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

    // Determine toolbar visibility using helper method
    const showToolbar = this.shouldShowToolbar(hostMenuItems, hostToolbarItems)
    const showPadding = !isEmbed() || isPaddingDisplayed()
    const disableScrolling = isScrollingHidden()

    return (
      <StreamlitContextProvider
        initialSidebarState={initialSidebarState}
        pageLinkBaseUrl={pageLinkBaseUrl}
        currentPageScriptHash={currentPageScriptHash}
        onPageChange={this.onPageChange}
        navSections={navSections}
        appPages={appPages}
        appLogo={elements.logo}
        sidebarChevronDownshift={sidebarChevronDownshift}
        expandSidebarNav={expandSidebarNav}
        hideSidebarNav={hideSidebarNav || hostHideSidebarNav}
        widgetsDisabled={
          inputsDisabled || connectionState !== ConnectionState.CONNECTED
        }
        gitInfo={this.state.gitInfo}
        isFullScreen={isFullScreen}
        setFullScreen={this.handleFullScreen}
        addScriptFinishedHandler={this.addScriptFinishedHandler}
        removeScriptFinishedHandler={this.removeScriptFinishedHandler}
        activeTheme={this.props.theme.activeTheme}
        setTheme={this.setAndSendTheme}
        availableThemes={this.props.theme.availableThemes}
        addThemes={this.props.theme.addThemes}
        libConfig={libConfig}
        fragmentIdsThisRun={this.state.fragmentIdsThisRun}
        locale={window.navigator.language}
        formsData={this.state.formsData}
        scriptRunState={scriptRunState}
        scriptRunId={scriptRunId}
        componentRegistry={this.componentRegistry}
        showToolbar={showToolbar}
      >
        <Hotkeys
          keyName="r,c,esc"
          onKeyDown={this.handleKeyDown}
          onKeyUp={this.handleKeyUp}
        >
          <StyledApp
            className={outerDivClass}
            data-testid="stApp"
            data-test-script-state={
              scriptRunId == INITIAL_SCRIPT_RUN_ID ? "initial" : scriptRunState
            }
            data-test-connection-state={connectionState}
          >
            <AppView
              endpoints={this.endpoints}
              sendMessageToHost={this.hostCommunicationMgr.sendMessageToHost}
              elements={elements}
              widgetMgr={this.widgetMgr}
              uploadClient={this.uploadClient}
              appLogo={elements.logo}
              appPages={appPages}
              navSections={navSections}
              onPageChange={this.onPageChange}
              hideSidebarNav={
                hideSidebarNav ||
                hostHideSidebarNav ||
                effectiveNavigationPosition === Navigation.Position.TOP
              }
              expandSidebarNav={expandSidebarNav}
              navigationPosition={effectiveNavigationPosition}
              pageLinkBaseUrl={this.state.pageLinkBaseUrl}
              wideMode={userSettings.wideMode}
              embedded={isEmbed()}
              showPadding={showPadding}
              disableScrolling={disableScrolling}
              currentPageScriptHash={currentPageScriptHash}
              topRightContent={
                <>
                  {!hideTopBar && (
                    <StatusWidget
                      connectionState={connectionState}
                      scriptRunState={scriptRunState}
                      rerunScript={this.rerunScript}
                      stopScript={this.stopScript}
                      allowRunOnSave={allowRunOnSave}
                      showScriptChangedActions={scriptChangedOnDisk}
                    />
                  )}
                  {!hideTopBar && (
                    <ToolbarActions
                      hostToolbarItems={hostToolbarItems}
                      sendMessageToHost={
                        this.hostCommunicationMgr.sendMessageToHost
                      }
                      metricsMgr={this.metricsMgr}
                    />
                  )}
                  {this.showDeployButton() && !scriptChangedOnDisk && (
                    <DeployButton onClick={this.deployButtonClicked} />
                  )}
                  {!hideTopBar && (
                    <MainMenu
                      isServerConnected={this.isServerConnected()}
                      quickRerunCallback={this.rerunScript}
                      clearCacheCallback={this.openClearCacheDialog}
                      settingsCallback={this.settingsCallback}
                      aboutCallback={this.aboutCallback}
                      printCallback={this.printCallback}
                      screencastCallback={this.screencastCallback}
                      screenCastState={this.props.screenCast.currentState}
                      hostMenuItems={hostMenuItems}
                      developmentMode={developmentMode}
                      sendMessageToHost={
                        this.hostCommunicationMgr.sendMessageToHost
                      }
                      menuItems={menuItems}
                      metricsMgr={this.metricsMgr}
                      toolbarMode={this.state.toolbarMode}
                    />
                  )}
                </>
              }
            />
            {renderedDialog}
          </StyledApp>
        </Hotkeys>
      </StreamlitContextProvider>
    )
  }
}

const AppWithScreenCast = withScreencast(App)

// Wrapper component to handle viewport size
const AppWrapper: React.FC<
  Omit<Props, "isMobileViewport" | "screenCast">
> = props => {
  const { isMobile } = useViewportSize()
  return <AppWithScreenCast {...props} isMobileViewport={isMobile} />
}

export default AppWrapper
