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
import { Tab as UITab, Tabs as UITabs } from "baseui/tabs-motion"

import { AppNode, BlockNode } from "~lib/AppNode"
import { BlockPropsWithoutWidth } from "~lib/components/core/Block/Block"
import { isElementStale } from "~lib/components/core/Block/utils"
import { ScriptRunContext } from "~lib/components/core/ScriptRunContext"
import Icon from "~lib/components/shared/Icon/Icon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { STALE_STYLES } from "~lib/theme/consts"

import { StyledScrollArrow, StyledTabContainer } from "./styled-components"

const SCROLL_AMOUNT = 200
const SCROLL_TOLERANCE = 1

export interface TabProps extends BlockPropsWithoutWidth {
  widgetsDisabled: boolean
  node: BlockNode
  isStale: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  renderTabContent: (childProps: any) => ReactElement
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
  // id is only set when the backend registers tabs as a stateful widget
  // (on_change="rerun"). block.id may still be set for CSS key styling.
  const widgetId = node.deltaBlock?.tabContainer?.id
  const isDynamic = Boolean(widgetId)

  // Memoize tab labels to prevent unnecessary effect reruns
  const allTabLabels = useMemo(
    () =>
      node.children.map((child, index) => {
        const tabNode = child as BlockNode
        return tabNode?.deltaBlock?.tab?.label ?? index.toString()
      }),
    [node.children]
  )

  const [activeTabKey, setActiveTabKey] = useState<React.Key>(defaultTabIndex)
  const [activeTabName, setActiveTabName] = useState<string>(() => {
    const tab = node.children[defaultTabIndex] as BlockNode

    return tab?.deltaBlock?.tab?.label ?? "0"
  })

  const tabListRef = useRef<HTMLUListElement>(null)
  const theme = useEmotionTheme()

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
          setActiveTabName(newLabel)
        }
        prevDefaultTabIndexRef.current = defaultTabIndex
      }
    }
  }, [defaultTabIndex, isDynamic, allTabLabels])

  // Reconciles active key & tab name
  useEffect(() => {
    const newTabKey = allTabLabels.indexOf(activeTabName)
    if (newTabKey === -1) {
      setActiveTabKey(defaultTabIndex)
      setActiveTabName(allTabLabels[defaultTabIndex])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: Update to match React best practices
  }, [allTabLabels])

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
  }, [updateScrollState])

  useEffect(() => {
    updateScrollState()

    // If tab # changes, match the selected tab label, otherwise default to first tab
    const newTabKey = allTabLabels.indexOf(activeTabName)
    if (newTabKey !== -1) {
      setActiveTabKey(newTabKey)
      setActiveTabName(allTabLabels[newTabKey])
    } else {
      setActiveTabKey(defaultTabIndex)
      setActiveTabName(allTabLabels[defaultTabIndex])
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: Update to match React best practices
  }, [node.children.length, updateScrollState])

  const TAB_HEIGHT = theme.sizes.tabHeight
  const TAB_BORDER_HEIGHT = theme.spacing.threeXS

  return (
    <StyledTabContainer
      className="stTabs"
      data-testid="stTabs"
      isOverflowing={isOverflowing}
      width={width}
      flex={flex}
    >
      <UITabs
        activateOnFocus
        activeKey={activeTabKey}
        onChange={({ activeKey }) => {
          setActiveTabKey(activeKey)
          setActiveTabName(allTabLabels[activeKey as number])

          // Update widget state for dynamic tabs
          if (isDynamic && widgetId && widgetMgr) {
            widgetMgr.setStringValue(
              { id: widgetId, formId: "" },
              allTabLabels[activeKey as number],
              { fromUi: true },
              fragmentId
            )
          }
        }}
        /* renderAll on UITabs should always be set to true to avoid scrolling issue
           https://github.com/streamlit/streamlit/issues/5069
         */
        renderAll={true}
        overrides={{
          TabHighlight: {
            style: () => ({
              backgroundColor: theme.colors.primary,
              height: TAB_BORDER_HEIGHT,
            }),
          },
          TabBorder: {
            style: () => ({
              backgroundColor: theme.colors.borderColorLight,
              height: TAB_BORDER_HEIGHT,
            }),
          },
          TabList: {
            props: { ref: tabListRef },
            style: () => ({
              gap: theme.spacing.lg,
              marginBottom: `-${TAB_BORDER_HEIGHT}`,
              paddingBottom: TAB_BORDER_HEIGHT,
              overflowY: "hidden",
              ...(isStale && STALE_STYLES),
            }),
          },
          Root: {
            style: () => ({
              // resetting transform to fix full screen wrapper
              transform: "none",
            }),
          },
        }}
      >
        {node.children.map((appNode: AppNode, index: number): ReactElement => {
          // If the tab is stale, disable it
          const isStaleTab = isElementStale(
            appNode,
            scriptRunState,
            scriptRunId,
            fragmentIdsThisRun
          )

          // Ensure stale tab's elements are also marked stale/disabled
          const childProps = {
            ...props,
            isStale: isStale || isStaleTab,
            widgetsDisabled,
            node: appNode as BlockNode,
          }
          const nodeLabel = allTabLabels[index] ?? index.toString()

          const isSelected = activeTabKey.toString() === index.toString()

          return (
            <UITab
              data-testid="stTab"
              title={
                <StreamlitMarkdown
                  source={nodeLabel}
                  allowHTML={false}
                  isLabel
                />
              }
              // TODO: Update to match React best practices
              // eslint-disable-next-line @eslint-react/no-array-index-key
              key={index}
              // Disable tab if the tab is stale but not the entire tab container:
              disabled={!isStale && isStaleTab}
              overrides={{
                TabPanel: {
                  style: () => ({
                    paddingLeft: theme.spacing.none,
                    paddingRight: theme.spacing.none,
                    paddingBottom: theme.spacing.none,
                    paddingTop: theme.spacing.lg,
                  }),
                },
                Tab: {
                  style: () => ({
                    height: TAB_HEIGHT,
                    whiteSpace: "nowrap",
                    paddingLeft: theme.spacing.none,
                    paddingRight: theme.spacing.none,
                    paddingTop: theme.spacing.none,
                    paddingBottom: theme.spacing.none,
                    fontSize: theme.fontSizes.sm,
                    background: "transparent",
                    color: theme.colors.bodyText,
                    ":focus": {
                      outline: "none",
                      color: theme.colors.primary,
                      background: "none",
                    },
                    ":hover": {
                      color: theme.colors.primary,
                      background: "none",
                    },
                    ...(isSelected
                      ? {
                          color: theme.colors.primary,
                        }
                      : {}),
                    // Apply stale effect if only this specific
                    // tab is stale but not the entire tab container.
                    ...(!isStale && isStaleTab && STALE_STYLES),
                  }),
                },
              }}
            >
              {props.renderTabContent(childProps)}
            </UITab>
          )
        })}
      </UITabs>
      {canScrollLeft && (
        <StyledScrollArrow
          position="left"
          tabHeight={TAB_HEIGHT}
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
          tabHeight={TAB_HEIGHT}
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
