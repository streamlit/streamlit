import React, {
  // Component,
  PureComponent
} from 'react';

import {
  Col as BootstrapCol,
  Container,
  Navbar,
  NavbarBrand,
  Progress,
  Row as BootstrapRow,
} from 'reactstrap';

import { AutoSizer, MultiGrid } from 'react-virtualized';



import Chart from './Chart'
import './WebClient.css';

// This my custom row which contains a complete 100% width column
const Row = ({children}) => (
  <BootstrapRow>
    <BootstrapCol>
      {children}
    </BootstrapCol>
  </BootstrapRow>
);



// Represents a Pandas Dataframe on the screen.
class DataFrame extends PureComponent {
  constructor(props) {
    super(props);
    this._cellRenderer = this._cellRenderer.bind(this)
  }

  render() {
    const height = 300;
    const border = 2;
    return (
      <div style={{height}}>
        <AutoSizer>
            {({width}) => (
              <div style={{width:width, border:'1px solid black'}}>
                <MultiGrid
                  className="dataFrame"
                  cellRenderer={this._cellRenderer}
                  fixedColumnCount={1}
                  fixedRowCount={1}
                  columnWidth={({index}) => {
                    return 30 + 2 * index;
                  }}
                  columnCount={50}
                  enableFixedColumnScroll
                  enableFixedRowScroll
                  height={height}
                  rowHeight={30}
                  rowCount={50}
                  width={width - border}
                />
            </div>
          )}
        </AutoSizer>
      </div>
    );
  }

  // Renders out each cell
  _cellRenderer({columnIndex, key, rowIndex, style}) {
    let backgroundColor = '#ddd';
    if ((columnIndex + rowIndex) % 2 === 0) {
      backgroundColor = '#eee';
    }
    const the_style = {
      ...style,
      // width: 75,
      // height: 40,
      // border: '1px solid black',
      backgroundColor: backgroundColor
    };
    return (
      <div key={key} style={the_style}>
        {columnIndex}, {rowIndex}, {key}
      </div>
    );
  }
}

class WebClient extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      progress: 0,
      data: [],
    };
  }

  componentDidMount() {
    this.timerID = this._setupAnimation();
    this.websocket = this._setupWebsocket();
  }

  componentWillUnmount() {
    clearInterval(this.timerID);

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
    const wsUri = "ws://echo.websocket.org/";
    const websocket = new WebSocket(wsUri);
    // websocket.onopen = onOpen;
    // websocket.onclose = onClose;
    websocket.onmessage = ({data}) => {
      console.log('got a message:')
      console.log(data)
    };

    // Now we're going to test ourselves against the echo websocket.
    websocket.onopen = () => {
      const messages = [
        'hello',
        'world',
        'this',
        'is',
        'truly',
        'a',
        'great',
        'world',
      ]
      function* msgGenerator() {
        for (let msg of messages)
          yield msg;
      }

      let msgs = msgGenerator()
      function sendMsg() {
        let {value, done} = msgs.next()
        if (!done) {
          websocket.send(value);
          setTimeout(sendMsg, 10);
        }
      }

      console.log('playing with msgGenerator');
      setTimeout(sendMsg, 10);
    };

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
