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

import React, {
  memo,
  ReactElement,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

import { Tab as UITab, Tabs as UITabs } from "baseui/tabs-motion"

import { AppNode, BlockNode } from "~lib/AppNode"
import { BlockPropsWithoutWidth } from "~lib/components/core/Block"
import { isElementStale } from "~lib/components/core/Block/utils"
import { LibContext } from "~lib/components/core/LibContext"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { STALE_STYLES } from "~lib/theme"

import { StyledTabContainer } from "./styled-components"

export interface TabProps extends BlockPropsWithoutWidth {
  widgetsDisabled: boolean
  node: BlockNode
  isStale: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  renderTabContent: (childProps: any) => ReactElement
  width: React.CSSProperties["width"]
  flex: React.CSSProperties["flex"]
}

function Tabs(props: Readonly<TabProps>): ReactElement {
  const { widgetsDisabled, node, isStale, width, flex } = props
  const { fragmentIdsThisRun, scriptRunState, scriptRunId } =
    useContext(LibContext)

  let allTabLabels: string[] = []
  const [activeTabKey, setActiveTabKey] = useState<React.Key>(0)
  const [activeTabName, setActiveTabName] = useState<string>(
    // @ts-expect-error
    node.children[0].deltaBlock.tab.label || "0"
  )

  const tabListRef = useRef<HTMLUListElement>(null)
  const theme = useEmotionTheme()

  const [isOverflowing, setIsOverflowing] = useState(false)

  // Reconciles active key & tab name
  useEffect(() => {
    const newTabKey = allTabLabels.indexOf(activeTabName)
    if (newTabKey === -1) {
      setActiveTabKey(0)
      setActiveTabName(allTabLabels[0])
    }
    // TODO: Update to match React best practices
    // eslint-disable-next-line react-hooks/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTabLabels])

  useEffect(() => {
    if (tabListRef.current) {
      const { scrollWidth, clientWidth } = tabListRef.current
      setIsOverflowing(scrollWidth > clientWidth)
    }

    // If tab # changes, match the selected tab label, otherwise default to first tab
    const newTabKey = allTabLabels.indexOf(activeTabName)
    if (newTabKey !== -1) {
      setActiveTabKey(newTabKey)
      setActiveTabName(allTabLabels[newTabKey])
    } else {
      setActiveTabKey(0)
      setActiveTabName(allTabLabels[0])
    }

    // TODO: Update to match React best practices
    // eslint-disable-next-line react-hooks/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.children.length])

  const TAB_HEIGHT = theme.sizes.tabHeight
  const TAB_BORDER_HEIGHT = theme.spacing.threeXS
  return (
    <StyledTabContainer
      className="stTabs"
      data-testid="stTabs"
      isOverflowing={isOverflowing}
      tabHeight={TAB_HEIGHT}
      width={width}
      flex={flex}
    >
      <UITabs
        activateOnFocus
        activeKey={activeTabKey}
        onChange={({ activeKey }) => {
          setActiveTabKey(activeKey)
          setActiveTabName(allTabLabels[activeKey as number])
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
          // Reset available tab labels when rerendering
          if (index === 0) {
            allTabLabels = []
          }

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
          let nodeLabel = index.toString()
          if (childProps.node.deltaBlock?.tab?.label) {
            nodeLabel = childProps.node.deltaBlock.tab.label
          }
          allTabLabels[index] = nodeLabel

          const isSelected = activeTabKey.toString() === index.toString()
          const isLast = index === node.children.length - 1

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
                    // Add minimal required padding to hide the overscroll gradient
                    // This is calculated based on the width of the gradient (spacing.lg)
                    ...(isOverflowing && isLast
                      ? {
                          paddingRight: `calc(${theme.spacing.lg} * 0.6)`,
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
    </StyledTabContainer>
  )
}

export default memo(Tabs)
