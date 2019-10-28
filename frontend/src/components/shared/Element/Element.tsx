/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { Component } from "react"
import { Map as ImmutableMap } from "immutable"
import { dispatchOneOf } from "lib/immutableProto"
import { WidgetStateManager } from "lib/WidgetStateManager"

// Load (non-lazy) elements.
import Chart from "components/elements/Chart"
import DocString from "components/elements/DocString"
import ExceptionElement from "components/elements/ExceptionElement"
import Table from "components/elements/Table"
import Text from "components/elements/Text"

// Lazy-load elements.
const Audio = React.lazy(() => import("components/elements/Audio"))
const Balloons = React.lazy(() => import("components/elements/Balloons"))
const BokehChart = React.lazy(() => import("components/elements/BokehChart"))
const DataFrame = React.lazy(() => import("components/elements/DataFrame"))
const DeckGlChart = React.lazy(() => import("components/elements/DeckGlChart"))
const ImageList = React.lazy(() => import("components/elements/ImageList"))
const GraphVizChart = React.lazy(() =>
  import("components/elements/GraphVizChart")
)
const PlotlyChart = React.lazy(() => import("components/elements/PlotlyChart"))
const VegaLiteChart = React.lazy(() =>
  import("components/elements/VegaLiteChart")
)
const Video = React.lazy(() => import("components/elements/Video"))

// Lazy-load widgets.
const Button = React.lazy(() => import("components/widgets/Button"))
const Checkbox = React.lazy(() => import("components/widgets/Checkbox"))
const DateInput = React.lazy(() => import("components/widgets/DateInput"))
const Multiselect = React.lazy(() => import("components/widgets/Multiselect"))
const Progress = React.lazy(() => import("components/elements/Progress"))
const Radio = React.lazy(() => import("components/widgets/Radio"))
const Selectbox = React.lazy(() => import("components/widgets/Selectbox"))
const Slider = React.lazy(() => import("components/widgets/Slider"))
const TextArea = React.lazy(() => import("components/widgets/TextArea"))
const TextInput = React.lazy(() => import("components/widgets/TextInput"))
const TimeInput = React.lazy(() => import("components/widgets/TimeInput"))
const NumberInput = React.lazy(() => import("components/widgets/NumberInput"))

type SimpleElement = ImmutableMap<string, any>

export interface Props {
  index: number
  disabled: boolean
  element: ImmutableMap<string, any>
  widgetMgr: WidgetStateManager
  width: number
  height?: number
}

class Element extends Component<Props> {
  shouldComponentUpdate(nextProps: any): boolean {
    const currentProps: any = this.props

    return Object.keys(currentProps).some(prop => {
      if (nextProps[prop] instanceof ImmutableMap) {
        const type = currentProps.element.get("type")
        const currentElement = currentProps.element.get(type)
        const nextElement = nextProps.element.get(type)

        return !currentElement.equals(nextElement)
      }

      return currentProps[prop] !== nextProps[prop]
    })
  }

  public render(): React.ReactNode {
    const { element, index, widgetMgr, disabled, width, height } = this.props

    if (!element) {
      throw new Error("Transmission error.")
    }

    const widgetProps = {
      widgetMgr: widgetMgr,
      disabled: disabled,
    }

    return dispatchOneOf(element, "type", {
      audio: (el: SimpleElement) => <Audio element={el} width={width} />,
      balloons: (el: SimpleElement) => <Balloons element={el} width={width} />,
      bokehChart: (el: SimpleElement) => (
        <BokehChart element={el} index={index} width={width} />
      ),
      chart: (el: SimpleElement) => <Chart element={el} width={width} />,
      dataFrame: (el: SimpleElement) => (
        <DataFrame element={el} width={width} height={height} />
      ),
      deckGlChart: (el: SimpleElement) => (
        <DeckGlChart element={el} width={width} />
      ),
      docString: (el: SimpleElement) => (
        <DocString element={el} width={width} />
      ),
      empty: () => undefined,
      exception: (el: SimpleElement) => (
        <ExceptionElement element={el} width={width} />
      ),
      graphvizChart: (el: SimpleElement) => (
        <GraphVizChart element={el} index={index} width={width} />
      ),
      imgs: (el: SimpleElement) => <ImageList element={el} width={width} />,
      multiselect: (el: SimpleElement) => (
        <Multiselect
          key={el.get("id")}
          element={el}
          width={width}
          {...widgetProps}
        />
      ),
      plotlyChart: (el: SimpleElement) => (
        <PlotlyChart element={el} width={width} />
      ),
      progress: (el: SimpleElement) => <Progress element={el} width={width} />,
      table: (el: SimpleElement) => <Table element={el} width={width} />,
      text: (el: SimpleElement) => <Text element={el} width={width} />,
      vegaLiteChart: (el: SimpleElement) => (
        <VegaLiteChart element={el} width={width} />
      ),
      video: (el: SimpleElement) => <Video element={el} width={width} />,
      // Widgets
      button: (el: SimpleElement) => (
        <Button element={el} width={width} {...widgetProps} />
      ),
      checkbox: (el: SimpleElement) => (
        <Checkbox
          key={el.get("id")}
          element={el}
          width={width}
          {...widgetProps}
        />
      ),
      dateInput: (el: SimpleElement) => (
        <DateInput
          key={el.get("id")}
          element={el}
          width={width}
          {...widgetProps}
        />
      ),
      radio: (el: SimpleElement) => (
        <Radio
          key={el.get("id")}
          element={el}
          width={width}
          {...widgetProps}
        />
      ),
      selectbox: (el: SimpleElement) => (
        <Selectbox
          key={el.get("id")}
          element={el}
          width={width}
          {...widgetProps}
        />
      ),
      slider: (el: SimpleElement) => (
        <Slider
          key={el.get("id")}
          element={el}
          width={width}
          {...widgetProps}
        />
      ),
      textArea: (el: SimpleElement) => (
        <TextArea
          key={el.get("id")}
          element={el}
          width={width}
          {...widgetProps}
        />
      ),
      textInput: (el: SimpleElement) => (
        <TextInput
          key={el.get("id")}
          element={el}
          width={width}
          {...widgetProps}
        />
      ),
      timeInput: (el: SimpleElement) => (
        <TimeInput
          key={el.get("id")}
          element={el}
          width={width}
          {...widgetProps}
        />
      ),
      numberInput: (el: SimpleElement) => (
        <NumberInput
          key={el.get("id")}
          element={el}
          width={width}
          {...widgetProps}
        />
      ),
    })
  }
}

export default Element
