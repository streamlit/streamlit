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

// Testing the new protobuf format.
import { Text } from './protobuf/notebook'

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
    console.log('Component did mount.')
    console.log('Got an awesome message:')
    console.log(Text)
    console.log('Here is a created message:')
    let text = Text.create()
    console.log(text)
    text.text = 'Some text.'
    console.log('Classes:')
    console.log(text.classes)
    text.classes.push(123)
    console.log(text)
    console.log('Verifying...')
    console.log(Text.verify(text))
    console.log('Done verifying.')
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
    const reader = new FileReader();
    reader.readAsArrayBuffer(blob)
    reader.onloadend = () => {
      console.log('Got some data from the blob')
      console.log(reader.result)
      const uint8array = new Uint8Array(reader.result);
      console.log(uint8array)
      const text = Text.decode(uint8array)
      console.log('decoded the following')
      console.log(text)
      console.log(`protobuf_len: ${blob.size}`);
      console.log(`json_len: ${JSON.stringify(text).length}`);
      console.log(JSON.stringify(text))

      // const text = Text.create()
      // text.text = 'some text'
      // text.classes = ['here is a class', 'here is another class']
      // console.log('text object', text)
      // const encoded = Text.encode(text)
      // console.log('encoded', encoded)
      // console.log('encoded length', encoded.length)
      // console.log(Text.decode(encoded))

      // let text = Text.decode(reader.result)
      // console.log(text)
      // console.log(JSON.stringify(text))
      // console.log(`json_len: ${JSON.stringify(text).length}`)
    }
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
