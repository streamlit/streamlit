/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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
import { HotKeys } from "react-hotkeys"
import { fromJS, List } from "immutable"
import classNames from "classnames"
// Other local imports.
import ReportView from "components/core/ReportView/"
import { StatusWidget } from "components/core/StatusWidget/"
import MainMenu from "components/core/MainMenu/"
import {
  DialogProps,
  DialogType,
  StreamlitDialog,
} from "components/core/StreamlitDialog/"
import { ConnectionManager } from "lib/ConnectionManager"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { ConnectionState } from "lib/ConnectionState"
import { ReportRunState } from "lib/ReportRunState"
import { SessionEventDispatcher } from "lib/SessionEventDispatcher"
import {
  applyDelta,
  BlockElement,
  Elements,
  ReportElement,
  SimpleElement,
} from "lib/DeltaParser"
import {
  BackMsg,
  Delta,
  ForwardMsg,
  IBackMsg,
  IForwardMsgMetadata,
  Initialize,
  ISessionState,
  NewReport,
  SessionEvent,
} from "autogen/proto"

import { RERUN_PROMPT_MODAL_DIALOG } from "lib/baseconsts"
import { SessionInfo } from "lib/SessionInfo"
import { MetricsManager } from "lib/MetricsManager"
import { FileUploadClient } from "lib/FileUploadClient"
import {
  flattenElements,
  hashString,
  isEmbeddedInIFrame,
  makeElementWithInfoText,
} from "lib/utils"
import { logError, logMessage } from "lib/log"
// WARNING: order matters
import "assets/css/theme.scss"
import "./App.scss"
import "assets/css/header.scss"
import { UserSettings } from "components/core/StreamlitDialog/UserSettings"

import withScreencast, {
  ScreenCastHOC,
} from "./hocs/withScreencast/withScreencast"

export interface Props {
  screenCast: ScreenCastHOC
}

interface State {
  connectionState: ConnectionState
  elements: Elements
  reportId: string
  reportName: string
  reportHash: string | null
  reportRunState: ReportRunState
  userSettings: UserSettings
  dialog?: DialogProps | null
  sharingEnabled?: boolean
}

const ELEMENT_LIST_BUFFER_TIMEOUT_MS = 10

declare global {
  interface Window {
    streamlitDebug: any
  }
}

export class App extends PureComponent<Props, State> {
  private readonly sessionEventDispatcher: SessionEventDispatcher
  private readonly statusWidgetRef: React.RefObject<StatusWidget>
  private connectionManager: ConnectionManager | null
  private readonly widgetMgr: WidgetStateManager
  private uploadClient: FileUploadClient
  private elementListBuffer: Elements | null
  private elementListBufferTimerIsSet: boolean

  constructor(props: Props) {
    super(props)

    this.state = {
      connectionState: ConnectionState.INITIAL,
      elements: {
        main: fromJS([
          {
            element: makeElementWithInfoText("Please wait..."),
            metadata: {},
            reportId: "no report",
          },
        ]),
        sidebar: fromJS([]),
      },
      reportName: "",
      reportId: "<null>",
      reportHash: null,
      reportRunState: ReportRunState.NOT_RUNNING,
      userSettings: {
        wideMode: false,
        runOnSave: false,
      },
    }

    this.sessionEventDispatcher = new SessionEventDispatcher()
    this.statusWidgetRef = React.createRef<StatusWidget>()
    this.connectionManager = null
    this.widgetMgr = new WidgetStateManager((msg: IBackMsg) => {
      this.sendBackMsg(new BackMsg(msg))
    })
    this.uploadClient = new FileUploadClient(() => {
      return this.connectionManager
        ? this.connectionManager.getBaseUriParts()
        : undefined
    })
    this.elementListBufferTimerIsSet = false
    this.elementListBuffer = null

    window.streamlitDebug = {}
    window.streamlitDebug.closeConnection = this.closeConnection.bind(this)
  }

  /**
   * Global keyboard shortcuts.
   */
  keyHandlers = {
    // The r key reruns the script.
    r: () => this.rerunScript(),

    // The c key clears the cache.
    c: () => this.openClearCacheDialog(),

    esc: this.props.screenCast.stopRecording,
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

  showError(title: string, errorNode: ReactNode): void {
    logError(errorNode)
    const newDialog: DialogProps = {
      type: DialogType.WARNING,
      title: title,
      msg: errorNode,
      onClose: () => {},
    }
    this.openDialog(newDialog)
  }

  /**
   * Checks if the code version from the backend is different than the frontend
   */
  hasStreamlitVersionChanged(initializeMsg: Initialize): boolean {
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
      } else {
        throw new Error(`Cannot handle ${name} "${whichOne}".`)
      }
    }

    try {
      dispatchProto(msgProto, "type", {
        initialize: (initializeMsg: Initialize) =>
          this.handleInitialize(initializeMsg),
        sessionStateChanged: (msg: ISessionState) =>
          this.handleSessionStateChanged(msg),
        sessionEvent: (evtMsg: SessionEvent) =>
          this.handleSessionEvent(evtMsg),
        newReport: (newReportMsg: NewReport) =>
          this.handleNewReport(newReportMsg),
        delta: (deltaMsg: Delta) =>
          this.handleDeltaMsg(deltaMsg, msgProto.metadata),
        reportFinished: (status: ForwardMsg.ReportFinishedStatus) =>
          this.handleReportFinished(status),
        uploadReportProgress: (progress: string | number) =>
          this.handleUploadReportProgress(progress),
        reportUploaded: (url: string) => this.handleReportUploaded(url),
      })
    } catch (err) {
      logError(err)
      this.showError("Bad message format", err.message)
    }
  }

  handleUploadReportProgress = (progress: string | number): void => {
    const newDialog: DialogProps = {
      type: DialogType.UPLOAD_PROGRESS,
      progress: progress,
      onClose: () => {},
    }
    this.openDialog(newDialog)
  }

  handleReportUploaded = (url: string): void => {
    const newDialog: DialogProps = {
      type: DialogType.UPLOADED,
      url: url,
      onClose: () => {},
    }
    this.openDialog(newDialog)
  }

  /**
   * Handler for ForwardMsg.initialize messages
   * @param initializeMsg an Initialize protobuf
   */

  handleInitialize = (initializeMsg: Initialize): void => {
    const {
      sessionId,
      environmentInfo,
      userInfo,
      config,
      sessionState,
    } = initializeMsg

    if (
      sessionId == null ||
      !environmentInfo ||
      !userInfo ||
      !config ||
      !sessionState
    ) {
      throw new Error("InitializeMsg is missing a required field")
    }

    if (this.hasStreamlitVersionChanged(initializeMsg)) {
      window.location.reload()

      return
    }

    SessionInfo.current = new SessionInfo({
      sessionId: sessionId,
      streamlitVersion: environmentInfo.streamlitVersion,
      pythonVersion: environmentInfo.pythonVersion,
      installationId: userInfo.installationId,
      authorEmail: userInfo.email,
      maxCachedMessageAge: config.maxCachedMessageAge,
      commandLine: initializeMsg.commandLine,
      userMapboxToken: config.mapboxToken,
    })

    MetricsManager.current.initialize({
      gatherUsageStats: Boolean(config.gatherUsageStats),
    })

    MetricsManager.current.enqueue("createReport", {
      pythonVersion: SessionInfo.current.pythonVersion,
    })

    this.setState({
      sharingEnabled: Boolean(config.sharingEnabled),
    })

    this.handleSessionStateChanged(sessionState)
  }

  /**
   * Handler for ForwardMsg.sessionStateChanged messages
   * @param stateChangeProto a SessionState protobuf
   */
  handleSessionStateChanged = (stateChangeProto: ISessionState): void => {
    this.setState((prevState: State) => {
      // Determine our new ReportRunState
      let reportRunState = prevState.reportRunState
      let dialog = prevState.dialog

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
          MetricsManager.current.getDeltaCounter()
        )
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
      }
      this.openDialog(newDialog)
    }
  }

  /**
   * Handler for ForwardMsg.newReport messages
   * @param newReportProto a NewReport protobuf
   */
  handleNewReport = (newReportProto: NewReport): void => {
    const { reportHash } = this.state
    const { id: reportId, name: reportName, scriptPath } = newReportProto

    const newReportHash = hashString(
      SessionInfo.current.installationId + scriptPath
    )

    document.title = `${reportName} · Streamlit`

    MetricsManager.current.clearDeltaCounter()

    MetricsManager.current.enqueue("updateReport", {
      // Create a hash that uniquely identifies this "project" so we can tell
      // how many projects are being created with Streamlit while still keeping
      // possibly-sensitive info like the scriptPath outside of our metrics
      // services.
      reportHash: newReportHash,
    })

    if (reportHash === newReportHash) {
      this.setState({
        reportId,
      })
    } else {
      this.clearAppState(newReportHash, reportId, reportName)
    }
  }

  /**
   * Handler for ForwardMsg.reportFinished messages
   * @param status the ReportFinishedStatus that the report finished with
   */
  handleReportFinished(status: ForwardMsg.ReportFinishedStatus): void {
    if (status === ForwardMsg.ReportFinishedStatus.FINISHED_SUCCESSFULLY) {
      // Clear any stale elements left over from the previous run.
      // (We don't do this if our script had a compilation error and didn't
      // finish successfully.)
      this.setState(
        ({ elements, reportId }) => ({
          elements: {
            main: this.clearOldElements(elements.main, reportId),
            sidebar: this.clearOldElements(elements.sidebar, reportId),
          },
        }),
        () => {
          this.elementListBuffer = this.state.elements
        }
      )

      // This step removes from the WidgetManager the state of those widgets
      // that are not shown on the page.
      if (this.elementListBuffer) {
        const active_widget_ids = flattenElements(this.elementListBuffer.main)
          .union(flattenElements(this.elementListBuffer.sidebar))
          .map((e: SimpleElement) => {
            const type = e.get("type")
            return e.get(type).get("id") as string
          })
          .filter(id => id != null)
        this.widgetMgr.clean(active_widget_ids)
      }

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

  /**
   * Removes old elements. The term old is defined as:
   *  - simple elements whose reportIds are no longer current
   *  - empty block elements
   */
  clearOldElements = (elements: any, reportId: string): BlockElement => {
    return elements
      .map((reportElement: ReportElement) => {
        const simpleElement = reportElement.get("element")

        if (simpleElement instanceof List) {
          const clearedElements = this.clearOldElements(
            simpleElement,
            reportId
          )
          return clearedElements.size > 0 ? clearedElements : null
        }

        return reportElement.get("reportId") === reportId
          ? reportElement
          : null
      })
      .filter((reportElement: any) => reportElement !== null)
  }

  /*
   * Clear all elements from the state.
   */
  clearAppState(
    reportHash: string,
    reportId: string,
    reportName: string
  ): void {
    this.setState(
      {
        reportId,
        reportName,
        reportHash,
        elements: {
          main: fromJS([]),
          sidebar: fromJS([]),
        },
      },
      () => {
        this.elementListBuffer = this.state.elements
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
    // HACK: Remove modal-open class that Bootstrap uses to hide scrollbars
    // when a modal is open. Otherwise, when the user causes a syntax error in
    // Python and we show an "Error" modal, and then the user presses "R" while
    // that modal is showing, this causes "modal-open" to *not* be removed
    // properly from <body>, thereby breaking scrolling. This seems to be
    // related to the modal-close animation taking too long.
    document.body.classList.remove("modal-open")

    this.setState({ dialog: undefined })
  }

  /**
   * Saves a UserSettings object.
   */
  saveSettings = (newSettings: UserSettings): void => {
    const prevRunOnSave = this.state.userSettings.runOnSave
    const runOnSave = newSettings.runOnSave

    this.setState({ userSettings: newSettings })

    if (prevRunOnSave !== runOnSave && this.isServerConnected()) {
      const backMsg = new BackMsg({ setRunOnSave: runOnSave })
      backMsg.type = "setRunOnSave"
      this.sendBackMsg(backMsg)
    }
  }

  /**
   * Updates elementListBuffer with the given delta, and sets up a timer to
   * update the elementList in the state as well. This buffer allows us to
   * receive deltas extremely quickly without spamming React with lots of
   * render() calls.
   */
  handleDeltaMsg = (
    deltaMsg: Delta,
    metadataMsg: IForwardMsgMetadata | undefined | null
  ): void => {
    this.elementListBuffer = applyDelta(
      this.state.elements,
      this.state.reportId,
      deltaMsg,
      metadataMsg
    )

    if (!this.elementListBufferTimerIsSet) {
      this.elementListBufferTimerIsSet = true

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
        this.elementListBufferTimerIsSet = false
        if (isStaticConnection || reportIsRunning) {
          // Create brand new `elements` instance, so components that depend on
          // this for re-rendering catch the change.
          if (this.elementListBuffer) {
            const elements: Elements = {
              ...this.elementListBuffer,
            }
            this.setState({ elements: elements })
          }
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

    const backMsg = new BackMsg({ rerunScript: true })
    backMsg.type = "rerunScript"
    this.sendBackMsg(backMsg)
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

  settingsCallback = (): void => {
    const newDialog: DialogProps = {
      type: DialogType.SETTINGS,
      isServerConnected: this.isServerConnected(),
      settings: this.state.userSettings,
      onSave: this.saveSettings,
      onClose: () => {},
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

  render(): JSX.Element {
    const outerDivClass = classNames("stApp", {
      "streamlit-embedded": isEmbeddedInIFrame(),
      "streamlit-wide": this.state.userSettings.wideMode,
    })

    let dialog: React.ReactNode = null
    if (this.state.dialog) {
      const dialogProps: DialogProps = {
        ...this.state.dialog,
        onClose: this.closeDialog,
      }
      dialog = StreamlitDialog(dialogProps)
    }

    // Attach and focused props provide a way to handle Global Hot Keys
    // https://github.com/greena13/react-hotkeys/issues/41
    // attach: DOM element the keyboard listeners should attach to
    // focused: A way to force focus behaviour
    return (
      <HotKeys handlers={this.keyHandlers} attach={window} focused={true}>
        <div className={outerDivClass}>
          {/* The tabindex below is required for testing. */}
          <header tabIndex={-1}>
            <div className="decoration" />
            <div className="toolbar">
              <StatusWidget
                ref={this.statusWidgetRef}
                connectionState={this.state.connectionState}
                sessionEventDispatcher={this.sessionEventDispatcher}
                reportRunState={this.state.reportRunState}
                rerunReport={this.rerunScript}
                stopReport={this.stopReport}
              />
              <MainMenu
                sharingEnabled={this.state.sharingEnabled === true}
                isServerConnected={this.isServerConnected}
                shareCallback={this.shareReport}
                quickRerunCallback={this.rerunScript}
                clearCacheCallback={this.openClearCacheDialog}
                settingsCallback={this.settingsCallback}
                aboutCallback={this.aboutCallback}
                screencastCallback={this.screencastCallback}
                screenCastState={this.props.screenCast.currentState}
              />
            </div>
          </header>

          <ReportView
            wide={this.state.userSettings.wideMode}
            elements={this.state.elements}
            reportId={this.state.reportId}
            reportRunState={this.state.reportRunState}
            showStaleElementIndicator={
              this.state.connectionState !== ConnectionState.STATIC
            }
            widgetMgr={this.widgetMgr}
            widgetsDisabled={
              this.state.connectionState !== ConnectionState.CONNECTED
            }
            uploadClient={this.uploadClient}
          />

          {dialog}
        </div>
      </HotKeys>
    )
  }
}

export default withScreencast(App)
