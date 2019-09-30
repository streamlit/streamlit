/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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

import React, { Fragment, PureComponent } from "react"
import { HotKeys } from "react-hotkeys"
import { fromJS, List } from "immutable"
import classNames from "classnames"

// Other local imports.
import ReportView from "components/core/ReportView/"
import { StatusWidget } from "components/core/StatusWidget/"
import LoginBox from "components/core/LoginBox/"
import MainMenu from "components/core/MainMenu/"
import { StreamlitDialog, DialogType } from "components/core/StreamlitDialog/"
import Resolver from "lib/Resolver"
import { ConnectionManager } from "lib/ConnectionManager"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { ConnectionState } from "lib/ConnectionState"
import { ReportRunState } from "lib/ReportRunState"
import { SessionEventDispatcher } from "lib/SessionEventDispatcher"
import { applyDelta } from "lib/DeltaParser"
import { ForwardMsg } from "autogen/proto"

import { RERUN_PROMPT_MODAL_DIALOG } from "lib/baseconsts"
import { SessionInfo } from "lib/SessionInfo"
import { MetricsManager } from "lib/MetricsManager"
import {
  hashString,
  isEmbeddedInIFrame,
  makeElementWithInfoText,
} from "lib/utils"
import { logError, logMessage } from "lib/log"

// WARNING: order matters
import "assets/css/theme.scss"
import "./App.scss"
import "assets/css/header.scss"

class App extends PureComponent {
  constructor(props) {
    super(props)

    this.state = {
      connectionState: ConnectionState.INITIAL,
      elements: {
        main: fromJS([makeElementWithInfoText("Please wait...")]),
        sidebar: fromJS([]),
      },
      reportId: "<null>",
      reportName: null,
      reportRunState: ReportRunState.NOT_RUNNING,
      showLoginBox: false,
      userSettings: {
        wideMode: false,
        runOnSave: false,
      },
    }

    // Bind event handlers.
    this.closeDialog = this.closeDialog.bind(this)
    this.getUserLogin = this.getUserLogin.bind(this)
    this.handleConnectionError = this.handleConnectionError.bind(this)
    this.handleConnectionStateChanged = this.handleConnectionStateChanged.bind(
      this
    )
    this.handleMessage = this.handleMessage.bind(this)
    this.isServerConnected = this.isServerConnected.bind(this)
    this.onLogInError = this.onLogInError.bind(this)
    this.onLogInSuccess = this.onLogInSuccess.bind(this)
    this.rerunScript = this.rerunScript.bind(this)
    this.stopReport = this.stopReport.bind(this)
    this.openClearCacheDialog = this.openClearCacheDialog.bind(this)
    this.clearCache = this.clearCache.bind(this)
    this.saveReport = this.saveReport.bind(this)
    this.saveSettings = this.saveSettings.bind(this)
    this.settingsCallback = this.settingsCallback.bind(this)
    this.aboutCallback = this.aboutCallback.bind(this)

    this.userLoginResolver = new Resolver()
    this.sessionEventDispatcher = new SessionEventDispatcher()
    this.statusWidgetRef = React.createRef()

    this.connectionManager = null
    this.widgetMgr = new WidgetStateManager(this.sendBackMsg)

    window.streamlitDebug = {}
    window.streamlitDebug.closeConnection = this.closeConnection.bind(this)
  }

  /**
   * Global keyboard shortcuts.
   */
  keyHandlers = {
    // The r key reruns the script.
    r: () => this.rerunScript(),

    // The shift+r key opens the rerun script dialog.
    "shift+r": () => this.openRerunScriptDialog(),

    // The c key clears the cache.
    c: () => this.openClearCacheDialog(),
  }

  componentDidMount() {
    // Initialize connection manager here, to avoid
    // "Can't call setState on a component that is not yet mounted." error.
    this.connectionManager = new ConnectionManager({
      getUserLogin: this.getUserLogin,
      onMessage: this.handleMessage,
      onConnectionError: this.handleConnectionError,
      connectionStateChanged: this.handleConnectionStateChanged,
    })

    if (isEmbeddedInIFrame()) {
      document.body.classList.add("embedded")
    }

    MetricsManager.current.enqueue("viewReport")
  }

  /**
   * Called by ConnectionManager when our connection state changes
   */
  handleConnectionStateChanged(newState) {
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

  showError(title, errorNode) {
    logError(errorNode)

    this.openDialog({
      title,
      type: "warning",
      msg: errorNode,
    })
  }

  /**
   * Callback when we get a message from the server.
   */
  handleMessage(msgProto) {
    // We don't have an immutableProto here, so we can't use
    // the dispatchOneOf helper
    const dispatchProto = (obj, name, funcs) => {
      const whichOne = obj[name]
      if (whichOne in funcs) {
        return funcs[whichOne](obj[whichOne])
      } else {
        throw new Error(`Cannot handle ${name} "${whichOne}".`)
      }
    }

    try {
      dispatchProto(msgProto, "type", {
        initialize: initializeMsg => this.handleInitialize(initializeMsg),
        sessionStateChanged: msg => this.handleSessionStateChanged(msg),
        sessionEvent: evtMsg => this.handleSessionEvent(evtMsg),
        newReport: newReportMsg => this.handleNewReport(newReportMsg),
        delta: deltaMsg => this.handleDeltaMsg(deltaMsg, msgProto.metadata),
        reportFinished: status => this.handleReportFinished(status),
        uploadReportProgress: progress =>
          this.openDialog({ progress, type: DialogType.UPLOAD_PROGRESS }),
        reportUploaded: url =>
          this.openDialog({ url, type: DialogType.UPLOADED }),
      })
    } catch (err) {
      logError(err)
      this.showError("Bad message format", err.message)
    }
  }

  /**
   * Handler for ForwardMsg.initialize messages
   * @param initializeMsg an Initialize protobuf
   */
  handleInitialize(initializeMsg) {
    SessionInfo.current = new SessionInfo({
      streamlitVersion: initializeMsg.environmentInfo.streamlitVersion,
      pythonVersion: initializeMsg.environmentInfo.pythonVersion,
      installationId: initializeMsg.userInfo.installationId,
      authorEmail: initializeMsg.userInfo.email,
      maxCachedMessageAge: initializeMsg.config.maxCachedMessageAge,
      commandLine: initializeMsg.commandLine,
    })

    MetricsManager.current.initialize({
      gatherUsageStats: initializeMsg.config.gatherUsageStats,
    })

    MetricsManager.current.enqueue("createReport", {
      pythonVersion: SessionInfo.current.pythonVersion,
    })

    this.setState({
      sharingEnabled: initializeMsg.config.sharingEnabled,
    })

    const initialState = initializeMsg.sessionState
    this.handleSessionStateChanged(initialState)
  }

  /**
   * Handler for ForwardMsg.sessionStateChanged messages
   * @param stateChangeProto a SessionState protobuf
   */
  handleSessionStateChanged(stateChangeProto) {
    this.setState(prevState => {
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
          runOnSave: stateChangeProto.runOnSave,
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
  handleSessionEvent(sessionEvent) {
    this.sessionEventDispatcher.handleSessionEventMsg(sessionEvent)
    if (sessionEvent.type === "scriptCompilationException") {
      this.setState({ reportRunState: ReportRunState.COMPILATION_ERROR })
      this.openDialog({
        type: DialogType.SCRIPT_COMPILE_ERROR,
        exception: sessionEvent.scriptCompilationException,
      })
    } else if (
      RERUN_PROMPT_MODAL_DIALOG &&
      sessionEvent.type === "reportChangedOnDisk"
    ) {
      this.openDialog({
        type: DialogType.SCRIPT_CHANGED,
        onRerun: this.rerunScript,
      })
    }
  }

  /**
   * Handler for ForwardMsg.newReport messages
   * @param newReportProto a NewReport protobuf
   */
  handleNewReport(newReportProto) {
    const name = newReportProto.name
    const scriptPath = newReportProto.scriptPath

    document.title = `${name} · Streamlit`

    MetricsManager.current.clearDeltaCounter()

    MetricsManager.current.enqueue("updateReport", {
      // Create a hash that uniquely identifies this "project" so we can tell
      // how many projects are being created with Streamlit while still keeping
      // possibly-sensitive info like the scriptPath outside of our metrics
      // services.
      reportHash: hashString(SessionInfo.current.installationId + scriptPath),
    })

    this.setState({
      reportId: newReportProto.id,
      reportName: name,
    })
  }

  /**
   * Handler for ForwardMsg.reportFinished messages
   * @param status the ReportFinishedStatus that the report finished with
   */
  handleReportFinished(status) {
    if (status === ForwardMsg.ReportFinishedStatus.FINISHED_SUCCESSFULLY) {
      // Clear any stale elements left over from the previous run.
      // (We don't do this if our script had a compilation error and didn't
      // finish successfully.)
      this.setState(({ elements, reportId }) => ({
        elements: {
          main: this.clearOldElements(elements.main, reportId),
          sidebar: this.clearOldElements(elements.sidebar, reportId),
        },
      }))

      // Tell the ConnectionManager to increment the message cache run
      // count. This will result in expired ForwardMsgs being removed from
      // the cache.
      this.connectionManager.incrementMessageCacheRunCount(
        SessionInfo.current.maxCachedMessageAge
      )
    }
  }

  /**
   * Removes old elements. The term old is defined as:
   *  - simple elements whose reportIds are no longer current
   *  - empty block elements
   */
  clearOldElements = (elements, reportId) => {
    return elements
      .map(element => {
        if (element instanceof List) {
          const clearedElements = this.clearOldElements(element, reportId)
          return clearedElements.size > 0 ? clearedElements : null
        }
        return element.get("reportId") === reportId ? element : null
      })
      .filter(element => element !== null)
  }

  /**
   * Opens a dialog with the specified state.
   */
  openDialog(dialogProps) {
    this.setState({ dialog: dialogProps })
  }

  /**
   * Closes the upload dialog if it's open.
   */
  closeDialog() {
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
  saveSettings(newSettings) {
    const prevRunOnSave = this.state.userSettings.runOnSave
    const runOnSave = newSettings.runOnSave

    this.setState({ userSettings: newSettings })

    if (prevRunOnSave !== runOnSave && this.isServerConnected()) {
      this.sendBackMsg({ type: "setRunOnSave", setRunOnSave: runOnSave })
    }
  }

  /**
   * Applies a list of deltas to the elements.
   */
  handleDeltaMsg = (deltaMsg, metadataMsg) => {
    // (BUG #685) When user presses stop, stop adding elements to
    // report immediately to avoid race condition.
    // The one exception is static connections, which do not depend on
    // the report state (and don't have a stop button).
    const isStaticConnection = this.connectionManager.isStaticConnection()
    const reportIsRunning =
      this.state.reportRunState === ReportRunState.RUNNING
    if (isStaticConnection || reportIsRunning) {
      this.setState(state => ({
        // Create brand new `elements` instance, so components that depend on
        // this for re-rendering catch the change.
        elements: {
          ...applyDelta(state.elements, state.reportId, deltaMsg, metadataMsg),
        },
      }))
    }
  }

  /**
   * Used by e2e tests to test disabling widgets
   */
  closeConnection() {
    if (this.isServerConnected()) {
      this.sendBackMsg({
        type: "closeConnection",
        closeConnection: true,
      })
    }
  }

  /**
   * Callback to call when we want to save the report.
   */
  saveReport() {
    if (this.isServerConnected()) {
      if (this.state.sharingEnabled) {
        MetricsManager.current.enqueue("shareReport")
        this.sendBackMsg({
          type: "cloudUpload",
          cloudUpload: true,
        })
      } else {
        this.openDialog({
          type: "warning",
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
        })
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
  rerunScript(alwaysRunOnSave = false) {
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

    this.sendBackMsg({
      type: "rerunScript",
      rerunScript: true,
    })
  }

  /** Requests that the server stop running the report */
  stopReport() {
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

    this.sendBackMsg({ type: "stopReport", stopReport: true })
    this.setState({ reportRunState: ReportRunState.STOP_REQUESTED })
  }

  /**
   * Shows a dialog asking the user to confirm they want to clear the cache
   */
  openClearCacheDialog() {
    if (this.isServerConnected()) {
      this.openDialog({
        type: DialogType.CLEAR_CACHE,
        confirmCallback: this.clearCache,

        // This will be called if enter is pressed.
        defaultAction: this.clearCache,
      })
    } else {
      logError("Cannot clear cache: disconnected from server")
    }
  }

  /**
   * Asks the server to clear the st_cache
   */
  clearCache() {
    this.closeDialog()
    if (this.isServerConnected()) {
      MetricsManager.current.enqueue("clearCache")
      this.sendBackMsg({ type: "clearCache", clearCache: true })
    } else {
      logError("Cannot clear cache: disconnected from server")
    }
  }

  /**
   * Sends a message back to the server.
   */
  sendBackMsg = msg => {
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
  handleConnectionError(errNode) {
    this.showError("Connection error", errNode)
  }

  /**
   * Indicates whether we're connected to the server.
   */
  isServerConnected() {
    return this.connectionManager
      ? this.connectionManager.isConnected()
      : false
  }

  settingsCallback() {
    this.openDialog({
      type: DialogType.SETTINGS,
      isOpen: true,
      isServerConnected: this.isServerConnected(),
      settings: this.state.userSettings,
      onSave: this.saveSettings,
    })
  }

  aboutCallback() {
    this.openDialog({
      type: DialogType.ABOUT,
      onClose: this.closeDialog,
    })
  }

  async getUserLogin() {
    this.setState({ showLoginBox: true })
    const idToken = await this.userLoginResolver.promise
    this.setState({ showLoginBox: false })
    return idToken
  }

  onLogInSuccess({ accessToken, idToken }) {
    if (accessToken) {
      this.userLoginResolver.resolve(idToken)
    } else {
      this.userLoginResolver.reject("Error signing in.")
    }
  }

  onLogInError(msg) {
    this.userLoginResolver.reject(`Error signing in. ${msg}`)
  }

  render() {
    const outerDivClass = classNames("stApp", {
      "streamlit-embedded": isEmbeddedInIFrame(),
      "streamlit-wide": this.state.userSettings.wideMode,
    })

    const dialogProps = {
      ...this.state.dialog,
      onClose: this.closeDialog,
    }

    // Attach and focused props provide a way to handle Global Hot Keys
    // https://github.com/greena13/react-hotkeys/issues/41
    // attach: DOM element the keyboard listeners should attach to
    // focused: A way to force focus behaviour
    return (
      <HotKeys handlers={this.keyHandlers} attach={window} focused={true}>
        <div className={outerDivClass}>
          {/* The tabindex below is required for testing. */}
          <header tabIndex="-1">
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
                isServerConnected={this.isServerConnected}
                saveCallback={this.saveReport}
                quickRerunCallback={this.rerunScript}
                rerunCallback={this.openRerunScriptDialog}
                clearCacheCallback={this.openClearCacheDialog}
                settingsCallback={this.settingsCallback}
                aboutCallback={this.aboutCallback}
              />
            </div>
          </header>

          {this.state.showLoginBox ? (
            <LoginBox
              onSuccess={this.onLogInSuccess}
              onFailure={this.onLogInError}
            />
          ) : (
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
            />
          )}

          <StreamlitDialog {...dialogProps} />
        </div>
      </HotKeys>
    )
  }
}

export default App
