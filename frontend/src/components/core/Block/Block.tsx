/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import {
  Alert as AlertProto,
  Audio as AudioProto,
  BokehChart as BokehChartProto,
  Button as ButtonProto,
  Checkbox as CheckboxProto,
  ColorPicker as ColorPickerProto,
  ComponentInstance as ComponentInstanceProto,
  DateInput as DateInputProto,
  FileUploader as FileUploaderProto,
  MultiSelect as MultiSelectProto,
  NumberInput as NumberInputProto,
  Radio as RadioProto,
  Selectbox as SelectboxProto,
  Slider as SliderProto,
  TextArea as TextAreaProto,
  TextInput as TextInputProto,
  TimeInput as TimeInputProto,
  DeckGlJsonChart as DeckGlJsonChartProto,
  DocString as DocStringProto,
  Exception as ExceptionProto,
  GraphVizChart as GraphVizChartProto,
  IBlock,
  IForwardMsgMetadata,
  IFrame as IFrameProto,
  ImageList as ImageListProto,
  Json as JsonProto,
  Markdown as MarkdownProto,
  PlotlyChart as PlotlyChartProto,
  Progress as ProgressProto,
  Text as TextProto,
  Video as VideoProto,
} from "autogen/proto"

import Maybe from "components/core/Maybe/"

// Load (non-lazy) elements.
import Alert from "components/elements/Alert/"
import DocString from "components/elements/DocString/"
import ExceptionElement from "components/elements/ExceptionElement/"
import Json from "components/elements/Json/"
import Markdown from "components/elements/Markdown/"
import Text from "components/elements/Text/"
import ErrorBoundary from "components/shared/ErrorBoundary/"
import FullScreenWrapper from "components/shared/FullScreenWrapper/"
import {
  ComponentInstance,
  ComponentRegistry,
} from "components/widgets/CustomComponent/"
import withExpandable from "hocs/withExpandable"
import { FileUploadClient } from "lib/FileUploadClient"
import { ReportRunState } from "lib/ReportRunState"
import { notNull } from "lib/utils"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { variables as stylingVariables } from "lib/widgetTheme"
import React, { PureComponent, ReactNode, Suspense } from "react"
import { AutoSizer } from "react-virtualized"
import {
  BlockNode,
  ElementNode,
  getElementWidgetID,
  makeElementWithInfoTextNew,
  ReportNode,
} from "../../../lib/ReportNode"

import "./Block.scss"

// Lazy-load elements.
const Audio = React.lazy(() => import("components/elements/Audio/"))
const Balloons = React.lazy(() => import("components/elements/Balloons/"))
const BokehChart = React.lazy(() => import("components/elements/BokehChart/"))
const DataFrame = React.lazy(() => import("components/elements/DataFrame/"))
const DeckGlJsonChart = React.lazy(() =>
  import("components/elements/DeckGlJsonChart/")
)
const GraphVizChart = React.lazy(() =>
  import("components/elements/GraphVizChart/")
)
const IFrame = React.lazy(() => import("components/elements/IFrame/"))
const ImageList = React.lazy(() => import("components/elements/ImageList/"))
const PlotlyChart = React.lazy(() =>
  import("components/elements/PlotlyChart/")
)
const VegaLiteChart = React.lazy(() =>
  import("components/elements/VegaLiteChart/")
)
const Video = React.lazy(() => import("components/elements/Video/"))

// Lazy-load widgets.
const Button = React.lazy(() => import("components/widgets/Button/"))
const Checkbox = React.lazy(() => import("components/widgets/Checkbox/"))
const ColorPicker = React.lazy(() => import("components/widgets/ColorPicker"))
const DateInput = React.lazy(() => import("components/widgets/DateInput/"))
const Multiselect = React.lazy(() => import("components/widgets/Multiselect/"))
const Progress = React.lazy(() => import("components/elements/Progress/"))
const Radio = React.lazy(() => import("components/widgets/Radio/"))
const Selectbox = React.lazy(() => import("components/widgets/Selectbox/"))
const Slider = React.lazy(() => import("components/widgets/Slider/"))
const FileUploader = React.lazy(() =>
  import("components/widgets/FileUploader/")
)
const TextArea = React.lazy(() => import("components/widgets/TextArea/"))
const TextInput = React.lazy(() => import("components/widgets/TextInput/"))
const TimeInput = React.lazy(() => import("components/widgets/TimeInput/"))
const NumberInput = React.lazy(() => import("components/widgets/NumberInput/"))

interface Props {
  elements: BlockNode
  reportId: string
  reportRunState: ReportRunState
  showStaleElementIndicator: boolean
  widgetMgr: WidgetStateManager
  uploadClient: FileUploadClient
  widgetsDisabled: boolean
  componentRegistry: ComponentRegistry
  deltaBlock?: IBlock
}

class Block extends PureComponent<Props> {
  private WithExpandableBlock = withExpandable(Block)

  /** Recursively transform this BLockElement and all children to React Nodes. */
  private renderElements = (width: number): ReactNode[] => {
    const elementsToRender = this.props.elements

    return elementsToRender.children
      .map((node: ReportNode, index: number): ReactNode | null => {
        if (node instanceof BlockNode) {
          return this.renderBlock(node, index, width, node.deltaBlock)
        }
        if (node instanceof ElementNode) {
          return this.renderElementWithErrorBoundary(node, index, width)
        }

        return null
      })
      .filter(notNull)
  }

  private isElementStale(node: ReportNode): boolean {
    if (this.props.reportRunState === ReportRunState.RERUN_REQUESTED) {
      // If a rerun was just requested, all of our current elements
      // are about to become stale.
      return true
    }
    if (this.props.reportRunState === ReportRunState.RUNNING) {
      return (
        node instanceof ElementNode && node.reportId !== this.props.reportId
      )
    }
    return false
  }

  private renderBlock(
    node: BlockNode,
    index: number,
    width: number,
    deltaBlock?: IBlock
  ): ReactNode {
    const BlockType =
      deltaBlock != null && deltaBlock.expandable
        ? this.WithExpandableBlock
        : Block
    const optionalProps =
      deltaBlock != null && deltaBlock.expandable
        ? {
            empty: node.children.length === 0,
            ...deltaBlock.expandable,
          }
        : {}
    let style: any = { width }
    if (deltaBlock && deltaBlock.column && deltaBlock.column.weight) {
      // The minimal viewport width used to determine the minimal
      // fixed column width while accounting for column proportions.
      // Randomly selected based on visual experimentation.
      const minViewportForColumns = 640

      // When working with columns, width is driven by what percentage of space
      // the column takes in relation to the total number of columns
      const columnPercentage = deltaBlock.column.weight / width
      const minColumnWidth = columnPercentage * minViewportForColumns
      style = {
        // Flex determines how much space is allocated to this column.
        flex: deltaBlock.column.weight,
        minWidth: `max(${columnPercentage * 100}% - ${
          stylingVariables.gutter
        }, ${minColumnWidth}px)`,
      }
    }
    return (
      <div key={index} className="stBlock" style={style}>
        <BlockType
          elements={node}
          reportId={this.props.reportId}
          reportRunState={this.props.reportRunState}
          showStaleElementIndicator={this.props.showStaleElementIndicator}
          widgetMgr={this.props.widgetMgr}
          uploadClient={this.props.uploadClient}
          widgetsDisabled={this.props.widgetsDisabled}
          componentRegistry={this.props.componentRegistry}
          deltaBlock={deltaBlock}
          {...optionalProps}
        />
      </div>
    )
  }

  private static getClassNames(isStale: boolean, isHidden: boolean): string {
    const classNames = ["element-container"]
    if (isStale && !FullScreenWrapper.isFullScreen) {
      classNames.push("stale-element")
    }
    if (isHidden) {
      classNames.push("stHidden")
    }
    return classNames.join(" ")
  }

  private shouldComponentBeEnabled(isHidden: boolean): boolean {
    return !isHidden || this.props.reportRunState !== ReportRunState.RUNNING
  }

  private isComponentStale(enable: boolean, node: ReportNode): boolean {
    return (
      !enable ||
      (this.props.showStaleElementIndicator && this.isElementStale(node))
    )
  }

  private renderElementWithErrorBoundary(
    node: ElementNode,
    index: number,
    width: number
  ): ReactNode | null {
    const component = this.renderElement(node, index, width, node.metadata)

    const elementType = node.element.type
    const isHidden = elementType === "empty"
    const enable = this.shouldComponentBeEnabled(isHidden)
    const isStale = this.isComponentStale(enable, node)
    const className = Block.getClassNames(isStale, isHidden)
    const key = getElementWidgetID(node.element) || index

    return (
      <Maybe enable={enable} key={key}>
        <div className={className} style={{ width }}>
          <ErrorBoundary width={width}>
            <Suspense
              fallback={
                <Alert
                  element={
                    makeElementWithInfoTextNew("Loading...")
                      .alert as AlertProto
                  }
                  width={width}
                />
              }
            >
              {component}
            </Suspense>
          </ErrorBoundary>
        </div>
      </Maybe>
    )
  }

  private renderElement = (
    node: ElementNode,
    index: number,
    width: number,
    metadata: IForwardMsgMetadata
  ): ReactNode => {
    if (!node) {
      throw new Error("Transmission error.")
    }

    const widgetProps = {
      widgetMgr: this.props.widgetMgr,
      disabled: this.props.widgetsDisabled,
    }

    let height: number | undefined

    // Modify width using the value from the spec as passed with the message when applicable
    if (metadata && metadata.elementDimensionSpec) {
      if (
        metadata &&
        metadata.elementDimensionSpec &&
        metadata.elementDimensionSpec.width &&
        metadata.elementDimensionSpec.width > 0
      ) {
        width = Math.min(metadata.elementDimensionSpec.width, width)
      }
      if (
        metadata &&
        metadata.elementDimensionSpec &&
        metadata.elementDimensionSpec.height &&
        metadata.elementDimensionSpec.height > 0
      ) {
        height = metadata.elementDimensionSpec.height
      }
    }

    switch (node.element.type) {
      case "alert":
        return (
          <Alert width={width} element={node.element.alert as AlertProto} />
        )

      case "audio":
        return (
          <Audio width={width} element={node.element.audio as AudioProto} />
        )

      case "balloons":
        return <Balloons reportId={this.props.reportId} />

      case "bokehChart":
        return (
          <BokehChart
            width={width}
            index={index}
            element={node.element.bokehChart as BokehChartProto}
          />
        )

      case "dataFrame":
        throw new Error("TODO")

      case "deckGlJsonChart":
        return (
          <DeckGlJsonChart
            width={width}
            element={node.element.deckGlJsonChart as DeckGlJsonChartProto}
          />
        )

      case "docString":
        return (
          <DocString
            width={width}
            element={node.element.docString as DocStringProto}
          />
        )

      case "empty":
        return <div className="stHidden" key={index} />

      case "exception":
        return (
          <ExceptionElement
            width={width}
            element={node.element.exception as ExceptionProto}
          />
        )

      case "graphvizChart":
        return (
          <GraphVizChart
            element={node.element.graphvizChart as GraphVizChartProto}
            index={index}
            width={width}
          />
        )

      case "iframe":
        return (
          <IFrame element={node.element.iframe as IFrameProto} width={width} />
        )

      case "imgs":
        return (
          <ImageList
            width={width}
            element={node.element.imgs as ImageListProto}
          />
        )

      case "json":
        return <Json width={width} element={node.element.json as JsonProto} />

      case "markdown":
        return (
          <Markdown
            width={width}
            element={node.element.markdown as MarkdownProto}
          />
        )

      case "plotlyChart":
        return (
          <PlotlyChart
            width={width}
            height={height}
            element={node.element.plotlyChart as PlotlyChartProto}
          />
        )

      case "progress":
        return (
          <Progress
            width={width}
            element={node.element.progress as ProgressProto}
          />
        )

      case "table":
        throw new Error("TODO")

      case "text":
        return <Text width={width} element={node.element.text as TextProto} />

      case "vegaLiteChart":
        throw new Error("TODO")

      case "video":
        return (
          <Video width={width} element={node.element.video as VideoProto} />
        )

      // Widgets

      case "button":
        return (
          <Button
            element={node.element.button as ButtonProto}
            width={width}
            {...widgetProps}
          />
        )

      case "checkbox": {
        const checkboxProto = node.element.checkbox as CheckboxProto
        return (
          <Checkbox
            key={checkboxProto.id}
            element={checkboxProto}
            width={width}
            {...widgetProps}
          />
        )
      }

      case "colorPicker": {
        const colorPickerProto = node.element.colorPicker as ColorPickerProto
        return (
          <ColorPicker
            key={colorPickerProto.id}
            element={colorPickerProto}
            width={width}
            {...widgetProps}
          />
        )
      }

      case "componentInstance":
        return (
          <ComponentInstance
            registry={this.props.componentRegistry}
            element={node.element.componentInstance as ComponentInstanceProto}
            width={width}
            {...widgetProps}
          />
        )

      case "dateInput": {
        const dateInputProto = node.element.dateInput as DateInputProto
        return (
          <DateInput
            key={dateInputProto.id}
            element={dateInputProto}
            width={width}
            {...widgetProps}
          />
        )
      }

      case "fileUploader": {
        const fileUploaderProto = node.element
          .fileUploader as FileUploaderProto
        return (
          <FileUploader
            key={fileUploaderProto.id}
            element={fileUploaderProto}
            width={width}
            widgetStateManager={widgetProps.widgetMgr}
            uploadClient={this.props.uploadClient}
            disabled={widgetProps.disabled}
          />
        )
      }

      case "multiselect": {
        const multiSelectProto = node.element.multiselect as MultiSelectProto
        return (
          <Multiselect
            key={multiSelectProto.id}
            element={multiSelectProto}
            width={width}
            {...widgetProps}
          />
        )
      }

      case "numberInput":
        throw new Error("TODO")

      case "radio":
        throw new Error("TODO")

      case "selectbox":
        throw new Error("TODO")

      case "slider":
        throw new Error("TODO")

      case "textArea":
        throw new Error("TODO")

      case "textInput":
        throw new Error("TODO")

      case "timeInput":
        throw new Error("TODO")

      default:
        throw new Error(`Unrecognized Element type ${node.element.type}`)
    }

    // return dispatchOneOf(node, "type", {
    //   dataFrame: (el: SimpleElement) => (
    //     <DataFrame element={el} width={width} height={height} />
    //   ),
    //   table: (el: SimpleElement) => <Table element={el} width={width} />,
    //     <VegaLiteChart element={el} width={width} />
    //   ),
    //   // Widgets
    //   radio: (el: SimpleElement) => (
    //     <Radio
    //       key={el.get("id")}
    //       element={el}
    //       width={width}
    //       {...widgetProps}
    //     />
    //   ),
    //   selectbox: (el: SimpleElement) => (
    //     <Selectbox
    //       key={el.get("id")}
    //       element={el}
    //       width={width}
    //       {...widgetProps}
    //     />
    //   ),
    //   slider: (el: SimpleElement) => (
    //     <Slider
    //       key={el.get("id")}
    //       element={el}
    //       width={width}
    //       {...widgetProps}
    //     />
    //   ),
    //   textArea: (el: SimpleElement) => (
    //     <TextArea
    //       key={el.get("id")}
    //       element={el}
    //       width={width}
    //       {...widgetProps}
    //     />
    //   ),
    //   textInput: (el: SimpleElement) => (
    //     <TextInput
    //       key={el.get("id")}
    //       element={el}
    //       width={width}
    //       {...widgetProps}
    //     />
    //   ),
    //   timeInput: (el: SimpleElement) => (
    //     <TimeInput
    //       key={el.get("id")}
    //       element={el}
    //       width={width}
    //       {...widgetProps}
    //     />
    //   ),
    //   numberInput: (el: SimpleElement) => (
    //     <NumberInput
    //       key={el.get("id")}
    //       element={el}
    //       width={width}
    //       {...widgetProps}
    //     />
    //   ),
    // })
  }

  public render = (): ReactNode => {
    if (this.props.deltaBlock && this.props.deltaBlock.horizontal) {
      // Create a horizontal block as the parent for columns
      // For now, all children are column blocks. For columns, `width` is
      // driven by the total number of columns available.
      return (
        <div className="stBlock-horiz">
          {this.renderElements(
            this.props.deltaBlock.horizontal.totalWeight || 0
          )}
        </div>
      )
    }

    // Create a vertical block. Widths of children autosizes to window width.
    return (
      <AutoSizer disableHeight={true}>
        {({ width }) => this.renderElements(width)}
      </AutoSizer>
    )
  }
}

export default Block
