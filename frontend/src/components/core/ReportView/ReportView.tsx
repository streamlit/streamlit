/**
 * @license
 * Copyright 2019 Streamlit Inc. All rights reserved.
 */

import React, {PureComponent, ReactNode} from 'react'
import {widgetTheme} from 'lib/widgetTheme'
import {AutoSizer} from 'react-virtualized'
import {Progress} from 'reactstrap'

import {ReportRunState} from 'lib/ReportRunState'
import {WidgetStateManager} from 'lib/WidgetStateManager'
import {Text as TextProto} from 'autogen/proto'
import {ThemeProvider} from 'baseui'
import {dispatchOneOf} from 'lib/immutableProto'
// @ts-ignore
import {fromJS, Iterable, List, Map as ImmutableMap} from 'immutable'

// Load (non-lazy) core elements.
import DocString from 'components/elements/DocString'
import ExceptionElement from 'components/elements/ExceptionElement'
import Table from 'components/elements/Table'
import Text from 'components/elements/Text'
import ErrorBoundary from 'components/shared/ErrorBoundary'

import './ReportView.scss'
import './Widget.scss'

// Lazy-load display widgets.
const Button = React.lazy(() => import('components/widgets/Button/'))
const Checkbox = React.lazy(() => import('components/widgets/Checkbox/'))
const DateInput = React.lazy(() => import('components/widgets/DateInput'))
const Radio = React.lazy(() => import('components/widgets/Radio/'))
const Selectbox = React.lazy(() => import('components/widgets/Selectbox/'))
const Slider = React.lazy(() => import('components/widgets/Slider/'))
const TextArea = React.lazy(() => import('components/widgets/TextArea/'))
const TextInput = React.lazy(() => import('components/widgets/TextInput/'))
const TimeInput = React.lazy(() => import('components/widgets/TimeInput'))

// Lazy-load display elements.
const Audio = React.lazy(() => import('components/elements/Audio/'))
const Balloons = React.lazy(() => import('components/elements/Balloons/'))
const Chart = React.lazy(() => import('components/elements/Chart/'))
const DataFrame = React.lazy(() => import('components/elements/DataFrame/'))
const ImageList = React.lazy(() => import('components/elements/ImageList/'))
const MapElement = React.lazy(() => import('components/elements/Map/'))
const DeckGlChart = React.lazy(() => import('components/elements/DeckGlChart/'))
const BokehChart = React.lazy(() => import('components/elements/BokehChart/'))
const GraphVizChart = React.lazy(() => import('components/elements/GraphVizChart/'))
const PlotlyChart = React.lazy(() => import('components/elements/PlotlyChart/'))
const VegaLiteChart = React.lazy(() => import('components/elements/VegaLiteChart/'))
const Video = React.lazy(() => import('components/elements/Video/'))

type Element = ImmutableMap<string, any>; // a report Element

interface Props {
  /** The protobuf elements of the report, as passed through immutablejs. */
  elements: List<Element>;

  /** The unique ID for the most recent run of the report. */
  reportId: string;

  /** Current ReportRunState. */
  reportRunState: ReportRunState;

  /**
   * If true, "stale" elements (that is, elements that were created during a previous
   * run of a currently-running report) will be faded out.
   *
   * (When we're viewing a shared report, this is set to false.)
   */
  showStaleElementIndicator: boolean;

  widgetMgr: WidgetStateManager;

  /** Disable the widgets when not connected to the server. */
  widgetsDisabled: boolean;
}

/**
 * Renders a Streamlit report. Reports consist of 0 or more elements.
 */
export class ReportView extends PureComponent<Props> {
  private elementsToRender: Iterable<number, Element | undefined> = List<Element>()

  public render(): ReactNode {
    return (
      <ThemeProvider theme={widgetTheme}>
        <AutoSizer className="main" disableHeight={true}>
          {({width}) => this.renderElements(width)}
        </AutoSizer>
      </ThemeProvider>
    )
  }

  private renderElements(width: number): ReactNode[] {
    if (this.props.reportRunState === ReportRunState.RUNNING) {
      // When the report is running, use our most recent list of rendered elements as placeholders
      // for any empty elements we encounter.
      this.elementsToRender = this.props.elements.map((element?, index?) => {
        if (element == null || index == null) {
          return element
        }

        const isEmpty = element.get('type') === 'empty'
        return isEmpty ? this.elementsToRender.get(index) : element
      })

    } else {
      this.elementsToRender = this.props.elements
    }

    // Transform our elements into ReactNodes.
    const out: ReactNode[] = []
    this.elementsToRender.forEach((element?: Element, index?: number) => {
      if (element == null || index == null) {
        return
      }

      const component = this.renderElement(element, index, width)
      if (!component) {
        return
      }

      const showStaleState =
        this.props.showStaleElementIndicator && this.isStaleElement(element)

      const className = showStaleState ? 'element-container stale-element' : 'element-container'

      out.push(
        <div className={className} key={index} style={{width}}>
          <React.Suspense
            fallback={<Text
              element={makeElementWithInfoText('Loading...').get('text')}
              width={width}
            />}
          >
            <ErrorBoundary width={width}>
              {component}
            </ErrorBoundary>
          </React.Suspense>
        </div>
      )
    })

    return out
  }

  private isStaleElement(element: Element): boolean {
    if (this.props.reportRunState === ReportRunState.RERUN_REQUESTED) {
      // If a rerun was just requested, all of our current elements
      // are about to become stale.
      return true
    } else if (this.props.reportRunState === ReportRunState.RUNNING) {
      return element.get('reportId') !== this.props.reportId
    } else {
      return false
    }
  }

  private renderElement(element: Element, index: number, width: number): ReactNode {
    if (!element) {
      throw new Error('Transmission error.')
    }

    const widgetProps = {
      widgetMgr: this.props.widgetMgr,
      disabled: this.props.widgetsDisabled,
    }

    return dispatchOneOf(element, 'type', {
      audio: (el: Element) => <Audio element={el} width={width} />,
      balloons: (el: Element) => <Balloons element={el} width={width} />,
      bokehChart: (el: Element) => <BokehChart element={el} id={index} width={width} />,
      chart: (el: Element) => <Chart element={el} width={width} />,
      dataFrame: (el: Element) => <DataFrame element={el} width={width} />,
      deckGlChart: (el: Element) => <DeckGlChart element={el} width={width} />,
      docString: (el: Element) => <DocString element={el} width={width} />,
      empty: () => undefined,
      exception: (el: Element) => <ExceptionElement element={el} width={width} />,
      graphvizChart: (el: Element) => <GraphVizChart element={el} id={index} width={width} />,
      imgs: (el: Element) => <ImageList element={el} width={width} />,
      map: (el: Element) => <MapElement element={el} width={width} />,
      plotlyChart: (el: Element) => <PlotlyChart element={el} width={width} />,
      progress: (el: Element) => <Progress value={el.get('value')} className="stProgress" style={{width}} />,
      table: (el: Element) => <Table element={el} width={width} />,
      text: (el: Element) => <Text element={el} width={width} />,
      vegaLiteChart: (el: Element) => <VegaLiteChart element={el} width={width} />,
      video: (el: Element) => <Video element={el} width={width} />,
      button: (el: Element) => <Button element={el} width={width} {...widgetProps} />,
      checkbox: (el: Element) => <Checkbox element={el} width={width} {...widgetProps} />,
      dateInput: (el: Element) => <DateInput element={el} width={width} {...widgetProps} />,
      textInput: (el: Element) => <TextInput element={el} width={width} {...widgetProps} />,
      radio: (el: Element) => <Radio element={el} width={width} {...widgetProps} />,
      selectbox: (el: Element) => <Selectbox element={el} width={width} {...widgetProps} />,
      slider: (el: Element) => <Slider element={el} width={width} {...widgetProps} />,
      textArea: (el: Element) => <TextArea element={el} width={width} {...widgetProps} />,
      timeInput: (el: Element) => <TimeInput element={el} width={width} {...widgetProps} />,
    })
  }
}

function makeElementWithInfoText(text: string): any {
  return fromJS({
    type: 'text',
    text: {
      format: TextProto.Format.INFO,
      body: text,
    },
  })
}
