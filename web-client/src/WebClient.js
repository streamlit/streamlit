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

import {
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  XAxis,
  YAxis
} from 'recharts';

import {
  LineChart as EasyLineChart,
  Legend as EasyLegend,
} from 'react-easy-chart';

import './WebClient.css';

// This my custom row which contains a complete 100% width column
const Row = ({children}) => (
  <BootstrapRow>
    <BootstrapCol>
      {children}
    </BootstrapCol>
  </BootstrapRow>
);

// Represents a chart with some data
class Chart extends PureComponent {
  constructor(props) {
    super(props);
  }

  render () {
    const height=200;
    return (
      <div style={{height}}>
        <AutoSizer>
          {({width}) => (
            <LineChart width={width} height={height} data={this.props.data}>
              <XAxis dataKey="x" type={this.props.data.length < 99 ? undefined : 'number'}/>
              {/* <XAxis dataKey="x"/> */}
              <YAxis type="number"/>
              <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
              <Line
                isAnimationActive={false}
                type="linear"
                dataKey="y"
                stroke="rgb(40, 113, 238)"
                dot={false}
              />
              <Legend />
            </LineChart>
          )}
        </AutoSizer>
      </div>
    );
  }
}

// Represents a chart with some data
class EasyChart extends PureComponent {
  constructor(props) {
    super(props);
  }

  render () {
    const height=200;
    const legendHeight = 20;
    console.log('About to render and EasyChart');
    console.log(this.props.data);
    return (
      <div style={{height: height + legendHeight}}>
        <AutoSizer>
          {({width}) => (
            <div>
              <EasyLineChart
                axisLabel={{x: 'This is X', y: 'This is Y'}}
                lineColors={['rgb(40, 113, 238)']}
                grid
                axes={true}
                width={width}
                height={height}
                data={[this.props.data]}
              />
              <div width={width} height={legendHeight}>
                <EasyLegend
                  width={width}
                  height={legendHeight}
                  data={[{key:'xs', color:'rgb(40, 113, 238)'}]}
                  dataId="key"
                  horizontal
                />
              </div>
            </div>
          )}
        </AutoSizer>
      </div>
    );
  }
}

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
    this.timerID = setInterval(() => {
      let {progress, data} = this.state
      if (progress < 100) {
        const deltaProgress = 1;
        progress = progress + deltaProgress;
        data = [...data, {x: progress, y: Math.random()}];
        this.setState({progress, data});
      }
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
            <samp>Let's start with an easy chart:</samp>
          </Row>
          <Row>
            <EasyChart data={this.state.data} />
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
