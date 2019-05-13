/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React, {PureComponent, ReactNode} from 'react';
import {AutoSizer} from 'react-virtualized';
import {fromJS, List, Map as ImmutableMap} from 'immutable';
import {Progress} from 'reactstrap';
import {dispatchOneOf} from '../../../lib/immutableProto';
import {Text as TextProto} from '../../../protobuf';
import {ReportRunState} from '../../../lib/ReportRunState';
import './ReportView.scss';

// Load (non-lazy) core elements.
import Chart from '../../elements/Chart';
import DocString from '../../elements/DocString';
import ExceptionElement from '../../elements/ExceptionElement';
import Table from '../../elements/Table';
import Text from '../../elements/Text';

// Lazy-load display elements.
const Audio = React.lazy(() => import('../../elements/Audio'));
const Balloons = React.lazy(() => import('../../elements/Balloons'));
const DataFrame = React.lazy(() => import('../../elements/DataFrame'));
const ImageList = React.lazy(() => import('../../elements/ImageList'));
const Map = React.lazy(() => import('../../elements/Map'));
const DeckGlChart = React.lazy(() => import('../../elements/DeckGlChart'));
const BokehChart = React.lazy(() => import('../../elements/BokehChart'));
const PlotlyChart = React.lazy(() => import('../../elements/PlotlyChart'));
const VegaLiteChart = React.lazy(() => import('../../elements/VegaLiteChart'));
const Video = React.lazy(() => import('../../elements/Video'));

type Element = ImmutableMap<string, any>; // a report Element

interface Props {
  /** The protobuf elements of the report, as passed through immutablejs. */
  elements: List<Element>;

  /** The unique ID for the most recent run of the report. */
  reportId: string;

  /** Current ReportRunState. */
  reportRunState: ReportRunState;
}

/**
 * Renders a Streamlit report. Reports consist of 0 or more elements.
 */
export class ReportView extends PureComponent<Props> {
  public constructor(props: Props) {
    super(props);
  }

  public render(): ReactNode {
    return (
      <AutoSizer className="main">
        {({width}) => this.renderElements(width)}
      </AutoSizer>
    );
  }

  private renderElements(width: number): ReactNode[] {
    const out: ReactNode[] = [];

    // Transform our elements into ReactNodes.
    this.props.elements.forEach((element?: Element, index?: number) => {
      if (!element || index == null) {
        return;
      }

      const component = this.renderElement(element, index, width);
      if (!component) {
        return;
      }

      const className = this.isStaleElement(element) ?
        'element-container stale-element' : 'element-container';

      out.push(
        <div className={className} key={index}>
          <React.Suspense
            fallback={<Text
              element={makeElementWithInfoText('Loading...').get('text')}
              width={width}
            />}
          >
            {component}
          </React.Suspense>
        </div>
      );
    });

    // add a Footer
    out.push(
      <div className="element-container" key={this.props.elements.size}>
        <div style={{width}} className="footer"/>
      </div>
    );

    return out;
  }

  private isStaleElement(element: Element): boolean {
    if (this.props.reportRunState === ReportRunState.RERUN_REQUESTED) {
      // If a rerun was just requested, all of our current elements
      // are about to become stale.
      return true;
    } else if (this.props.reportRunState === ReportRunState.RUNNING) {
      return element.get('reportId') !== this.props.reportId;
    } else {
      return false;
    }
  }

  private renderElement(element: Element, index: number, width: number): ReactNode {
    if (!element) {
      throw new Error('Transmission error.');
    }

    return dispatchOneOf(element, 'type', {
      audio: (el: Element) => <Audio element={el} width={width}/>,
      balloons: (el: Element) => <Balloons element={el} width={width}/>,
      bokehChart: (el: Element) => <BokehChart element={el} id={index} width={width}/>,
      chart: (el: Element) => <Chart element={el} width={width}/>,
      dataFrame: (el: Element) => <DataFrame element={el} width={width}/>,
      deckGlChart: (el: Element) => <DeckGlChart element={el} width={width}/>,
      docString: (el: Element) => <DocString element={el} width={width}/>,
      empty: () => undefined,
      exception: (el: Element) => <ExceptionElement element={el} width={width}/>,
      imgs: (el: Element) => <ImageList element={el} width={width}/>,
      map: (el: Element) => <Map element={el} width={width}/>,
      plotlyChart: (el: Element) => <PlotlyChart element={el} width={width}/>,
      progress: (el: Element) => <Progress value={el.get('value')} style={{width}}/>,
      table: (el: Element) => <Table element={el} width={width}/>,
      text: (el: Element) => <Text element={el} width={width}/>,
      vegaLiteChart: (el: Element) => <VegaLiteChart element={el} width={width}/>,
      video: (el: Element) => <Video element={el} width={width}/>,
    });
  }
}

function makeElementWithInfoText(text: string): any {
  return fromJS({
    type: 'text',
    text: {
      format: TextProto.Format.INFO,
      body: text,
    },
  });
}
