/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, {
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react"

import classNames from "classnames"
import { useTheme } from "@emotion/react"
import { set } from "lodash"

import { LibContext } from "@streamlit/lib/src/components/core/LibContext"
import {
  Block as BlockProto,
  Json as JsonProto,
} from "@streamlit/lib/src/proto"
import { AppNode, BlockNode, ElementNode } from "@streamlit/lib/src/AppNode"
import {
  getElementId,
  notNullOrUndefined,
} from "@streamlit/lib/src/util/utils"
import { Form } from "@streamlit/lib/src/components/widgets/Form"
import Tabs, { TabProps } from "@streamlit/lib/src/components/elements/Tabs"
import Popover from "@streamlit/lib/src/components/elements/Popover"
import ChatMessage from "@streamlit/lib/src/components/elements/ChatMessage"
import Dialog from "@streamlit/lib/src/components/elements/Dialog"
import Expander from "@streamlit/lib/src/components/elements/Expander"
import { useScrollToBottom } from "@streamlit/lib/src/hooks/useScrollToBottom"
import Json from "@streamlit/lib/src/components/elements/Json"

import {
  assignDividerColor,
  BaseBlockProps,
  convertKeyToClassName,
  getKeyFromId,
  isComponentStale,
  shouldComponentBeEnabled,
} from "./utils"
import ElementNodeRenderer from "./ElementNodeRenderer"
import {
  StyledColumn,
  StyledDeltaInfo,
  StyledDeltaPathHighlighter,
  StyledDetailsCloseButton,
  StyledHorizontalBlock,
  StyledVerticalBlock,
  StyledVerticalBlockBorderWrapper,
  StyledVerticalBlockBorderWrapperProps,
  StyledVerticalBlockWrapper,
} from "./styled-components"

export interface BlockPropsWithoutWidth extends BaseBlockProps {
  node: BlockNode
}

interface BlockPropsWithWidth extends BaseBlockProps {
  node: BlockNode
  width: number
}

const NodeDetailsWrapper = ({
  id,
  node,
  childProps,
}: {
  id: string
  node: ElementNode
  childProps: any
}): ReactElement => {
  const [event, setEvent] = React.useState<
    React.MouseEvent<HTMLDivElement, MouseEvent> | undefined
  >(undefined)
  const [position, setPosition] = React.useState({ x: 0, y: 0 })
  const [enableDrag, setEnableDrag] = React.useState(false)
  console.log("position", position, event)
  const classNameDeltaPath = `[${node.metadata.deltaPath}]`

  const highlight = (
    e: React.MouseEvent<HTMLDivElement, MouseEvent>
  ): void => {
    e.stopPropagation()

    const elements = document.getElementsByClassName(classNameDeltaPath)
    // only highlight when there is more than one element to hightlight / link
    if (elements.length < 2) {
      return
    }
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i] as HTMLElement
      if (element.classList.contains("highlight")) {
        continue
      }
      element.classList.add("highlight")
      element.style.border = "1px solid red"
    }
  }

  const removeHighlight = useCallback((): void => {
    if (event) {
      return
    }
    // event.stopPropagation()
    const elements = document.getElementsByClassName(classNameDeltaPath)
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i] as HTMLElement
      element.classList.remove("highlight")
      element.style.border = ""
    }
  }, [classNameDeltaPath, event])

  useEffect(() => {
    if (!event) {
      removeHighlight()
    }
  }, [event, removeHighlight])

  return (
    <>
      <StyledDeltaPathHighlighter
        key={id}
        className={classNameDeltaPath !== "[]" ? classNameDeltaPath : ""}
        onContextMenu={e => {
          e.preventDefault()
          e.stopPropagation()
          // if (e.button !== 2) {
          //   return
          // }
          // dismiss open state
          if (event) {
            setEvent(undefined)
            return
          }

          setEvent(e)
          setPosition({
            // x: e.currentTarget.clientLeft - 400,
            // y: Math.max(50, e.currentTarget.clientTop - 100),
            x: e.pageX,
            y: e.pageY,
          })

          highlight(e)
        }}
        onMouseOver={highlight}
        onMouseLeave={removeHighlight}
      >
        <ElementNodeRenderer key={id} {...childProps} />
        <StyledDeltaInfo>{classNameDeltaPath}</StyledDeltaInfo>
      </StyledDeltaPathHighlighter>
      {event && (
        <div
          className="stDeltaInfo"
          draggable={true}
          onDrag={e => {
            // e.stopPropogation()
            e.preventDefault()
            e.stopPropagation()
            if (e.clientX === 0 && e.clientY === 0) {
              return
            }
            setPosition({
              x: e.clientX,
              y: e.clientY,
            })
          }}
          style={{
            position: "fixed",
            left: `${position.x}px`,
            top: `${position.y}px`,
            zIndex: 1000000,
          }}
          onDragOver={e => {
            e.stopPropagation()
            e.preventDefault()
          }}
        >
          <StyledDetailsCloseButton
            onClick={() => {
              setEvent(undefined)
            }}
          >
            X
          </StyledDetailsCloseButton>
          <Json
            width={300}
            element={JsonProto.create({
              body: JSON.stringify({
                deltaPath: JSON.stringify(node.metadata.deltaPath),
                elementId: id,
                fragmentId: node.fragmentId,
                scriptRunId: node.scriptRunId,
              }),
              expanded: true,
            })}
          />
        </div>
      )}
    </>
  )
}

// Render BlockNodes (i.e. container nodes).
const BlockNodeRenderer = (props: BlockPropsWithWidth): ReactElement => {
  const { node } = props
  const { fragmentIdsThisRun } = useContext(LibContext)

  if (node.isEmpty && !node.deltaBlock.allowEmpty) {
    return <></>
  }

  const enable = shouldComponentBeEnabled("", props.scriptRunState)
  const isStale = isComponentStale(
    enable,
    node,
    props.scriptRunState,
    props.scriptRunId,
    fragmentIdsThisRun
  )

  const childProps = { ...props, ...{ node } }

  const disableFullscreenMode =
    props.disableFullscreenMode ||
    notNullOrUndefined(node.deltaBlock.dialog) ||
    notNullOrUndefined(node.deltaBlock.popover)

  const child: ReactElement = (
    <LayoutBlock
      {...childProps}
      disableFullscreenMode={disableFullscreenMode}
    />
  )

  if (node.deltaBlock.dialog) {
    return (
      <Dialog
        element={node.deltaBlock.dialog as BlockProto.Dialog}
        deltaMsgReceivedAt={node.deltaMsgReceivedAt}
      >
        {child}
      </Dialog>
    )
  }

  if (node.deltaBlock.expandable) {
    return (
      <Expander
        empty={node.isEmpty}
        isStale={isStale}
        element={node.deltaBlock.expandable as BlockProto.Expandable}
      >
        {child}
      </Expander>
    )
  }

  if (node.deltaBlock.popover) {
    return (
      <Popover
        empty={node.isEmpty}
        element={node.deltaBlock.popover as BlockProto.Popover}
        width={props.width}
      >
        {child}
      </Popover>
    )
  }

  if (node.deltaBlock.type === "form") {
    const { formId, clearOnSubmit, enterToSubmit, border } = node.deltaBlock
      .form as BlockProto.Form
    const submitButtons = props.formsData.submitButtons.get(formId)
    const hasSubmitButton =
      submitButtons !== undefined && submitButtons.length > 0
    return (
      <Form
        formId={formId}
        clearOnSubmit={clearOnSubmit}
        enterToSubmit={enterToSubmit}
        width={props.width}
        hasSubmitButton={hasSubmitButton}
        scriptRunState={props.scriptRunState}
        widgetMgr={props.widgetMgr}
        border={border}
      >
        {child}
      </Form>
    )
  }

  if (node.deltaBlock.chatMessage) {
    return (
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
        gap={node.deltaBlock.column.gap ?? ""}
        verticalAlignment={
          node.deltaBlock.column.verticalAlignment ?? undefined
        }
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
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      return <VerticalBlock {...mappedChildProps}></VerticalBlock>
    }
    const tabsProps: TabProps = { ...childProps, isStale, renderTabContent }
    return <Tabs {...tabsProps} />
  }

  return child
}

const ChildRenderer = (props: BlockPropsWithWidth): ReactElement => {
  const { libConfig } = useContext(LibContext)

  // Handle cycling of colors for dividers:
  const theme = useTheme()
  assignDividerColor(props.node, theme)

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
              node: node as ElementNode,
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
            return (
              <NodeDetailsWrapper
                key={key}
                id={key}
                node={node}
                childProps={childProps}
              />
            )
          }

          // Recursive case: render a block, which can contain other blocks
          // and elements.
          if (node instanceof BlockNode) {
            // Put node in childProps instead of passing as a node={node} prop in React to
            // guarantee it doesn't get overwritten by {...childProps}.
            const childProps = {
              ...props,
              disableFullscreenMode,
              node: node as BlockNode,
            }

            return (
              <StyledDeltaPathHighlighter key={index}>
                <BlockNodeRenderer key={index} {...childProps} />
                <StyledDeltaInfo>{node.deltaBlock.type}</StyledDeltaInfo>
              </StyledDeltaPathHighlighter>
            )
          }

          // We don't have any other node types!
          throw new Error(`Unrecognized AppNode: ${node}`)
        })}
    </>
  )
}

export interface ScrollToBottomVerticalBlockWrapperProps
  extends StyledVerticalBlockBorderWrapperProps {
  children: ReactNode
}

// A wrapper for Vertical Block that adds scrolling with pinned to bottom behavior.
function ScrollToBottomVerticalBlockWrapper(
  props: ScrollToBottomVerticalBlockWrapperProps
): ReactElement {
  const { border, height, children } = props
  const scrollContainerRef = useScrollToBottom()

  return (
    <StyledVerticalBlockBorderWrapper
      border={border}
      height={height}
      data-testid="stVerticalBlockBorderWrapper"
      data-test-scroll-behavior="scroll-to-bottom"
      ref={scrollContainerRef as React.RefObject<HTMLDivElement>}
    >
      {children}
    </StyledVerticalBlockBorderWrapper>
  )
}

// Currently, only VerticalBlocks will ever contain leaf elements. But this is only enforced on the
// Python side.
const VerticalBlock = (props: BlockPropsWithoutWidth): ReactElement => {
  const wrapperElement = useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(-1)

  const observer = useMemo(
    () =>
      new ResizeObserver(([entry]) => {
        // Since the setWidth will perform changes to the DOM,
        // we need wrap it in a requestAnimationFrame to avoid this error:
        // ResizeObserver loop completed with undelivered notifications.
        window.requestAnimationFrame(() => {
          // We need to determine the available width here to be able to set
          // an explicit width for the `StyledVerticalBlock`.

          // The width should never be set to 0 since it can cause
          // flickering effects.
          setWidth(entry.target.getBoundingClientRect().width || -1)
        })
      }),
    [setWidth]
  )

  const border = props.node.deltaBlock.vertical?.border ?? false
  const height = props.node.deltaBlock.vertical?.height || undefined

  const activateScrollToBottom =
    height &&
    props.node.children.find(node => {
      return (
        node instanceof BlockNode && node.deltaBlock.type === "chatMessage"
      )
    }) !== undefined

  useEffect(() => {
    if (wrapperElement.current) {
      observer.observe(wrapperElement.current)
    }
    return () => {
      observer.disconnect()
    }
    // We need to update the observer whenever the scrolling is activated or deactivated
    // Otherwise, it still tries to measure the width of the old wrapper element.
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [observer, activateScrollToBottom])

  // Decide which wrapper to use based on whether we need to activate scrolling to bottom
  // This is done for performance reasons, to prevent the usage of useScrollToBottom
  // if it is not needed.
  const VerticalBlockBorderWrapper = activateScrollToBottom
    ? ScrollToBottomVerticalBlockWrapper
    : StyledVerticalBlockBorderWrapper

  const propsWithNewWidth = {
    ...props,
    ...{ width },
  }
  // Extract the user-specified key from the block ID (if provided):
  const userKey = getKeyFromId(props.node.deltaBlock.id)

  // Widths of children autosizes to container width (and therefore window width).
  // StyledVerticalBlocks are the only things that calculate their own widths. They should never use
  // the width value coming from the parent via props.

  // To apply a border, we need to wrap the StyledVerticalBlockWrapper again, otherwise the width
  // calculation would not take the padding into consideration.
  return (
    <VerticalBlockBorderWrapper
      border={border}
      height={height}
      data-testid="stVerticalBlockBorderWrapper"
      data-test-scroll-behavior="normal"
    >
      <StyledVerticalBlockWrapper ref={wrapperElement}>
        <StyledVerticalBlock
          width={width}
          className={classNames(
            "stVerticalBlock",
            convertKeyToClassName(userKey)
          )}
          data-testid="stVerticalBlock"
        >
          <ChildRenderer {...propsWithNewWidth} />
        </StyledVerticalBlock>
      </StyledVerticalBlockWrapper>
    </VerticalBlockBorderWrapper>
  )
}

const HorizontalBlock = (props: BlockPropsWithWidth): ReactElement => {
  // Create a horizontal block as the parent for columns.
  // The children are always columns, but this is not checked. We just trust the Python side to
  // do the right thing, then we ask ChildRenderer to handle it.
  const gap = props.node.deltaBlock.horizontal?.gap ?? ""

  return (
    <StyledHorizontalBlock
      gap={gap}
      className="stHorizontalBlock"
      data-testid="stHorizontalBlock"
    >
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
