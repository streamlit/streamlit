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

import React, { Fragment, PureComponent, ReactNode } from "react"
import moment from "moment"
import { HotKeys, KeyMap } from "react-hotkeys"
import { fromJS } from "immutable"
import classNames from "classnames"

// Other local imports.
import PageLayoutContext from "src/components/core/PageLayoutContext"
import ReportView from "src/components/core/ReportView"
import StatusWidget from "src/components/core/StatusWidget"
import MainMenu from "src/components/core/MainMenu"
import Header from "src/components/core/Header"
import {
  DialogProps,
  DialogType,
  StreamlitDialog,
} from "src/components/core/StreamlitDialog/"
import { ConnectionManager } from "src/lib/ConnectionManager"
import { WidgetStateManager } from "src/lib/WidgetStateManager"
import { ConnectionState } from "src/lib/ConnectionState"
import { ReportRunState } from "src/lib/ReportRunState"
import { SessionEventDispatcher } from "src/lib/SessionEventDispatcher"
import {
  setCookie,
  hashString,
  isEmbeddedInIFrame,
  notUndefined,
  getElementWidgetID,
} from "src/lib/utils"
import {
  BackMsg,
  CustomThemeConfig,
  Delta,
  ForwardMsg,
  ForwardMsgMetadata,
  Initialize,
  NewReport,
  IDeployParams,
  PageConfig,
  PageInfo,
  SessionEvent,
  WidgetStates,
  SessionState,
  Config,
} from "src/autogen/proto"
import { without, concat } from "lodash"

import { RERUN_PROMPT_MODAL_DIALOG } from "src/lib/baseconsts"
import { SessionInfo } from "src/lib/SessionInfo"
import { MetricsManager } from "src/lib/MetricsManager"
import { FileUploadClient } from "src/lib/FileUploadClient"
import { logError, logMessage } from "src/lib/log"
import { ReportRoot } from "src/lib/ReportNode"

import { UserSettings } from "src/components/core/StreamlitDialog/UserSettings"
import { ComponentRegistry } from "src/components/widgets/CustomComponent"
import { handleFavicon } from "src/components/elements/Favicon"

import {
  CUSTOM_THEME_NAME,
  createAutoTheme,
  createPresetThemes,
  createTheme,
  getCachedTheme,
  isPresetTheme,
  ThemeConfig,
} from "src/theme"

import { StyledApp } from "./styled-components"

import withS4ACommunication, {
  S4ACommunicationHOC,
} from "./hocs/withS4ACommunication/withS4ACommunication"

import withScreencast, {
  ScreenCastHOC,
} from "./hocs/withScreencast/withScreencast"

// Used to import fonts + responsive reboot items
import "src/assets/css/theme.scss"

export interface Props {
  screenCast: ScreenCastHOC
  s4aCommunication: S4ACommunicationHOC
  theme: {
    activeTheme: ThemeConfig
    availableThemes: ThemeConfig[]
    setTheme: (theme: ThemeConfig) => void
    addThemes: (themes: ThemeConfig[]) => void
  }
}

interface State {
  connectionState: ConnectionState
  elements: ReportRoot
  isFullScreen: boolean
  reportId: string
  reportName: string
  reportHash: string | null
  reportRunState: ReportRunState
  userSettings: UserSettings
  dialog?: DialogProps | null
  sharingEnabled?: boolean
  layout: PageConfig.Layout
  initialSidebarState: PageConfig.SidebarState
  allowRunOnSave: boolean
  deployParams?: IDeployParams | null
  reportFinishedHandlers: (() => void)[]
  developerMode: boolean
  themeHash?: string
}

const ELEMENT_LIST_BUFFER_TIMEOUT_MS = 10

// eslint-disable-next-line
declare global {
  interface Window {
    streamlitDebug: any
  }
}

export class App extends PureComponent<Props, State> {
  private readonly sessionEventDispatcher: SessionEventDispatcher

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
  private pendingElementsBuffer: ReportRoot

  private pendingElementsTimerRunning: boolean

  private readonly componentRegistry: ComponentRegistry

  static contextType = PageLayoutContext

  constructor(props: Props) {
    super(props)

    this.state = {
      connectionState: ConnectionState.INITIAL,
      elements: ReportRoot.empty("Please wait..."),
      isFullScreen: false,
      reportName: "",
      reportId: "<null>",
      reportHash: null,
      reportRunState: ReportRunState.NOT_RUNNING,
      userSettings: {
        wideMode: false,
        runOnSave: false,
      },
      layout: PageConfig.Layout.CENTERED,
      initialSidebarState: PageConfig.SidebarState.AUTO,
      allowRunOnSave: true,
      deployParams: null,
      reportFinishedHandlers: [],
      // A hack for now to get theming through. Product to think through how
      // developer mode should be designed in the long term.
      developerMode: window.location.host.includes("localhost"),
    }

    this.sessionEventDispatcher = new SessionEventDispatcher()
    this.connectionManager = null
    this.widgetMgr = new WidgetStateManager(this.sendRerunBackMsg)
    this.uploadClient = new FileUploadClient(() => {
      return this.connectionManager
        ? this.connectionManager.getBaseUriParts()
        : undefined
    }, true)
    this.componentRegistry = new ComponentRegistry(() => {
      return this.connectionManager
        ? this.connectionManager.getBaseUriParts()
        : undefined
    })
    this.pendingElementsTimerRunning = false
    this.pendingElementsBuffer = this.state.elements

    window.streamlitDebug = {}
    window.streamlitDebug.closeConnection = this.closeConnection.bind(this)
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
    RERUN: () => this.rerunScript(),
    CLEAR_CACHE: () => this.openClearCacheDialog(),
    STOP_RECORDING: this.props.screenCast.stopRecording,
  }

  componentDidMount(): void {
    // Initialize connection manager here, to avoid
    // "Can't call setState on a component that is not yet mounted." error.
    this.connectionManager = new ConnectionManager({
      onMessage: this.handleMessage,
      onConnectionError: this.handleConnectionError,
      connectionStateChanged: this.handleConnectionStateChanged,
    })

    if (isEmbeddedInIFrame()) {
      document.body.classList.add("embedded")
    }

    MetricsManager.current.enqueue("viewReport")
  }

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (
      prevProps.s4aCommunication.currentState.queryParams !==
      this.props.s4aCommunication.currentState.queryParams
    ) {
      this.sendRerunBackMsg()
    }
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

  /**
   * Checks if the code version from the backend is different than the frontend
   */
  static hasStreamlitVersionChanged(initializeMsg: Initialize): boolean {
    if (SessionInfo.isSet()) {
      const { streamlitVersion: currentStreamlitVersion } = SessionInfo.current
      const { environmentInfo } = initializeMsg

      if (
        environmentInfo != null &&
        environmentInfo.streamlitVersion != null
      ) {
        return currentStreamlitVersion < environmentInfo.streamlitVersion
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
      logMessage(
        "Reconnected to server; Requesting a run (which may be preheated)"
      )
      this.widgetMgr.sendUpdateWidgetsMessage()
      this.setState({ dialog: null })
    } else {
      setCookie("_xsrf", "")

      if (SessionInfo.isSet()) {
        SessionInfo.clearSession()
      }
    }
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
        newReport: (newReportMsg: NewReport) =>
          this.handleNewReport(newReportMsg),
        sessionStateChanged: (msg: SessionState) =>
          this.handleSessionStateChanged(msg),
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
        reportFinished: (status: ForwardMsg.ReportFinishedStatus) =>
          this.handleReportFinished(status),
        uploadReportProgress: (progress: number) =>
          this.handleUploadReportProgress(progress),
        reportUploaded: (url: string) => this.handleReportUploaded(url),
      })
    } catch (err) {
      logError(err)
      this.showError("Bad message format", err.message)
    }
  }

  handleUploadReportProgress = (progress: number): void => {
    const newDialog: DialogProps = {
      type: DialogType.UPLOAD_PROGRESS,
      progress,
      onClose: () => {},
    }
    this.openDialog(newDialog)
  }

  handleReportUploaded = (url: string): void => {
    const newDialog: DialogProps = {
      type: DialogType.UPLOADED,
      url,
      onClose: () => {},
    }
    this.openDialog(newDialog)
  }

  handlePageConfigChanged = (pageConfig: PageConfig): void => {
    const { title, favicon, layout, initialSidebarState } = pageConfig

    if (title) {
      this.props.s4aCommunication.sendMessage({
        type: "SET_PAGE_TITLE",
        title,
      })

      document.title = `${title} · Streamlit`
    }

    if (favicon) {
      handleFavicon(favicon)
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
  }

  handlePageInfoChanged = (pageInfo: PageInfo): void => {
    const { queryString } = pageInfo
    const targetUrl =
      document.location.pathname + (queryString ? `?${queryString}` : "")
    window.history.pushState({}, "", targetUrl)

    this.props.s4aCommunication.sendMessage({
      type: "SET_QUERY_PARAM",
      queryParams: queryString ? `?${queryString}` : "",
    })
  }

  /**
   * Handler for ForwardMsg.sessionStateChanged messages
   * @param stateChangeProto a SessionState protobuf
   */
  handleSessionStateChanged = (stateChangeProto: SessionState): void => {
    this.setState((prevState: State) => {
      // Determine our new ReportRunState
      let { reportRunState } = prevState
      let { dialog } = prevState

      if (
        stateChangeProto.reportIsRunning &&
        prevState.reportRunState !== ReportRunState.STOP_REQUESTED
      ) {
        // If the report is running, we change our ReportRunState only
        // if we don't have a pending stop request
        reportRunState = ReportRunState.RUNNING

        // If the scriptCompileError dialog is open and the report starts
        // running, close it.
        if (
          dialog != null &&
          dialog.type === DialogType.SCRIPT_COMPILE_ERROR
        ) {
          dialog = undefined
        }
      } else if (
        !stateChangeProto.reportIsRunning &&
        prevState.reportRunState !== ReportRunState.RERUN_REQUESTED &&
        prevState.reportRunState !== ReportRunState.COMPILATION_ERROR
      ) {
        // If the report is not running, we change our ReportRunState only
        // if we don't have a pending rerun request, and we don't have
        // a script compilation failure
        reportRunState = ReportRunState.NOT_RUNNING

        MetricsManager.current.enqueue(
          "deltaStats",
          MetricsManager.current.getAndResetDeltaCounter()
        )

        const { availableThemes, activeTheme } = this.props.theme
        const customThemeDefined =
          availableThemes.length > createPresetThemes().length
        MetricsManager.current.enqueue("themeStats", {
          activeThemeName: activeTheme.name,
          customThemeDefined,
        })

        const customComponentCounter = MetricsManager.current.getAndResetCustomComponentCounter()
        Object.entries(customComponentCounter).forEach(([name, count]) => {
          MetricsManager.current.enqueue("customComponentStats", {
            name,
            count,
          })
        })
      }

      return {
        userSettings: {
          ...prevState.userSettings,
          runOnSave: Boolean(stateChangeProto.runOnSave),
        },
        dialog,
        reportRunState,
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
      this.setState({ reportRunState: ReportRunState.COMPILATION_ERROR })
      const newDialog: DialogProps = {
        type: DialogType.SCRIPT_COMPILE_ERROR,
        exception: sessionEvent.scriptCompilationException,
        onClose: () => {},
      }
      this.openDialog(newDialog)
    } else if (
      RERUN_PROMPT_MODAL_DIALOG &&
      sessionEvent.type === "reportChangedOnDisk"
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
   * Handler for ForwardMsg.newReport messages. This runs on each rerun
   * @param newReportProto a NewReport protobuf
   */
  handleNewReport = (newReportProto: NewReport): void => {
    const initialize = newReportProto.initialize as Initialize
    const config = newReportProto.config as Config
    const themeInput = newReportProto.customTheme as CustomThemeConfig

    if (App.hasStreamlitVersionChanged(initialize)) {
      window.location.reload()
      return
    }

    // First, handle initialization logic. Each NewReport message has
    // initialization data. If this is the _first_ time we're receiving
    // the NewReport message, we perform some one-time initialization.
    if (!SessionInfo.isSet()) {
      // We're not initialized. Perform one-time initialization.
      this.handleOneTimeInitialization(newReportProto)
    }

    this.processThemeInput(themeInput)
    this.setState({
      sharingEnabled: config.sharingEnabled,
      allowRunOnSave: config.allowRunOnSave,
    })

    const { reportHash } = this.state
    const {
      reportId,
      name: reportName,
      scriptPath,
      deployParams,
    } = newReportProto

    const newReportHash = hashString(
      SessionInfo.current.installationId + scriptPath
    )

    // Set the title and favicon to their default values
    document.title = `${reportName} · Streamlit`
    handleFavicon(`${process.env.PUBLIC_URL}/favicon.png`)

    MetricsManager.current.setMetadata(
      this.props.s4aCommunication.currentState.streamlitShareMetadata
    )
    MetricsManager.current.setReportHash(newReportHash)
    MetricsManager.current.clearDeltaCounter()

    MetricsManager.current.enqueue("updateReport")

    if (reportHash === newReportHash) {
      this.setState({
        reportId,
        deployParams,
      })
    } else {
      this.clearAppState(newReportHash, reportId, reportName, deployParams)
    }
  }

  /**
   * Performs one-time initialization. This is called from `handleNewReport`.
   */
  handleOneTimeInitialization = (newReportProto: NewReport): void => {
    const initialize = newReportProto.initialize as Initialize
    const config = newReportProto.config as Config

    SessionInfo.current = SessionInfo.fromNewReportMessage(newReportProto)

    MetricsManager.current.initialize({
      gatherUsageStats: config.gatherUsageStats,
    })

    MetricsManager.current.enqueue("createReport", {
      pythonVersion: SessionInfo.current.pythonVersion,
    })

    this.props.s4aCommunication.connect()
    this.handleSessionStateChanged(initialize.sessionState)
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
        this.props.theme.setTheme(customTheme)
      }
    } else if (!themeInput) {
      // Remove the custom theme menu option.
      this.props.theme.addThemes([])

      if (usingCustomTheme) {
        this.props.theme.setTheme(createAutoTheme())
      }
    }
  }

  /**
   * Handler for ForwardMsg.reportFinished messages
   * @param status the ReportFinishedStatus that the report finished with
   */
  handleReportFinished(status: ForwardMsg.ReportFinishedStatus): void {
    if (status === ForwardMsg.ReportFinishedStatus.FINISHED_SUCCESSFULLY) {
      // Notify any subscribers of this event (and do it on the next cycle of
      // the event loop)
      window.setTimeout(() => {
        this.state.reportFinishedHandlers.map(handler => handler())
      }, 0)

      // Clear any stale elements left over from the previous run.
      // (We don't do this if our script had a compilation error and didn't
      // finish successfully.)
      this.setState(
        ({ reportId }) => ({
          // Apply any pending elements that haven't been applied.
          elements: this.pendingElementsBuffer.clearStaleNodes(reportId),
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
      this.widgetMgr.clean(activeWidgetIds)

      // Tell the ConnectionManager to increment the message cache run
      // count. This will result in expired ForwardMsgs being removed from
      // the cache.
      if (this.connectionManager !== null) {
        this.connectionManager.incrementMessageCacheRunCount(
          SessionInfo.current.maxCachedMessageAge
        )
      }
    }
  }

  /*
   * Clear all elements from the state.
   */
  clearAppState(
    reportHash: string,
    reportId: string,
    reportName: string,
    deployParams?: IDeployParams | null
  ): void {
    this.setState(
      {
        reportId,
        reportName,
        reportHash,
        deployParams,
        elements: ReportRoot.empty(),
      },
      () => {
        this.pendingElementsBuffer = this.state.elements
        this.widgetMgr.clean(fromJS([]))
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
      this.state.reportId,
      deltaMsg,
      metadataMsg
    )

    if (!this.pendingElementsTimerRunning) {
      this.pendingElementsTimerRunning = true

      // (BUG #685) When user presses stop, stop adding elements to
      // report immediately to avoid race condition.
      // The one exception is static connections, which do not depend on
      // the report state (and don't have a stop button).
      const isStaticConnection = this.connectionManager
        ? this.connectionManager.isStaticConnection()
        : false
      const reportIsRunning =
        this.state.reportRunState === ReportRunState.RUNNING

      setTimeout(() => {
        this.pendingElementsTimerRunning = false
        if (isStaticConnection || reportIsRunning) {
          this.setState({ elements: this.pendingElementsBuffer })
        }
      }, ELEMENT_LIST_BUFFER_TIMEOUT_MS)
    }
  }

  /**
   * Used by e2e tests to test disabling widgets
   */
  closeConnection(): void {
    if (this.isServerConnected()) {
      const backMsg = new BackMsg({ closeConnection: true })
      backMsg.type = "closeConnection"
      this.sendBackMsg(backMsg)
    }
  }

  /**
   * Callback to call when we want to share the report.
   */
  shareReport = (): void => {
    if (this.isServerConnected()) {
      if (this.state.sharingEnabled) {
        MetricsManager.current.enqueue("shareReport")
        const backMsg = new BackMsg({ cloudUpload: true })
        backMsg.type = "cloudUpload"
        this.sendBackMsg(backMsg)
      } else {
        const newDialog: DialogProps = {
          type: DialogType.WARNING,
          title: "Error sharing app",
          msg: (
            <Fragment>
              <div>You do not have sharing configured.</div>
              <div>
                Please contact{" "}
                <a href="mailto:hello@streamlit.io">Streamlit Support</a> to
                setup sharing.
              </div>
            </Fragment>
          ),
          onClose: () => {},
        }
        this.openDialog(newDialog)
      }
    } else {
      logError("Cannot save app when disconnected from server")
    }
  }

  /**
   * Reruns the script.
   *
   * @param alwaysRunOnSave a boolean. If true, UserSettings.runOnSave
   * will be set to true, which will result in a request to the Server
   * to enable runOnSave for this report.
   */
  rerunScript = (alwaysRunOnSave = false): void => {
    this.closeDialog()

    if (!this.isServerConnected()) {
      logError("Cannot rerun script when disconnected from server.")
      return
    }

    if (
      this.state.reportRunState === ReportRunState.RUNNING ||
      this.state.reportRunState === ReportRunState.RERUN_REQUESTED
    ) {
      // Don't queue up multiple rerunScript requests
      return
    }

    MetricsManager.current.enqueue("rerunScript")

    this.setState({ reportRunState: ReportRunState.RERUN_REQUESTED })

    // Note: `rerunScript` is incorrectly called in some places.
    // We can remove `=== true` after adding type information
    if (alwaysRunOnSave === true) {
      // Update our run-on-save setting *before* calling rerunScript.
      // The rerunScript message currently blocks all BackMsgs from
      // being processed until the script has completed executing.
      this.saveSettings({ ...this.state.userSettings, runOnSave: true })
    }

    this.widgetMgr.sendUpdateWidgetsMessage()
  }

  sendRerunBackMsg = (widgetStates?: WidgetStates | undefined): void => {
    const { queryParams } = this.props.s4aCommunication.currentState

    let queryString =
      queryParams && queryParams.length > 0
        ? queryParams
        : document.location.search

    if (queryString.startsWith("?")) {
      queryString = queryString.substring(1)
    }

    this.sendBackMsg(
      new BackMsg({
        rerunScript: { queryString, widgetStates },
      })
    )
  }

  /** Requests that the server stop running the report */
  stopReport = (): void => {
    if (!this.isServerConnected()) {
      logError("Cannot stop app when disconnected from server.")
      return
    }

    if (
      this.state.reportRunState === ReportRunState.NOT_RUNNING ||
      this.state.reportRunState === ReportRunState.STOP_REQUESTED
    ) {
      // Don't queue up multiple stopReport requests
      return
    }

    const backMsg = new BackMsg({ stopReport: true })
    backMsg.type = "stopReport"
    this.sendBackMsg(backMsg)
    this.setState({ reportRunState: ReportRunState.STOP_REQUESTED })
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

  openThemeCreatorDialog = (): void => {
    const newDialog: DialogProps = {
      type: DialogType.THEME_CREATOR,
      backToSettings: this.settingsCallback,
      onClose: this.closeDialog,
    }
    this.openDialog(newDialog)
  }

  /**
   * Asks the server to clear the st_cache
   */
  clearCache = (): void => {
    this.closeDialog()
    if (this.isServerConnected()) {
      MetricsManager.current.enqueue("clearCache")
      const backMsg = new BackMsg({ clearCache: true })
      backMsg.type = "clearCache"
      this.sendBackMsg(backMsg)
    } else {
      logError("Cannot clear cache: disconnected from server")
    }
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
   * Updates the report body when there's a connection error.
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
    }
    this.openDialog(newDialog)
  }

  aboutCallback = (): void => {
    const newDialog: DialogProps = {
      type: DialogType.ABOUT,
      onClose: this.closeDialog,
    }
    this.openDialog(newDialog)
  }

  screencastCallback = (): void => {
    const { reportName } = this.state
    const { startRecording } = this.props.screenCast
    const date = moment().format("YYYY-MM-DD-HH-MM-SS")

    startRecording(`streamlit-${reportName}-${date}`)
  }

  handleFullScreen = (isFullScreen: boolean): void => {
    this.setState({ isFullScreen })
  }

  addReportFinishedHandler = (func: () => void): void => {
    this.setState({
      reportFinishedHandlers: concat(this.state.reportFinishedHandlers, func),
    })
  }

  removeReportFinishedHandler = (func: () => void): void => {
    this.setState({
      reportFinishedHandlers: without(this.state.reportFinishedHandlers, func),
    })
  }

  render(): JSX.Element {
    const {
      allowRunOnSave,
      connectionState,
      deployParams,
      dialog,
      elements,
      initialSidebarState,
      isFullScreen,
      layout,
      reportId,
      reportRunState,
      sharingEnabled,
      userSettings,
    } = this.state
    const outerDivClass = classNames("stApp", {
      "streamlit-embedded": isEmbeddedInIFrame(),
      "streamlit-wide": userSettings.wideMode,
    })

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
      <PageLayoutContext.Provider
        value={{
          initialSidebarState,
          layout,
          wideMode: userSettings.wideMode,
          embedded: isEmbeddedInIFrame(),
          isFullScreen,
          setFullScreen: this.handleFullScreen,
          addReportFinishedHandler: this.addReportFinishedHandler,
          removeReportFinishedHandler: this.removeReportFinishedHandler,
          activeTheme: this.props.theme.activeTheme,
          availableThemes: this.props.theme.availableThemes,
          setTheme: this.props.theme.setTheme,
          addThemes: this.props.theme.addThemes,
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
              <StatusWidget
                connectionState={connectionState}
                sessionEventDispatcher={this.sessionEventDispatcher}
                reportRunState={reportRunState}
                rerunReport={this.rerunScript}
                stopReport={this.stopReport}
                allowRunOnSave={allowRunOnSave}
              />
              <MainMenu
                sharingEnabled={sharingEnabled === true}
                isServerConnected={this.isServerConnected()}
                shareCallback={this.shareReport}
                quickRerunCallback={this.rerunScript}
                clearCacheCallback={this.openClearCacheDialog}
                settingsCallback={this.settingsCallback}
                aboutCallback={this.aboutCallback}
                screencastCallback={this.screencastCallback}
                screenCastState={this.props.screenCast.currentState}
                s4aMenuItems={this.props.s4aCommunication.currentState.items}
                sendS4AMessage={this.props.s4aCommunication.sendMessage}
                deployParams={deployParams}
              />
            </Header>

            <ReportView
              elements={elements}
              reportId={reportId}
              reportRunState={reportRunState}
              showStaleElementIndicator={
                connectionState !== ConnectionState.STATIC
              }
              widgetMgr={this.widgetMgr}
              widgetsDisabled={connectionState !== ConnectionState.CONNECTED}
              uploadClient={this.uploadClient}
              componentRegistry={this.componentRegistry}
            />
            {renderedDialog}
          </StyledApp>
        </HotKeys>
      </PageLayoutContext.Provider>
    )
  }
}

export default withS4ACommunication(withScreencast(App))
