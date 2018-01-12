import React, { Component } from 'react';
import {
  Col as BootstrapCol,
  Container,
  Navbar,
  NavbarBrand,
  Progress,
  Row as BootstrapRow,
} from 'reactstrap';
import './WebClient.css';

// This my custom row which contains a complete 100% width column
const Row = ({children}) => (
  <BootstrapRow>
    <BootstrapCol>
      {children}
    </BootstrapCol>
  </BootstrapRow>
);

class WebClient extends Component {
  constructor(props) {
    super(props);

    this.state = {
      progress: 0,
    };
  }

  componentDidMount() {
    console.log('In componentDidMount.')
    this.timerID = setInterval(() => {
      const deltaProgress = 1;
      const progress = Math.min(100, this.state.progress + deltaProgress);
      console.log(`Updating state ${this.state.progress} -> ${progress}`)
      this.setState({progress})
    }, 30);
  }

  componentWillUnmount() {
    clearInterval(this.timerID);
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
            <samp>And this is some more.</samp>
          </Row>
        </Container>

      </div>
    );
  }
}

export default WebClient;
