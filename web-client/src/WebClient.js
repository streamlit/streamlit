import React, { PureComponent } from 'react';

import {
  Col as BootstrapCol,
  Container,
  Navbar,
  NavbarBrand,
  Progress,
  Row as BootstrapRow,
} from 'reactstrap';

import Chart from './Chart'
import DataFrame from './DataFrame'
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
  }

  componentDidMount() {
    // this.timerID = this._setupAnimation();
    this.websocket = this._setupWebsocket();
  }

  componentWillUnmount() {
    // clearInterval(this.timerID);

    const NORMAL_CLOSURE = 1000;
    this.websocket.close(NORMAL_CLOSURE)
  }

  /**
   * Sets up the initial animation.
   */
  _setupAnimation() {
    return setInterval(() => {
      let {progress, data} = this.state
      if (progress < 100) {
        const deltaProgress = 1;
        progress = progress + deltaProgress;
        data = [...data, {x: progress, y: Math.random()}];
        this.setState({progress, data});
      }
    }, 10);
  }

  /**
   * Set up a websocket connection.
   */
  _setupWebsocket() {
    const wsUri = "ws://localhost:8315/";
    const websocket = new WebSocket(wsUri);
    websocket.onmessage = ({data}) => {
      console.log('got a message:')
      let new_state = JSON.parse(data)
      this.setState((old_state) => ({
        ...new_state,
        data: [...old_state.data, {x: new_state.progress, y: Math.random()}],
      }));
      console.log(this.state)
      console.log(new_state)
    };

    // Debug - beging - fill in the other event handler
    function handleEvent(hanlderName, event) {
      console.log(hanlderName)
      console.log(event)
    }
    websocket.onopen = handleEvent.bind(this, 'onopen')
    websocket.onclose = handleEvent.bind(this, 'onclose')
    websocket.onerror = handleEvent.bind(this, 'onerror')
    // Debug end

    // websocket.onerror = onError;
    console.log('The websocket is set up.')
    return websocket;
  }


  render() {
    return (
      <div>
        <Navbar color='dark'>
          <NavbarBrand href="/">Tiny Notebook</NavbarBrand>
        </Navbar>
        <Container>
          <Row>
            <h3>Testing React Speed</h3>
          </Row>
          <Row>
            <Progress value={this.state.progress}/>
          </Row>
          <Row>
            <samp>Progress: {this.state.progress}% | FPS: 21</samp>
          </Row>
          <Row>
            <samp>Now for some recharts:</samp>
          </Row>
          <Row>
            <Chart data={this.state.data}/>
          </Row>
          <Row>
            <samp>And a little more.</samp>
          </Row>
          <Row>
            <DataFrame />
          </Row>
          <Row>
            <samp>And this is some more.</samp>
          </Row>
        </Container>

      </div>
    );
  }
}

export default WebClient;
