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

// Display Elements
import Audio from './elements/Audio';
import Balloons from './elements/Balloons';
import Chart from './elements/Chart';
import DataFrame from './elements/DataFrame';
import DocString from './elements/DocString';
import ExceptionElement from './elements/ExceptionElement';
import ImageList from './elements/ImageList';
import Map from './elements/Map';
import DeckGlChart from './elements/DeckGlChart';
import Table from './elements/Table';
import Text from './elements/Text';
import VegaLiteChart from './elements/VegaLiteChart';
import Video from './elements/Video';

// Other local imports.
import MainMenu from './MainMenu';
import ConnectionState from './ConnectionState';
import ConnectionStatus from './ConnectionStatus';
import WebsocketConnection from './WebsocketConnection';
import StaticConnection from './StaticConnection';
import StreamlitDialog from './StreamlitDialog';

import { ForwardMsg, Text as TextProto } from './protobuf';
import { PROXY_PORT_PROD } from './baseconsts';
import { addRows } from './dataFrameProto';
import { initRemoteTracker, trackEventRemotely } from './remotetracking';
import { toImmutableProto, dispatchOneOf } from './immutableProto';

import './WebClient.css';

class WebClient extends PureComponent {
  constructor(props) {
    super(props);

    // Initially the state reflects that no data has been received.
    this.state = {
      reportId: '<null>',
      reportName: null,
      elements: fromJS([{
        type: 'text',
        text: {
          format: TextProto.Format.INFO,
          body: 'Ready to receive data',
        }
      }]),
      userSettings: {
        wideMode: false,
      },
    };

    // Bind event handlers.
    this.handleReconnect = this.handleReconnect.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
    this.saveSettings = this.saveSettings.bind(this);
    this.setConnectionState = this.setConnectionState.bind(this);
    this.isProxyConnected = this.isProxyConnected.bind(this);
    this.setReportName = this.setReportName.bind(this);
    this.saveReport = this.saveReport.bind(this);
    this.displayHelp = this.displayHelp.bind(this);
    this.openRerunScriptDialog = this.openRerunScriptDialog.bind(this);
    this.rerunScript = this.rerunScript.bind(this);
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

    // The shift+r key opens the rerun script dialog.
    'shift+r': {
      priority: 1,
      handler: () => this.openRerunScriptDialog(),
    },

    // The enter key runs the "default action" of the dialog.
    'enter': {
      priority: 1,
      handler: () => {
        if (this.state.dialog && this.state.dialog.defaultAction)
          this.state.dialog.defaultAction();
      },
    }
  }

  componentDidMount() {
    const { query } = url.parse(window.location.href, true);
    if (query.name !== undefined) {
        const reportName = query.name;
        this.setReportName(reportName);
        let uri = `ws://${window.location.hostname}:${PROXY_PORT_PROD}/stream/${encodeURIComponent(reportName)}`
        this.connection = new WebsocketConnection({
          uri: uri,
          onMessage: this.handleMessage,
          setConnectionState: this.setConnectionState,
        });
    } else if (query.id !== undefined) {
        this.connection = new StaticConnection({
          reportId: query.id,
          onMessage: this.handleMessage,
          setConnectionState: this.setConnectionState,
          setReportName: this.setReportName,
        });
    } else {
      this.showSingleTextElement(
        'URL must contain either a report name or an ID.',
        TextProto.Format.ERROR
      );
    }
  }

  componentWillUnmount() {
  }

  /**
   * Callback when we establish a websocket connection.
   */
  handleReconnect() {
    // Initially the state reflects that no data has been received.
    this.showSingleTextElement('Established connection.', TextProto.Format.WARNING);
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
          format: format,
          body: msg,
        }
      }]),
    });
  }

  /**
   * Callback when we get a message from the server.
   */
  handleMessage(msgProto) {
    const msg = toImmutableProto(ForwardMsg, msgProto);

    dispatchOneOf(msg, 'type', {
      newConnection: (connectionProperties) => {
        initRemoteTracker({
          remotelyTrackUsage: connectionProperties.get('remotelyTrackUsage'),
        });
        trackEventRemotely('newConnection', 'newMessage');
        this.setState({
          sharingEnabled: connectionProperties.get('sharingEnabled'),
        });
      },
      newReport: (newReportMsg) => {
        trackEventRemotely('newReport', 'newMessage');
        this.setState({
          reportId: newReportMsg.get('id'),
          commandLine: newReportMsg.get('commandLine').toJS().join(' '),
        });
        setTimeout(() => {
          if (newReportMsg.get('id') === this.state.reportId) {
            this.clearOldElements();
          }
        }, 3000);
      },
      delta: (delta) => {
        this.applyDelta(delta);
      },
      reportFinished: () => {
        this.clearOldElements();
      },
      uploadReportProgress: (progress) => {
        this.openDialog({type: 'uploadProgress', progress: progress});
      },
      reportUploaded: (url) => {
        this.openDialog({type: 'uploaded', url: url})
      },
    });
  }

  /**
   * Opens a dialog with the specified state.
   */
  openDialog(dialogProps) {
    this.setState({dialog: dialogProps});
  }

  /**
   * Closes the upload dialog if it's open.
   */
  closeDialog() {
    this.setState({dialog: undefined});
  }

  /**
   * Saves a settings object.
   */
  saveSettings(settings) {
    this.setState({
      userSettings: {
        ...this.state.userSettings,
        wideMode: settings.wideMode,
      },
    });
  }

  /**
   * Applies a list of deltas to the elements.
   */
  applyDelta(delta) {
    const reportId = this.state.reportId;
    this.setState(({elements}) => ({
      elements: elements.update(delta.get('id'), (element) =>
          dispatchOneOf(delta, 'type', {
            newElement: (newElement) => newElement.set('reportId', reportId),
            addRows: (newRows) => addRows(element, newRows),
        }))
    }));
  }

  /**
   * Empties out all elements whose reportIds are no longer current.
   */
  clearOldElements() {
    this.setState(({elements, reportId}) => ({
      elements: elements.map((elt) => {
        if (elt.get('reportId') === reportId) {
          return elt;
        } else {
          return fromJS({
            empty: {unused: true},
            reportId: reportId,
            type: "empty"
          });
        }
      })
    }));
  }

  /**
   * Callback to call when we want to save the report.
   */
  saveReport() {
    if (this.state.sharingEnabled) {
      trackEventRemotely('saveReport', 'newInteraction');
      this.sendBackMsg({
        type: 'cloudUpload',
        cloudUpload: true,
      });
    } else {
      this.openDialog({
        type: "warning",
        msg: (
          <div>
            You do not have Amazon S3 or Google GCS sharing configured.
            Please contact&nbsp;
              <a href="mailto:adrien@streamlit.io">Adrien</a>
            &nbsp;to setup sharing.
          </div>
        ),
      });
    }
  }

  /**
   * Opens the dialog to rerun the script.
   */
  openRerunScriptDialog() {
    if (this.isProxyConnected()) {
      this.openDialog({
        type: "rerunScript",
        getCommandLine: (() => this.state.commandLine),
        setCommandLine: ((commandLine) => this.setState({commandLine})),
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
   */
  rerunScript() {
    this.closeDialog();
    if (this.isProxyConnected()) {
      trackEventRemotely('rerunScript', 'newInteraction');
      this.sendBackMsg({
        type: 'rerunScript',
        rerunScript: this.state.commandLine
      });
    } else {
      console.warn('Cannot rerun script when proxy is disconnected.');
    }
  }

  /**
   * Tells the proxy to display the inline help dialog.
   */
  displayHelp() {
    trackEventRemotely('displayHelp', 'newInteraction');
    this.sendBackMsg({
      type: 'help',
      help: true
    });
  }

  /**
   * Sends a message back to the proxy.
   */
  sendBackMsg(msg) {
    if (this.connection) {
      console.error('Sending back message:');
      console.error(msg);
      this.connection.sendToProxy(msg);
    } else {
      console.error('Cannot send a back message without a connection:');
      console.error(msg);
    }
  }

  /**
   * Sets the connection state to given value defined in ConnectionStatus.js.
   * errMsg is an optional error message to display on the screen.
   */
  setConnectionState({connectionState, errMsg}) {
    this.setState({connectionState: connectionState});
    if (errMsg)
      this.showSingleTextElement(errMsg, TextProto.Format.WARNING);
  }

  /**
   * Indicates whether we're connect to the proxy.
   */
  isProxyConnected() {
    return !(
      this.state.connectionState === ConnectionState.STATIC ||
      this.state.connectionState === ConnectionState.DISCONNECTED ||
      this.state.connectionState === null);
  }

  /**
   * Sets the reportName in state and upates the title bar.
   */
  setReportName(reportName) {
    document.title = `${reportName} (Streamlit)`
    this.setState({reportName});
  }

  render() {
    return (
      <div className={this.state.userSettings.wideMode ? 'wide' : ''}>
        <header>
          <div id="brand">
            <a href="http://streamlit.io">Streamlit</a>
          </div>
          <ConnectionStatus connectionState={this.state.connectionState} />
          <MainMenu
            isHelpPage={this.state.reportName === 'help'}
            isProxyConnected={this.isProxyConnected()}
            helpCallback={this.displayHelp}
            saveCallback={this.saveReport}
            quickRerunCallback={this.rerunScript}
            rerunCallback={this.openRerunScriptDialog}
            settingsCallback={() => this.openDialog({
              type: 'settings',
              isOpen: true,
              settings: this.state.userSettings,
              onSave: this.saveSettings,
            })}
          />
        </header>

        <Container className="streamlit-container">
          <Row className="justify-content-center">
            <Col className={this.state.userSettings.wideMode ?
                '' : 'col-lg-8 col-md-9 col-sm-12 col-xs-12'}>
              <AutoSizer className="main">
                { ({width}) => this.renderElements(width) }
              </AutoSizer>
            </Col>
          </Row>

          <StreamlitDialog
            dialogProps={{...this.state.dialog, onClose: this.closeDialog}}
          />

        </Container>
      </div>
    );
  }

  renderElements(width) {
    return this.state.elements.map((element) => {
      try {
        if (!element) throw new Error('Transmission error.');
        return dispatchOneOf(element, 'type', {
          audio: (audio) => <Audio audio={audio} width={width}/>,
          balloons: (balloons) => <Balloons balloons={balloons}/>,
          chart: (chart) => <Chart chart={chart} width={width}/>,
          dataFrame: (df) => <DataFrame df={df} width={width}/>,
          deckGlChart: (el) => <DeckGlChart element={el} width={width}/>,
          docString: (doc) => <DocString element={doc} width={width}/>,
          empty: (empty) => undefined,
          exception: (exc) => <ExceptionElement element={exc} width={width}/>,
          imgs: (imgs) => <ImageList imgs={imgs} width={width}/>,
          map: (map) => <Map map={map} width={width}/>,
          progress: (p) => <Progress value={p.get('value')} style={{width}}/>,
          table: (df) => <Table df={df} width={width}/>,
          text: (text) => <Text element={text} width={width}/>,
          vegaLiteChart: (chart) => <VegaLiteChart chart={chart} width={width}/>,
          video: (video) => <Video video={video} width={width}/>,
        });
      } catch (err) {
        return <Alert color="warning" style={{width}}>{err.message}</Alert>;
      }
    }).push(
      <div style={{width}} className="footer"/>
    ).flatMap((element, indx) => {
      if (element) {
        return [<div className="element-container" key={indx}>{element}</div>];
      } else {
        return [];
      }
    })
  }
}

export default hotkeys(WebClient);
