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
import {
  StatelessAccordion as Accordion,
  Panel,
  SharedProps,
} from "baseui/accordion"
import { useTheme } from "emotion-theming"
import { Theme } from "src/theme"
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
    const { colors, radii, spacing, fontSizes } = useTheme<Theme>()

    return (
      <StyledExpandableContainer>
        <Accordion
          onChange={toggle}
          expanded={expanded ? ["panel"] : []}
          disabled={widgetsDisabled}
          overrides={{
            Content: {
              style: ({ $expanded }: SharedProps) => ({
                backgroundColor: colors.transparent,
                marginLeft: spacing.none,
                marginRight: spacing.none,
                marginTop: spacing.none,
                marginBottom: spacing.none,
                overflow: "visible",
                paddingLeft: spacing.lg,
                paddingRight: spacing.lg,
                paddingTop: 0,
                paddingBottom: $expanded ? spacing.lg : 0,
                borderTopStyle: "none",
                borderBottomStyle: "none",
                borderRightStyle: "none",
                borderLeftStyle: "none",
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
              style: ({ $disabled }: SharedProps) => ({
                marginBottom: spacing.none,
                marginLeft: spacing.none,
                marginRight: spacing.none,
                marginTop: spacing.none,
                backgroundColor: colors.transparent,
                color: $disabled ? colors.disabled : colors.bodyText,
                fontSize: fontSizes.sm,
                borderTopStyle: "none",
                borderBottomStyle: "none",
                borderRightStyle: "none",
                borderLeftStyle: "none",
                paddingBottom: spacing.md,
                paddingTop: spacing.md,
                paddingRight: spacing.lg,
                paddingLeft: spacing.lg,
                ...(isStale
                  ? {
                      opacity: 0.33,
                      transition: "opacity 1s ease-in 0.5s",
                    }
                  : {}),
              }),
              props: {
                className: "streamlit-expanderHeader",
                isStale,
              },
            },
            ToggleIcon: {
              style: ({ $disabled }: SharedProps) => ({
                color: $disabled ? colors.disabled : colors.bodyText,
              }),
            },
            Root: {
              props: {
                className: classNames("streamlit-expander", { empty }),
                isStale,
              },
              style: {
                borderStyle: "solid",
                borderWidth: "1px",
                borderColor: colors.fadedText10,
                borderRadius: radii.md,
                marginBottom: spacing.lg,
                ...(isStale
                  ? {
                      borderColor: colors.fadedText05,
                      transition: "border 1s ease-in 0.5s",
                    }
                  : {}),
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
