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

import React, { memo, ReactElement } from "react"

import {
  ArrowDownward,
  ArrowForward,
  ChevronLeft,
  Functions,
  KeyboardArrowDown,
  Tag,
  TrendingDown,
  TrendingUp,
} from "@emotion-icons/material-outlined"

import Icon from "~lib/components/shared/Icon"
import { Quiver } from "~lib/dataframes/Quiver"

import { AggregationType, PivotConfig } from "./pivotTransform"
import {
  StyledActiveFields,
  StyledAvailableFields,
  StyledCheckboxLabel,
  StyledFieldItemWithIcon,
  StyledFieldsHeader,
  StyledSidebar,
  StyledSidebarContent,
  StyledSidebarHeader,
  StyledSidebarTitle,
  StyledToggleButton,
  StyledTotalsSection,
} from "./styled-components"

export interface FieldsListProps {
  data: Quiver
  config: PivotConfig
  isVisible: boolean
  onToggleSidebar: () => void
  showRowTotals: boolean
  showColumnTotals: boolean
  onToggleRowTotals: () => void
  onToggleColumnTotals: () => void
  onAddToRows: (fieldName: string) => void
  onAddToColumns: (fieldName: string) => void
  onAddToValues: (fieldName: string) => void
  onUpdateAggregation?: (
    fieldName: string,
    aggregation: AggregationType
  ) => void
}

function getAggregationIcon(aggregation: AggregationType): typeof Functions {
  switch (aggregation) {
    case "sum":
      return Functions // Σ
    case "count":
      return Tag // # (using Tag as close to # symbol)
    case "mean":
      return Functions // x̄ (use Functions as fallback)
    case "min":
      return TrendingDown // ↓
    case "max":
      return TrendingUp // ↑
    default:
      return Functions
  }
}

function FieldsList({
  data,
  config,
  isVisible,
  onToggleSidebar,
  showRowTotals,
  showColumnTotals,
  onToggleRowTotals,
  onToggleColumnTotals,
  onAddToRows: _onAddToRows,
  onAddToColumns: _onAddToColumns,
  onAddToValues: _onAddToValues,
  onUpdateAggregation,
}: FieldsListProps): ReactElement {
  const [draggedField, setDraggedField] = React.useState<string | null>(null)
  const [activeAggregation, setActiveAggregation] = React.useState<
    string | null
  >(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

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

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveAggregation(null)
      }
    }

    if (activeAggregation) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }
  }, [activeAggregation])

  // Get all available field names from the data, filtering out empty strings
  const allFields = (data.columnNames?.[0] || []).filter(
    field => field && field.trim() !== ""
  )

  // Get fields that are not currently used
  const availableFields = allFields.filter(
    field =>
      !config.rows.includes(field) &&
      !config.columns.includes(field) &&
      !config.values.find(v => v.field === field)
  )

  const handleDragStart = (
    event: React.DragEvent,
    fieldName: string
  ): void => {
    setDraggedField(fieldName)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", fieldName)
  }

  const handleDragEnd = (): void => {
    setDraggedField(null)
  }

  // Get active fields with their zone info
  const activeFields: Array<{
    name: string
    zone: "rows" | "columns" | "values"
    aggregation?: AggregationType
  }> = [
    ...config.rows.map(field => ({ name: field, zone: "rows" as const })),
    ...config.columns.map(field => ({
      name: field,
      zone: "columns" as const,
    })),
    ...config.values.map(v => ({
      name: v.field,
      zone: "values" as const,
      aggregation: v.aggregation,
    })),
  ]

  const getZoneIcon = (
    zone: "rows" | "columns" | "values",
    aggregation?: AggregationType
  ): typeof ArrowDownward => {
    if (zone === "rows") {
      return ArrowDownward
    }
    if (zone === "columns") {
      return ArrowForward
    }
    // Values - return aggregation icon
    return getAggregationIcon(aggregation || "sum")
  }

  return (
    <StyledSidebar $isVisible={isVisible} data-testid="stPivotTableFieldsList">
      <StyledSidebarHeader>
        <StyledSidebarTitle>Configuration</StyledSidebarTitle>
        <StyledToggleButton onClick={onToggleSidebar} title="Hide Config">
          <Icon content={ChevronLeft} size="md" />
        </StyledToggleButton>
      </StyledSidebarHeader>
      <StyledSidebarContent>
        {/* Active Fields */}
        {activeFields.length > 0 && (
          <>
            <StyledFieldsHeader>Active Fields</StyledFieldsHeader>
            <StyledActiveFields>
              {activeFields.map(field => (
                <div
                  key={field.name}
                  style={{ position: "relative" }}
                  ref={activeAggregation === field.name ? menuRef : null}
                >
                  <StyledFieldItemWithIcon>
                    <Icon
                      content={getZoneIcon(field.zone, field.aggregation)}
                      size="sm"
                    />
                    <span style={{ flex: 1 }}>{field.name}</span>
                    {field.zone === "values" && onUpdateAggregation && (
                      <>
                        <button
                          onClick={() =>
                            setActiveAggregation(
                              activeAggregation === field.name
                                ? null
                                : field.name
                            )
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "0 4px",
                            display: "flex",
                            alignItems: "center",
                            color: "inherit",
                          }}
                          title="Change aggregation"
                        >
                          <Icon content={KeyboardArrowDown} size="md" />
                        </button>
                        {activeAggregation === field.name && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              right: 0,
                              marginTop: "4px",
                              backgroundColor: "white",
                              border: "1px solid #ccc",
                              borderRadius: "4px",
                              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                              zIndex: 1000,
                              minWidth: "120px",
                            }}
                          >
                            {AGGREGATION_OPTIONS.map(option => (
                              <button
                                key={option.value}
                                onClick={() => {
                                  onUpdateAggregation(field.name, option.value)
                                  setActiveAggregation(null)
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  width: "100%",
                                  padding: "8px 12px",
                                  background: "none",
                                  border: "none",
                                  textAlign: "left",
                                  cursor: "pointer",
                                  fontSize: "14px",
                                  fontWeight:
                                    option.value === field.aggregation
                                      ? "bold"
                                      : "normal",
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.backgroundColor =
                                    "#f5f5f5"
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.backgroundColor =
                                    "transparent"
                                }}
                              >
                                <Icon
                                  content={getAggregationIcon(option.value)}
                                  size="xs"
                                />
                                {option.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </StyledFieldItemWithIcon>
                </div>
              ))}
            </StyledActiveFields>
          </>
        )}

        {/* Available Fields */}
        <StyledFieldsHeader>
          {activeFields.length > 0 ? "Available Fields" : "All Fields"}
        </StyledFieldsHeader>
        <StyledAvailableFields>
          {availableFields.length === 0 ? (
            <div
              style={{ fontSize: "0.875rem", color: "#888", padding: "8px" }}
            >
              All fields are in use
            </div>
          ) : (
            availableFields.map(field => (
              <StyledFieldItemWithIcon
                key={field}
                draggable
                onDragStart={e => handleDragStart(e, field)}
                onDragEnd={handleDragEnd}
                $isDragging={draggedField === field}
                title={`Drag ${field} to Rows, Columns, or Values`}
              >
                <span>{field}</span>
              </StyledFieldItemWithIcon>
            ))
          )}
        </StyledAvailableFields>

        {/* Totals Options */}
        <StyledTotalsSection>
          <StyledFieldsHeader>Options</StyledFieldsHeader>
          {config.rows.length > 0 ||
          config.columns.length > 0 ||
          config.values.length > 0 ? (
            <>
              <StyledCheckboxLabel>
                <input
                  type="checkbox"
                  checked={showRowTotals}
                  onChange={onToggleRowTotals}
                />
                Show Row Totals
              </StyledCheckboxLabel>
              <StyledCheckboxLabel>
                <input
                  type="checkbox"
                  checked={showColumnTotals}
                  onChange={onToggleColumnTotals}
                />
                Show Column Totals
              </StyledCheckboxLabel>
            </>
          ) : (
            <div
              style={{
                color: "#808495",
                fontSize: "0.875rem",
                padding: "8px 0",
              }}
            >
              Configure rows, columns, or values to enable totals
            </div>
          )}
        </StyledTotalsSection>
      </StyledSidebarContent>
    </StyledSidebar>
  )
}

export default memo(FieldsList)
