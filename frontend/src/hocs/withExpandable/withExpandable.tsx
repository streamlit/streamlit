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

import React, { ComponentType, ReactElement, useEffect, useState } from "react"
import classNames from "classnames"
import { StatelessAccordion as Accordion, Panel } from "baseui/accordion"
import { useTheme } from "emotion-theming"
import { Theme } from "theme"
import { StyledExpandableContainer } from "./styled-components"

export interface Props {
  expandable: boolean
  label: string
  expanded: boolean
  empty: boolean
  widgetsDisabled: boolean
  isStale: boolean
}

function withExpandable(
  WrappedComponent: ComponentType<any>
): ComponentType<any> {
  const ExpandableComponent = (props: Props): ReactElement => {
    const {
      label,
      expanded: initialExpanded,
      empty,
      widgetsDisabled,
      isStale,
      ...componentProps
    } = props

    const [expanded, toggleExpanded] = useState<boolean>(initialExpanded)
    useEffect(() => {
      toggleExpanded(initialExpanded)
    }, [initialExpanded])

    const toggle = (): void => toggleExpanded(!expanded)
    const { colors, fontWeights, spacing } = useTheme<Theme>()

    return (
      <StyledExpandableContainer>
        <Accordion
          onChange={toggle}
          expanded={expanded ? ["panel"] : []}
          disabled={widgetsDisabled}
          overrides={{
            Content: {
              style: ({ $expanded }) => ({
                backgroundColor: colors.transparent,
                borderTopStyle: "none",
                borderBottomStyle: "solid",
                borderBottomColor: $expanded
                  ? colors.lightGray
                  : colors.transparent,
                marginLeft: spacing.none,
                marginRight: spacing.none,
                marginTop: spacing.none,
                marginBottom: spacing.none,
                overflow: "visible",
                paddingLeft: spacing.none,
                paddingRight: spacing.none,
                paddingTop: $expanded ? "1em" : 0,
                paddingBottom: spacing.none,
              }),
              props: { className: "streamlit-expanderContent" },
            },
            PanelContainer: {
              style: () => ({
                marginLeft: `${spacing.none} !important`,
                marginRight: `${spacing.none} !important`,
                marginTop: `${spacing.none} !important`,
                marginBottom: `${spacing.none} !important`,
                paddingLeft: `${spacing.none} !important`,
                paddingRight: `${spacing.none} !important`,
                paddingTop: `${spacing.none} !important`,
                paddingBottom: `${spacing.none} !important`,
              }),
            },
            Header: {
              style: ({ $disabled }) => ({
                marginBottom: spacing.none,
                marginLeft: spacing.none,
                marginRight: spacing.none,
                marginTop: spacing.none,
                paddingLeft: spacing.none,
                backgroundColor: colors.transparent,
                borderBottomColor: colors.lightGray,
                color: $disabled ? colors.disabled : colors.black,
                borderTopStyle: "none",
                paddingBottom: "0.5em",
                paddingRight: spacing.none,
                paddingTop: "0.5em",
                fontWeight: fontWeights.medium,
                ":hover": {
                  borderBottomColor: colors.primary,
                },
              }),
              props: {
                className: "streamlit-expanderHeader",
                isStale,
              },
            },
            ToggleIcon: {
              style: ({ $disabled }) => ({
                marginRight: spacing.sm,
                color: $disabled ? colors.disabled : colors.black,
              }),
            },
            Root: {
              props: {
                className: classNames("streamlit-expander", { empty }),
              },
            },
          }}
        >
          <Panel title={label} key="panel">
            <WrappedComponent {...componentProps} disabled={widgetsDisabled} />
          </Panel>
        </Accordion>
      </StyledExpandableContainer>
    )
  }

  return ExpandableComponent
}

export default withExpandable
