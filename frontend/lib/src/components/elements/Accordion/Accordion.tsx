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

import { memo, ReactElement, useCallback, useState } from "react"

import { AppNode, BlockNode } from "~lib/AppNode"
import { BlockPropsWithoutWidth } from "~lib/components/core/Block/Block"
import {
  StyledAccordionContainer,
  StyledAccordionItem,
} from "~lib/components/elements/Accordion/styled-components"
import {
  StyledDetails,
  StyledDetailsPanel,
  StyledExpandableContainer,
  StyledSummary,
  StyledSummaryHeading,
  StyledSummaryLabelWrapper,
} from "~lib/components/elements/Expander/styled-components"
import { useDetailsAnimation } from "~lib/components/elements/Expander/useDetailsAnimation"
import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import useWidgetManagerElementState from "~lib/hooks/useWidgetManagerElementState"

export interface AccordionProps extends BlockPropsWithoutWidth {
  node: BlockNode
  isStale: boolean
  renderAccordionContent: (
    childProps: JSX.IntrinsicAttributes & BlockPropsWithoutWidth
  ) => ReactElement
  width: React.CSSProperties["width"]
  flex: React.CSSProperties["flex"]
  fragmentId?: string
}

interface AccordionItemProps extends BlockPropsWithoutWidth {
  accordionNode: BlockNode
  label: string
  isOpen: boolean
  isStale: boolean
  onToggle: (label: string, newOpen: boolean) => void
  renderAccordionContent: (
    childProps: JSX.IntrinsicAttributes & BlockPropsWithoutWidth
  ) => ReactElement
}

const AccordionItem: React.FC<Readonly<AccordionItemProps>> = ({
  accordionNode,
  label,
  isOpen,
  isStale,
  onToggle,
  renderAccordionContent,
  widgetMgr,
  ...props
}): ReactElement => {
  const { detailsRef, summaryRef, contentRef, handleToggle } =
    useDetailsAnimation({
      backendExpanded: isOpen,
      label,
      onToggle: (newOpen: boolean) => onToggle(label, newOpen),
    })

  const childProps: BlockPropsWithoutWidth = {
    ...props,
    widgetMgr,
    node: accordionNode,
  }

  return (
    <StyledAccordionItem
      className="stAccordionItem"
      data-testid="stAccordionItem"
    >
      <StyledExpandableContainer>
        <StyledDetails ref={detailsRef} isStale={isStale}>
          <StyledSummary
            ref={summaryRef}
            onClick={handleToggle}
            isStale={isStale}
            expanded={isOpen}
          >
            <StyledSummaryHeading>
              <DynamicIcon
                iconValue={
                  isOpen
                    ? ":material/keyboard_arrow_down:"
                    : ":material/keyboard_arrow_right:"
                }
                size="lg"
              />
              <StyledSummaryLabelWrapper>
                <StreamlitMarkdown source={label} allowHTML={false} isLabel />
              </StyledSummaryLabelWrapper>
            </StyledSummaryHeading>
          </StyledSummary>

          <StyledDetailsPanel
            ref={contentRef}
            data-testid="stAccordionDetails"
            inert={!isOpen ? "" : undefined}
          >
            {renderAccordionContent(childProps)}
          </StyledDetailsPanel>
        </StyledDetails>
      </StyledExpandableContainer>
    </StyledAccordionItem>
  )
}

const Accordion: React.FC<Readonly<AccordionProps>> = ({
  node,
  isStale,
  widgetMgr,
  renderAccordionContent,
  width,
  flex,
  fragmentId,
  ...props
}): ReactElement => {
  const container = node.deltaBlock.accordionContainer
  const widgetId = container?.id || undefined
  const blockId = node.deltaBlock.id || ""
  const isWidget = Boolean(widgetMgr && widgetId)
  const isPassivelyKeyed = Boolean(blockId) && !isWidget

  const defaultOpenIndex = container?.defaultOpenIndex ?? 0

  const children = node.children

  const labels = children.map((child, index) => {
    const accordionNode = child as BlockNode
    return accordionNode.deltaBlock.accordion?.label ?? index.toString()
  })

  const defaultOpenLabel = labels[defaultOpenIndex] ?? labels[0] ?? ""

  const [storedOpenLabel, setStoredOpenLabel] =
    useWidgetManagerElementState<string>({
      widgetMgr,
      id: isPassivelyKeyed ? blockId : "",
      key: "openLabel",
      defaultValue: defaultOpenLabel,
    })

  const initialOpenLabel = isPassivelyKeyed
    ? storedOpenLabel
    : defaultOpenLabel

  const [openLabel, setOpenLabel] = useState<string>(initialOpenLabel)

  const handleSectionToggle = useCallback(
    (label: string, newOpen: boolean): void => {
      const nextOpenLabel = newOpen ? label : ""

      setOpenLabel(nextOpenLabel)

      if (isPassivelyKeyed) {
        setStoredOpenLabel(nextOpenLabel)
      }

      if (isWidget && widgetId && widgetMgr) {
        widgetMgr.setStringValue(
          { id: widgetId, formId: "" },
          nextOpenLabel,
          { fromUi: true },
          fragmentId
        )
      }
    },
    [
      fragmentId,
      isPassivelyKeyed,
      isWidget,
      setStoredOpenLabel,
      widgetId,
      widgetMgr,
    ]
  )

  return (
    <StyledAccordionContainer
      className="stAccordion"
      data-testid="stAccordion"
      style={{ width, flex }}
    >
      {children.map((child: AppNode, index: number): ReactElement => {
        const accordionNode = child as BlockNode
        const label = labels[index] ?? index.toString()

        return (
          <AccordionItem
            key={accordionNode.deltaBlock.accordion?.label ?? label}
            node={accordionNode}
            accordionNode={accordionNode}
            label={label}
            isOpen={openLabel === label}
            isStale={isStale}
            onToggle={handleSectionToggle}
            renderAccordionContent={renderAccordionContent}
            widgetMgr={widgetMgr}
            {...props}
          />
        )
      })}
    </StyledAccordionContainer>
  )
}

export default memo(Accordion)
