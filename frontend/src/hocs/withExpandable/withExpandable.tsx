/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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
import { colors } from "lib/widgetTheme"
import "./withExpandable.scss"

export interface Props {
  expandable: boolean
  label: string
  expanded: boolean
  empty: boolean
  widgetsDisabled: boolean
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
      ...componentProps
    } = props

    const [expanded, toggleExpanded] = useState<boolean>(initialExpanded)
    useEffect(() => {
      toggleExpanded(initialExpanded)
    }, [initialExpanded])

    const toggle = (): void => toggleExpanded(!expanded)

    return (
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
                ? colors.grayLighter
                : colors.transparent,
              marginLeft: "0",
              marginRight: "0",
              marginTop: "0",
              marginBottom: "0",
              paddingLeft: "0",
              paddingRight: "0",
              paddingTop: $expanded ? "1em" : 0,
              paddingBottom: 0,
            }),
            props: { className: "streamlit-expanderContent" },
          },
          PanelContainer: {
            style: {
              marginLeft: "0 !important",
              marginRight: "0 !important",
              marginTop: "0 !important",
              marginBottom: "0 !important",
              paddingLeft: "0 !important",
              paddingRight: "0 !important",
              paddingTop: "0 !important",
              paddingBottom: "0 !important",
            },
          },
          Header: {
            style: ({ $disabled }) => ({
              marginBottom: "0",
              marginLeft: "0",
              marginRight: "0",
              marginTop: "0",
              paddingLeft: "0",
              backgroundColor: colors.transparent,
              borderBottomColor: colors.grayLighter,
              color: $disabled ? colors.disabledColor : colors.black,
              borderTopStyle: "none",
              paddingBottom: "0.5em",
              paddingRight: "0",
              paddingTop: "0.5em",
              fontWeight: 500,
              ":hover": {
                borderBottomColor: colors.primary,
              },
            }),
            props: { className: "streamlit-expanderHeader" },
          },
          ToggleIcon: {
            style: ({ $disabled }) => ({
              marginRight: ".5rem",
              color: $disabled ? colors.disabledColor : colors.black,
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
    )
  }

  return ExpandableComponent
}

export default withExpandable
