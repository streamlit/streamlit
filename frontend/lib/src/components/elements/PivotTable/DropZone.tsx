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

import React, { memo, ReactElement, useEffect, useRef, useState } from "react"

import {
  Add,
  Close,
  Functions,
  KeyboardArrowDown,
  Tag,
  TrendingDown,
  TrendingUp,
} from "@emotion-icons/material-outlined"

import { useEmotionTheme } from "@streamlit/lib"

import Icon from "~lib/components/shared/Icon"

import { AggregationType, ValueField } from "./pivotTransform"
import {
  StyledAggregationButton,
  StyledAggregationMenu,
  StyledDroppedField,
  StyledDropZone,
  StyledDropZoneContent,
  StyledDropZoneLabel,
  StyledFieldName,
  StyledRemoveButton,
} from "./styled-components"

interface DropZoneProps {
  label: string
  fields?: string[]
  valueFields?: ValueField[]
  onRemove: (fieldName: string) => void
  onUpdateAggregation?: (
    fieldName: string,
    aggregation: AggregationType
  ) => void
  onReorder?: (fromIndex: number, toIndex: number) => void
  showAggregation?: boolean
}

const AGGREGATION_OPTIONS: Array<{
  label: string
  value: AggregationType
}> = [
  { label: "Sum", value: "sum" },
  { label: "Average", value: "mean" },
  { label: "Count", value: "count" },
  { label: "Min", value: "min" },
  { label: "Max", value: "max" },
]

function getAggregationIcon(aggregation: AggregationType): typeof Functions {
  switch (aggregation) {
    case "sum":
      return Add
    case "mean":
      return Functions
    case "count":
      return Tag
    case "min":
      return TrendingDown
    case "max":
      return TrendingUp
    default:
      return Functions
  }
}

function DropZone({
  label,
  fields = [],
  valueFields = [],
  onRemove,
  onUpdateAggregation,
  onReorder,
  showAggregation = false,
}: DropZoneProps): ReactElement {
  const theme = useEmotionTheme()
  const [activeAggregation, setActiveAggregation] = useState<string | null>(
    null
  )
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
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
    return undefined
  }, [activeAggregation])

  const displayFields = showAggregation
    ? valueFields
    : fields.map(f => ({ field: f }))

  const handleAggregationClick = (fieldName: string): void => {
    setActiveAggregation(activeAggregation === fieldName ? null : fieldName)
  }

  const handleAggregationChange = (
    fieldName: string,
    aggregation: AggregationType
  ): void => {
    if (onUpdateAggregation) {
      onUpdateAggregation(fieldName, aggregation)
    }
    setActiveAggregation(null)
  }

  // Drag and drop handlers
  const handleDragStart = (index: number): void => {
    setDraggedIndex(index)
  }

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    index: number
  ): void => {
    event.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragLeave = (): void => {
    setDragOverIndex(null)
  }

  const handleDrop = (index: number): void => {
    if (draggedIndex !== null && draggedIndex !== index && onReorder) {
      onReorder(draggedIndex, index)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = (): void => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <StyledDropZone>
      <StyledDropZoneLabel>{label}</StyledDropZoneLabel>
      <StyledDropZoneContent>
        {displayFields.length === 0 ? (
          <div style={{ color: "#888", fontSize: "0.875rem" }}>
            Select fields from the left panel
          </div>
        ) : (
          displayFields.map((item, index) => {
            const fieldName = "field" in item ? item.field : item
            const currentAggregation =
              showAggregation && "aggregation" in item
                ? item.aggregation
                : "sum"

            return (
              <StyledDroppedField
                key={index}
                draggable={!!onReorder}
                onDragStart={() => handleDragStart(index)}
                onDragOver={event => handleDragOver(event, index)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                style={{
                  opacity: draggedIndex === index ? 0.5 : 1,
                  borderColor:
                    dragOverIndex === index
                      ? "var(--primary-color)"
                      : undefined,
                  cursor: onReorder ? "move" : "default",
                }}
              >
                <StyledFieldName>{fieldName}</StyledFieldName>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginLeft: "auto",
                  }}
                >
                  {showAggregation && (
                    <div
                      style={{ position: "relative" }}
                      ref={activeAggregation === fieldName ? menuRef : null}
                    >
                      <StyledAggregationButton
                        onClick={() => handleAggregationClick(fieldName)}
                        title="Change aggregation"
                      >
                        {AGGREGATION_OPTIONS.find(
                          opt => opt.value === currentAggregation
                        )?.label || "Sum"}
                        <Icon content={KeyboardArrowDown} size="sm" />
                      </StyledAggregationButton>
                      {activeAggregation === fieldName && (
                        <StyledAggregationMenu>
                          {AGGREGATION_OPTIONS.map(option => (
                            <button
                              key={option.value}
                              onClick={() =>
                                handleAggregationChange(
                                  fieldName,
                                  option.value
                                )
                              }
                              className={
                                option.value === currentAggregation
                                  ? "selected"
                                  : ""
                              }
                            >
                              <Icon
                                content={getAggregationIcon(option.value)}
                                size="sm"
                              />
                              {option.label}
                            </button>
                          ))}
                        </StyledAggregationMenu>
                      )}
                    </div>
                  )}
                  <StyledRemoveButton
                    onClick={() => onRemove(fieldName)}
                    title={`Remove ${fieldName}`}
                  >
                    <Icon content={Close} size="sm" />
                  </StyledRemoveButton>
                </div>
              </StyledDroppedField>
            )
          })
        )}
      </StyledDropZoneContent>
    </StyledDropZone>
  )
}

export default memo(DropZone)
