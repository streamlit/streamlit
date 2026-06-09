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

import { useCallback, useEffect, useState } from "react"

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
import { isFromMac } from "~lib/util/utils"

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

const StyledContainer = styled.div<StyledContainerProps>(
  ({ theme, isEditing }) => ({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    minHeight: isEditing ? "18.75rem" : "12.5rem",
    maxHeight: isEditing ? "min(31.25rem, 70vh)" : "25rem",
    fontFamily: theme.genericFonts.bodyFont,
    fontSize: theme.fontSizes.sm,
  })
)

const TOOLBAR_OPACITY_TRANSITION = "opacity 300ms 150ms"
const TOOLBAR_HIDE_TRANSITION = `${TOOLBAR_OPACITY_TRANSITION}, visibility 0ms linear 450ms`
const TOOLBAR_SHOW_TRANSITION = `${TOOLBAR_OPACITY_TRANSITION}, visibility 0ms linear 150ms`

interface StyledToolbarWrapperProps {
  locked?: boolean
}

const StyledToolbarWrapper = styled.div<StyledToolbarWrapperProps>(
  ({ theme, locked }) => ({
    // Hide visually via opacity (not `visibility`/`display`) so the button
    // stays in the tab order and remains reachable via keyboard.
    opacity: locked ? 1 : 0,
    padding: `${theme.spacing.sm} ${theme.spacing.sm} 0 0`,
    top: 0,
    right: 0,
    position: "absolute",
    zIndex: theme.zIndices.sidebar + 1,
    pointerEvents: "auto",
    transition: locked ? TOOLBAR_SHOW_TRANSITION : TOOLBAR_HIDE_TRANSITION,

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
  color: theme.colors.bodyText,

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
  color: theme.colors.bodyText,
  fontFamily: theme.genericFonts.codeFont,
  fontSize: theme.fontSizes.sm,
  lineHeight: 1.5,

  "&:focus": {
    outline: "none",
  },
}))
/* eslint-enable streamlit-custom/no-hardcoded-theme-values */

const StyledEmptyMessage = styled.div(({ theme }) => ({
  color: theme.colors.fadedText40,
  fontStyle: "italic",
}))

/**
 * Cell overlay editor for markdown cells. Shows rendered markdown by default
 * with edit button. When editing, shows a textarea with save/cancel buttons.
 */
const MarkdownCellEditor: ReturnType<ProvideEditorCallback<MarkdownCell>> = ({
  value: cell,
  initialValue,
  onChange,
  onFinishedEditing,
}) => {
  // A non-empty `initialValue` means the edit was started by typing a
  // character while the cell was selected, so we open directly in edit mode.
  // To avoid wiping out existing markdown with a single keystroke, we only
  // seed the editor with the typed character when the cell is currently
  // empty. For non-empty cells we keep the existing value so the user can
  // edit it (the triggering keystroke just transitions into edit mode).
  const existingValue = cell.data.value ?? ""
  const startedByTyping = initialValue !== undefined && initialValue !== ""
  const [isEditing, setIsEditing] = useState(startedByTyping)
  const [editValue, setEditValue] = useState(
    startedByTyping && existingValue === "" ? initialValue : existingValue
  )

  // When a keyboard edit is started on an empty cell we seed the editor with
  // the typed character (see `editValue` above). That character initially only
  // lives in local React state, so glide-data-grid is unaware of it. Propagate
  // it once on mount via `onChange` so that dismissing the overlay (e.g. by
  // clicking outside) commits the typed character instead of dropping it.
  useEffect(() => {
    if (startedByTyping && existingValue === "" && initialValue) {
      const seededValue = initialValue
      onChange({
        ...cell,
        copyData: seededValue,
        data: {
          ...cell.data,
          value: seededValue,
          displayValue: removeLineBreaks(seededValue),
        },
      })
    }
    // Only run on mount to sync the keyboard-seeded value to glide-data-grid;
    // re-running would clobber subsequent user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const modifierLabel = isFromMac() ? "⌘" : "Ctrl"

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      setEditValue(newValue)
      // Propagate the draft to glide-data-grid so that dismissing the overlay
      // by clicking outside commits the latest text.
      onChange({
        ...cell,
        copyData: newValue,
        data: {
          ...cell.data,
          value: newValue,
          displayValue: removeLineBreaks(newValue),
        },
      })
    },
    [cell, onChange]
  )

  const handleSave = useCallback(() => {
    // Commit the new value and signal glide-data-grid that editing finished,
    // which closes the overlay. Closing (rather than staying open) keeps
    // glide's selection state consistent so the cell can be re-opened later.
    onFinishedEditing(
      {
        ...cell,
        copyData: editValue,
        data: {
          ...cell.data,
          value: editValue,
          displayValue: removeLineBreaks(editValue),
        },
      },
      [0, 0]
    )
  }, [cell, editValue, onFinishedEditing])

  const handleCancel = useCallback(() => {
    // Close the overlay without committing changes.
    onFinishedEditing(undefined, [0, 0])
  }, [onFinishedEditing])

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

  const handleEnterEdit = useCallback(() => {
    // Re-seed the editor with the latest cell value so that, if the cell was
    // updated externally (e.g. via a rerun) while the viewer overlay stayed
    // open, the textarea starts from the current content rather than the
    // value captured when the overlay first mounted.
    setEditValue(cell.data.value ?? "")
    setIsEditing(true)
  }, [cell.data.value])

  if (isEditing) {
    return (
      <StyledContainer data-testid="stMarkdownColumnEditor" isEditing>
        <StyledTextareaWrapper>
          <StyledToolbarWrapper locked>
            <StyledCellToolbar>
              <ToolbarAction
                label={`Save (${modifierLabel}+Enter)`}
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
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            autoFocus
            placeholder="Enter markdown text..."
            aria-label="Edit markdown content"
          />
        </StyledTextareaWrapper>
      </StyledContainer>
    )
  }

  const hasContent = Boolean(cell.data.value)

  return (
    <StyledContainer data-testid="stMarkdownColumnViewer">
      <StyledMarkdownViewer tabIndex={0} aria-label="Markdown content">
        {!cell.readonly && (
          <StyledToolbarWrapper className="stMarkdownCellToolbar">
            <StyledCellToolbar>
              <ToolbarAction
                label="Edit"
                icon={Edit}
                onClick={handleEnterEdit}
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

  onPaste: (val: string, cell: MarkdownCellProps) => ({
    ...cell,
    value: val,
    displayValue: removeLineBreaks(val),
  }),
}

export default renderer
