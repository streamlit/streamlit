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

// Display Elements
import DataFrame from 'streamlit-shared/lib/elements/DataFrame';
import Chart from 'streamlit-shared/lib/elements/Chart';
import ImageList from 'streamlit-shared/lib/elements/ImageList';
import Text from 'streamlit-shared/lib/elements/Text';
import DocString from 'streamlit-shared/lib/elements/DocString';
import ExceptionElement from 'streamlit-shared/lib/elements/ExceptionElement';

// Other local imports.
import PersistentWebsocket from 'streamlit-shared/lib/PersistentWebsocket';
import { StreamlitMsg, Text as TextProto }
  from 'streamlit-shared/lib/protobuf/streamlit';
import { addRows } from 'streamlit-shared/lib/dataFrameProto';
import { toImmutableProto, dispatchOneOf }
  from 'streamlit-shared/lib/immutableProto';
import { fromJS } from 'immutable';

import './WebClient.css';

class WebClient extends PureComponent {
  constructor(props) {
    super(props);

    // Initially the state reflects that no data has been received.
    this.state = {
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
  }

  componentDidMount() {
  }

  componentWillUnmount() {
  }

  /**
   * Callback when we establish a websocket connection.
   */
  handleReconnect() {
    console.log('RECONNECTED TO THE SERVER');
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
  handleMessage(blob) {
    // Parse the deltas out and apply them to the state.
    const reader = new FileReader();
    reader.readAsArrayBuffer(blob)
    reader.onloadend = () => {
      // Parse out the delta_list.
      const result = new Uint8Array(reader.result);
      const msgProto = StreamlitMsg.decode(result)
      const msg = toImmutableProto(StreamlitMsg, msgProto);
      dispatchOneOf(msg, 'type', {
        newReport: (id) => {
          console.log(`newReport id=${id}`); // debug
          this.resetState(`Receiving data for report ${id}`,
            TextProto.Format.INFO);
        },
        deltaList: (deltaList) => {
          this.applyDeltas(deltaList);
        }
      });
    }
  }

  /**
   * Applies a list of deltas to the elements.
   */
  applyDeltas(deltaList) {
    // // debug - begin
    // console.log('applying deltas')
    // console.log(deltaList.toJS())
    // // debug - end

    this.setState(({elements}) => ({
      elements: deltaList.get('deltas').reduce((elements, delta) => (
        elements.update(delta.get('id'), (element) =>
          dispatchOneOf(delta, 'type', {
            newElement: (newElement) => newElement,
            addRows: (newRows) => addRows(element, newRows),
        }))), elements)
    }));
  }

  render() {
    // Compute the websocket URI based on the pathname.
    const reportName =
      decodeURIComponent(window.location.pathname).split( '/' )[2];
    document.title = `${reportName} (Streamlit)`
    let uri = `ws://localhost:5006/stream/${encodeURIComponent(reportName)}`

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
            <PersistentWebsocket
              uri={uri}
              onReconnect={this.handleReconnect}
              onMessage={this.handleMessage}
              persist={false}
            />
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
