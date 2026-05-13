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
import { Check, Close, Edit } from "@emotion-icons/material-outlined"
import {
  type CustomCell,
  type CustomRenderer,
  drawTextCell,
  GridCellKind,
  type ProvideEditorCallback,
} from "@glideapps/glide-data-grid"

import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { StyledToolbar } from "~lib/components/shared/Toolbar/styled-components"
import { ToolbarAction } from "~lib/components/shared/Toolbar/Toolbar"
import { removeLineBreaks } from "~lib/components/widgets/DataFrame/columns/utils"

interface MarkdownCellProps {
  kind: "markdown-cell"
  /** The raw markdown string value. */
  value: string | null
  /** The plain text display value for cell preview. */
  displayValue: string
}

export type MarkdownCell = CustomCell<MarkdownCellProps>

interface StyledContainerProps {
  isEditing?: boolean
}

/* eslint-disable streamlit-custom/no-hardcoded-theme-values -- Uses glide-data-grid CSS variables */
const StyledContainer = styled.div<StyledContainerProps>(({ isEditing }) => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  minHeight: isEditing ? "18.75rem" : "12.5rem",
  maxHeight: isEditing ? "min(31.25rem, 70vh)" : "25rem",
  fontFamily: "var(--gdg-font-family)",
  fontSize: "var(--gdg-editor-font-size)",
}))
/* eslint-enable streamlit-custom/no-hardcoded-theme-values */

const TOOLBAR_OPACITY_TRANSITION = "opacity 300ms 150ms"
const TOOLBAR_HIDE_TRANSITION = `${TOOLBAR_OPACITY_TRANSITION}, visibility 0ms linear 450ms`
const TOOLBAR_SHOW_TRANSITION = `${TOOLBAR_OPACITY_TRANSITION}, visibility 0ms linear 150ms`

interface StyledToolbarWrapperProps {
  locked?: boolean
}

const StyledToolbarWrapper = styled.div<StyledToolbarWrapperProps>(
  ({ theme, locked }) => ({
    opacity: locked ? 1 : 0,
    // Keep in tab order when hidden (visibility: hidden removes from tab order)
    // Use opacity for visual hide, which allows keyboard navigation to the button
    // pointerEvents remains "auto" so the button can be tabbed to even when visually hidden
    padding: `${theme.spacing.sm} ${theme.spacing.sm} 0 0`,
    top: 0,
    right: 0,
    position: "absolute",
    zIndex: theme.zIndices.sidebar + 1,
    pointerEvents: "auto",
    transition: locked ? TOOLBAR_SHOW_TRANSITION : TOOLBAR_HIDE_TRANSITION,

    // Make button visible when focused via keyboard
    "&:focus-within": {
      opacity: 1,
    },
  })
)

/* eslint-disable streamlit-custom/no-hardcoded-theme-values -- Uses glide-data-grid CSS variables */
const StyledTextareaWrapper = styled.div({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  flex: 1,
  backgroundColor: "var(--gdg-bg-cell)",
})
/* eslint-enable streamlit-custom/no-hardcoded-theme-values */

const StyledCellToolbar = styled(StyledToolbar)({
  pointerEvents: "auto",
})

/* eslint-disable streamlit-custom/no-hardcoded-theme-values -- Uses glide-data-grid CSS variables */
const StyledMarkdownViewer = styled.div(({ theme }) => ({
  position: "relative",
  flex: 1,
  overflowY: "auto",
  padding: theme.spacing.lg,
  paddingBottom: theme.spacing.twoXL,
  backgroundColor: "var(--gdg-bg-cell)",
  color: "var(--gdg-text-dark)",

  // Show toolbar on hover/focus
  "&:hover, &:focus-visible, &:focus-within:has(:focus-visible)": {
    [`.stMarkdownCellToolbar`]: {
      opacity: 1,
      visibility: "visible",
      pointerEvents: "auto",
      transition: TOOLBAR_SHOW_TRANSITION,
    },
  },
}))
/* eslint-enable streamlit-custom/no-hardcoded-theme-values */

/* eslint-disable streamlit-custom/no-hardcoded-theme-values -- Uses glide-data-grid CSS variables */
const StyledTextarea = styled.textarea(({ theme }) => ({
  flex: 1,
  padding: theme.spacing.lg,
  paddingBottom: theme.spacing.twoXL,
  border: "none",
  resize: "none",
  backgroundColor: "var(--gdg-bg-cell)",
  color: "var(--gdg-text-dark)",
  fontFamily:
    '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
  fontSize: "var(--gdg-editor-font-size)",
  lineHeight: 1.5,

  "&:focus": {
    outline: "none",
  },

  "&:focus-visible": {
    outline: "2px solid var(--gdg-accent-color)",
    outlineOffset: "-2px",
  },
}))
/* eslint-enable streamlit-custom/no-hardcoded-theme-values */

// eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values -- Uses glide-data-grid CSS variables
const StyledEmptyMessage = styled.div`
  color: var(--gdg-text-light);
  font-style: italic;
`

/**
 * Cell overlay editor for markdown cells. Shows rendered markdown by default
 * with edit button. When editing, shows a textarea with save/cancel buttons.
 */
const MarkdownCellEditor: ReturnType<ProvideEditorCallback<MarkdownCell>> = ({
  value: cell,
  initialValue,
  onChange,
  // Note: onFinishedEditing is provided by glide-data-grid but not used here.
  // The markdown cell has internal view/edit modes, and glide handles overlay
  // closure on outside clicks. We don't need to signal finish for internal toggles.
}) => {
  const [isEditing, setIsEditing] = useState(() => {
    // If initialValue is provided (keyboard-started edit), start in edit mode
    return initialValue !== undefined && initialValue !== ""
  })
  const [editValue, setEditValue] = useState(() => {
    // If initialValue is provided (keyboard-started edit), use it as the starting value
    // following glide-data-grid's convention: typed character replaces the cell value
    if (initialValue !== undefined && initialValue !== "") {
      return initialValue
    }
    return cell.data.value ?? ""
  })

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
    // Return to viewer mode (don't call onFinishedEditing - that closes the overlay)
    setIsEditing(false)
  }, [cell, editValue, onChange])

  const handleCancel = useCallback(() => {
    setEditValue(cell.data.value ?? "")
    // Return to viewer mode (don't call onFinishedEditing - that closes the overlay)
    setIsEditing(false)
  }, [cell.data.value])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Prevent glide-data-grid from handling these keys
      e.stopPropagation()

      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        handleSave()
      } else if (e.key === "Escape") {
        handleCancel()
      }
    },
    [handleSave, handleCancel]
  )

  if (isEditing) {
    return (
      <StyledContainer data-testid="stMarkdownColumnEditor" isEditing>
        <StyledTextareaWrapper>
          <StyledToolbarWrapper locked>
            <StyledCellToolbar>
              <ToolbarAction
                label="Save (Ctrl+Enter)"
                icon={Check}
                onClick={handleSave}
              />
              <ToolbarAction
                label="Cancel (Escape)"
                icon={Close}
                onClick={handleCancel}
              />
            </StyledCellToolbar>
          </StyledToolbarWrapper>
          <StyledTextarea
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            placeholder="Enter markdown text..."
            aria-label="Edit markdown content"
          />
        </StyledTextareaWrapper>
      </StyledContainer>
    )
  }

  const hasContent = (cell.data.value?.length ?? 0) > 0

  return (
    <StyledContainer data-testid="stMarkdownColumnViewer">
      <StyledMarkdownViewer tabIndex={cell.readonly ? undefined : 0}>
        {!cell.readonly && (
          <StyledToolbarWrapper className="stMarkdownCellToolbar">
            <StyledCellToolbar>
              <ToolbarAction
                label="Edit"
                icon={Edit}
                onClick={() => setIsEditing(true)}
              />
            </StyledCellToolbar>
          </StyledToolbarWrapper>
        )}
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

/** Custom renderer for markdown cells. */
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
    styleOverride: {
      minWidth: "min(37.5rem, 90vw)",
    },
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
