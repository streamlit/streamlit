/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

/*jshint loopfunc:false */

import React, { PureComponent } from 'react'
import { HotKeys } from 'react-hotkeys'
import {
  Col,
  Container,
  Row,
} from 'reactstrap'
import { fromJS } from 'immutable'
import url from 'url'

// Other local imports.
import LoginBox from 'components/core/LoginBox/'
import MainMenu from 'components/core/MainMenu/'
import Resolver from 'lib/Resolver'
import { StreamlitDialog } from 'components/core/StreamlitDialog/'
import { ConnectionManager } from 'lib/ConnectionManager'
import { WidgetStateManager } from 'lib/WidgetStateManager'
import { ConnectionState } from 'lib/ConnectionState'
import { ReportRunState } from 'lib/ReportRunState'
import { StatusWidget } from 'components/core/StatusWidget/'
import { SessionEventDispatcher } from 'lib/SessionEventDispatcher'
import { ReportView } from 'components/core/ReportView/'

import { Delta, Text as TextProto } from 'autogen/protobuf'
import { addRows } from 'lib/dataFrameProto'
import { initRemoteTracker, trackEventRemotely } from 'lib/remotetracking'
import { logError, logMessage } from 'lib/log'
import {RERUN_PROMPT_MODAL_DIALOG, setInstallationId, setStreamlitVersion} from 'lib/baseconsts'
import { toImmutableProto, dispatchOneOf } from 'lib/immutableProto'

import 'assets/css/theme.scss'
import './App.scss'
import 'assets/css/header.scss'

class App extends PureComponent {
  constructor(props) {
    super(props)

    this.state = {
      reportId: '<null>',
      reportName: null,
      elements: fromJS([makeElementWithInfoText('Please wait...')]),
      userSettings: {
        wideMode: false,
        runOnSave: false,
      },
      showLoginBox: false,
      reportRunState: ReportRunState.NOT_RUNNING,
      connectionState: ConnectionState.INITIAL,
    }

    // Bind event handlers.
    this.closeDialog = this.closeDialog.bind(this)
    this.getUserLogin = this.getUserLogin.bind(this)
    this.handleConnectionError = this.handleConnectionError.bind(this)
    this.handleConnectionStateChanged = this.handleConnectionStateChanged.bind(this)
    this.handleMessage = this.handleMessage.bind(this)
    this.isServerConnected = this.isServerConnected.bind(this)
    this.onLogInError = this.onLogInError.bind(this)
    this.onLogInSuccess = this.onLogInSuccess.bind(this)
    this.openRerunScriptDialog = this.openRerunScriptDialog.bind(this)
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
    'r': () => this.rerunScript(),

    // The shift+r key opens the rerun script dialog.
    'shift+r': () => this.openRerunScriptDialog(),

    // The c key clears the cache.
    'c': () => this.openClearCacheDialog(),
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
      document.body.classList.add('embedded')
    }

    trackEventRemotely('viewReport')

    // When a user is viewing a shared report we will actually receive no
    // 'newReport' message, so we initialize the tracker here instead.
    if (this.connectionManager.isStaticConnection()) {
      initRemoteTracker({
        gatherUsageStats: true,
      })
    }
  }

  /**
   * Called by ConnectionManager when our connection state changes
   */
  handleConnectionStateChanged(newState) {
    logMessage(`Connection state changed from ${this.state.connectionState} to ${newState}`)

    this.setState({ connectionState: newState })

    if (newState === ConnectionState.CONNECTED) {
      logMessage('Reconnected to server; Requesting a run (which may be preheated)')
      this.widgetMgr.sendUpdateWidgetsMessage()
      this.setState({ dialog: null })
    }
  }

  showError(errorNode) {
    logError(errorNode)

    this.openDialog({
      type: 'warning',
      title: 'Connection error',
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
      dispatchProto(msgProto, 'type', {
        initialize: initializeMsg => this.handleInitialize(initializeMsg),
        sessionStateChanged: msg => this.handleSessionStateChanged(msg),
        sessionEvent: evtMsg => this.handleSessionEvent(evtMsg),
        newReport: newReportMsg => this.handleNewReport(newReportMsg),
        delta: deltaMsg => this.applyDelta(toImmutableProto(Delta, deltaMsg)),
        reportFinished: () => this.handleReportFinished(),
        uploadReportProgress: progress =>
          this.openDialog({ progress, type: 'uploadProgress' }),
        reportUploaded: url => this.openDialog({ url, type: 'uploaded' }),
      })
    } catch (err) {
      this.showError(err)
    }
  }

  /**
   * Handler for ForwardMsg.initialize messages
   * @param initializeMsg an Initialize protobuf
   */
  handleInitialize(initializeMsg) {
    setStreamlitVersion(initializeMsg.streamlitVersion)
    setInstallationId(initializeMsg.userInfo.installationId)

    initRemoteTracker({
      gatherUsageStats: initializeMsg.gatherUsageStats,
      email: initializeMsg.userInfo.email,
    })

    trackEventRemotely('createReport')

    this.setState({
      sharingEnabled: initializeMsg.sharingEnabled,
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

      if (stateChangeProto.reportIsRunning &&
        prevState.reportRunState !== ReportRunState.STOP_REQUESTED) {

        // If the report is running, we change our ReportRunState only
        // if we don't have a pending stop request
        reportRunState = ReportRunState.RUNNING

      } else if (!stateChangeProto.reportIsRunning &&
        prevState.reportRunState !== ReportRunState.RERUN_REQUESTED &&
        prevState.reportRunState !== ReportRunState.COMPILATION_ERROR) {

        // If the report is not running, we change our ReportRunState only
        // if we don't have a pending rerun request, and we don't have
        // a script compilation failure
        reportRunState = ReportRunState.NOT_RUNNING
      }

      return ({
        userSettings: {
          ...prevState.userSettings,
          runOnSave: stateChangeProto.runOnSave,
        },
        reportRunState,
      })
    })
  }

  /**
   * Handler for ForwardMsg.sessionEvent messages
   * @param sessionEvent a SessionEvent protobuf
   */
  handleSessionEvent(sessionEvent) {
    this.sessionEventDispatcher.handleSessionEventMsg(sessionEvent)
    if (sessionEvent.type === 'scriptCompilationException') {
      this.setState({ reportRunState: ReportRunState.COMPILATION_ERROR })
      this.openDialog({
        type: 'scriptCompileError',
        exception: sessionEvent.scriptCompilationException,
        onRerun: this.rerunScript,
      })
    } else if (RERUN_PROMPT_MODAL_DIALOG && sessionEvent.type === 'reportChangedOnDisk') {
      this.openDialog({
        type: 'scriptChanged',
        onRerun: this.rerunScript,
      })
    }
  }

  /**
   * Handler for ForwardMsg.newReport messages
   * @param newReportProto a NewReport protobuf
   */
  handleNewReport(newReportProto) {
    trackEventRemotely('updateReport')

    const name = newReportProto.name
    document.title = `${name} · Streamlit`

    this.setState({
      reportId: newReportProto.id,
      commandLine: newReportProto.commandLine.join(' '),
      reportName: name,
    })
  }

  /**
   * Handler for ForwardMsg.reportFinished messages
   */
  handleReportFinished() {
    // When a script finishes running, we clear any stale elements left over
    // from its previous run - unless our script had a fatal error during
    // execution.
    if (this.state.reportRunState !== ReportRunState.COMPILATION_ERROR) {
      this.clearOldElements()
    }
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
    document.body.classList.remove('modal-open')

    this.setState({ dialog: undefined })
  }

  /**
   * Saves a UserSettings object.
   */
  saveSettings(newSettings) {
    const prevRunOnSave = this.state.userSettings.runOnSave
    const runOnSave = newSettings.runOnSave

    this.setState({userSettings: newSettings})

    if (prevRunOnSave !== runOnSave && this.isServerConnected()) {
      this.sendBackMsg({type: 'setRunOnSave', setRunOnSave: runOnSave})
    }
  }

  /**
   * Applies a list of deltas to the elements.
   */
  applyDelta(delta) {
    if (
      this.state.reportRunState !== ReportRunState.RUNNING &&
      !this.connectionManager.isStaticConnection()
    ) {
      // Only add messages to report when script is running. Otherwise, we get
      // bugs like #685.
      return
    }

    const { reportId } = this.state
    this.setState(({ elements }) => ({
      elements: elements.update(delta.get('id'), element =>
        dispatchOneOf(delta, 'type', {
          newElement: newElement =>
            handleNewElementMessage(newElement, reportId),
          addRows: namedDataSet =>
            handleAddRowsMessage(element, namedDataSet),
        })),
    }))
  }

  /**
   * Removes all elements whose reportIds are no longer current.
   */
  clearOldElements() {
    this.setState(({ elements, reportId }) => ({
      elements: elements.filter(elt => elt && elt.get('reportId') === reportId),
    }))
  }

  /**
   * Used by e2e tests to test disabling widgets
   */
  closeConnection() {
    if (this.isServerConnected()) {
      this.sendBackMsg({
        type: 'closeConnection',
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
        trackEventRemotely('shareReport')
        this.sendBackMsg({
          type: 'cloudUpload',
          cloudUpload: true,
        })
      } else {
        this.openDialog({
          type: 'warning',
          title: 'Error sharing report',
          msg: (
            <React.Fragment>
              <div>
                You do not have sharing configured.
              </div>
              <div>
                Please contact{' '}
                <a href="mailto:hello@streamlit.io">Streamlit Support</a>
                {' '}to setup sharing.
              </div>
            </React.Fragment>
          ),
        })
      }
    } else {
      logError('Cannot save report when disconnected from server')
    }
  }

  /**
   * Opens the dialog to rerun the script.
   */
  openRerunScriptDialog() {
    if (this.isServerConnected()) {
      this.openDialog({
        type: 'rerunScript',
        getCommandLine: () => this.state.commandLine,
        setCommandLine: commandLine => this.setState({ commandLine }),
        rerunCallback: this.rerunScript,

        // This will be called if enter is pressed.
        defaultAction: this.rerunScript,
      })
    } else {
      logError('Cannot rerun script when disconnected from server.')
    }
  }

  /**
   * Reruns the script (given by this.state.commandLine).
   *
   * @param alwaysRunOnSave a boolean. If true, UserSettings.runOnSave
   * will be set to true, which will result in a request to the Server
   * to enable runOnSave for this report.
   */
  rerunScript(alwaysRunOnSave = false) {
    this.closeDialog()

    if (!this.isServerConnected()) {
      logError('Cannot rerun script when disconnected from server.')
      return
    }

    if (this.state.reportRunState === ReportRunState.RUNNING ||
      this.state.reportRunState === ReportRunState.RERUN_REQUESTED) {
      // Don't queue up multiple rerunScript requests
      return
    }

    trackEventRemotely('rerunScript')

    this.setState({reportRunState: ReportRunState.RERUN_REQUESTED})

    // Note: `rerunScript` is incorrectly called in some places.
    // We can remove `=== true` after adding type information
    if (alwaysRunOnSave === true) {
      // Update our run-on-save setting *before* calling rerunScript.
      // The rerunScript message currently blocks all BackMsgs from
      // being processed until the script has completed executing.
      this.saveSettings({...this.state.userSettings, runOnSave: true})
    }

    this.sendBackMsg({
      type: 'rerunScript',
      rerunScript: this.state.commandLine,
    })
  }

  /** Requests that the server stop running the report */
  stopReport() {
    if (!this.isServerConnected()) {
      logError('Cannot stop report when disconnected from server.')
      return
    }

    if (this.state.reportRunState === ReportRunState.NOT_RUNNING ||
      this.state.reportRunState === ReportRunState.STOP_REQUESTED) {
      // Don't queue up multiple stopReport requests
      return
    }

    this.sendBackMsg({type: 'stopReport', stopReport: true})
    this.setState({reportRunState: ReportRunState.STOP_REQUESTED})
  }

  /**
   * Shows a dialog asking the user to confirm they want to clear the cache
   */
  openClearCacheDialog() {
    if (this.isServerConnected()) {
      this.openDialog({
        type: 'clearCache',
        confirmCallback: this.clearCache,

        // This will be called if enter is pressed.
        defaultAction: this.clearCache,
      })
    } else {
      logError('Cannot clear cache: disconnected from server')
    }
  }

  /**
   * Asks the server to clear the st_cache
   */
  clearCache() {
    this.closeDialog()
    if (this.isServerConnected()) {
      trackEventRemotely('clearCache')
      this.sendBackMsg({type: 'clearCache', clearCache: true})
    } else {
      logError('Cannot clear cache: disconnected from server')
    }
  }

  /**
   * Sends a message back to the server.
   */
  sendBackMsg = (msg) => {
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
    this.showError(errNode)
  }

  /**
   * Indicates whether we're connected to the server.
   */
  isServerConnected() {
    return this.connectionManager ?
      this.connectionManager.isConnected() :
      false
  }

  settingsCallback() {
    this.openDialog({
      type: 'settings',
      isOpen: true,
      isServerConnected: this.isServerConnected(),
      settings: this.state.userSettings,
      onSave: this.saveSettings,
    })
  }

  aboutCallback() {
    this.openDialog({
      type: 'about',
      onClose: this.closeDialog,
    })
  }

  render() {
    const outerDivClass = [
      'stApp',
      isEmbeddedInIFrame() ?
        'streamlit-embedded' :
        this.state.userSettings.wideMode ?
          'streamlit-wide' :
          'streamlit-regular',
    ].join(' ')

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
            <nav>
              <a href="//streamlit.io">Streamlit</a>
            </nav>
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

          <Container className="streamlit-container">
            <Row className="justify-content-center">
              <Col className={this.state.userSettings.wideMode ?
                '' : 'col-lg-8 col-md-9 col-sm-12 col-xs-12'}>
                {this.state.showLoginBox ?
                  <LoginBox
                    onSuccess={this.onLogInSuccess}
                    onFailure={this.onLogInError}
                  />
                  :
                  <ReportView
                    elements={this.state.elements}
                    reportId={this.state.reportId}
                    reportRunState={this.state.reportRunState}
                    showStaleElementIndicator={this.state.connectionState !== ConnectionState.STATIC}
                    widgetMgr={this.widgetMgr}
                    widgetsDisabled={this.state.connectionState !== ConnectionState.CONNECTED}
                  />
                }
              </Col>
            </Row>

            <StreamlitDialog {...dialogProps}/>

          </Container>
        </div>
      </HotKeys>
    )
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
      this.userLoginResolver.reject('Error signing in.')
    }
  }

  onLogInError(msg) {
    this.userLoginResolver.reject(`Error signing in. ${msg}`)
  }
}


function handleNewElementMessage(element, reportId) {
  // TODO: Readd this when #652 is fixed.
  // trackEventRemotely('visualElementUpdated', {
  //   elementType: element.get('type'),
  // })

  // Set reportId on elements so we can clear old elements when the report
  // script is re-executed.
  return element.set('reportId', reportId)
}


function handleAddRowsMessage(element, namedDataSet) {
  // TODO: Readd this when #652 is fixed.
  // trackEventRemotely('dataMutated')
  return addRows(element, namedDataSet)
}


/**
 * Returns true if the URL parameters indicated that we're embedded in an
 * iframe.
 */
function isEmbeddedInIFrame() {
  return url.parse(window.location.href, true).query.embed === 'true'
}


function makeElementWithInfoText(text) {
  return fromJS({
    type: 'text',
    text: {
      format: TextProto.Format.INFO,
      body: text,
    },
  })
}


export default App
