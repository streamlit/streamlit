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
import { List } from 'immutable';

// Display Elements
import DataFrame from './elements/DataFrame'
import Div from './elements/Div'
import Chart from './elements/Chart'
import ImageList from './elements/ImageList'

// Other local imports.
import PersistentWebsocket from './PersistentWebsocket'
import { DeltaList } from './protobuf/printf'

import './WebClient.css';

class WebClient extends PureComponent {
  constructor(props) {
    super(props);

    // Initially the state reflects that no data has been received.
    this.state = {
      elements: List([{
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
    console.log('CONNECTED TO THE SERVER');
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
      const deltaList = DeltaList.decode(result)
      console.log('Received a message and am applying...')
      console.log(deltaList)
      console.log('Protobuf Length:', reader.result.byteLength);
      console.log('JSON Length:', JSON.stringify(deltaList).length);
      console.log('Applying')
      console.log(deltaList)
      this.applyDeltas(deltaList);
    }
  }

  /**
   * Applies a list of deltas to the elements.
   */
  applyDeltas(deltaList) {
    this.setState(({elements}) => {
      console.log('Updating the state elements.')
      for (const delta of deltaList.deltas) {
        if (delta.type === 'newElement') {
          elements = elements.set(delta.id, delta.newElement);
        } else {
          throw new Error(`Cannot parse delta type "${delta.type}".`)
        }
      }
      return {elements};
    });
  }

  render() {
    return (
      <div>
        <Navbar color='dark' className="fixed-top">
          <NavbarBrand href="/">Printf</NavbarBrand>
          <NavItem>
            <PersistentWebsocket
              uri="ws://localhost:8315/"
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
                    console.log('Rendering with width:', width);
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
      if (!element) {
        const msg = 'Transmission error.'
        return <Alert color="warning" style={{width}}>{msg}</Alert>;
      } else if (element.div) {
        return <Div element={element.div} width={width}/>;
      } else if (element.dataFrame) {
        return <DataFrame element={element.dataFrame} width={width}/>;
      } else if (element.chart) {
        return <Chart element={element.chart} width={width}/>;
      } else if (element.imgs) {
        return <ImageList imgs={element.imgs} width={width}/>;
      } else if (element.progress) {
        return <Progress value={element.progress.value} style={{width}}/>
      } else {
        const msg = `Cannot parse type "${element.type}". WTF?!`
        return <Alert color="warning" style={{width}}>{msg}</Alert>;
    }}).push(
      <div style={{width}} className="footer"/>
    ).map((element, indx) => (
      <div className="element-container" key={indx}>{element}</div>
    ))
  }
}

export default WebClient;
