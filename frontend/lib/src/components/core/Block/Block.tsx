/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import React, { ReactElement, useContext } from "react"

import classNames from "classnames"

import { Block as BlockProto, streamlit } from "@streamlit/protobuf"

import { BlockNode } from "~lib/AppNode"
import {
  FlexContext,
  FlexContextProvider,
} from "~lib/components/core/Layout/FlexContext"
import { useLayoutStyles } from "~lib/components/core/Layout/useLayoutStyles"
import type { UseLayoutStylesArgs } from "~lib/components/core/Layout/useLayoutStyles"
import {
  Direction,
  getDirectionOfBlock,
  MinFlexElementWidth,
  shouldWidthStretch,
} from "~lib/components/core/Layout/utils"
import { ScriptRunContext } from "~lib/components/core/ScriptRunContext"
import ChatMessage from "~lib/components/elements/ChatMessage"
import Dialog from "~lib/components/elements/Dialog"
import Expander from "~lib/components/elements/Expander"
import Popover from "~lib/components/elements/Popover"
import Tabs, { TabProps } from "~lib/components/elements/Tabs"
import Form from "~lib/components/widgets/Form"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useScrollToBottom } from "~lib/hooks/useScrollToBottom"
import { notNullOrUndefined } from "~lib/util/utils"

import { RenderNodeVisitor } from "./RenderNodeVisitor"
import {
  StyledColumn,
  StyledFlexContainerBlock,
  StyledFlexContainerBlockProps,
  StyledLayoutWrapper,
} from "./styled-components"
import {
  assignDividerColor,
  backwardsCompatibleColumnGapSize,
  BaseBlockProps,
  checkFlexContainerBackwardsCompatibile,
  convertKeyToClassName,
  getActivateScrollToBottomBackwardsCompatible,
  getBorderBackwardsCompatible,
  getClassnamePrefix,
  getKeyFromId,
  isComponentStale,
  shouldComponentBeEnabled,
} from "./utils"

const ChildRenderer = (props: BlockPropsWithoutWidth): ReactElement => {
  // Handle cycling of colors for dividers:
  assignDividerColor(props.node, useEmotionTheme())

  return <>{RenderNodeVisitor.collectReactElements(props)}</>
}

/**
 * Extract only layout-relevant fields from a block submessage to satisfy
 * `useLayoutStyles`'s `subElement` shape while being robust to unrelated block
 * types like TabContainer.
 */
const getLayoutSubElement = (
  block: BlockProto
): UseLayoutStylesArgs["subElement"] => {
  const typeKey = block.type as keyof typeof block | undefined
  const raw = typeKey
    ? (block as unknown as Record<string, unknown>)[typeKey]
    : undefined
  if (!raw || typeof raw !== "object") return undefined

  const candidate = raw as Record<string, unknown>
  const subElement = {
    useContainerWidth: candidate.useContainerWidth as
      | boolean
      | null
      | undefined,
    height: candidate.height as number | undefined,
    width: candidate.width as number | undefined,
    widthConfig: candidate.widthConfig as
      | streamlit.IWidthConfig
      | null
      | undefined,
  }

  if (
    subElement.useContainerWidth === undefined &&
    subElement.height === undefined &&
    subElement.width === undefined &&
    subElement.widthConfig === undefined
  ) {
    return undefined
  }

  return subElement
}

interface ContainerContentsWrapperProps extends BaseBlockProps {
  node: BlockNode
  height: React.CSSProperties["height"]
  isRoot?: boolean
}

export const ContainerContentsWrapper = (
  props: ContainerContentsWrapperProps
): ReactElement => {
  const parentContext = useContext(FlexContext)

  const defaultStyles: StyledFlexContainerBlockProps = {
    direction: Direction.VERTICAL,
    flex: 1,
    gap: streamlit.GapSize.SMALL,
    height: props.height,
    // eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values
    border: false,
  }

  const userKey = getKeyFromId(props.node.deltaBlock.id)
  return (
    <FlexContextProvider
      direction={Direction.VERTICAL}
      isRoot={props.isRoot}
      parentContext={parentContext}
    >
      <StyledFlexContainerBlock
        {...defaultStyles}
        className={classNames(
          getClassnamePrefix(Direction.VERTICAL),
          convertKeyToClassName(userKey)
        )}
        data-testid={getClassnamePrefix(Direction.VERTICAL)}
      >
        <ChildRenderer {...props} />
      </StyledFlexContainerBlock>
    </FlexContextProvider>
  )
}

interface FlexBoxContainerProps extends BaseBlockProps {
  node: BlockNode
}

export const FlexBoxContainer = (
  props: FlexBoxContainerProps
): ReactElement => {
  const direction = getDirectionOfBlock(props.node.deltaBlock)
  const parentContext = useContext(FlexContext)

  const activateScrollToBottom = getActivateScrollToBottomBackwardsCompatible(
    props.node
  )
  const scrollContainerRef = useScrollToBottom(activateScrollToBottom)

  const layout_styles = useLayoutStyles({
    element: props.node.deltaBlock,
    subElement: getLayoutSubElement(props.node.deltaBlock),
  })

  const styles = {
    gap:
      // This is backwards compatible with old proto messages since previously
      // the gap size was defaulted to small.
      props.node.deltaBlock.flexContainer?.gapConfig?.gapSize ??
      streamlit.GapSize.SMALL,
    direction: direction,
    // This is also backwards compatible since previously wrap was not added
    // to the flex container.
    $wrap: props.node.deltaBlock.flexContainer?.wrap ?? false,
    overflow: layout_styles.overflow,
    border: getBorderBackwardsCompatible(props.node.deltaBlock),
    // We need the height on the container for scrolling.
    height: layout_styles.height,
    // Flex properties are set on the LayoutWrapper.
    flex: "1",
    align: props.node.deltaBlock.flexContainer?.align,
    justify: props.node.deltaBlock.flexContainer?.justify,
  }

  const userKey = getKeyFromId(props.node.deltaBlock.id)

  // Extract pixel width if the container has a fixed width
  const parentWidth =
    props.node.deltaBlock.widthConfig?.pixelWidth ?? undefined

  // Determine width configuration for FlexContext
  const hasContentWidth =
    props.node.deltaBlock.widthConfig?.useContent ?? false
  const hasFixedWidth =
    (props.node.deltaBlock.widthConfig?.pixelWidth ?? 0) > 0 ||
    (props.node.deltaBlock.widthConfig?.remWidth ?? 0) > 0

  return (
    <FlexContextProvider
      direction={direction}
      parentWidth={parentWidth}
      hasContentWidth={hasContentWidth}
      hasFixedWidth={hasFixedWidth}
      parentContext={parentContext}
    >
      <StyledFlexContainerBlock
        {...styles}
        className={classNames(
          getClassnamePrefix(direction),
          convertKeyToClassName(userKey)
        )}
        data-testid={getClassnamePrefix(direction)}
        ref={scrollContainerRef as React.RefObject<HTMLDivElement>}
        data-test-scroll-behavior={
          activateScrollToBottom ? "scroll-to-bottom" : "normal"
        }
      >
        <ChildRenderer {...props} />
      </StyledFlexContainerBlock>
    </FlexContextProvider>
  )
}

export interface BlockPropsWithoutWidth extends BaseBlockProps {
  node: BlockNode
}

const LARGE_STRETCH_BEHAVIOR = ["tabContainer"]
const MEDIUM_STRETCH_BEHAVIOR = ["chatInput"]

export const BlockNodeRenderer = (
  props: BlockPropsWithoutWidth
): ReactElement => {
  const { node } = props
  const { scriptRunState, scriptRunId, fragmentIdsThisRun } =
    useContext(ScriptRunContext)

  let minStretchBehavior: MinFlexElementWidth
  if (LARGE_STRETCH_BEHAVIOR.includes(node.deltaBlock.type ?? "")) {
    minStretchBehavior = "14rem"
  } else if (MEDIUM_STRETCH_BEHAVIOR.includes(node.deltaBlock.type ?? "")) {
    minStretchBehavior = "8rem"
  } else if (node.deltaBlock.type === "chatMessage") {
    if (node.isEmpty) {
      minStretchBehavior = "8rem"
    }
  } else if (
    node.deltaBlock.type === "flexContainer" ||
    node.deltaBlock.column ||
    node.deltaBlock.expandable
  ) {
    if (!node.isEmpty) {
      minStretchBehavior = "8rem"
    }
  }

  const styles = useLayoutStyles({
    element: node.deltaBlock,
    subElement: getLayoutSubElement(node.deltaBlock),
    minStretchBehavior,
  })

  if (node.isEmpty && !node.deltaBlock.allowEmpty) {
    return <></>
  }

  const enable = shouldComponentBeEnabled("", scriptRunState)
  const isStale = isComponentStale(
    enable,
    node,
    scriptRunState,
    scriptRunId,
    fragmentIdsThisRun
  )

  const childProps = { ...props, ...{ node } }

  // Disable fullscreen mode if already disabled by parent
  // (e.g., via libConfig or ancestor dialog/popover),
  // or if this block itself is a dialog or popover
  const disableFullscreenMode =
    props.disableFullscreenMode ||
    notNullOrUndefined(node.deltaBlock.dialog) ||
    notNullOrUndefined(node.deltaBlock.popover)

  let containerElement: ReactElement | undefined
  const child: ReactElement = (
    <ContainerContentsWrapper
      {...childProps}
      disableFullscreenMode={disableFullscreenMode}
      height="100%"
    />
  )

  if (checkFlexContainerBackwardsCompatibile(node.deltaBlock)) {
    containerElement = <FlexBoxContainer {...childProps} />
  }

  if (node.deltaBlock.dialog) {
    return (
      <Dialog
        element={node.deltaBlock.dialog as BlockProto.Dialog}
        deltaMsgReceivedAt={node.deltaMsgReceivedAt}
        widgetMgr={props.widgetMgr}
        fragmentId={node.fragmentId}
      >
        {child}
      </Dialog>
    )
  }

  if (node.deltaBlock.expandable) {
    containerElement = (
      <Expander
        isStale={isStale}
        element={node.deltaBlock.expandable as BlockProto.Expandable}
      >
        {child}
      </Expander>
    )
  }

  if (node.deltaBlock.popover) {
    containerElement = (
      <Popover
        empty={node.isEmpty}
        element={node.deltaBlock.popover as BlockProto.Popover}
        stretchWidth={shouldWidthStretch(node.deltaBlock.widthConfig)}
      >
        {child}
      </Popover>
    )
  }

  if (node.deltaBlock.type === "form") {
    const { formId, clearOnSubmit, enterToSubmit, border } = node.deltaBlock
      .form as BlockProto.Form
    containerElement = (
      <Form
        formId={formId}
        clearOnSubmit={clearOnSubmit}
        enterToSubmit={enterToSubmit}
        widgetMgr={props.widgetMgr}
        border={border}
        overflow={styles.overflow}
      >
        {child}
      </Form>
    )
  }

  if (node.deltaBlock.chatMessage) {
    containerElement = (
      <ChatMessage
        element={node.deltaBlock.chatMessage as BlockProto.ChatMessage}
        endpoints={props.endpoints}
      >
        {child}
      </ChatMessage>
    )
  }

  if (node.deltaBlock.column) {
    return (
      <StyledColumn
        weight={node.deltaBlock.column.weight ?? 0}
        gap={backwardsCompatibleColumnGapSize(node.deltaBlock.column)}
        verticalAlignment={
          node.deltaBlock.column.verticalAlignment ?? undefined
        }
        showBorder={node.deltaBlock.column.showBorder ?? false}
        className="stColumn"
        data-testid="stColumn"
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
      return <ContainerContentsWrapper {...mappedChildProps} height="auto" />
    }
    // We can't use StyledLayoutWrapper for tabs currently because of the horizontal scrolling
    // management that is handled in the Tabs component. TODO(lwilby): Investigate whether it makes
    // sense to consolidate that logic with the StyledLayoutWrapper.
    const tabsProps: TabProps = {
      ...childProps,
      isStale,
      renderTabContent,
      width: styles.width,
      flex: styles.flex,
    }
    return <Tabs {...tabsProps} />
  }

  if (containerElement) {
    return (
      <StyledLayoutWrapper data-testid="stLayoutWrapper" {...styles}>
        {containerElement}
      </StyledLayoutWrapper>
    )
  }

  return child
}

export const VerticalBlock = (props: BlockPropsWithoutWidth): ReactElement => {
  // Deprecated. Use FlexBoxContainer instead.
  return <FlexBoxContainer {...props} />
}
