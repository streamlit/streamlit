import React, { PureComponent } from 'react';
import {
  Alert,
  Col as BootstrapCol,
  Container,
  Navbar,
  NavItem,
  NavbarBrand,
  Progress,
  Row as BootstrapRow,
} from 'reactstrap';
import { List } from 'immutable';

import Chart from './elements/Chart'
import DataFrame from './elements/DataFrame'
import Div from './elements/Div'
import PersistentWebsocket from './PersistentWebsocket'
import { DeltaList } from './protobuf/printf'

import './WebClient.css';

// This my custom row which contains a complete 100% width column
const Row = ({children}) => (
  <BootstrapRow>
    <BootstrapCol>
      {children}
    </BootstrapCol>
  </BootstrapRow>
);

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
          <NavbarBrand href="/">Tiny Notebook</NavbarBrand>
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
          { this.renderElements() }
        </Container>

      </div>
    );
  }

  renderElements() {
    return this.state.elements.map((element) => {
      if (element.type === 'div') {
        return <Div element={element.div}/>;
      } else if (element.type === 'dataFrame') {
        return <DataFrame element={element.dataFrame}/>;
      }

      // Default render if we don't understand the type.
      return (
        <Alert color="secondary">
          I don't understand "{element.type}" as an element type. WTF?!
        </Alert>
      );
    }).map((element, indx) => (
      <Row key={indx}>{element}</Row>
    ));
  }
}

export default WebClient;
