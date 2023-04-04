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

import React, { ReactElement, useRef, useState, useEffect } from "react"
import { useTheme } from "@emotion/react"
import { Tabs as UITabs, Tab as UITab } from "baseui/tabs-motion"

import { BlockNode, AppNode } from "src/lib/AppNode"
import VerticalBlock, {
  BlockPropsWithoutWidth,
} from "src/components/core/Block"
import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"

import { StyledTabContainer } from "./styled-components"

export interface Props extends BlockPropsWithoutWidth {
  widgetsDisabled: boolean
  node: BlockNode
  isStale: boolean
}

function Tabs(props: Props): ReactElement {
  const { widgetsDisabled, node, isStale } = props

  const [activeKey, setActiveKey] = useState<React.Key>(0)
  const tabListRef = useRef<HTMLUListElement>(null)
  const theme = useTheme()

  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    if (tabListRef.current) {
      const { scrollWidth, clientWidth } = tabListRef.current
      setIsOverflowing(scrollWidth > clientWidth)
    }
  }, [node.children.length])

  const TAB_HEIGHT = "2.5rem"
  const TAB_BORDER_HEIGHT = theme.spacing.threeXS

  return (
    <StyledTabContainer
      isOverflowing={isOverflowing}
      tabHeight={TAB_HEIGHT}
      className="stTabs"
    >
      <UITabs
        activeKey={activeKey}
        onChange={({ activeKey }) => {
          setActiveKey(activeKey)
        }}
        /* renderAll on UITabs should always be set to true to avoid scrolling issue
           https://github.com/streamlit/streamlit/issues/5069
         */
        renderAll={true}
        disabled={widgetsDisabled}
        overrides={{
          TabHighlight: {
            style: () => ({
              backgroundColor: widgetsDisabled
                ? theme.colors.fadedText40
                : theme.colors.primary,
              height: TAB_BORDER_HEIGHT,
              // Requires bottom offset to align with the TabBorder
              // bottom: "3px",
            }),
          },
          TabBorder: {
            style: () => ({
              backgroundColor: theme.colors.fadedText05,
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
              ...(isStale
                ? {
                    opacity: 0.33,
                    transition: "opacity 1s ease-in 0.5s",
                  }
                : {}),
            }),
          },
          Root: {
            style: () => ({
              // resetting transform to fix full screen wrapper
              transform: "none",
            }),
          },
        }}
        activateOnFocus
      >
        {node.children.map((appNode: AppNode, index: number): ReactElement => {
          const childProps = {
            ...props,
            node: appNode as BlockNode,
          }
          let nodeLabel = index.toString()
          if (childProps.node.deltaBlock?.tab?.label) {
            nodeLabel = childProps.node.deltaBlock.tab.label
          }
          const isSelected = activeKey.toString() === index.toString()
          const isLast = index === node.children.length - 1

          return (
            <UITab
              title={
                <StreamlitMarkdown
                  source={nodeLabel}
                  allowHTML={false}
                  isLabel
                />
              }
              key={index}
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
                    color: widgetsDisabled
                      ? theme.colors.fadedText40
                      : theme.colors.bodyText,
                    ":focus": {
                      outline: "none",
                      color: widgetsDisabled
                        ? theme.colors.fadedText40
                        : theme.colors.primary,
                      background: "none",
                    },
                    ":hover": {
                      color: widgetsDisabled
                        ? theme.colors.fadedText40
                        : theme.colors.primary,
                      background: "none",
                    },
                    ...(isSelected
                      ? {
                          color: widgetsDisabled
                            ? theme.colors.fadedText40
                            : theme.colors.primary,
                        }
                      : {}),
                    ...(isOverflowing && isLast
                      ? {
                          // Add minimal required padding to hide the overscroll gradient
                          paddingRight: "0.6rem",
                        }
                      : {}),
                  }),
                },
              }}
            >
              <VerticalBlock {...childProps}></VerticalBlock>
            </UITab>
          )
        })}
      </UITabs>
    </StyledTabContainer>
  )
}

export default Tabs
