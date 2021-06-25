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

import { Block as BlockProto } from "src/autogen/proto"

import React, { ReactElement } from "react"
import { AutoSizer } from "react-virtualized"
import { BlockNode, ReportNode, ElementNode } from "src/lib/ReportNode"
import { assign } from "lodash"
import { getElementWidgetID } from "src/lib/utils"
import withExpandable from "src/hocs/withExpandable"
import { Form } from "src/components/widgets/Form"

import {
  CommonProps,
  isComponentStale,
  shouldComponentBeEnabled,
} from "./utils"
import ElementNodeRenderer from "./ElementNodeRenderer"
import Card from "./Card"

import {
  StyledColumn,
  StyledHorizontalBlock,
  StyledVerticalBlock,
  styledVerticalBlockWrapperStyles,
} from "./styled-components"

const WithExpandableBlock = withExpandable(Block)

interface BlockProps extends CommonProps {
  node: BlockNode
  width?: number
}

const BlockNodeRenderer = (props: BlockProps): ReactElement => {
  // TODO: Move this cast into type signature of props.
  const node = (props.node as any) as BlockNode

  if (node.isEmpty) {
    return <></>
  }

  const BlockType = node.deltaBlock.expandable ? WithExpandableBlock : Block

  const enable = shouldComponentBeEnabled(false, props.reportRunState)
  const isStale = isComponentStale(
    enable,
    node,
    props.showStaleElementIndicator,
    props.reportRunState,
    props.reportId
  )

  const optionalProps = node.deltaBlock.expandable
    ? {
        empty: node.isEmpty,
        isStale,
        ...node.deltaBlock.expandable,
      }
    : {}

  const childProps = assign({}, props, optionalProps, { node })

  // Container nodes only have 1 direct child, and it's a always a Block (which, for now, is only
  // allowed to be a VerticalBlock). Other other elements go inside *that*.
  const child = <BlockType {...childProps} />

  if (node.deltaBlock.type === "form") {
    const { formId, clearOnSubmit } = node.deltaBlock.form as BlockProto.Form
    const submitButtonCount = props.formsData.submitButtonCount.get(formId)
    const hasSubmitButton =
      submitButtonCount !== undefined && submitButtonCount > 0
    return (
      <Form
        formId={formId}
        clearOnSubmit={clearOnSubmit}
        width={props.width ?? 0}
        hasSubmitButton={hasSubmitButton}
        reportRunState={props.reportRunState}
        widgetMgr={props.widgetMgr}
      >
        {child}
      </Form>
    )
  }

  if (node.deltaBlock.card) {
    return <Card>{child}</Card>
  }

  if (node.deltaBlock.column) {
    return (
      <StyledColumn weight={node.deltaBlock.column.weight ?? 0}>
        {child}
      </StyledColumn>
    )
  }

  return child
}

const ChildRenderer = (props: BlockProps): ReactElement => {
  /** Recursively transform this BlockElement and all children to React Nodes. */
  return (
    <>
      {props.node.children.map(
        (node: ReportNode, index: number): ReactElement => {
          if (node instanceof ElementNode) {
            const childProps = assign({}, props, { node: node as ElementNode })

            // Base case: render a leaf node.
            const key = getElementWidgetID(node.element) || index
            return <ElementNodeRenderer key={key} {...childProps} />
          }

          if (node instanceof BlockNode) {
            const childProps = assign({}, props, { node: node as BlockNode })

            // Recursive case: render a block, which can contain other blocks
            // and elements.
            return <BlockNodeRenderer key={index} {...childProps} />
          }

          // We don't have any other node types!
          throw new Error(`Unrecognized ReportNode: ${node}`)
        }
      )}
    </>
  )
}

// Currently, only VerticalBlocks will ever contain leaf elements. But this is only enforced on the
// Python side.
const VerticalBlock = (props: BlockProps): ReactElement => {
  // Widths of children autosizes to container width (and therefore window width).
  // StyledVerticalBlocks are the only things that calculate their own widths. They should never use
  // the width value coming from the parent via props.
  return (
    <AutoSizer disableHeight={true} style={styledVerticalBlockWrapperStyles}>
      {({ width }) => {
        const propsWithNewWidth = assign({}, props, { width })

        return (
          <StyledVerticalBlock width={width}>
            <ChildRenderer {...propsWithNewWidth} />
          </StyledVerticalBlock>
        )
      }}
    </AutoSizer>
  )
}

const HorizontalBlock = (props: BlockProps): ReactElement => {
  // Create a horizontal block as the parent for columns.
  // For now, the children will always be columns, but this is not strictly enforced. We just trust
  // the Python side to do the right thing and ask ChildRenderer to handle it.
  return (
    <StyledHorizontalBlock data-testid="stHorizontalBlock">
      <ChildRenderer {...props} />
    </StyledHorizontalBlock>
  )
}

// This is the component for any ReportNode that can have more than one direct descendant.
// (i.e. only Vertical and Horizontal blocks for now)
function Block(props: BlockProps): ReactElement {
  if (props.node.deltaBlock.horizontal) {
    return <HorizontalBlock {...props} />
  }

  return <VerticalBlock {...props} />
}

export default Block
