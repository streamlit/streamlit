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

import React, { PureComponent, ReactNode, Suspense } from "react"
import { AutoSizer } from "react-virtualized"
import { List, Map as ImmutableMap } from "immutable"
import { ReportRunState } from "lib/ReportRunState"
import { WidgetStateManager } from "lib/WidgetStateManager"
import { makeElementWithInfoText } from "lib/utils"
import { ForwardMsgMetadata } from "autogen/proto"

import Element from "components/shared/Element"
import ErrorBoundary from "components/shared/ErrorBoundary/"
import FullScreenWrapper from "components/shared/FullScreenWrapper/"

import Text from "components/elements/Text/"

type SimpleElement = ImmutableMap<string, any>
type StElement = SimpleElement | BlockElement
interface BlockElement extends List<StElement> {}

interface Props {
  elements: BlockElement
  reportId: string
  reportRunState: ReportRunState
  showStaleElementIndicator: boolean
  widgetMgr: WidgetStateManager
  widgetsDisabled: boolean
}

class Block extends PureComponent<Props> {
  private renderElements = (width: number): ReactNode[] => {
    const elementsToRender = this.getElements()

    // Transform Streamlit elements into ReactNodes.
    return elementsToRender
      .toArray()
      .map((element: StElement, index: number): ReactNode | null => {
        if (element instanceof List) {
          return this.renderBlock(element as BlockElement, index, width)
        } else {
          return this.renderElementWithErrorBoundary(
            element as SimpleElement,
            index,
            width
          )
        }
      })
      .filter((node: ReactNode | null): ReactNode => node != null)
  }

  private getElements = (): BlockElement => {
    let elementsToRender = this.props.elements
    if (this.props.reportRunState === ReportRunState.RUNNING) {
      // (BUG #739) When the report is running, use our most recent list
      // of rendered elements as placeholders for any empty elements we encounter.
      elementsToRender = this.props.elements.map(
        (element: StElement, index: number): StElement => {
          if (element instanceof ImmutableMap) {
            // Repeat the old element if we encounter st.empty()
            const isEmpty = (element as SimpleElement).get("type") === "empty"
            return isEmpty ? elementsToRender.get(index, element) : element
          }
          return element
        }
      )
    }
    return elementsToRender
  }

  private isElementStale(element: SimpleElement): boolean {
    if (this.props.reportRunState === ReportRunState.RERUN_REQUESTED) {
      // If a rerun was just requested, all of our current elements
      // are about to become stale.
      return true
    } else if (this.props.reportRunState === ReportRunState.RUNNING) {
      return element.get("reportId") !== this.props.reportId
    } else {
      return false
    }
  }

  private renderBlock(
    element: BlockElement,
    index: number,
    width: number
  ): ReactNode {
    return (
      <div key={index} className="stBlock" style={{ width }}>
        <Block
          elements={element}
          reportId={this.props.reportId}
          reportRunState={this.props.reportRunState}
          showStaleElementIndicator={this.props.showStaleElementIndicator}
          widgetMgr={this.props.widgetMgr}
          widgetsDisabled={this.props.widgetsDisabled}
        />
      </div>
    )
  }

  private renderElementWithErrorBoundary(
    element: SimpleElement,
    index: number,
    width: number
  ): ReactNode | null {
    const component = this.renderElement(element, index, width)

    if (!element) {
      // Do not transform an empty element into a ReactNode.
      return null
    }

    const isStale =
      this.props.showStaleElementIndicator &&
      this.isElementStale(element as SimpleElement)

    const className =
      isStale && !FullScreenWrapper.isFullScreen
        ? "element-container stale-element"
        : "element-container"

    return (
      <div key={index} className={className} style={{ width }}>
        <ErrorBoundary width={width}>
          <Suspense
            fallback={
              <Text
                element={makeElementWithInfoText("Loading...").get("text")}
                width={width}
              />
            }
          >
            {component}
          </Suspense>
        </ErrorBoundary>
      </div>
    )
  }

  private renderElement = (
    element: SimpleElement,
    index: number,
    width: number
  ): ReactNode | undefined => {
    if (!element) {
      throw new Error("Transmission error.")
    }
    const { widgetsDisabled, widgetMgr } = this.props

    const metadata = element.get("metadata") as ForwardMsgMetadata
    let height: number | undefined

    // Modify width using the value from the spec as passed with the message when applicable
    if (metadata && metadata.elementDimensionSpec) {
      if (metadata.elementDimensionSpec.width > 0) {
        width = Math.min(metadata.elementDimensionSpec.width, width)
      }
      if (metadata.elementDimensionSpec.height > 0) {
        height = metadata.elementDimensionSpec.height
      }
    }

    return (
      <Element
        index={index}
        disabled={widgetsDisabled}
        element={element}
        widgetMgr={widgetMgr}
        width={width}
        height={height}
      />
    )
  }

  public render = (): ReactNode => (
    <AutoSizer disableHeight={true}>
      {({ width }) => this.renderElements(width)}
    </AutoSizer>
  )
}

export default Block
