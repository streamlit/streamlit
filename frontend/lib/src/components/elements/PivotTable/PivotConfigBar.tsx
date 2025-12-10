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

import React, { memo, ReactElement, useRef, useState } from "react"

import {
  ArrowDownward,
  ArrowForward,
  Close,
  Functions,
  KeyboardArrowDown,
  Tag,
  TrendingDown,
  TrendingUp,
} from "@emotion-icons/material-outlined"

import Icon from "~lib/components/shared/Icon"

import { AggregationType, PivotConfig, ValueField } from "./pivotTransform"
import {
  StyledAggregationChip,
  StyledAggregationMenu,
  StyledChipRemoveButton,
  StyledConfigBar,
  StyledConfigChip,
  StyledConfigFields,
  StyledConfigLabel,
  StyledConfigPlaceholder,
  StyledConfigRow,
} from "./styled-components"

export interface PivotConfigBarProps {
  config: PivotConfig
  onAddToRows: (fieldName: string) => void
  onAddToColumns: (fieldName: string) => void
  onAddToValues: (fieldName: string) => void
  onRemoveRow: (fieldName: string) => void
  onRemoveColumn: (fieldName: string) => void
  onRemoveValue: (fieldName: string) => void
  onUpdateAggregation: (
    fieldName: string,
    aggregation: AggregationType
  ) => void
  onReorderRows: (fromIndex: number, toIndex: number) => void
  onReorderColumns: (fromIndex: number, toIndex: number) => void
  onReorderValues: (fromIndex: number, toIndex: number) => void
}

const AGGREGATION_OPTIONS: Array<{
  label: string
  value: AggregationType
}> = [
  { label: "Sum", value: "sum" },
  { label: "Avg", value: "mean" },
  { label: "Count", value: "count" },
  { label: "Min", value: "min" },
  { label: "Max", value: "max" },
]

function getAggregationIcon(aggregation: AggregationType): typeof Functions {
  switch (aggregation) {
    case "sum":
      return Functions // Σ
    case "count":
      return Tag // # (using Tag as close to # symbol)
    case "mean":
      return Functions // x̄ (we'll use Functions as fallback)
    case "min":
      return TrendingDown // ↓
    case "max":
      return TrendingUp // ↑
    default:
      return Functions
  }
}

const ZONE_COLORS = {
  rows: "#7c4dff", // Purple
  columns: "#2196f3", // Blue
  values: "#4caf50", // Green
}

function PivotConfigBar({
  config,
  onAddToRows,
  onAddToColumns,
  onAddToValues,
  onRemoveRow,
  onRemoveColumn,
  onRemoveValue,
  onUpdateAggregation,
  onReorderRows,
  onReorderColumns,
  onReorderValues,
}: PivotConfigBarProps): ReactElement {
  const [activeAggregation, setActiveAggregation] = useState<string | null>(
    null
  )
  const [draggedItem, setDraggedItem] = useState<{
    type: "row" | "column" | "value" | "external"
    index?: number
    fieldName?: string
  } | null>(null)
  const [dragOverZone, setDragOverZone] = useState<
    "rows" | "columns" | "values" | null
  >(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleDragStart = (
    type: "row" | "column" | "value",
    index: number
  ): void => {
    setDraggedItem({ type, index })
  }

  const handleZoneDragOver = (
    event: React.DragEvent,
    zone: "rows" | "columns" | "values"
  ): void => {
    event.preventDefault()
    setDragOverZone(zone)
  }

  const handleZoneDragLeave = (): void => {
    setDragOverZone(null)
  }

  const handleZoneDrop = (
    event: React.DragEvent,
    zone: "rows" | "columns" | "values"
  ): void => {
    event.preventDefault()
    const fieldName = event.dataTransfer.getData("text/plain")

    if (fieldName) {
      // External field being dropped
      switch (zone) {
        case "rows":
          onAddToRows(fieldName)
          break
        case "columns":
          onAddToColumns(fieldName)
          break
        case "values":
          onAddToValues(fieldName)
          break
      }
    }

    setDragOverZone(null)
    setDraggedItem(null)
  }

  const handleChipDragOver = (
    event: React.DragEvent,
    type: "row" | "column" | "value",
    index: number
  ): void => {
    event.preventDefault()
    event.stopPropagation()
    // Only allow reordering within same zone
    if (draggedItem?.type === type) {
      // Reordering within zone
    }
  }

  const handleChipDrop = (
    type: "row" | "column" | "value",
    index: number
  ): void => {
    if (
      draggedItem?.type === type &&
      draggedItem.index !== undefined &&
      draggedItem.index !== index
    ) {
      switch (type) {
        case "row":
          onReorderRows(draggedItem.index, index)
          break
        case "column":
          onReorderColumns(draggedItem.index, index)
          break
        case "value":
          onReorderValues(draggedItem.index, index)
          break
      }
    }
    setDraggedItem(null)
  }

  const handleDragEnd = (): void => {
    setDraggedItem(null)
    setDragOverZone(null)
  }

  return (
    <StyledConfigBar>
      {/* Rows */}
      <StyledConfigRow
        onDragOver={e => handleZoneDragOver(e, "rows")}
        onDragLeave={handleZoneDragLeave}
        onDrop={e => handleZoneDrop(e, "rows")}
        $isOver={dragOverZone === "rows"}
      >
        <StyledConfigLabel>
          <Icon content={ArrowDownward} size="sm" />
          ROWS
        </StyledConfigLabel>
        <StyledConfigFields>
          {config.rows.length === 0 ? (
            <StyledConfigPlaceholder>Drop fields here</StyledConfigPlaceholder>
          ) : (
            config.rows.map((field, index) => (
              <StyledConfigChip
                key={field}
                draggable
                onDragStart={() => handleDragStart("row", index)}
                onDragOver={e => handleChipDragOver(e, "row", index)}
                onDrop={() => handleChipDrop("row", index)}
                onDragEnd={handleDragEnd}
                $zoneColor={ZONE_COLORS.rows}
                style={{
                  opacity:
                    draggedItem?.type === "row" && draggedItem.index === index
                      ? 0.5
                      : 1,
                }}
              >
                {field}
                <StyledChipRemoveButton
                  onClick={() => onRemoveRow(field)}
                  title={`Remove ${field}`}
                >
                  <Icon content={Close} size="sm" />
                </StyledChipRemoveButton>
              </StyledConfigChip>
            ))
          )}
        </StyledConfigFields>
      </StyledConfigRow>

      {/* Columns */}
      <StyledConfigRow
        onDragOver={e => handleZoneDragOver(e, "columns")}
        onDragLeave={handleZoneDragLeave}
        onDrop={e => handleZoneDrop(e, "columns")}
        $isOver={dragOverZone === "columns"}
      >
        <StyledConfigLabel>
          <Icon content={ArrowForward} size="sm" />
          COLUMNS
        </StyledConfigLabel>
        <StyledConfigFields>
          {config.columns.length === 0 ? (
            <StyledConfigPlaceholder>Drop fields here</StyledConfigPlaceholder>
          ) : (
            config.columns.map((field, index) => (
              <StyledConfigChip
                key={field}
                draggable
                onDragStart={() => handleDragStart("column", index)}
                onDragOver={e => handleChipDragOver(e, "column", index)}
                onDrop={() => handleChipDrop("column", index)}
                onDragEnd={handleDragEnd}
                $zoneColor={ZONE_COLORS.columns}
                style={{
                  opacity:
                    draggedItem?.type === "column" &&
                    draggedItem.index === index
                      ? 0.5
                      : 1,
                }}
              >
                {field}
                <StyledChipRemoveButton
                  onClick={() => onRemoveColumn(field)}
                  title={`Remove ${field}`}
                >
                  <Icon content={Close} size="sm" />
                </StyledChipRemoveButton>
              </StyledConfigChip>
            ))
          )}
        </StyledConfigFields>
      </StyledConfigRow>

      {/* Values */}
      <StyledConfigRow
        onDragOver={e => handleZoneDragOver(e, "values")}
        onDragLeave={handleZoneDragLeave}
        onDrop={e => handleZoneDrop(e, "values")}
        $isOver={dragOverZone === "values"}
      >
        <StyledConfigLabel>
          <Icon content={Functions} size="sm" />
          VALUES
        </StyledConfigLabel>
        <StyledConfigFields>
          {config.values.length === 0 ? (
            <StyledConfigPlaceholder>Drop fields here</StyledConfigPlaceholder>
          ) : (
            config.values.map((valueField, index) => (
              <StyledConfigChip
                key={valueField.field}
                draggable
                onDragStart={() => handleDragStart("value", index)}
                onDragOver={e => handleChipDragOver(e, "value", index)}
                onDrop={() => handleChipDrop("value", index)}
                onDragEnd={handleDragEnd}
                $zoneColor={ZONE_COLORS.values}
                style={{
                  opacity:
                    draggedItem?.type === "value" &&
                    draggedItem.index === index
                      ? 0.5
                      : 1,
                }}
              >
                <Icon
                  content={getAggregationIcon(valueField.aggregation)}
                  size="sm"
                />
                {valueField.field}
                <StyledChipRemoveButton
                  onClick={() => onRemoveValue(valueField.field)}
                  title={`Remove ${valueField.field}`}
                >
                  <Icon content={Close} size="sm" />
                </StyledChipRemoveButton>
              </StyledConfigChip>
            ))
          )}
        </StyledConfigFields>
      </StyledConfigRow>
    </StyledConfigBar>
  )
}

export default memo(PivotConfigBar)
