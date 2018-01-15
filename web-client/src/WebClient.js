import React, { PureComponent } from 'react';

import {
  Col as BootstrapCol,
  Container,
  Navbar,
  NavItem,
  NavbarBrand,
  Progress,
  Row as BootstrapRow,
} from 'reactstrap';

import Chart from './Chart'
import DataFrame from './DataFrame'
import PersistentWebsocket from './PersistentWebsocket'
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

    this.state = {
      progress: 0,
      data: [],
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
  handleMessage(data) {
    console.log('RECEIVED MEESAGE')
    console.log(data)
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
        <Container className="notebook-container">
          <Row>
            <h3>Dumb Client</h3>
          </Row>
          <Row>
            <samp>
              This client is printing out all messages to the console.
            </samp>
          </Row>
          <Row>
            <samp>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce ac sollicitudin ex. Sed pretium tincidunt justo, non blandit augue condimentum in. Integer ullamcorper sem urna. Aliquam magna massa, volutpat eu tincidunt ut, aliquam a arcu. Duis pulvinar pharetra malesuada. Nam bibendum maximus faucibus. Etiam eu nisi mattis, facilisis enim at, dapibus magna. Phasellus a nulla a tortor ultrices auctor.

Nulla molestie ante lorem, nec tempor dolor vulputate quis. Suspendisse euismod nulla leo, et finibus erat aliquet et. Nulla augue ligula, vehicula ac odio id, fermentum dictum erat. Quisque lobortis aliquam hendrerit. Aliquam et iaculis nulla. Donec blandit finibus est, nec bibendum magna commodo sit amet. Curabitur ultrices eu ligula non luctus. Phasellus molestie bibendum tortor sed malesuada. Donec accumsan mi in tempor vestibulum. In vitae quam vel ex ultrices consequat nec nec ipsum. Etiam venenatis dapibus feugiat. Praesent rhoncus enim eget quam accumsan, ut venenatis sem tristique.

Sed porttitor magna ac est luctus, ac commodo justo facilisis. Proin id scelerisque odio. Donec vulputate magna sed dolor vestibulum, eget luctus lorem vestibulum. In condimentum mi a ligula posuere, consectetur auctor sapien mollis. Quisque dignissim vel turpis vitae euismod. Morbi venenatis ultrices metus, vel fermentum nisl placerat eu. Aliquam lobortis felis risus, eget pharetra nibh scelerisque sed. Sed elementum ex magna, ut sagittis leo eleifend vel. Proin id aliquam neque. Aenean arcu ex, finibus eu sodales et, sagittis ac velit. Nam euismod dignissim neque, at consequat nisl venenatis id. Aliquam pretium semper justo, id posuere est bibendum a.

Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Donec vulputate auctor tortor, et faucibus odio finibus vitae. Morbi ut iaculis quam. Vivamus dictum libero in ligula efficitur, hendrerit dignissim lorem mattis. Ut pharetra ante a odio auctor viverra. Aliquam ac tellus leo. In pulvinar fringilla commodo. Sed aliquet varius quam id auctor. Donec dapibus consectetur mi vel cursus.

Sed auctor, arcu sit amet hendrerit sodales, odio leo aliquet nisl, quis accumsan eros urna eu erat. Sed vitae augue velit. Vestibulum volutpat consectetur tempus. Nam vitae imperdiet sapien, vitae ultricies dui. Sed consequat augue tellus, ac tristique lacus tincidunt ac. Sed accumsan, ex sit amet tempus elementum, quam augue auctor nibh, quis ultrices urna nulla sit amet magna. Mauris venenatis laoreet suscipit. Duis libero enim, feugiat id congue id, consequat vitae felis.
            </samp>
          </Row>
        </Container>

      </div>
    );
  }
}

export default WebClient;
