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

import { screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { vi } from "vitest"

import { Block as BlockProto } from "@streamlit/protobuf"

import { BlockNode } from "~lib/AppNode"
import { render } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import Accordion from "./Accordion"

const createWidgetMgr = (): WidgetStateManager =>
  new WidgetStateManager({
    sendRerunBackMsg: vi.fn(),
    formsDataChanged: vi.fn(),
  })

const createAccordionNode = (defaultOpenIndex = 0): BlockNode => {
  const parent = new BlockNode(
    "script-hash",
    [],
    new BlockProto({
      allowEmpty: true,
      accordionContainer: {
        defaultOpenIndex,
      },
    })
  )

  const first = new BlockNode(
    "script-hash",
    [],
    new BlockProto({
      allowEmpty: true,
      accordion: {
        label: "First",
      },
    })
  )

  const second = new BlockNode(
    "script-hash",
    [],
    new BlockProto({
      allowEmpty: true,
      accordion: {
        label: "Second",
      },
    })
  )

  parent.children.push(first)
  parent.children.push(second)

  return parent
}

const renderAccordion = (node = createAccordionNode()): void => {
  render(
    <Accordion
      node={node}
      isStale={false}
      widgetsDisabled={false}
      renderAccordionContent={({ node }) => {
        const blockNode = node
        const label = blockNode.deltaBlock.accordion?.label ?? "Unknown"
        return <div>{`${label} content`}</div>
      }}
      width="100%"
      flex="1"
      endpoints={{} as never}
      uploadClient={{} as never}
      componentRegistry={{} as never}
      widgetMgr={createWidgetMgr()}
    />
  )
}

describe("Accordion", () => {
  it("renders accordion section labels", () => {
    renderAccordion()

    expect(screen.getByText("First")).toBeInTheDocument()
    expect(screen.getByText("Second")).toBeInTheDocument()
  })

  it("opens the default section content", () => {
    renderAccordion(createAccordionNode(0))

    expect(screen.getByText("First content")).toBeVisible()
  })

  it("opens a different default section when defaultOpenIndex changes", () => {
    renderAccordion(createAccordionNode(1))

    expect(screen.getByText("Second content")).toBeVisible()
  })

  it("switches open section when clicking another header", async () => {
    const user = userEvent.setup()
    renderAccordion(createAccordionNode(0))

    await user.click(screen.getByText("Second"))

    expect(screen.getByText("Second content")).toBeVisible()
  })

  it("allows closing the currently open section", async () => {
    const user = userEvent.setup()
    renderAccordion(createAccordionNode(0))

    const panels = screen.getAllByTestId("stAccordionDetails")
    expect(panels[0]).not.toHaveAttribute("inert")

    await user.click(screen.getByText("First"))

    expect(panels[0]).toHaveAttribute("inert")
  })
})
