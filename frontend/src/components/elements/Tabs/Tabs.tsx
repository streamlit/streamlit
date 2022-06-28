/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
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

import React, { ComponentType, ReactElement, useRef, useState } from "react"
import { useTheme } from "@emotion/react"
import { Tabs as UITabs, Tab as UITab } from "baseui/tabs-motion"

import { BlockNode, AppNode } from "src/lib/AppNode"
import { useIsOverflowing } from "src/lib/Hooks"

import { StyledTabContainer } from "./styled-components"

const TAB_HEIGHT = "2.5rem"

export interface Props {
  widgetsDisabled: boolean
  node: BlockNode
  isStale: boolean
}

function Tabs(TabLayoutComponent: ComponentType<any>): ComponentType<any> {
  const TabContainer = (props: Props): ReactElement => {
    const { widgetsDisabled, node, isStale } = props

    const [activeKey, setActiveKey] = useState<React.Key>(0)
    const tabListRef = useRef<HTMLUListElement>(null)

    const isOverflowing = useIsOverflowing(tabListRef, false)

    const theme = useTheme()

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
          disabled={widgetsDisabled}
          overrides={{
            TabHighlight: {
              style: () => ({
                backgroundColor: widgetsDisabled
                  ? theme.colors.fadedText40
                  : theme.colors.primary,
                height: "2px",
                // Requires bottom offset to align with the TabBorder
                bottom: "3px",
              }),
            },
            TabBorder: {
              style: () => ({
                backgroundColor: theme.colors.fadedText05,
                height: "2px",
              }),
            },
            TabList: {
              props: { ref: tabListRef },
              style: () => ({
                gap: theme.spacing.lg,
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
          {node.children.map(
            (appNode: AppNode, index: number): ReactElement => {
              const childProps = {
                ...props,
                node: appNode as BlockNode,
              }
              let nodeLabel = index.toString()
              if (childProps.node.deltaBlock?.tab?.label) {
                nodeLabel = childProps.node.deltaBlock.tab.label
              }
              const isSelected = activeKey === index
              const isLast = index === node.children.length - 1

              return (
                <UITab
                  title={nodeLabel}
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
                  <TabLayoutComponent {...childProps}></TabLayoutComponent>
                </UITab>
              )
            }
          )}
        </UITabs>
      </StyledTabContainer>
    )
  }
  return TabContainer
}

export default Tabs
