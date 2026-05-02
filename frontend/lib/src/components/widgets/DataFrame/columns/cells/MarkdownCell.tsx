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

import { useCallback, useState } from "react"

import styled from "@emotion/styled"
import {
  type CustomCell,
  type CustomRenderer,
  drawTextCell,
  GridCellKind,
  type ProvideEditorCallback,
} from "@glideapps/glide-data-grid"
import { Check, Edit2, X } from "react-feather"

import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { removeLineBreaks } from "~lib/components/widgets/DataFrame/columns/utils"

interface MarkdownCellProps {
  readonly kind: "markdown-cell"
  /** The raw markdown string value. */
  readonly value: string | null
  /** The plain text display value (markdown stripped) for cell preview. */
  readonly displayValue: string
}

export type MarkdownCell = CustomCell<MarkdownCellProps>

// eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values -- Uses glide-data-grid CSS variables
const StyledContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 200px;
  max-height: 400px;
  font-family: var(--gdg-font-family);
  font-size: var(--gdg-editor-font-size);
`

// eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values -- Uses glide-data-grid CSS variables
const StyledOverlayButtons = styled.div`
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0.4;
  transition: opacity 0.15s ease;
  z-index: 1;

  ${StyledContainer}:hover &,
  ${StyledContainer}:focus-within & {
    opacity: 1;
  }
`

// eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values -- Uses glide-data-grid CSS variables
const StyledIconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border: none;
  border-radius: 4px;
  background-color: var(--gdg-bg-bubble);
  color: var(--gdg-text-dark);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    transform 0.1s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);

  &:hover {
    background-color: var(--gdg-accent-light);
    transform: scale(1.05);
  }

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--gdg-accent-color);
  }
`

// eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values -- Uses glide-data-grid CSS variables
const StyledMarkdownViewer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: 24px;
  background-color: var(--gdg-bg-cell);
  color: var(--gdg-text-dark);

  /* Apply styles to markdown content */
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin-top: 0;
    margin-bottom: 0.5em;
  }

  p {
    margin-top: 0;
    margin-bottom: 0.5em;
  }

  ul,
  ol {
    margin-top: 0;
    margin-bottom: 0.5em;
    padding-left: 1.5em;
  }

  /* Inline code */
  code {
    padding: 0.2em 0.4em;
    border-radius: 3px;
    background-color: var(--gdg-bg-bubble);
    font-size: 0.9em;
    font-family:
      "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
  }

  /* Code blocks - reset the pre and nested code styles */
  pre {
    padding: 0.75em 1em;
    margin: 0.5em 0;
    border-radius: 4px;
    background-color: var(--gdg-bg-bubble);
    overflow-x: auto;
    font-family:
      "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
    font-size: 0.875em;
    line-height: 1.5;

    /* Reset code styles inside pre */
    code {
      padding: 0;
      background-color: transparent;
      font-size: inherit;
      border-radius: 0;
    }
  }

  a {
    color: var(--gdg-accent-color);
    text-decoration: underline;
  }

  blockquote {
    margin: 0.5em 0;
    padding-left: 1em;
    border-left: 3px solid var(--gdg-border-color);
    color: var(--gdg-text-medium);
  }
`

// eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values -- Uses glide-data-grid CSS variables
const StyledTextarea = styled.textarea`
  flex: 1;
  padding: 16px;
  padding-bottom: 24px;
  border: none;
  resize: none;
  background-color: var(--gdg-bg-cell);
  color: var(--gdg-text-dark);
  font-family:
    "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;
  font-size: var(--gdg-editor-font-size);
  line-height: 1.5;

  &:focus {
    outline: none;
  }
`

// eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values -- Uses glide-data-grid CSS variables
const StyledEmptyMessage = styled.div`
  color: var(--gdg-text-light);
  font-style: italic;
`

/**
 * The cell overlay editor for markdown cells.
 * Shows rendered markdown by default with hover overlay buttons.
 * When editing, shows a textarea with save/cancel buttons.
 */
const MarkdownCellEditor: ReturnType<ProvideEditorCallback<MarkdownCell>> = ({
  value: cell,
  onChange,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(cell.data.value ?? "")

  const handleSave = useCallback(() => {
    onChange({
      ...cell,
      copyData: editValue,
      data: {
        ...cell.data,
        value: editValue,
        displayValue: removeLineBreaks(editValue),
      },
    })
    setIsEditing(false)
  }, [cell, editValue, onChange])

  const handleCancel = useCallback(() => {
    setEditValue(cell.data.value ?? "")
    setIsEditing(false)
  }, [cell.data.value])

  const handleEdit = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditValue(e.target.value)
    },
    []
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Prevent glide-data-grid from handling these keys
      e.stopPropagation()

      // Ctrl/Cmd + Enter to save
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        handleSave()
      }
      // Escape to cancel
      if (e.key === "Escape") {
        handleCancel()
      }
    },
    [handleSave, handleCancel]
  )

  if (isEditing) {
    return (
      <StyledContainer data-testid="markdown-cell-editor">
        <StyledOverlayButtons style={{ opacity: 1 }}>
          <StyledIconButton
            onClick={handleSave}
            title="Save (Ctrl+Enter)"
            aria-label="Save"
          >
            <Check size={16} aria-hidden="true" />
          </StyledIconButton>
          <StyledIconButton
            onClick={handleCancel}
            title="Cancel (Escape)"
            aria-label="Cancel"
          >
            <X size={16} aria-hidden="true" />
          </StyledIconButton>
        </StyledOverlayButtons>
        <StyledTextarea
          value={editValue}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          autoFocus
          placeholder="Enter markdown text..."
          aria-label="Edit markdown content"
        />
      </StyledContainer>
    )
  }

  const hasContent = (cell.data.value?.length ?? 0) > 0

  return (
    <StyledContainer data-testid="markdown-cell-viewer">
      {!cell.readonly && (
        <StyledOverlayButtons>
          <StyledIconButton
            onClick={handleEdit}
            title="Edit"
            aria-label="Edit"
          >
            <Edit2 size={16} aria-hidden="true" />
          </StyledIconButton>
        </StyledOverlayButtons>
      )}
      <StyledMarkdownViewer>
        {hasContent ? (
          <StreamlitMarkdown
            source={cell.data.value ?? ""}
            allowHTML={false}
          />
        ) : (
          <StyledEmptyMessage>No content</StyledEmptyMessage>
        )}
      </StyledMarkdownViewer>
    </StyledContainer>
  )
}

/**
 * Custom renderer for markdown cells.
 * Draws plain text preview in the cell grid.
 */
const renderer: CustomRenderer<MarkdownCell> = {
  kind: GridCellKind.Custom,

  isMatch: (c): c is MarkdownCell =>
    (c.data as { kind?: string }).kind === "markdown-cell",

  draw: (args, cell) => {
    const { displayValue } = cell.data
    drawTextCell(args, displayValue, cell.contentAlign)
    return true
  },

  measure: (ctx, cell, theme) => {
    const { displayValue } = cell.data
    return (
      (displayValue ? ctx.measureText(displayValue).width : 0) +
      theme.cellHorizontalPadding * 2
    )
  },

  provideEditor: () => ({
    editor: MarkdownCellEditor,
    disablePadding: true,
  }),

  onPaste: (val: string, cell: MarkdownCellProps) => {
    return {
      ...cell,
      value: val,
      displayValue: removeLineBreaks(val),
    }
  },
}

export default renderer
