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
    };
  }

  componentDidMount() {
    console.log('In componentDidMount.')
    this.timerID = setInterval(() => {
      const deltaProgress = 1;
      const progress = Math.min(100, this.state.progress + deltaProgress);
      // console.log(`Updating state ${this.state.progress} -> ${progress}`)
      this.setState({progress})
    }, 10);
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
