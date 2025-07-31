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

import React, { ReactElement } from "react"

import { screen } from "@testing-library/react"

import { Block as BlockProto, streamlit } from "@streamlit/protobuf"

import { BlockNode } from "~lib/AppNode"
import { ScriptRunState } from "~lib/ScriptRunState"
import { renderWithContexts } from "~lib/test_util"

import { FlexBoxContainer, VerticalBlock } from "./Block"

const FAKE_SCRIPT_HASH = "fake_script_hash"

function makeColumn(weight: number, children: BlockNode[] = []): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    children,
    new BlockProto({ allowEmpty: true, column: { weight } })
  )
}

function makeHorizontalBlockWithColumns(numColumns: number): BlockNode {
  const weight = 1 / numColumns

  return new BlockNode(
    FAKE_SCRIPT_HASH,
    Array.from({ length: numColumns }, () => makeColumn(weight)),
    new BlockProto({
      allowEmpty: true,
      flexContainer: {
        gapConfig: {
          gapSize: streamlit.GapSize.SMALL,
        },
        direction: BlockProto.FlexContainer.Direction.HORIZONTAL,
      },
    })
  )
}

function makeVerticalBlock(
  children: BlockNode[] = [],
  additionalProps: Partial<BlockProto> = {}
): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    children,
    new BlockProto({ allowEmpty: true, ...additionalProps })
  )
}

function makeVerticalBlockComponent(node: BlockNode): ReactElement {
  return (
    <FlexBoxContainer
      node={node}
      scriptRunId={""}
      scriptRunState={ScriptRunState.NOT_RUNNING}
      widgetsDisabled={false}
      // @ts-expect-error
      widgetMgr={undefined}
      // @ts-expect-error
      uploadClient={undefined}
    />
  )
}

describe("FlexBoxContainer Block Component", () => {
  it("should render a horizontal block with empty columns", () => {
    const block: BlockNode = makeVerticalBlock([
      makeHorizontalBlockWithColumns(4),
    ])
    renderWithContexts(makeVerticalBlockComponent(block), {})

    const horizontalBlock = screen.getByTestId("stHorizontalBlock")
    expect(horizontalBlock).toBeVisible()
    expect(horizontalBlock).toHaveAttribute("direction", "row")

    expect(screen.getAllByTestId("stColumn")).toHaveLength(4)
    expect(screen.getAllByTestId("stVerticalBlock")[0]).not.toHaveStyle(
      "overflow: auto"
    )
  })

  it("should add the user-specified key as class", () => {
    const block: BlockNode = makeVerticalBlock([], {
      id: "$$ID-899e9b72e1539f21f8e82565d36609d0-first container",
    })
    renderWithContexts(makeVerticalBlockComponent(block), {})

    expect(screen.getByTestId("stVerticalBlock")).toBeVisible()
    expect(screen.getByTestId("stVerticalBlock")).toHaveClass(
      "st-key-first-container"
    )
  })

  it("should activate scrolling when height is set", () => {
    const block: BlockNode = makeVerticalBlock(
      [makeHorizontalBlockWithColumns(4)],
      {
        heightConfig: { pixelHeight: 100 },
      }
    )

    renderWithContexts(makeVerticalBlockComponent(block), {})

    expect(screen.getAllByTestId("stVerticalBlock")[0]).toHaveStyle(
      "overflow: auto"
    )
  })

  it("should show border when border is True", () => {
    const block: BlockNode = makeVerticalBlock(
      [makeHorizontalBlockWithColumns(4)],
      {
        flexContainer: { border: true },
      }
    )
    renderWithContexts(makeVerticalBlockComponent(block), {})

    expect(screen.getAllByTestId("stVerticalBlock")[0]).toHaveStyle(
      "border: 1px solid rgba(49, 51, 63, 0.2);"
    )
  })

  describe("VerticalBlock", () => {
    it("should render and be visible", () => {
      const block = new BlockNode(FAKE_SCRIPT_HASH, [], new BlockProto())
      renderWithContexts(
        <VerticalBlock
          node={block}
          scriptRunId={""}
          scriptRunState={ScriptRunState.NOT_RUNNING}
          widgetsDisabled={false}
          // @ts-expect-error
          widgetMgr={undefined}
          // @ts-expect-error
          uploadClient={undefined}
        />,
        {}
      )
      const verticalBlock = screen.getByTestId("stVerticalBlock")
      expect(verticalBlock).toBeVisible()
    })
  })
})
