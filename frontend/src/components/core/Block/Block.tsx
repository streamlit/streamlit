/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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
  Block as BlockProto,
  BokehChart as BokehChartProto,
  Button as ButtonProto,
  DownloadButton as DownloadButtonProto,
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
  IFrame as IFrameProto,
  ImageList as ImageListProto,
  Json as JsonProto,
  Markdown as MarkdownProto,
  Metric as MetricProto,
  PlotlyChart as PlotlyChartProto,
  Progress as ProgressProto,
  Text as TextProto,
  Video as VideoProto,
} from "src/autogen/proto"

import React, { PureComponent, ReactNode, Suspense } from "react"
import { AutoSizer } from "react-virtualized"
// @ts-ignore
import debounceRender from "react-debounce-render"
import { ReportRunState } from "src/lib/ReportRunState"
import { FormsData, WidgetStateManager } from "src/lib/WidgetStateManager"
import { getElementWidgetID } from "src/lib/utils"
import { FileUploadClient } from "src/lib/FileUploadClient"
import { BlockNode, ReportNode, ElementNode } from "src/lib/ReportNode"
import { Quiver } from "src/lib/Quiver"
import { VegaLiteChartElement } from "src/components/elements/ArrowVegaLiteChart/ArrowVegaLiteChart"

// Load (non-lazy) elements.
import Alert from "src/components/elements/Alert/"
import { getAlertKind } from "src/components/elements/Alert/Alert"
import { Kind } from "src/components/shared/AlertContainer"
import ArrowTable from "src/components/elements/ArrowTable/"
import DocString from "src/components/elements/DocString/"
import ErrorBoundary from "src/components/shared/ErrorBoundary/"
import ExceptionElement from "src/components/elements/ExceptionElement/"
import Json from "src/components/elements/Json/"
import Markdown from "src/components/elements/Markdown/"
import Metric from "src/components/elements/Metric/"
import Table from "src/components/elements/Table/"
import Text from "src/components/elements/Text/"
import {
  ComponentInstance,
  ComponentRegistry,
} from "src/components/widgets/CustomComponent/"

import Maybe from "src/components/core/Maybe/"
import withExpandable from "src/hocs/withExpandable"
import { Form, FormSubmitContent } from "src/components/widgets/Form"

import {
  StyledBlock,
  StyledColumn,
  StyledElementContainer,
  StyledHorizontalBlock,
} from "./styled-components"

// Lazy-load elements.
const Audio = React.lazy(() => import("src/components/elements/Audio/"))
const Balloons = React.lazy(() => import("src/components/elements/Balloons/"))
const ArrowDataFrame = React.lazy(() =>
  import("src/components/elements/ArrowDataFrame/")
)
const ArrowVegaLiteChart = React.lazy(() =>
  import("src/components/elements/ArrowVegaLiteChart/")
)

// BokehChart render function is sluggish. If the component is not debounced,
// AutoSizer causes it to rerender multiple times for different widths
// when the sidebar is toggled, which significantly slows down the app.
const BokehChart = React.lazy(() =>
  import("src/components/elements/BokehChart/")
)
const DebouncedBokehChart = debounceRender(BokehChart, 100)

const DataFrame = React.lazy(() =>
  import("src/components/elements/DataFrame/")
)
const DeckGlJsonChart = React.lazy(() =>
  import("src/components/elements/DeckGlJsonChart/")
)
const GraphVizChart = React.lazy(() =>
  import("src/components/elements/GraphVizChart/")
)
const IFrame = React.lazy(() => import("src/components/elements/IFrame/"))
const ImageList = React.lazy(() =>
  import("src/components/elements/ImageList/")
)
const PlotlyChart = React.lazy(() =>
  import("src/components/elements/PlotlyChart/")
)
const VegaLiteChart = React.lazy(() =>
  import("src/components/elements/VegaLiteChart/")
)
const Video = React.lazy(() => import("src/components/elements/Video/"))

// Lazy-load widgets.
const Button = React.lazy(() => import("src/components/widgets/Button/"))
const DownloadButton = React.lazy(() =>
  import("src/components/widgets/DownloadButton/")
)
const Checkbox = React.lazy(() => import("src/components/widgets/Checkbox/"))
const ColorPicker = React.lazy(() =>
  import("src/components/widgets/ColorPicker")
)
const DateInput = React.lazy(() => import("src/components/widgets/DateInput/"))
const Multiselect = React.lazy(() =>
  import("src/components/widgets/Multiselect/")
)
const Progress = React.lazy(() => import("src/components/elements/Progress/"))
const Radio = React.lazy(() => import("src/components/widgets/Radio/"))
const Selectbox = React.lazy(() => import("src/components/widgets/Selectbox/"))
const Slider = React.lazy(() => import("src/components/widgets/Slider/"))
const FileUploader = React.lazy(() =>
  import("src/components/widgets/FileUploader/")
)
const TextArea = React.lazy(() => import("src/components/widgets/TextArea/"))
const TextInput = React.lazy(() => import("src/components/widgets/TextInput/"))
const TimeInput = React.lazy(() => import("src/components/widgets/TimeInput/"))
const NumberInput = React.lazy(() =>
  import("src/components/widgets/NumberInput/")
)

interface Props {
  node: BlockNode
  reportId: string
  reportRunState: ReportRunState
  showStaleElementIndicator: boolean
  widgetMgr: WidgetStateManager
  uploadClient: FileUploadClient
  widgetsDisabled: boolean
  componentRegistry: ComponentRegistry
  formsData: FormsData
}

class Block extends PureComponent<Props> {
  private static readonly WithExpandableBlock = withExpandable(Block)

  /** Recursively transform this BlockElement and all children to React Nodes. */
  private renderElements = (width: number): ReactNode[] => {
    return this.props.node.children.map(
      (node: ReportNode, index: number): ReactNode => {
        if (node instanceof ElementNode) {
          // Base case: render a leaf node.
          return this.renderElementWithErrorBoundary(node, index, width)
        }

        if (node instanceof BlockNode) {
          // Recursive case: render a block, which can contain other blocks
          // and elements.
          return this.renderBlock(node, index, width)
        }

        // We don't have any other node types!
        throw new Error(`Unrecognized ReportNode: ${node}`)
      }
    )
  }

  private isElementStale(node: ReportNode): boolean {
    if (this.props.reportRunState === ReportRunState.RERUN_REQUESTED) {
      // If a rerun was just requested, all of our current elements
      // are about to become stale.
      return true
    }
    if (this.props.reportRunState === ReportRunState.RUNNING) {
      return node.reportId !== this.props.reportId
    }
    return false
  }

  private renderBlock(
    node: BlockNode,
    index: number,
    width: number
  ): ReactNode {
    const BlockType = node.deltaBlock.expandable
      ? Block.WithExpandableBlock
      : Block
    const enable = this.shouldComponentBeEnabled(false)
    const isStale = this.isComponentStale(enable, node)

    const optionalProps = node.deltaBlock.expandable
      ? {
          empty: node.isEmpty,
          isStale,
          ...node.deltaBlock.expandable,
        }
      : {}

    const child = (
      <BlockType
        node={node}
        reportId={this.props.reportId}
        reportRunState={this.props.reportRunState}
        showStaleElementIndicator={this.props.showStaleElementIndicator}
        widgetMgr={this.props.widgetMgr}
        uploadClient={this.props.uploadClient}
        widgetsDisabled={this.props.widgetsDisabled}
        componentRegistry={this.props.componentRegistry}
        formsData={this.props.formsData}
        {...optionalProps}
      />
    )

    if (node.deltaBlock.type === "form") {
      const { formId, clearOnSubmit } = node.deltaBlock.form as BlockProto.Form
      const submitButtonCount = this.props.formsData.submitButtonCount.get(
        formId
      )
      const hasSubmitButton =
        submitButtonCount !== undefined && submitButtonCount > 0
      return (
        <Form
          formId={formId}
          clearOnSubmit={clearOnSubmit}
          width={width}
          hasSubmitButton={hasSubmitButton}
          reportRunState={this.props.reportRunState}
          widgetMgr={this.props.widgetMgr}
        >
          {child}
        </Form>
      )
    }

    if (node.deltaBlock.column && node.deltaBlock.column.weight) {
      // For columns, `width` contains the total weight of all columns.
      return (
        <StyledColumn
          key={index}
          data-testid="stBlock"
          weight={node.deltaBlock.column.weight}
          totalWeight={width}
          isEmpty={node.isEmpty}
        >
          {child}
        </StyledColumn>
      )
    }

    return (
      <StyledBlock
        key={index}
        data-testid="stBlock"
        width={width}
        isEmpty={node.isEmpty}
      >
        {child}
      </StyledBlock>
    )
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
    const element = this.renderElement(node, index, width)

    const elementType = node.element.type
    const isHidden = elementType === "empty" || elementType === "balloons"
    const enable = this.shouldComponentBeEnabled(isHidden)
    const isStale = this.isComponentStale(enable, node)
    const key = getElementWidgetID(node.element) || index

    return (
      <Maybe enable={enable} key={key}>
        <StyledElementContainer
          data-stale={!!isStale}
          isStale={isStale}
          isHidden={isHidden}
          className={"element-container"}
          style={{ width }}
        >
          <ErrorBoundary width={width}>
            <Suspense
              fallback={
                <Alert body="Loading..." kind={Kind.INFO} width={width} />
              }
            >
              {element}
            </Suspense>
          </ErrorBoundary>
        </StyledElementContainer>
      </Maybe>
    )
  }

  private renderElement = (
    node: ElementNode,
    index: number,
    width: number
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
    if (node.metadata.elementDimensionSpec) {
      if (
        node.metadata.elementDimensionSpec.width &&
        node.metadata.elementDimensionSpec.width > 0
      ) {
        width = Math.min(node.metadata.elementDimensionSpec.width, width)
      }
      if (
        node.metadata.elementDimensionSpec.height &&
        node.metadata.elementDimensionSpec.height > 0
      ) {
        height = node.metadata.elementDimensionSpec.height
      }
    }

    switch (node.element.type) {
      case "alert": {
        const alertProto = node.element.alert as AlertProto
        return (
          <Alert
            width={width}
            body={alertProto.body}
            kind={getAlertKind(alertProto.format)}
          />
        )
      }

      case "audio":
        return (
          <Audio width={width} element={node.element.audio as AudioProto} />
        )

      case "balloons":
        return <Balloons reportId={this.props.reportId} />

      case "arrowDataFrame":
        return (
          <ArrowDataFrame
            element={node.quiverElement as Quiver}
            width={width}
            height={height}
          />
        )

      case "arrowTable":
        return <ArrowTable element={node.quiverElement as Quiver} />

      case "arrowVegaLiteChart":
        return (
          <ArrowVegaLiteChart
            element={node.vegaLiteChartElement as VegaLiteChartElement}
            width={width}
          />
        )

      case "bokehChart":
        return (
          <DebouncedBokehChart
            width={width}
            index={index}
            element={node.element.bokehChart as BokehChartProto}
          />
        )

      case "dataFrame":
        return (
          <DataFrame
            element={node.immutableElement.get("dataFrame")}
            width={width}
            height={height}
          />
        )

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
        return (
          <Table element={node.immutableElement.get("table")} width={width} />
        )

      case "text":
        return <Text width={width} element={node.element.text as TextProto} />

      case "metric":
        return <Metric element={node.element.metric as MetricProto} />

      case "vegaLiteChart":
        return (
          <VegaLiteChart
            element={node.immutableElement.get("vegaLiteChart")}
            width={width}
          />
        )

      case "video":
        return (
          <Video width={width} element={node.element.video as VideoProto} />
        )

      // Widgets

      case "button": {
        const buttonProto = node.element.button as ButtonProto
        if (buttonProto.isFormSubmitter) {
          const { formId } = buttonProto
          const hasInProgressUpload = this.props.formsData.formsWithUploads.has(
            formId
          )
          return (
            <FormSubmitContent
              element={buttonProto}
              width={width}
              hasInProgressUpload={hasInProgressUpload}
              {...widgetProps}
            />
          )
        }
        return <Button element={buttonProto} width={width} {...widgetProps} />
      }

      case "downloadButton": {
        const downloadButtonProto = node.element
          .downloadButton as DownloadButtonProto
        return (
          <DownloadButton
            key={downloadButtonProto.id}
            element={downloadButtonProto}
            width={width}
            {...widgetProps}
          />
        )
      }

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
            widgetMgr={widgetProps.widgetMgr}
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

      case "numberInput": {
        const numberInputProto = node.element.numberInput as NumberInputProto
        return (
          <NumberInput
            key={numberInputProto.id}
            element={numberInputProto}
            width={width}
            {...widgetProps}
          />
        )
      }

      case "radio": {
        const radioProto = node.element.radio as RadioProto
        return (
          <Radio
            key={radioProto.id}
            element={radioProto}
            width={width}
            {...widgetProps}
          />
        )
      }

      case "selectbox": {
        const selectboxProto = node.element.selectbox as SelectboxProto
        return (
          <Selectbox
            key={selectboxProto.id}
            element={selectboxProto}
            width={width}
            {...widgetProps}
          />
        )
      }

      case "slider": {
        const sliderProto = node.element.slider as SliderProto
        return (
          <Slider
            key={sliderProto.id}
            element={sliderProto}
            width={width}
            {...widgetProps}
          />
        )
      }

      case "textArea": {
        const textAreaProto = node.element.textArea as TextAreaProto
        return (
          <TextArea
            key={textAreaProto.id}
            element={textAreaProto}
            width={width}
            {...widgetProps}
          />
        )
      }

      case "textInput": {
        const textInputProto = node.element.textInput as TextInputProto
        return (
          <TextInput
            key={textInputProto.id}
            element={textInputProto}
            width={width}
            {...widgetProps}
          />
        )
      }

      case "timeInput": {
        const timeInputProto = node.element.timeInput as TimeInputProto
        return (
          <TimeInput
            key={timeInputProto.id}
            element={timeInputProto}
            width={width}
            {...widgetProps}
          />
        )
      }

      default:
        throw new Error(`Unrecognized Element type ${node.element.type}`)
    }
  }

  public render = (): ReactNode => {
    if (this.props.node.deltaBlock.horizontal) {
      // Create a horizontal block as the parent for columns
      // For now, all children are column blocks. For columns, `width` is
      // driven by the total number of columns available.
      return (
        <StyledHorizontalBlock data-testid="stHorizontalBlock">
          {this.renderElements(
            this.props.node.deltaBlock.horizontal.totalWeight || 0
          )}
        </StyledHorizontalBlock>
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
