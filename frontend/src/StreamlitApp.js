/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

/*jshint loopfunc:false */

import React, { PureComponent } from 'react';
import { hotkeys } from 'react-keyboard-shortcuts';
import { AutoSizer } from 'react-virtualized';
import {
  Alert,
  Col,
  Container,
  Progress,
  Row,
} from 'reactstrap';
import { fromJS } from 'immutable';
import url from 'url';

// Other local imports.
import LoginBox from './LoginBox';
import MainMenu from './MainMenu';
import Resolver from './Resolver';
import StreamlitDialog from './StreamlitDialog';
import { ConnectionManager } from './ConnectionManager';
import { ConnectionState } from './ConnectionState';
import { ReportRunState } from './ReportRunState';
import { StatusWidget } from './StatusWidget';
import { ReportEventDispatcher } from './ReportEvent';

// Load (non-lazy) core elements.
import Chart from './elements/Chart';
import DocString from './elements/DocString';
import ExceptionElement from './elements/ExceptionElement';
import Table from './elements/Table';
import { Text } from './elements/Text';

import { setStreamlitVersion } from './baseconsts';
import { ForwardMsg, Text as TextProto } from './protobuf';
import { addRows } from './dataFrameProto';
import { initRemoteTracker, trackEventRemotely } from './remotetracking';
import { toImmutableProto, dispatchOneOf } from './immutableProto';

import './StreamlitApp.css';

// Lazy-load display elements.
const Audio = React.lazy(() => import('./elements/Audio'));
const Balloons = React.lazy(() => import('./elements/Balloons'));
const DataFrame = React.lazy(() => import('./elements/DataFrame'));
const ImageList = React.lazy(() => import('./elements/ImageList'));
const Map = React.lazy(() => import('./elements/Map'));
const DeckGlChart = React.lazy(() => import('./elements/DeckGlChart'));
const PlotlyChart = React.lazy(() => import('./elements/PlotlyChart'));
const VegaLiteChart = React.lazy(() => import('./elements/VegaLiteChart'));
const Video = React.lazy(() => import('./elements/Video'));


class StreamlitApp extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      reportId: '<null>',
      reportName: null,
      elements: fromJS([makeElementWithInfoText('Connecting...')]),
      userSettings: {
        wideMode: false,
        runOnSave: true,
      },
      showLoginBox: false,
      reportRunState: ReportRunState.NOT_RUNNING,
      connectionState: ConnectionState.INITIAL,
    };

    // Bind event handlers.
    this.closeDialog = this.closeDialog.bind(this);
    this.getUserLogin = this.getUserLogin.bind(this);
    this.handleConnectionError = this.handleConnectionError.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.isProxyConnected = this.isProxyConnected.bind(this);
    this.onLogInError = this.onLogInError.bind(this);
    this.onLogInSuccess = this.onLogInSuccess.bind(this);
    this.openRerunScriptDialog = this.openRerunScriptDialog.bind(this);
    this.rerunScript = this.rerunScript.bind(this);
    this.stopReport = this.stopReport.bind(this);
    this.openClearCacheDialog = this.openClearCacheDialog.bind(this);
    this.clearCache = this.clearCache.bind(this);
    this.saveReport = this.saveReport.bind(this);
    this.saveSettings = this.saveSettings.bind(this);
    this.setReportName = this.setReportName.bind(this);

    this.userLoginResolver = new Resolver();
    this.reportEventDispatcher = new ReportEventDispatcher();
    this.statusWidgetRef = React.createRef();

    this.connectionManager = new ConnectionManager({
      getUserLogin: this.getUserLogin,
      onMessage: this.handleMessage,
      onConnectionError: this.handleConnectionError,
      setReportName: this.setReportName,
      connectionStateChanged: newState => {
        this.setState({connectionState: newState});
      },
    });
  }

  /**
   * Global keyboard shortcuts.
   */
  hot_keys = {
    // The r key reruns the script.
    'r': {
      priority: 1,
      handler: () => this.rerunScript(),
    },

    // 'a' reruns the script, and sets "always rerun" to true,
    // but only if the StatusWidget is currently prompting the
    // user to rerun
    'a': {
      priority: 1,
      handler: () => {
        if (this.statusWidgetRef.current != null) {
          this.statusWidgetRef.current.handleAlwaysRerunHotkeyPressed();
        }
      },
    },

    // The shift+r key opens the rerun script dialog.
    'shift+r': {
      priority: 1,
      handler: () => this.openRerunScriptDialog(),
    },

    // 'c' clears the cache
    'c': {
      priority: 1,
      handler: () => this.openClearCacheDialog(),
    },

    // The enter key runs the "default action" of the dialog.
    'enter': {
      priority: 1,
      handler: () => {
        if (this.state.dialog && this.state.dialog.defaultAction) {
          this.state.dialog.defaultAction();
        }
      },
    },
  };

  async componentDidMount() {
    if (isEmbeddedInIFrame()) {
      document.body.classList.add('embedded');
    }

    trackEventRemotely('viewReport');

    // When a user is viewing a shared report we will actually receive no
    // 'newReport' message, so we initialize the tracker here instead.
    if (this.connectionManager.isStaticConnection()) {
      initRemoteTracker({
        gatherUsageStats: true,
      });
    }
  }

  /**
   * Resets the state of client to an empty report containing a single
   * element which is an alert of the given type.
   *
   * msg    - The message to display
   * format - One of the accepted formats from Text.proto.
   */
  showSingleTextElement(msg, format) {
    this.setState({
      reportId: '<null>',
      elements: fromJS([{
        type: 'text',
        text: {
          format,
          body: msg,
        },
      }]),
    });
  }

  /**
   * Callback when we get a message from the server.
   */
  handleMessage(msgProto) {
    const msg = toImmutableProto(ForwardMsg, msgProto);

    dispatchOneOf(msg, 'type', {
      initialize: initializeMsg => this.handleInitialize(initializeMsg),
      sessionStateChanged: msg => this.handleSessionStateChanged(msg),
      sessionEvent: msg => this.handleSessionEvent(msg),
      newReport: newReportMsg => this.handleNewReport(newReportMsg),
      delta: delta => this.applyDelta(delta),
      reportFinished: () => this.clearOldElements(),
      uploadReportProgress: progress =>
        this.openDialog({ progress, type: 'uploadProgress' }),
      reportUploaded: url => this.openDialog({ url, type: 'uploaded' }),
    });
  }

  /**
   * Handler for ForwardMsg.initialize messages
   * @param initializeMsg an Initialize protobuf
   */
  handleInitialize(initializeMsg) {
    setStreamlitVersion(initializeMsg.get('streamlitVersion'));

    initRemoteTracker({
      gatherUsageStats: initializeMsg.get('gatherUsageStats'),
    });

    trackEventRemotely('createReport');

    this.setState({
      sharingEnabled: initializeMsg.get('sharingEnabled'),
    });

    const initialState = initializeMsg.get('sessionState');
    this.handleSessionStateChanged(initialState);
  }

  /**
   * Handler for ForwardMsg.sessionStateChanged messages
   * @param msg a SessionState protobuf
   */
  handleSessionStateChanged(msg) {
    const runOnSave = msg.get('runOnSave');
    const reportIsRunning = msg.get('reportIsRunning');

    this.setState(prevState => {
      // If we have a pending run-state request, only change our reportRunState
      // if our request has been processed.
      let reportRunState;
      if (reportIsRunning) {
        reportRunState =
          prevState.reportRunState === ReportRunState.STOP_REQUESTED ?
            ReportRunState.STOP_REQUESTED : ReportRunState.RUNNING;
      } else {
        reportRunState =
          prevState.reportRunState === ReportRunState.RERUN_REQUESTED ?
            ReportRunState.RERUN_REQUESTED : ReportRunState.NOT_RUNNING;
      }

      return ({
        userSettings: {
          ...prevState.userSettings,
          runOnSave,
        },
        reportRunState,
      });
    });
  }

  /**
   * Handler for ForwardMsg.sessionEvent messages
   * @param msg a SessionEvent protobuf
   */
  handleSessionEvent(msg) {
    this.reportEventDispatcher.handleSessionEventMsg(msg);
  }

  /**
   * Handler for ForwardMsg.newReport messages
   * @param newReportMsg a NewReport protobuf
   */
  handleNewReport(newReportMsg) {
    trackEventRemotely('updateReport');

    this.setState({
      reportId: newReportMsg.get('id'),
      commandLine: newReportMsg.get('commandLine').toJS().join(' '),
    });

    setTimeout(() => {
      if (newReportMsg.get('id') === this.state.reportId) {
        this.clearOldElements();
      }
    }, 3000);
  }

  /**
   * Opens a dialog with the specified state.
   */
  openDialog(dialogProps) {
    this.setState({ dialog: dialogProps });
  }

  /**
   * Closes the upload dialog if it's open.
   */
  closeDialog() {
    this.setState({ dialog: undefined });
  }

  /**
   * Saves a UserSettings object.
   */
  saveSettings(newSettings) {
    const prevRunOnSave = this.state.userSettings.runOnSave;
    const runOnSave = newSettings.runOnSave;

    this.setState({userSettings: newSettings});

    if (prevRunOnSave !== runOnSave && this.isProxyConnected()) {
      this.sendBackMsg({type: 'setRunOnSave', setRunOnSave: runOnSave});
    }
  }

  /**
   * Applies a list of deltas to the elements.
   */
  applyDelta(delta) {
    const { reportId } = this.state;
    this.setState(({ elements }) => ({
      elements: elements.update(delta.get('id'), element =>
        dispatchOneOf(delta, 'type', {
          newElement: newElement =>
            handleNewElementMessage(newElement, reportId),
          addRows: namedDataSet =>
            handleAddRowsMessage(element, namedDataSet),
        })),
    }));
  }

  /**
   * Empties out all elements whose reportIds are no longer current.
   */
  clearOldElements() {
    this.setState(({ elements, reportId }) => ({
      elements: elements.map((elt) => {
        if (elt.get('reportId') === reportId) {
          return elt;
        }
        return fromJS({
          reportId,
          empty: { unused: true },
          type: 'empty',
        });
      }),
    }));
  }

  /**
   * Callback to call when we want to save the report.
   */
  saveReport() {
    if (this.isProxyConnected()) {
      if (this.state.sharingEnabled) {
        trackEventRemotely('shareReport');
        this.sendBackMsg({
          type: 'cloudUpload',
          cloudUpload: true,
        });
      } else {
        this.openDialog({
          type: 'warning',
          msg: (
            <div>
              You do not have sharing configured.
              Please contact&nbsp;
              <a href="mailto:hello@streamlit.io">Streamlit Support</a>
              &nbsp;to setup sharing.
            </div>
          ),
        });
      }
    } else {
      console.warn('Cannot save report when proxy is disconnected');
    }
  }

  /**
   * Opens the dialog to rerun the script.
   */
  openRerunScriptDialog() {
    if (this.isProxyConnected()) {
      this.openDialog({
        type: 'rerunScript',
        getCommandLine: () => this.state.commandLine,
        setCommandLine: commandLine => this.setState({ commandLine }),
        rerunCallback: this.rerunScript,

        // This will be called if enter is pressed.
        defaultAction: this.rerunScript,
      });
    } else {
      console.warn('Cannot rerun script when proxy is disconnected.');
    }
  }

  /**
   * Reruns the script (given by this.state.commandLine).
   *
   * @param alwaysRunOnSave a boolean. If true, UserSettings.runOnSave
   * will be set to true, which will result in a request to the Proxy
   * to enable runOnSave for this report.
   */
  rerunScript(alwaysRunOnSave = false) {
    this.closeDialog();

    if (!this.isProxyConnected()) {
      console.warn('Cannot rerun script when proxy is disconnected.');
      return;
    }

    if (this.state.reportRunState === ReportRunState.RUNNING ||
      this.state.reportRunState === ReportRunState.RERUN_REQUESTED) {
      // Don't queue up multiple rerunScript requests
      return;
    }

    trackEventRemotely('rerunScript');

    this.setState({reportRunState: ReportRunState.RERUN_REQUESTED});

    if (alwaysRunOnSave) {
      // Update our run-on-save setting *before* calling rerunScript.
      // The rerunScript message currently blocks all BackMsgs from
      // being processed until the script has completed executing.
      this.saveSettings({...this.state.userSettings, runOnSave: true});
    }

    this.sendBackMsg({
      type: 'rerunScript',
      rerunScript: this.state.commandLine,
    });
  }

  /** Requests that the server stop running the report */
  stopReport() {
    if (!this.isProxyConnected()) {
      console.warn('Cannot stop report when proxy is disconnected.');
      return;
    }

    if (this.state.reportRunState === ReportRunState.NOT_RUNNING ||
      this.state.reportRunState === ReportRunState.STOP_REQUESTED) {
      // Don't queue up multiple stopReport requests
      return;
    }

    this.sendBackMsg({type: 'stopReport', stopReport: true});
    this.setState({reportRunState: ReportRunState.STOP_REQUESTED});
  }

  /**
   * Shows a dialog asking the user to confirm they want to clear the cache
   */
  openClearCacheDialog() {
    if (this.isProxyConnected()) {
      this.openDialog({
        type: 'clearCache',
        confirmCallback: this.clearCache,

        // This will be called if enter is pressed.
        defaultAction: this.clearCache,
      });
    } else {
      console.warn('Cannot clear cache: proxy is disconnected');
    }
  }

  /**
   * Asks the server to clear the st_cache
   */
  clearCache() {
    this.closeDialog();
    if (this.isProxyConnected()) {
      trackEventRemotely('clearCache');
      this.sendBackMsg({type: 'clearCache', clearCache: true});
    } else {
      console.warn('Cannot clear cache: proxy is disconnected');
    }
  }

  /**
   * Sends a message back to the proxy.
   */
  sendBackMsg(msg) {
    if (this.connectionManager) {
      this.connectionManager.sendMessage(msg);
    } else {
      console.error(`Not connected. Cannot send back message: ${msg}`);
    }
  }

  /**
   * Updates the report body when there's a connection error.
   */
  handleConnectionError(errMsg) {
    this.showSingleTextElement(
      `Connection error: ${errMsg}`, TextProto.Format.WARNING);
  }

  /**
   * Indicates whether we're connected to the proxy.
   */
  isProxyConnected() {
    return this.connectionManager ?
      this.connectionManager.isConnected() :
      false;
  }

  /**
   * Sets the reportName in state and upates the title bar.
   */
  setReportName(reportName) {
    document.title = `${reportName} · Streamlit`;
    this.setState({ reportName });
  }

  render() {
    const outerDivClass =
        isEmbeddedInIFrame() ?
          'streamlit-embedded' :
          this.state.userSettings.wideMode ?
            'streamlit-wide' :
            'streamlit-regular';

    return (
      <div className={outerDivClass}>
        <header>
          <div className="decoration" />
          <div id="brand">
            <a href="//streamlit.io">Streamlit</a>
          </div>
          <StatusWidget
            ref={this.statusWidgetRef}
            connectionState={this.state.connectionState}
            reportEventDispatcher={this.reportEventDispatcher}
            reportRunState={this.state.reportRunState}
            rerunReport={this.rerunScript}
            stopReport={this.stopReport}
          />
          <MainMenu
            isProxyConnected={this.isProxyConnected}
            saveCallback={this.saveReport}
            quickRerunCallback={this.rerunScript}
            rerunCallback={this.openRerunScriptDialog}
            clearCacheCallback={this.openClearCacheDialog}
            settingsCallback={() => this.openDialog({
              type: 'settings',
              isOpen: true,
              isProxyConnected: this.isProxyConnected(),
              settings: this.state.userSettings,
              onSave: this.saveSettings,
            })}
            aboutCallback={() => this.openDialog({
              type: 'about',
              onClose: this.closeDialog,
            })}
          />
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
                <AutoSizer className="main">
                  { ({ width }) => this.renderElements(width) }
                </AutoSizer>
              }
            </Col>
          </Row>

          <StreamlitDialog
            dialogProps={{
              ...this.state.dialog,
              onClose: this.closeDialog,
            }}
          />

        </Container>
      </div>
    );
  }

  renderElements(width) {
    return this.state.elements.map((element) => {
      try {
        if (!element) { throw new Error('Transmission error.'); }
        return dispatchOneOf(element, 'type', {
          audio: audio => <Audio audio={audio} width={width} />,
          balloons: balloons => <Balloons balloons={balloons} />,
          chart: chart => <Chart chart={chart} width={width} />,
          dataFrame: df => <DataFrame df={df} width={width} />,
          deckGlChart: el => <DeckGlChart element={el} width={width} />,
          docString: doc => <DocString element={doc} width={width} />,
          empty: empty => undefined,
          exception: exc => <ExceptionElement element={exc} width={width} />,
          imgs: imgs => <ImageList imgs={imgs} width={width} />,
          map: map => <Map map={map} width={width} />,
          plotlyChart: el => <PlotlyChart element={el} width={width} />,
          progress: p => <Progress value={p.get('value')} style={{width}} />,
          table: df => <Table df={df} width={width} />,
          text: text => <Text element={text} width={width} />,
          vegaLiteChart: el => <VegaLiteChart element={el} width={width} />,
          video: video => <Video video={video} width={width} />,
        });
      } catch (err) {
        return <Alert color="warning" style={{ width }}>{err.message}</Alert>;
      }
    }).push(
      <div style={{ width }} className="footer" />
    ).flatMap((element, indx) => {
      if (element) {
        return [
          <React.Suspense
            fallback={<Text
              element={makeElementWithInfoText('Loading...').get('text')}
              width={width}
            />}
            className="element-container"
            key={indx}
          >
            {element}
          </React.Suspense>,
        ];
      } else {
        return [];
      }
    });
  }

  async getUserLogin() {
    this.setState({ showLoginBox: true });
    const idToken = await this.userLoginResolver.promise;
    this.setState({ showLoginBox: false });

    return idToken;
  }

  onLogInSuccess({ accessToken, idToken }) {
    if (accessToken) {
      this.userLoginResolver.resolve(idToken);
    } else {
      this.userLoginResolver.reject('Error signing in.');
    }
  }

  onLogInError(msg) {
    this.userLoginResolver.reject(`Error signing in. ${msg}`);
  }
}


function handleNewElementMessage(element, reportId) {
  trackEventRemotely('visualElementUpdated', {
    elementType: element.get('type'),
  });
  return element.set('reportId', reportId);
}


function handleAddRowsMessage(element, namedDataSet) {
  trackEventRemotely('dataMutated');
  return addRows(element, namedDataSet);
}


/**
 * Returns true if the URL parameters indicated that we're embedded in an
 * iframe.
 */
function isEmbeddedInIFrame() {
  return url.parse(window.location.href, true).query.embed === 'true';
}


function makeElementWithInfoText(text) {
  return fromJS({
    type: 'text',
    text: {
      format: TextProto.Format.INFO,
      body: text,
    },
  });
}


export default hotkeys(StreamlitApp);
