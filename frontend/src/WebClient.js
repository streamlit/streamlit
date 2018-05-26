/*jshint loopfunc:false */

import React, { PureComponent } from 'react';
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
import DataFrame from './elements/DataFrame';
import Chart from './elements/Chart';
import ImageList from './elements/ImageList';
import Text from './elements/Text';
import DocString from './elements/DocString';
import ExceptionElement from './elements/ExceptionElement';
import Map from './elements/Map';
import Table from './elements/Table';

// Other local imports.
import MainMenu from './MainMenu';
import ConnectionStatus from './ConnectionStatus';
import WebsocketConnection from './WebsocketConnection';
import StaticConnection from './StaticConnection';
import UploadDialog from './UploadDialog';

import { ForwardMsg, BackMsg, Text as TextProto } from './protobuf';
import { addRows } from './dataFrameProto';
import { toImmutableProto, dispatchOneOf } from './immutableProto';

import './WebClient.css';

class WebClient extends PureComponent {
  constructor(props) {
    super(props);

    // Initially the state reflects that no data has been received.
    this.state = {
      reportId: '<null>',
      elements: fromJS([{
        type: 'text',
        text: {
          format: 8,  // info
          body: 'Ready to receive data',
        }
      }]),
    };

    // Bind event handlers.
    this.handleReconnect = this.handleReconnect.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleRegister = this.handleRegister.bind(this);
    this.closeUploadDialog = this.closeUploadDialog.bind(this);
    this.setConnectionState = this.setConnectionState.bind(this);
  }

  componentDidMount() {
    const { query } = url.parse(window.location.href, true);
    if (query.name !== undefined) {
        const reportName = query.name;
        document.title = `${reportName} (Streamlit)`
        let uri = `ws://localhost:5009/stream/${encodeURIComponent(reportName)}`
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
      newReport: (id) => {
        this.setState(() => ({reportId: id}))
        setTimeout(() => {
          if (id === this.state.reportId)
            this.clearOldElements();
        }, 2000);
      },
      deltaList: (deltaList) => {
        this.applyDeltas(deltaList);
      },
      reportFinished: () => {
        this.clearOldElements();
      },
      uploadReportProgress: (progress) => {
        this.setState({
          uploadProgress: progress,
          uploadUrl: undefined
        });
      },
      reportUploaded: (url) => {
        console.log('Copied text to clipboard', url);
        this.setState({
          uploadProgress: undefined,
          uploadUrl: url,
        });
      },
    });
  }

  handleRegister(sender) {
    this.setState(_ => ({ sender }));
  }

  /**
   * Closes the upload dialog if it's open.
   */
  closeUploadDialog() {
    console.log('closeUploadDialog');
    this.setState({
      uploadProgress: undefined,
      uploadUrl: undefined,
    });
  }

  /**
   * Applies a list of deltas to the elements.
   */
  applyDeltas(deltaList) {
    // // debug - begin
    // console.log(`applying deltas to report id ${this.state.reportId}`)
    // // debug - end

    const reportId = this.state.reportId;
    this.setState(({elements}) => ({
      elements: deltaList.get('deltas').reduce((elements, delta) => (
        elements.update(delta.get('id'), (element) =>
          dispatchOneOf(delta, 'type', {
            newElement: (newElement) => newElement.set('reportId', reportId),
            addRows: (newRows) => addRows(element, newRows),
        }))), elements)
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

  sendBackMsg(command) {
    if (!this.connection) return;
    const msg = {command: BackMsg.Command[command]};
    this.connection.sendToProxy(msg);
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


  render() {
    // Compute the websocket URI based on the pathname.
    // const reportName =
    //   decodeURIComponent(window.location.pathname).split( '/' )[2];


    // const get_report = /nb\/(.*)/.exec(window.location.pathname)
    // if (get_report)
    //   uri = `ws://localhost:8554/api/get/${get_report[1]}`
    // else if (window.location.pathname === '/x')
    //   uri = 'ws://localhost:8554/api/getx/'
    // // console.log(`For path=${window.location.pathname} uri=${uri}`)

    // Return the tree
    return (
      <div>
        <header>
          <div id="brand">
            <a href="/">Streamlit</a>
          </div>
          <ConnectionStatus connectionState={this.state.connectionState} />
          <MainMenu
            helpButtonCallback={() => this.sendBackMsg('HELP')}
            saveButtonCallback={() => this.sendBackMsg('CLOUD_UPLOAD')}
            />
        </header>
        <Container className="streamlit-container">
          <Row className="justify-content-center">
            <Col className="col-lg-8 col-md-9 col-sm-12 col-xs-12">
              <AutoSizer className="main">
                { ({width}) => this.renderElements(width) }
              </AutoSizer>
            </Col>
          </Row>

          <UploadDialog
            progress={this.state.uploadProgress}
            url={this.state.uploadUrl}
            onClose={this.closeUploadDialog}
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
          dataFrame: (df) => <DataFrame df={df} width={width}/>,
          chart: (chart) => <Chart chart={chart} width={width}/>,
          imgs: (imgs) => <ImageList imgs={imgs} width={width}/>,
          progress: (p) => <Progress value={p.get('value')} style={{width}}/>,
          text: (text) => <Text element={text} width={width}/>,
          docString: (doc) => <DocString element={doc} width={width}/>,
          exception: (exc) => <ExceptionElement element={exc} width={width}/>,
          empty: (empty) => undefined,
          map: (map) => <Map map={map} width={width}/>,
          table: (df) => <Table df={df} width={width}/>,
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

export default WebClient;
