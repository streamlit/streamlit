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

import React, { useContext, useCallback, useRef } from "react"
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror"
import { createTheme } from "@uiw/codemirror-themes"
import { tags as t } from "@lezer/highlight"
import { ViewUpdate } from "@codemirror/view"
import { defaultKeymap } from "@codemirror/commands"
import { python } from "@codemirror/lang-python"
import { dracula } from "@uiw/codemirror-theme-dracula"
import { keymap } from "@codemirror/view"
import { Close } from "@emotion-icons/material-outlined"

import { Cell as CellProto } from "src/autogen/proto"
import NotebookContext from "src/components/core/NotebookContext"
import CallbacksContext from "src/components/core/CallbacksContext"
import Icon from "src/components/shared/Icon"

import { StyledCloseButton } from "./styled-components"

const myTheme = createTheme({
  theme: "light",
  settings: {
    background: "#fafafa",
    foreground: "#31333f",
    caret: "#262730",
    selection: "#ffc7c7",
    selectionMatch: "#e6eaf1",
    lineHighlight: "#9af8ff",
    gutterBackground: "#fafafa",
    gutterForeground: "#808495",
  },
  styles: [
    { tag: [t.comment, t.bracket], color: "#6a737d" },
    { tag: [t.className, t.propertyName], color: "#6f42c1" },
    {
      tag: [t.variableName, t.attributeName, t.number, t.operator],
      color: "#005cc5",
    },
    {
      tag: [t.keyword, t.typeName, t.typeOperator, t.typeName],
      color: "#d73a49",
    },
    { tag: [t.string, t.meta, t.regexp], color: "#032f62" },
    { tag: [t.name, t.quote], color: "#22863a" },
    { tag: [t.heading], color: "#24292e", fontWeight: "bold" },
    { tag: [t.emphasis], color: "#24292e", fontStyle: "italic" },
    { tag: [t.deleted], color: "#b31d28", backgroundColor: "ffeef0" },
  ],
})

export interface Props {
  element: CellProto
  cellIndex: number
}

function Cell({ element, cellIndex }: Props) {
  const ref = useRef<ReactCodeMirrorRef>({})
  const { notebookModel } = useContext(NotebookContext)
  const {
    updateCellModel,
    insertCell,
    deleteCell,
    storeAndRun,
    toggleCellVisible,
  } = useContext(CallbacksContext)

  // TODO: stop using cellIndex for this. You can add cells above others, which breaks the indexing.
  const cellModel = notebookModel.get(cellIndex)

  const onChange = useCallback(
    (value: string, viewUpdate: ViewUpdate) => {
      updateCellModel(cellIndex, value)
    },
    [updateCellModel, cellIndex]
  )

  const runAll = useCallback((): boolean => {
    storeAndRun()
    return true
  }, [storeAndRun])

  const insertCellBelow = useCallback((): boolean => {
    // TODO: Move the text after the cursor into the new cell.
    // TODO: Move cursor to the end of next cell.
    insertCell(cellIndex + 1)
    return true
  }, [insertCell, cellIndex])

  const backspaceEmptyCell = useCallback((): boolean => {
    if (cellModel?.body.length === 0) {
      deleteCell(cellIndex)
      // TODO: Move cursor to previous cell.
    }

    console.log("XXX", ref.current.state?.selection.main.head)

    return true
  }, [cellModel, cellIndex, deleteCell])

  const backspaceFullCell = useCallback((): boolean => {
    deleteCell(cellIndex)
    // TODO: Move cursor to previous cell.

    return true
  }, [cellIndex, deleteCell])

  const deleteFullCell = useCallback((): boolean => {
    deleteCell(cellIndex)
    // TODO: Move cursor to next cell.

    return true
  }, [cellIndex, deleteCell])

  const toggleCell = useCallback(() => {
    toggleCellVisible(cellIndex)
  }, [toggleCellVisible, cellIndex])

  // TODO:
  // - Cell navigation with up/down
  // - Cell merging with backspace
  // - Cell splitting with shift-enter
  // - Delete Cell (even if full) with mod-shift-backspace
  // - Duplicate cell
  // - Better theme
  // - Better edit / close button
  // NOTE: Mod == Command on Mac and Ctrl on Win/Linux
  const KEYMAPS = [
    {
      key: "Mod-Enter",
      run: runAll,
      shift: insertCellBelow,
      preventDefault: true,
    },
    {
      key: "Ctrl-Enter",
      run: runAll,
      shift: insertCellBelow,
      preventDefault: true,
    },
    { key: "Shift-Enter", run: insertCellBelow, preventDefault: true },
    {
      key: "Mod-Backspace",
      run: backspaceEmptyCell,
      shift: backspaceFullCell,
      preventDefault: true,
    },
    { key: "Mod-Shift-Delete", run: deleteFullCell, preventDefault: true },
    { key: "Ctrl-Backspace", run: backspaceEmptyCell, preventDefault: true },
    // Putting this below so our custom keymaps have precedence.
    ...defaultKeymap,
  ]

  if (!cellModel || !cellModel.visible) {
    return <></>
  }

  return (
    <div style={{ position: "relative" }}>
      <StyledCloseButton onClick={toggleCell}>
        <Icon content={Close} size="lg" />
      </StyledCloseButton>
      <CodeMirror
        key={`cell-${cellIndex}`}
        ref={ref}
        value={cellModel.body}
        extensions={[python(), keymap.of(KEYMAPS)]}
        placeholder="# Type Python here!"
        theme={myTheme /*dracula*/}
        basicSetup={{
          foldGutter: false,
          highlightActiveLine: false,
          lineNumbers: false,
          defaultKeymap: false,
        }}
        style={{
          background: "#fafafa",
          overflow: "hidden",
          fontFamily: "Source Code Pro, monospace",
          fontSize: "14px",
          border: "none",
          borderRadius: "0 0.25rem 0.25rem 0",
          padding: "1rem 1rem 1rem calc(1rem + 2px)",
          margin: "0 0 0 -3px",
          borderLeft: "3px solid #e6eaf1",
        }}
        onChange={onChange}
      />
    </div>
  )
}

export default Cell
