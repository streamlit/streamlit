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

import React, { ReactElement, ReactNode, useContext } from "react"

import classNames from "classnames"

import { Block as BlockProto, streamlit } from "@streamlit/protobuf"

import { AppNode, BlockNode, ElementNode } from "~lib/AppNode"
import { FormsContext } from "~lib/components/core/FormsContext"
import { FlexContextProvider } from "~lib/components/core/Layout/FlexContext"
import { useLayoutStyles } from "~lib/components/core/Layout/useLayoutStyles"
import {
  Direction,
  getDirectionOfBlock,
  MinFlexElementWidth,
  shouldChildrenStretch,
} from "~lib/components/core/Layout/utils"
import { LibContext } from "~lib/components/core/LibContext"
import ChatMessage from "~lib/components/elements/ChatMessage"
import Dialog from "~lib/components/elements/Dialog"
import Expander from "~lib/components/elements/Expander"
import Popover from "~lib/components/elements/Popover"
import Tabs, { TabProps } from "~lib/components/elements/Tabs"
import Form from "~lib/components/widgets/Form"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { useScrollToBottom } from "~lib/hooks/useScrollToBottom"
import { ScriptRunState } from "~lib/ScriptRunState"
import { getElementId, notNullOrUndefined } from "~lib/util/utils"

import ElementNodeRenderer from "./ElementNodeRenderer"
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
  const { libConfig } = useContext(LibContext)

  // Handle cycling of colors for dividers:
  assignDividerColor(props.node, useEmotionTheme())

  // Capture all the element ids to avoid rendering the same element twice
  const elementKeySet = new Set<string>()

  return (
    <>
      {props.node.children &&
        props.node.children.map((node: AppNode, index: number): ReactNode => {
          const disableFullscreenMode =
            libConfig.disableFullscreenMode || props.disableFullscreenMode

          // Base case: render a leaf node.
          if (node instanceof ElementNode) {
            // Put node in childProps instead of passing as a node={node} prop in React to
            // guarantee it doesn't get overwritten by {...childProps}.
            const childProps = {
              ...props,
              disableFullscreenMode,
              node,
            }

            const key = getElementId(node.element) || index.toString()
            // Avoid rendering the same element twice. We assume the first one is the one we want
            // because the page is rendered top to bottom, so a valid widget would be rendered
            // correctly and we assume the second one is therefore stale (or throw an error).
            // Also, our setIn logic pushes stale widgets down in the list of elements, so the
            // most recent one should always come first.
            if (elementKeySet.has(key)) {
              return null
            }

            elementKeySet.add(key)

            return <ElementNodeRenderer key={key} {...childProps} />
          }

          // Recursive case: render a block, which can contain other blocks
          // and elements.
          if (node instanceof BlockNode) {
            // Put node in childProps instead of passing as a node={node} prop in React to
            // guarantee it doesn't get overwritten by {...childProps}.
            const childProps = {
              ...props,
              disableFullscreenMode,
              node,
            }

            // TODO: Update to match React best practices
            // eslint-disable-next-line @eslint-react/no-array-index-key, @typescript-eslint/no-use-before-define
            return <BlockNodeRenderer key={index} {...childProps} />
          }

          // We don't have any other node types!
          // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions -- TODO: Fix this
          throw new Error(`Unrecognized AppNode: ${node}`)
        })}
    </>
  )
}

interface ContainerContentsWrapperProps extends BaseBlockProps {
  node: BlockNode
  height: React.CSSProperties["height"]
}

export const ContainerContentsWrapper = (
  props: ContainerContentsWrapperProps
): ReactElement => {
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
    <FlexContextProvider direction={Direction.VERTICAL}>
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

  const activateScrollToBottom = getActivateScrollToBottomBackwardsCompatible(
    props.node
  )
  const scrollContainerRef = useScrollToBottom(activateScrollToBottom)

  const layout_styles = useLayoutStyles({
    element: props.node.deltaBlock,
    subElement:
      (props.node.deltaBlock.type &&
        props.node.deltaBlock[props.node.deltaBlock.type]) ||
      undefined,
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

  return (
    <FlexContextProvider direction={direction}>
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

const BlockNodeRenderer = (props: BlockPropsWithoutWidth): ReactElement => {
  const { node } = props
  const { fragmentIdsThisRun, scriptRunState, scriptRunId } =
    useContext(LibContext)
  const { formsData } = useRequiredContext(FormsContext)

  let minStretchBehavior: MinFlexElementWidth
  if (LARGE_STRETCH_BEHAVIOR.includes(node.deltaBlock.type ?? "")) {
    minStretchBehavior = "14rem"
  } else if (MEDIUM_STRETCH_BEHAVIOR.includes(node.deltaBlock.type ?? "")) {
    minStretchBehavior = "8rem"
  } else if (node.deltaBlock.type === "chatMessage") {
    if (node.isEmpty) {
      minStretchBehavior = "8rem"
    } else {
      minStretchBehavior = "fit-content"
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
    subElement:
      (node.deltaBlock.type && node.deltaBlock[node.deltaBlock.type]) ||
      undefined,
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
        stretchWidth={shouldChildrenStretch(node.deltaBlock.widthConfig)}
      >
        {child}
      </Popover>
    )
  }

  if (node.deltaBlock.type === "form") {
    const { formId, clearOnSubmit, enterToSubmit, border } = node.deltaBlock
      .form as BlockProto.Form
    const submitButtons = formsData.submitButtons.get(formId)
    const hasSubmitButton =
      submitButtons !== undefined && submitButtons.length > 0
    const scriptNotRunning = scriptRunState === ScriptRunState.NOT_RUNNING
    containerElement = (
      <Form
        formId={formId}
        clearOnSubmit={clearOnSubmit}
        enterToSubmit={enterToSubmit}
        hasSubmitButton={hasSubmitButton}
        scriptNotRunning={scriptNotRunning}
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
