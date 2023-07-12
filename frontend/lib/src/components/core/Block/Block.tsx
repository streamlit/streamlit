/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement } from "react"
import { AutoSizer } from "react-virtualized"

import { Block as BlockProto } from "@streamlit/lib/src/proto"
import ExpandableProto = BlockProto.Expandable
import { BlockNode, AppNode, ElementNode } from "@streamlit/lib/src/AppNode"
import { getElementWidgetID } from "@streamlit/lib/src/util/utils"
import withExpandable from "@streamlit/lib/src/hocs/withExpandable"
import { Form } from "@streamlit/lib/src/components/widgets/Form"
import Tabs, { TabProps } from "@streamlit/lib/src/components/elements/Tabs"
import ChatMessage from "@streamlit/lib/src/components/elements/ChatMessage"

import {
  BaseBlockProps,
  isComponentStale,
  shouldComponentBeEnabled,
} from "./utils"
import ElementNodeRenderer from "./ElementNodeRenderer"

import {
  StyledColumn,
  StyledHorizontalBlock,
  StyledVerticalBlock,
  styledVerticalBlockWrapperStyles,
} from "./styled-components"

const ExpandableLayoutBlock = withExpandable(LayoutBlock)

export interface BlockPropsWithoutWidth extends BaseBlockProps {
  node: BlockNode
}

interface BlockPropsWithWidth extends BaseBlockProps {
  node: BlockNode
  width: number
}

// Render BlockNodes (i.e. container nodes).
const BlockNodeRenderer = (props: BlockPropsWithWidth): ReactElement => {
  const { node } = props

  // Allow columns and chat messages to create the specified space regardless of empty state
  // TODO: Maybe we can simplify this to: node.isEmpty && !node.deltaBlock.allowEmpty?
  if (
    node.isEmpty &&
    !node.deltaBlock.column &&
    !node.deltaBlock.chatMessage
  ) {
    return <></>
  }

  const enable = shouldComponentBeEnabled("", props.scriptRunState)
  const isStale = isComponentStale(
    enable,
    node,
    props.scriptRunState,
    props.scriptRunId
  )

  let child: ReactElement
  const childProps = { ...props, ...{ node } }
  if (node.deltaBlock.expandable) {
    // Handle expandable blocks
    const expandableProps = {
      ...childProps,
      empty: node.isEmpty,
      isStale,
      expandable: true,
      ...(node.deltaBlock.expandable as ExpandableProto),
    }
    child = <ExpandableLayoutBlock {...expandableProps} />
  } else {
    child = <LayoutBlock {...childProps} />
  }

  if (node.deltaBlock.type === "form") {
    const { formId, clearOnSubmit } = node.deltaBlock.form as BlockProto.Form
    const submitButtons = props.formsData.submitButtons.get(formId)
    const hasSubmitButton =
      submitButtons !== undefined && submitButtons.length > 0
    return (
      <Form
        formId={formId}
        clearOnSubmit={clearOnSubmit}
        width={props.width}
        hasSubmitButton={hasSubmitButton}
        scriptRunState={props.scriptRunState}
        widgetMgr={props.widgetMgr}
      >
        {child}
      </Form>
    )
  }

  if (node.deltaBlock.chatMessage) {
    return (
      <ChatMessage
        element={node.deltaBlock.chatMessage as BlockProto.ChatMessage}
      >
        {child}
      </ChatMessage>
    )
  }

  if (node.deltaBlock.column) {
    return (
      <StyledColumn
        weight={node.deltaBlock.column.weight ?? 0}
        gap={node.deltaBlock.column.gap ?? ""}
        data-testid="column"
      >
        {child}
      </StyledColumn>
    )
  }

  if (node.deltaBlock.tabContainer) {
    const renderTabContent = (
      mappedChildProps: JSX.IntrinsicAttributes & BlockPropsWithoutWidth
    ): ReactElement => {
      // avoid circular dependency where Tab uses VerticalBlock but VerticalBlock uses tabs
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return <VerticalBlock {...mappedChildProps}></VerticalBlock>
    }
    const tabsProps: TabProps = { ...childProps, isStale, renderTabContent }
    return <Tabs {...tabsProps} />
  }

  return child
}

const ChildRenderer = (props: BlockPropsWithWidth): ReactElement => {
  return (
    <>
      {props.node.children &&
        props.node.children.map(
          (node: AppNode, index: number): ReactElement => {
            // Base case: render a leaf node.
            if (node instanceof ElementNode) {
              // Put node in childProps instead of passing as a node={node} prop in React to
              // guarantee it doesn't get overwritten by {...childProps}.
              const childProps = { ...props, node: node as ElementNode }

              const key = getElementWidgetID(node.element) || index
              return <ElementNodeRenderer key={key} {...childProps} />
            }

            // Recursive case: render a block, which can contain other blocks
            // and elements.
            if (node instanceof BlockNode) {
              // Put node in childProps instead of passing as a node={node} prop in React to
              // guarantee it doesn't get overwritten by {...childProps}.
              const childProps = { ...props, node: node as BlockNode }

              return <BlockNodeRenderer key={index} {...childProps} />
            }

            // We don't have any other node types!
            throw new Error(`Unrecognized AppNode: ${node}`)
          }
        )}
    </>
  )
}

// Currently, only VerticalBlocks will ever contain leaf elements. But this is only enforced on the
// Python side.
const VerticalBlock = (props: BlockPropsWithoutWidth): ReactElement => {
  // Widths of children autosizes to container width (and therefore window width).
  // StyledVerticalBlocks are the only things that calculate their own widths. They should never use
  // the width value coming from the parent via props.
  return (
    <AutoSizer disableHeight={true} style={styledVerticalBlockWrapperStyles}>
      {({ width }) => {
        const propsWithNewWidth = { ...props, ...{ width } }

        return (
          <StyledVerticalBlock width={width} data-testid="stVerticalBlock">
            <ChildRenderer {...propsWithNewWidth} />
          </StyledVerticalBlock>
        )
      }}
    </AutoSizer>
  )
}

const HorizontalBlock = (props: BlockPropsWithWidth): ReactElement => {
  // Create a horizontal block as the parent for columns.
  // The children are always columns, but this is not checked. We just trust the Python side to
  // do the right thing, then we ask ChildRenderer to handle it.
  const gap = props.node.deltaBlock.horizontal?.gap ?? ""

  return (
    <StyledHorizontalBlock gap={gap} data-testid="stHorizontalBlock">
      <ChildRenderer {...props} />
    </StyledHorizontalBlock>
  )
}

// A container block with one of two types of layouts: vertical and horizontal.
function LayoutBlock(props: BlockPropsWithWidth): ReactElement {
  if (props.node.deltaBlock.horizontal) {
    return <HorizontalBlock {...props} />
  }

  return <VerticalBlock {...props} />
}

export default VerticalBlock
