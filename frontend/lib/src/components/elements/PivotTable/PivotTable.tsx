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

import React, {
  memo,
  ReactElement,
  useCallback,
  useMemo,
  useState,
} from "react"

import { Settings } from "@emotion-icons/material-outlined"

import {
  Arrow as ArrowProto,
  PivotTable as PivotTableProto,
} from "@streamlit/protobuf"

import { ArrowTable } from "~lib/components/elements/ArrowTable/ArrowTable"
import Icon from "~lib/components/shared/Icon"
import { Quiver } from "~lib/dataframes/Quiver"

import FieldsList from "./FieldsList"
import PivotConfigBar from "./PivotConfigBar"
import {
  AggregationType,
  PivotConfig,
  transformToPivotQuiver,
} from "./pivotTransform"
import {
  StyledPivotContent,
  StyledPivotTableContainer,
  StyledTableArea,
  StyledToggleStrip,
  StyledToggleStripButton,
} from "./styled-components"

export interface PivotTableProps {
  element: PivotTableProto
  data: Quiver
  width?: number
  height?: number
}

export function PivotTable(props: PivotTableProps): ReactElement {
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [showRowTotals, setShowRowTotals] = useState(false)
  const [showColumnTotals, setShowColumnTotals] = useState(false)
  const [pivotConfig, setPivotConfig] = useState<PivotConfig>({
    rows: [],
    columns: [],
    values: [],
    filters: {},
  })

  // Transform data based on pivot configuration (live updates)
  const transformedData = useMemo(
    () =>
      transformToPivotQuiver(
        props.data,
        pivotConfig,
        showRowTotals,
        showColumnTotals
      ),
    [props.data, pivotConfig, showRowTotals, showColumnTotals]
  )

  // Create an ArrowProto element for the transformed data
  // Use editingMode to apply DataFrame-like styling
  const arrowElement = useMemo(() => {
    return ArrowProto.create({
      data: new Uint8Array(), // ArrowTable uses the Quiver data directly
      useContainerWidth: false,
      width: 0,
      borderMode: props.element.borderMode as ArrowProto.BorderMode,
      editingMode: ArrowProto.EditingMode.READ_ONLY, // Triggers DataFrame-like styling
    })
  }, [props.element.borderMode])

  const handleToggleSidebar = useCallback(() => {
    setSidebarVisible(prev => !prev)
  }, [])

  // Handler functions for field management
  const handleAddToRows = useCallback((fieldName: string) => {
    setPivotConfig(prev => ({
      ...prev,
      rows: [...prev.rows, fieldName],
    }))
  }, [])

  const handleAddToColumns = useCallback((fieldName: string) => {
    setPivotConfig(prev => ({
      ...prev,
      columns: [...prev.columns, fieldName],
    }))
  }, [])

  const handleAddToValues = useCallback((fieldName: string) => {
    setPivotConfig(prev => ({
      ...prev,
      values: [...prev.values, { field: fieldName, aggregation: "sum" }],
    }))
  }, [])

  const handleRemoveRow = useCallback((fieldName: string) => {
    setPivotConfig(prev => ({
      ...prev,
      rows: prev.rows.filter(f => f !== fieldName),
    }))
  }, [])

  const handleRemoveColumn = useCallback((fieldName: string) => {
    setPivotConfig(prev => ({
      ...prev,
      columns: prev.columns.filter(f => f !== fieldName),
    }))
  }, [])

  const handleRemoveValue = useCallback((fieldName: string) => {
    setPivotConfig(prev => ({
      ...prev,
      values: prev.values.filter(v => v.field !== fieldName),
    }))
  }, [])

  const handleUpdateAggregation = useCallback(
    (fieldName: string, aggregation: AggregationType) => {
      setPivotConfig(prev => ({
        ...prev,
        values: prev.values.map(v =>
          v.field === fieldName ? { ...v, aggregation } : v
        ),
      }))
    },
    []
  )

  const handleReorderRows = useCallback(
    (fromIndex: number, toIndex: number) => {
      setPivotConfig(prev => {
        const newRows = [...prev.rows]
        const [movedField] = newRows.splice(fromIndex, 1)
        newRows.splice(toIndex, 0, movedField)
        return { ...prev, rows: newRows }
      })
    },
    []
  )

  const handleReorderColumns = useCallback(
    (fromIndex: number, toIndex: number) => {
      setPivotConfig(prev => {
        const newColumns = [...prev.columns]
        const [movedField] = newColumns.splice(fromIndex, 1)
        newColumns.splice(toIndex, 0, movedField)
        return { ...prev, columns: newColumns }
      })
    },
    []
  )

  const handleReorderValues = useCallback(
    (fromIndex: number, toIndex: number) => {
      setPivotConfig(prev => {
        const newValues = [...prev.values]
        const [movedField] = newValues.splice(fromIndex, 1)
        newValues.splice(toIndex, 0, movedField)
        return { ...prev, values: newValues }
      })
    },
    []
  )

  return (
    <StyledPivotTableContainer
      className="stPivotTable"
      data-testid="stPivotTable"
    >
      {/* Config Bar at top */}
      <PivotConfigBar
        config={pivotConfig}
        onAddToRows={handleAddToRows}
        onAddToColumns={handleAddToColumns}
        onAddToValues={handleAddToValues}
        onRemoveRow={handleRemoveRow}
        onRemoveColumn={handleRemoveColumn}
        onRemoveValue={handleRemoveValue}
        onUpdateAggregation={handleUpdateAggregation}
        onReorderRows={handleReorderRows}
        onReorderColumns={handleReorderColumns}
        onReorderValues={handleReorderValues}
      />

      {/* Main content: Left Sidebar + Table with Toggle */}
      <StyledPivotContent $sidebarVisible={sidebarVisible}>
        <FieldsList
          data={props.data}
          config={pivotConfig}
          isVisible={sidebarVisible}
          onToggleSidebar={handleToggleSidebar}
          showRowTotals={showRowTotals}
          showColumnTotals={showColumnTotals}
          onToggleRowTotals={() => setShowRowTotals(prev => !prev)}
          onToggleColumnTotals={() => setShowColumnTotals(prev => !prev)}
          onAddToRows={handleAddToRows}
          onAddToColumns={handleAddToColumns}
          onAddToValues={handleAddToValues}
          onUpdateAggregation={handleUpdateAggregation}
        />

        <StyledTableArea>
          <ArrowTable element={arrowElement} data={transformedData} />
        </StyledTableArea>

        {!sidebarVisible && (
          <StyledToggleStrip>
            <StyledToggleStripButton
              onClick={handleToggleSidebar}
              title="Show Config"
            >
              <Icon content={Settings} size="md" />
            </StyledToggleStripButton>
          </StyledToggleStrip>
        )}
      </StyledPivotContent>
    </StyledPivotTableContainer>
  )
}

export default memo(PivotTable)
