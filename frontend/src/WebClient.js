/*jshint loopfunc:false */

import React, { PureComponent } from 'react';
import { AutoSizer } from 'react-virtualized';
import {
  Alert,
  Button,
  Col,
  Container,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
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
import WebsocketConnection from './WebsocketConnection';
import StaticConnection from './StaticConnection';
import { ForwardMsg, BackMsg, Text as TextProto }
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
    const { query } = url.parse(window.location.href, true);
    if (query.name !== undefined) {
        const reportName = query.name;
        document.title = `${reportName} (Streamlit)`
        let uri = `ws://localhost:5009/stream/${encodeURIComponent(reportName)}`
        // Create the websocket connection.
        console.log('About to create websocket conneting to', uri)
        this.connection = new WebsocketConnection({
          uri: uri,
          onMessage: this.handleMessage.bind(this),
          incomingMessageType: ForwardMsg,
          outgoingMessageType: BackMsg,
        })
        console.log('Created the websocket.')
    } else if (query.id !== undefined) {
        console.log('Doing a connection with report id', query.id);
        this.connection = new StaticConnection({
          reportId: query.id,
          onMessage: this.handleMessage.bind(this),
        })
    } else {
      this.resetState('URL must contain either a report name or an ID.',
        TextProto.Format.ERROR);
    }
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
        console.log('uploadReportProgress');
      },
      reportUploaded: (url) => {
        console.log('reportUploaded');
      },
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

  sendBackMsg(command) {
    return () => {
      const msg = {command: BackMsg.Command[command]}
      console.log('About to send message', msg)
      this.connection.sendToProxy(msg)
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

    const toggle = () => { console.log('toggle'); };

    // Return the tree
    return (
      <div>
        <header>
          <a className="brand" href="/">Streamlit</a>
          <div className="connection-status">
            <svg id="cloud-upload-icon" viewBox="0 0 8 8" width="1em"
                onClick={this.sendBackMsg('CLOUD_UPLOAD')}>
              <use xlinkHref={'./open-iconic.min.svg#cloud-upload'} />
            </svg>
            <svg id="info-icon" viewBox="0 0 8 8" width="1em"
              onClick={this.sendBackMsg('HELP')}>
              <use xlinkHref={'./open-iconic.min.svg#info'} />
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

          <Modal isOpen={true} toggle={toggle} className={""}>
            <ModalHeader toggle={toggle}>Modal title</ModalHeader>
            <ModalBody>
              Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </ModalBody>
            <ModalFooter>
              <Button color="primary" onClick={toggle}>Do Something</Button>{' '}
              <Button color="secondary" onClick={toggle}>Cancel</Button>
            </ModalFooter>
          </Modal>
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
