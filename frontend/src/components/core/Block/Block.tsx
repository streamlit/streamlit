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

import React, { PureComponent, ReactNode, Suspense } from "react"
import { AutoSizer } from "react-virtualized"
import { List } from "immutable"
import { dispatchOneOf } from "lib/immutableProto"
import { ReportRunState } from "lib/ReportRunState"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { makeElementWithInfoText, notNull, requireNonNull } from "lib/utils"
import { IForwardMsgMetadata, IBlock } from "autogen/proto"
import { FileUploadClient } from "lib/FileUploadClient"

// Load (non-lazy) elements.
import Alert from "components/elements/Alert/"
import DocString from "components/elements/DocString/"
import ErrorBoundary from "components/shared/ErrorBoundary/"
import FullScreenWrapper from "components/shared/FullScreenWrapper/"
import ExceptionElement from "components/elements/ExceptionElement/"
import Json from "components/elements/Json/"
import Markdown from "components/elements/Markdown/"
import Table from "components/elements/Table/"
import Text from "components/elements/Text/"
import {
  ComponentInstance,
  ComponentRegistry,
} from "components/widgets/CustomComponent/"

import Maybe from "components/core/Maybe/"
import withExpandable from "hocs/withExpandable"
import { SimpleElement } from "../../../lib/DeltaParser"
import {
  BlockNode,
  ElementNode,
  getElementWidgetID,
  ReportNode,
  ReportRoot,
} from "../../../lib/ReportNode"

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
    let BlockType
    let optionalProps
    if (deltaBlock != null && deltaBlock.expandable) {
      BlockType = this.WithExpandableBlock
      optionalProps = deltaBlock.expandable
    } else {
      BlockType = Block
      optionalProps = {}
    }

    let style: any = { width }
    if (deltaBlock != null && deltaBlock.column) {
      style = {
        // Flex determines how much space is allocated to this column.
        flex: deltaBlock.column.weight,
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
                  element={makeElementWithInfoText("Loading...").get("alert")}
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
          <Alert width={width} element={requireNonNull(node.element.alert)} />
        )

      case "text":
        return (
          <Text width={width} element={requireNonNull(node.element.text)} />
        )

      case "markdown":
        return (
          <Markdown
            width={width}
            element={requireNonNull(node.element.markdown)}
          />
        )

      case "empty":
        return <div className="stHidden" key={index} />

      default:
        throw new Error(`Unrecognized Element type ${node.element.type}`)
    }

    // return dispatchOneOf(node, "type", {
    //   alert: (el: SimpleElement) => <Alert element={el} width={width} />,
    //   audio: (el: SimpleElement) => <Audio element={el} width={width} />,
    //   balloons: (el: SimpleElement) => (
    //     <Balloons reportId={this.props.reportId} />
    //   ),
    //   bokehChart: (el: SimpleElement) => (
    //     <BokehChart element={el} index={index} width={width} />
    //   ),
    //   dataFrame: (el: SimpleElement) => (
    //     <DataFrame element={el} width={width} height={height} />
    //   ),
    //   deckGlJsonChart: (el: SimpleElement) => (
    //     <DeckGlJsonChart element={el} width={width} />
    //   ),
    //   docString: (el: SimpleElement) => (
    //     <DocString element={el} width={width} />
    //   ),
    //   empty: () => <div className="stHidden" key={index} />,
    //   exception: (el: SimpleElement) => (
    //     <ExceptionElement element={el} width={width} />
    //   ),
    //   graphvizChart: (el: SimpleElement) => (
    //     <GraphVizChart element={el} index={index} width={width} />
    //   ),
    //   iframe: (el: SimpleElement) => <IFrame element={el} width={width} />,
    //   imgs: (el: SimpleElement) => <ImageList element={el} width={width} />,
    //   json: (el: SimpleElement) => <Json element={el} width={width} />,
    //   markdown: (el: SimpleElement) => <Markdown element={el} width={width} />,
    //   multiselect: (el: SimpleElement) => (
    //     <Multiselect
    //       key={el.get("id")}
    //       element={el}
    //       width={width}
    //       {...widgetProps}
    //     />
    //   ),
    //   plotlyChart: (el: SimpleElement) => (
    //     <PlotlyChart element={el} width={width} />
    //   ),
    //   progress: (el: SimpleElement) => <Progress element={el} width={width} />,
    //   table: (el: SimpleElement) => <Table element={el} width={width} />,
    //   text: (el: SimpleElement) => <Text element={el} width={width} />,
    //   vegaLiteChart: (el: SimpleElement) => (
    //     <VegaLiteChart element={el} width={width} />
    //   ),
    //   video: (el: SimpleElement) => <Video element={el} width={width} />,
    //   // Widgets
    //   button: (el: SimpleElement) => (
    //     <Button element={el} width={width} {...widgetProps} />
    //   ),
    //   checkbox: (el: SimpleElement) => (
    //     <Checkbox
    //       key={el.get("id")}
    //       element={el}
    //       width={width}
    //       {...widgetProps}
    //     />
    //   ),
    //   colorPicker: (el: SimpleElement) => (
    //     <ColorPicker
    //       key={el.get("id")}
    //       element={el}
    //       width={width}
    //       {...widgetProps}
    //     />
    //   ),
    //   dateInput: (el: SimpleElement) => (
    //     <DateInput
    //       key={el.get("id")}
    //       element={el}
    //       width={width}
    //       {...widgetProps}
    //     />
    //   ),
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
    //   fileUploader: (el: SimpleElement) => (
    //     <FileUploader
    //       key={el.get("id")}
    //       element={el}
    //       width={width}
    //       widgetStateManager={widgetProps.widgetMgr}
    //       uploadClient={this.props.uploadClient}
    //       disabled={widgetProps.disabled}
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
    //   componentInstance: (el: SimpleElement) => (
    //     <ComponentInstance
    //       registry={this.props.componentRegistry}
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
      // For now, all children are column blocks, so we can ignore `width`.
      return (
        <div className="stBlock-horiz" style={{ display: "flex", gap: "8px" }}>
          {this.renderElements(0)}
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
