/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import {
  memo,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { ChevronLeft, ChevronRight } from "@emotion-icons/material-outlined"
import classNames from "classnames"
import { Key, SelectionIndicator } from "react-aria-components"

import { AppNode, BlockNode } from "~lib/AppNode"
import { BlockPropsWithoutWidth } from "~lib/components/core/Block/Block"
import {
  convertKeyToClassName,
  getKeyFromId,
  isElementStale,
} from "~lib/components/core/Block/utils"
import { ScriptRunContext } from "~lib/components/core/ScriptRunContext"
import Icon from "~lib/components/shared/Icon/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledScrollArrow,
  StyledTab,
  StyledTabContainer,
  StyledTabList,
  StyledTabPanel,
  StyledTabsRoot,
} from "./styled-components"

const SCROLL_AMOUNT = 200
const SCROLL_TOLERANCE = 1

/**
 * Look up the persisted active tab label from elementStates and resolve
 * it to an index in the current tab list. Returns null if nothing is
 * stored or the stored label no longer matches any tab.
 */
function getPersistedTabIndex(
  widgetMgr: WidgetStateManager,
  blockId: string,
  allTabLabels: string[]
): { index: number; label: string } | null {
  const stored = widgetMgr.getElementState<string>(blockId, "activeTabLabel")
  if (!stored) return null
  const idx = allTabLabels.indexOf(stored)
  return idx >= 0 ? { index: idx, label: stored } : null
}

export interface TabProps extends BlockPropsWithoutWidth {
  widgetsDisabled: boolean
  node: BlockNode
  isStale: boolean
  renderTabContent: (
    childProps: JSX.IntrinsicAttributes & BlockPropsWithoutWidth
  ) => ReactElement
  width: React.CSSProperties["width"]
  flex: React.CSSProperties["flex"]
  fragmentId?: string
}

function Tabs(props: Readonly<TabProps>): ReactElement {
  const {
    widgetsDisabled,
    node,
    isStale,
    width,
    flex,
    widgetMgr,
    fragmentId,
  } = props
  const { scriptRunState, scriptRunId, fragmentIdsThisRun } =
    useContext(ScriptRunContext)
  const defaultTabIndex = node.deltaBlock?.tabContainer?.defaultTabIndex ?? 0
  // widgetId is only set when the backend registers tabs as a stateful widget
  // (on_change="rerun"). blockId is set whenever key= is provided.
  const widgetId = node.deltaBlock?.tabContainer?.id
  const blockId = node.deltaBlock?.id ?? ""
  const isDynamic = Boolean(widgetId)
  // Passive keyed tabs: have a stable blockId (key= provided) but are NOT
  // dynamic widgets (no on_change="rerun"). These persist the active tab label
  // in elementStates so the selection survives component remounts. Dynamic tabs
  // are excluded because the backend manages their state via session_state.
  const isPassivelyKeyed = Boolean(blockId) && !isDynamic
  const userKey = getKeyFromId(blockId)

  // Memoize tab labels to prevent unnecessary effect reruns
  const allTabLabels = useMemo(
    () =>
      node.children.map((child, index) => {
        const tabNode = child as BlockNode
        return tabNode?.deltaBlock?.tab?.label ?? index.toString()
      }),
    [node.children]
  )

  // Memoize stale flags once so both the tab-button and tab-panel maps share
  // the same computation instead of calling isElementStale twice per child.
  const staleTabFlags = useMemo(
    () =>
      node.children.map(appNode =>
        isElementStale(
          appNode,
          scriptRunState,
          scriptRunId,
          fragmentIdsThisRun
        )
      ),
    [node.children, scriptRunState, scriptRunId, fragmentIdsThisRun]
  )

  const [activeTabKey, setActiveTabKey] = useState<number>(() => {
    if (isPassivelyKeyed) {
      const persisted = getPersistedTabIndex(widgetMgr, blockId, allTabLabels)
      if (persisted) return persisted.index
    }
    return defaultTabIndex
  })
  const activeTabNameRef = useRef<string | undefined>(undefined)
  if (activeTabNameRef.current === undefined) {
    if (isPassivelyKeyed) {
      const persisted = getPersistedTabIndex(widgetMgr, blockId, allTabLabels)
      if (persisted) {
        activeTabNameRef.current = persisted.label
      }
    }

    if (activeTabNameRef.current === undefined) {
      const tab = node.children[defaultTabIndex] as BlockNode
      activeTabNameRef.current = tab?.deltaBlock?.tab?.label ?? "0"
    }
  }

  const tabListRef = useRef<HTMLDivElement>(null)

  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Derive isOverflowing from scroll state instead of tracking separately
  const isOverflowing = canScrollLeft || canScrollRight

  // Update scroll state based on current scroll position
  const updateScrollState = useCallback((): void => {
    if (tabListRef.current) {
      // eslint-disable-next-line streamlit-custom/no-force-reflow-access -- Required for scroll tracking
      const { scrollLeft, scrollWidth, clientWidth } = tabListRef.current
      // Use SCROLL_TOLERANCE for both directions to handle floating point rounding
      setCanScrollLeft(scrollLeft > SCROLL_TOLERANCE)
      setCanScrollRight(
        scrollLeft + clientWidth < scrollWidth - SCROLL_TOLERANCE
      )
    }
  }, [])

  // Scroll the tabs by a fixed amount
  const scroll = useCallback((direction: "left" | "right"): void => {
    tabListRef.current?.scrollBy({
      left: direction === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
      behavior: "smooth",
    })
  }, [])

  const handleScrollLeft = useCallback((): void => scroll("left"), [scroll])
  const handleScrollRight = useCallback((): void => scroll("right"), [scroll])

  // Track previous defaultTabIndex to detect backend changes
  const prevDefaultTabIndexRef = useRef<number>(defaultTabIndex)

  // Sync tab selection when defaultTabIndex changes programmatically
  // (only for dynamic tabs with programmatic control)
  useEffect(() => {
    if (isDynamic && allTabLabels.length > 0) {
      const tabIndexChanged =
        defaultTabIndex !== prevDefaultTabIndexRef.current

      if (tabIndexChanged) {
        const newLabel = allTabLabels[defaultTabIndex]
        if (newLabel) {
          setActiveTabKey(defaultTabIndex)
          activeTabNameRef.current = newLabel
          // Keep the widget manager in sync with the backend-driven tab change.
          // Without this, subsequent reruns would send a stale widget value that
          // overrides session_state, making tab.open return False for the new tab.
          // fromUi: false avoids scheduling a spurious rerun.
          if (widgetId && widgetMgr) {
            widgetMgr.setStringValue(
              { id: widgetId, formId: "" },
              newLabel,
              { fromUi: false },
              fragmentId
            )
          }
        }
        prevDefaultTabIndexRef.current = defaultTabIndex
      }
    }
  }, [
    defaultTabIndex,
    isDynamic,
    allTabLabels,
    widgetId,
    widgetMgr,
    fragmentId,
  ])

  // Reconciles active key & tab name when tab list changes.
  // When isPassivelyKeyed, also check elementStates so that the persisted
  // label survives even if the tracked active label no longer matches a tab.
  useEffect(() => {
    if (isPassivelyKeyed) {
      const persisted = getPersistedTabIndex(widgetMgr, blockId, allTabLabels)
      if (persisted) {
        setActiveTabKey(persisted.index)
        activeTabNameRef.current = persisted.label
        return
      }
    }

    const newTabKey = allTabLabels.indexOf(activeTabNameRef.current ?? "0")
    if (newTabKey === -1) {
      const fallbackLabel = allTabLabels[defaultTabIndex]
      setActiveTabKey(defaultTabIndex)
      activeTabNameRef.current = fallbackLabel
      if (isPassivelyKeyed) {
        widgetMgr.setElementState(blockId, "activeTabLabel", fallbackLabel)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: Update to match React best practices
  }, [allTabLabels])

  // Scroll the active tab into view when the selection changes programmatically
  // (e.g. defaultTabIndex update, passive state restore). block:"nearest" avoids
  // vertical page scroll; inline:"nearest" only scrolls if the tab is not visible.
  // Respects the OS reduced-motion preference by using "instant" when set.
  useEffect(() => {
    const tabList = tabListRef.current
    if (!tabList) return
    const activeTab = tabList.querySelector<HTMLElement>(
      "[aria-selected='true']"
    )
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
    activeTab?.scrollIntoView({
      behavior: reduceMotion ? "instant" : "smooth",
      block: "nearest",
      inline: "nearest",
    })
  }, [activeTabKey])

  // Set up scroll event listener and resize observer
  useEffect(() => {
    const tabList = tabListRef.current
    if (tabList) {
      tabList.addEventListener("scroll", updateScrollState, { passive: true })

      // Use ResizeObserver to update scroll state when container resizes
      // (e.g., window resize, sidebar toggle, orientation change)
      const resizeObserver = new ResizeObserver(() => {
        updateScrollState()
      })
      resizeObserver.observe(tabList)

      return () => {
        tabList.removeEventListener("scroll", updateScrollState)
        resizeObserver.disconnect()
      }
    }
    return undefined
  }, [updateScrollState])

  useEffect(() => {
    // React Aria's Collection-based rendering may add tab DOM nodes in a
    // subsequent microtask/frame, so scrollWidth can still equal clientWidth
    // on the synchronous effect run. Schedule via rAF so layout is finalised
    // before we measure overflow.
    const rafId = requestAnimationFrame(updateScrollState)

    // If tab # changes, match the selected tab label, otherwise default to first tab.
    // When isPassivelyKeyed, prefer the stored label over the tracked ref value.
    if (isPassivelyKeyed) {
      const persisted = getPersistedTabIndex(widgetMgr, blockId, allTabLabels)
      if (persisted) {
        setActiveTabKey(persisted.index)
        activeTabNameRef.current = persisted.label
        return () => cancelAnimationFrame(rafId)
      }
    }

    const newTabKey = allTabLabels.indexOf(activeTabNameRef.current ?? "0")
    if (newTabKey !== -1) {
      setActiveTabKey(newTabKey)
      activeTabNameRef.current = allTabLabels[newTabKey]
    } else {
      const fallbackLabel = allTabLabels[defaultTabIndex]
      setActiveTabKey(defaultTabIndex)
      activeTabNameRef.current = fallbackLabel
      if (isPassivelyKeyed) {
        widgetMgr.setElementState(blockId, "activeTabLabel", fallbackLabel)
      }
    }

    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only re-run when tab count changes; other deps are stable across renders
  }, [node.children.length, updateScrollState])

  const handleSelectionChange = useCallback(
    (key: Key): void => {
      const newIndex = Number(key)
      // RAC guarantees key matches the id prop passed to <Tab> (always String(index)),
      // but guard against NaN in case id generation ever changes.
      if (Number.isNaN(newIndex)) return
      const newLabel = allTabLabels[newIndex]
      setActiveTabKey(newIndex)
      activeTabNameRef.current = newLabel

      if (isPassivelyKeyed) {
        widgetMgr.setElementState(blockId, "activeTabLabel", newLabel)
      }

      if (isDynamic && widgetId && widgetMgr) {
        widgetMgr.setStringValue(
          { id: widgetId, formId: "" },
          newLabel,
          { fromUi: true },
          fragmentId
        )
      }
    },
    [
      allTabLabels,
      blockId,
      fragmentId,
      isDynamic,
      isPassivelyKeyed,
      widgetId,
      widgetMgr,
    ]
  )

  return (
    <StyledTabContainer
      className={classNames("stTabs", convertKeyToClassName(userKey))}
      data-testid="stTabs"
      isOverflowing={isOverflowing}
      width={width}
      flex={flex}
    >
      <StyledTabsRoot
        selectedKey={String(activeTabKey)}
        onSelectionChange={handleSelectionChange}
      >
        <StyledTabList ref={tabListRef} $isStale={isStale}>
          {node.children.map(
            (_appNode: AppNode, index: number): ReactElement => {
              const isStaleTab = staleTabFlags[index]
              const nodeLabel = allTabLabels[index] ?? index.toString()
              return (
                <StyledTab
                  data-testid="stTab"
                  id={String(index)}
                  // TODO: Update to match React best practices
                  // eslint-disable-next-line @eslint-react/no-array-index-key
                  key={index}
                  isDisabled={!isStale && isStaleTab}
                  $isStale={!isStale && isStaleTab}
                >
                  <StreamlitMarkdown
                    source={nodeLabel}
                    allowHTML={false}
                    isLabel
                  />
                  <SelectionIndicator />
                </StyledTab>
              )
            }
          )}
        </StyledTabList>
        {/* shouldForceMount keeps all panels in the DOM to preserve scroll position
            when switching tabs: https://github.com/streamlit/streamlit/issues/5069 */}
        {node.children.map(
          (_appNode: AppNode, index: number): ReactElement => {
            const isStaleTab = staleTabFlags[index]
            const childProps = {
              ...props,
              isStale: isStale || isStaleTab,
              widgetsDisabled,
              node: node.children[index] as BlockNode,
            }
            return (
              <StyledTabPanel
                id={String(index)}
                // TODO: Update to match React best practices
                // eslint-disable-next-line @eslint-react/no-array-index-key
                key={index}
                shouldForceMount
              >
                {props.renderTabContent(childProps)}
              </StyledTabPanel>
            )
          }
        )}
      </StyledTabsRoot>
      {canScrollLeft && (
        <StyledScrollArrow
          position="left"
          onClick={handleScrollLeft}
          aria-label="Scroll tabs left"
          data-testid="stTabsScrollLeft"
        >
          <Icon content={ChevronLeft} size="lg" />
        </StyledScrollArrow>
      )}
      {canScrollRight && (
        <StyledScrollArrow
          position="right"
          onClick={handleScrollRight}
          aria-label="Scroll tabs right"
          data-testid="stTabsScrollRight"
        >
          <Icon content={ChevronRight} size="lg" />
        </StyledScrollArrow>
      )}
    </StyledTabContainer>
  )
}

export default memo(Tabs)
