/*jshint loopfunc:false */

import React, { PureComponent } from 'react';
import { AutoSizer } from 'react-virtualized';
import {
  Alert,
  Col,
  Container,
  Progress,
  Row,
  // UncontrolledTooltip,
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
import ProtobufWebsocket from './ProtobufWebsocket';
// import PersistentWebsocket from './PersistentWebsocket';
import { StreamlitMsg, BackendMsg, Text as TextProto }
  from './protobuf';
import { addRows } from './dataFrameProto';
import { toImmutableProto, dispatchOneOf }
  from './immutableProto';

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
  }

  componentDidMount() {
      // var localhost = false;
      // if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      //     localhost = true;
      //
      // if (!localhost) {
      //     var callback = (blob) =>  {
      //         this.handleMessage(blob);
      //     };
      //
      //     fetch('data.pb').then(function(response) {
      //         return response.arrayBuffer();
      //     }).then(function(data) {
      //         return new Uint8Array(data);
      //     }).then(callback);
      // }

    const { query } = url.parse(window.location.href, true);
    const reportName = query.name;
    document.title = `${reportName} (Streamlit)`
    let uri = `ws://localhost:5009/stream/${encodeURIComponent(reportName)}`
    console.log("Old fashioned connect to", uri)

    // Create the websocket connection.
    console.log('About to create websocket conneting to', uri)
    this.websocket = new ProtobufWebsocket({
      uri: uri,
      onMessage: this.handleMessage.bind(this),
      incomingMessageType: StreamlitMsg,
      outgoingMessageType: BackendMsg,
    })
    console.log('Created the websocket.')

    // this.handleReconnect = this.handleReconnect.bind(this);
    // this.handleMessage =
    // this.handleRegister = this.handleRegister.bind(this);
    // this.sendCommand = this.sendCommand.bind(this);
    //
    // //

      // var urlParams = new URLSearchParams(window.location.search);
      // var datafile = urlParams.get('datafile');
      // console.log(datafile);
      // if (datafile) {
      //     var callback = (blob) =>  {
      //         this.handleMessage(blob);
      //     };
      //
      //     fetch('/data/' + datafile).then(function(response) {
      //         return response.arrayBuffer();
      //     }).then(function(data) {
      //         var uint8 = new Uint8Array(data);
      //         var blob = new Blob([uint8]);
      //         return blob;
      //     }).then(callback);
      // }
  }

  componentWillUnmount() {
  }

  /**
   * Callback when we establish a websocket connection.
   */
  handleReconnect() {
    // Initially the state reflects that no data has been received.
    this.resetState('Established connection.', TextProto.Format.WARNING);
  }

  /**
   * Resets the state of client to an empty report containing a single
   * element which is an alert of the given type.
   *
   * msg    - The message to display
   * format - One of the accepted formats from Text.proto.
   */
  resetState(msg, format) {
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
    const msg = toImmutableProto(StreamlitMsg, msgProto);
    dispatchOneOf(msg, 'type', {
      newReport: (id) => {
        this.setState(() => ({reportId: id}))
        setTimeout(() => {
          if (id === this.state.reportId)
            this.clearOldElements();
        }, 2000);
        // this.resetState(`Receiving data for report ${id}`,
        //   TextProto.Format.INFO);
      },
      deltaList: (deltaList) => {
        this.applyDeltas(deltaList);
      },
      reportFinished: () => {
        this.clearOldElements();
      }
    });
  }

  handleRegister(sender) {
    this.setState(_ => ({ sender }))
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

  sendBackendMsg(command) {
    return () => {
      const msg = {command: BackendMsg.Command[command]}
      console.log('About to send message', msg)
      this.websocket.sendMessage(msg)
    }
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
          <a className="brand" href="/">Streamlit</a>
          <div className="connection-status">
            <svg id="cloud-upload-icon" viewBox="0 0 8 8" width="1em"
                onClick={this.sendBackendMsg('CLOUD_UPLOAD')}>
              <use xlinkHref={'/open-iconic.min.svg#cloud-upload'} />
            </svg>
            <svg id="info-icon" viewBox="0 0 8 8" width="1em"
              onClick={this.sendBackendMsg('HELP')}>
              <use xlinkHref={'/open-iconic.min.svg#info'} />
            </svg>
            {/* <PersistentWebsocket
              uri={uri}
              onReconnect={this.handleReconnect}
              onMessage={this.handleMessage}
              onRegister={this.handleRegister}
              persist={false}
            /> */}
          </div>
        </header>
        <Container className="streamlit-container">
          <Row className="justify-content-center">
            <Col className="col-lg-8 col-md-9 col-sm-12 col-xs-12">
              <AutoSizer className="main">
                { ({width}) => this.renderElements(width) }
              </AutoSizer>
            </Col>
          </Row>
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
      if (element)
        return [<div className="element-container" key={indx}>{element}</div>]
      else
        return []
    })
  }
}

export default WebClient;
