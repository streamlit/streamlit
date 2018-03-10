/*jshint loopfunc:false */

import React, { PureComponent } from 'react';
import { AutoSizer } from 'react-virtualized';
import {
  Alert,
  Col,
  Container,
  Navbar,
  NavItem,
  NavbarBrand,
  Progress,
  Row,
} from 'reactstrap';

// Display Elements
import DataFrame from 'streamlet-shared/lib/elements/DataFrame';
import Div from 'streamlet-shared/lib/elements/Div';
import Chart from 'streamlet-shared/lib/elements/Chart';
import ImageList from 'streamlet-shared/lib/elements/ImageList';

// Other local imports.
import PersistentWebsocket from 'streamlet-shared/lib/PersistentWebsocket';
import { DeltaList } from 'streamlet-shared/lib/protobuf/streamlet';
import { addRows } from 'streamlet-shared/lib/dataFrameProto';
import { toImmutableProto, dispatchOneOf }
  from 'streamlet-shared/lib/immutableProto';
import { fromJS } from 'immutable';

import './WebClient.css';

class WebClient extends PureComponent {
  constructor(props) {
    super(props);

    // Initially the state reflects that no data has been received.
    this.state = {
      elements: fromJS([{
        type: 'div',
        div: {
          text: 'No data received.',
          classes: 'alert alert-info',
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
    this.setState({
      elements: fromJS([{
        type: 'div',
        div: {
          text: 'Established connection.',
          classes: 'alert alert-warning',
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
      const deltaListProto = DeltaList.decode(result);
      const deltaList = toImmutableProto(DeltaList, deltaListProto);
      this.applyDeltas(deltaList);
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
    let uri = "ws://localhost:9667/latest" // default
    // const get_notebook = /nb\/(.*)/.exec(window.location.pathname)
    // if (get_notebook)
    //   uri = `ws://localhost:8554/api/get/${get_notebook[1]}`
    // else if (window.location.pathname === '/x')
    //   uri = 'ws://localhost:8554/api/getx/'
    // // console.log(`For path=${window.location.pathname} uri=${uri}`)

    // Return the tree
    return (
      <div>
        <Navbar color='dark' className="fixed-top">
          <NavbarBrand href="/">Printf</NavbarBrand>
          <NavItem>
            <PersistentWebsocket
              uri={uri}
              onReconnect={this.handleReconnect}
              onMessage={this.handleMessage}
              persist={false}
            />
          </NavItem>
        </Navbar>
        <Container className="printf-container">
          <Row>
            <Col className="col-12">
              {/* {this.renderElements(0)} */}
              <AutoSizer>
                {
                  ({width}) => {
                    // console.log('Rendering with width:', width);
                    return this.renderElements(width)
                  }
                }
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
        if (!element)
          throw new Error('Transmission error.')
        return dispatchOneOf(element, 'type', {
          // div: (div) => <div>A div.</div>,
          div: (div) => <Div element={div} width={width}/>,
          dataFrame: (df) => <DataFrame df={df} width={width}/>,
          chart: (chart) => <Chart chart={chart} width={width}/>,
          imgs: (imgs) => <ImageList imgs={imgs} width={width}/>,
          // imgs: (imgs) => <div>Here are some images.</div>,
          progress: (p) => <Progress value={p.get('value')} style={{width}}/>,
        });
      } catch (err) {
        return <Alert color="warning" style={{width}}>{err.message}</Alert>;
      }
    }).push(
      <div style={{width}} className="footer"/>
    ).map((element, indx) => (
      <div className="element-container" key={indx}>{element}</div>
    ))
  }
}

export default WebClient;
