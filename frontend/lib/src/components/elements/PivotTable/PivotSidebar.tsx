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

import { Quiver } from "~lib/dataframes/Quiver"

import DropZone from "./DropZone"
import FieldList from "./FieldList"
import { PivotConfig } from "./pivotTransform"
import {
  StyledAvailableFields,
  StyledFieldsHeader,
  StyledPivotAreas,
  StyledSidebar,
  StyledSidebarContent,
} from "./styled-components"

export interface PivotSidebarProps {
  data: Quiver
  config: PivotConfig
  onConfigChange: (config: PivotConfig) => void
}

function PivotSidebar({
  data,
  config,
  onConfigChange,
}: PivotSidebarProps): ReactElement {
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

  const handleAddToRows = (fieldName: string): void => {
    if (!config.rows.includes(fieldName)) {
      onConfigChange({
        ...config,
        rows: [...config.rows, fieldName],
      })
    }
  }

  const handleAddToColumns = (fieldName: string): void => {
    if (!config.columns.includes(fieldName)) {
      onConfigChange({
        ...config,
        columns: [...config.columns, fieldName],
      })
    }
  }

  const handleAddToValues = (fieldName: string): void => {
    if (!config.values.find(v => v.field === fieldName)) {
      onConfigChange({
        ...config,
        values: [...config.values, { field: fieldName, aggregation: "sum" }],
      })
    }
  }

  const handleRemoveFromRows = (fieldName: string): void => {
    onConfigChange({
      ...config,
      rows: config.rows.filter(f => f !== fieldName),
    })
  }

  const handleRemoveFromColumns = (fieldName: string): void => {
    onConfigChange({
      ...config,
      columns: config.columns.filter(f => f !== fieldName),
    })
  }

  const handleRemoveFromValues = (fieldName: string): void => {
    onConfigChange({
      ...config,
      values: config.values.filter(v => v.field !== fieldName),
    })
  }

  const handleUpdateValueAggregation = (
    fieldName: string,
    aggregation: "sum" | "mean" | "count" | "min" | "max"
  ): void => {
    onConfigChange({
      ...config,
      values: config.values.map(v =>
        v.field === fieldName ? { ...v, aggregation } : v
      ),
    })
  }

  const handleReorderRows = (fromIndex: number, toIndex: number): void => {
    const newRows = [...config.rows]
    const [movedField] = newRows.splice(fromIndex, 1)
    newRows.splice(toIndex, 0, movedField)
    onConfigChange({
      ...config,
      rows: newRows,
    })
  }

  const handleReorderColumns = (fromIndex: number, toIndex: number): void => {
    const newColumns = [...config.columns]
    const [movedField] = newColumns.splice(fromIndex, 1)
    newColumns.splice(toIndex, 0, movedField)
    onConfigChange({
      ...config,
      columns: newColumns,
    })
  }

  const handleReorderValues = (fromIndex: number, toIndex: number): void => {
    const newValues = [...config.values]
    const [movedField] = newValues.splice(fromIndex, 1)
    newValues.splice(toIndex, 0, movedField)
    onConfigChange({
      ...config,
      values: newValues,
    })
  }

  return (
    <StyledSidebar data-testid="stPivotTableSidebar">
      <StyledSidebarContent>
        <StyledFieldsHeader>FIELDS</StyledFieldsHeader>

        <StyledPivotAreas>
          <DropZone
            label="Rows"
            fields={config.rows}
            onRemove={handleRemoveFromRows}
            onReorder={handleReorderRows}
          />
          <DropZone
            label="Columns"
            fields={config.columns}
            onRemove={handleRemoveFromColumns}
            onReorder={handleReorderColumns}
          />
          <DropZone
            label="Values"
            valueFields={config.values}
            onRemove={handleRemoveFromValues}
            onUpdateAggregation={handleUpdateValueAggregation}
            onReorder={handleReorderValues}
            showAggregation
          />
        </StyledPivotAreas>

        <StyledAvailableFields>
          <StyledFieldsHeader>AVAILABLE FIELDS</StyledFieldsHeader>
          <FieldList
            fields={availableFields}
            onAddToRows={handleAddToRows}
            onAddToColumns={handleAddToColumns}
            onAddToValues={handleAddToValues}
          />
        </StyledAvailableFields>
      </StyledSidebarContent>
    </StyledSidebar>
  )
}

export default memo(PivotSidebar)
