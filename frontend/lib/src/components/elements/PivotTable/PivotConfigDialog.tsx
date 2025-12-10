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

import React, { memo, ReactElement, useState } from "react"

import { BaseButtonKind } from "~lib/components/shared/BaseButton"
import Modal, {
  ModalBody,
  ModalButton,
  ModalHeader,
} from "~lib/components/shared/Modal"
import { Quiver } from "~lib/dataframes/Quiver"

import DropZone from "./DropZone"
import FieldList from "./FieldList"
import { PivotConfig, ValueField } from "./pivotTransform"
import {
  StyledDialogActions,
  StyledDialogContent,
  StyledLeftPanel,
  StyledPivotAreas,
  StyledRightPanel,
} from "./styled-components"

interface PivotConfigDialogProps {
  data: Quiver
  config: PivotConfig
  onApply: (config: PivotConfig) => void
  onCancel: () => void
}

function PivotConfigDialog({
  data,
  config,
  onApply,
  onCancel,
}: PivotConfigDialogProps): ReactElement {
  const [localConfig, setLocalConfig] = useState<PivotConfig>(config)

  // Get all available field names from the data (filter out empty strings)
  const allFields = (data.columnNames?.[0] || []).filter(
    field => field && field.trim() !== ""
  )

  const handleFieldClick = (fieldName: string) => {
    // Add field to Values by default when clicked
    if (!localConfig.values.find(v => v.field === fieldName)) {
      setLocalConfig({
        ...localConfig,
        values: [
          ...localConfig.values,
          { field: fieldName, aggregation: "sum" },
        ],
      })
    }
  }

  const handleAddToRows = (fieldName: string) => {
    if (!localConfig.rows.includes(fieldName)) {
      setLocalConfig({
        ...localConfig,
        rows: [...localConfig.rows, fieldName],
      })
    }
  }

  const handleAddToColumns = (fieldName: string) => {
    if (!localConfig.columns.includes(fieldName)) {
      setLocalConfig({
        ...localConfig,
        columns: [...localConfig.columns, fieldName],
      })
    }
  }

  const handleRemoveFromRows = (fieldName: string) => {
    setLocalConfig({
      ...localConfig,
      rows: localConfig.rows.filter(f => f !== fieldName),
    })
  }

  const handleRemoveFromColumns = (fieldName: string) => {
    setLocalConfig({
      ...localConfig,
      columns: localConfig.columns.filter(f => f !== fieldName),
    })
  }

  const handleRemoveFromValues = (fieldName: string) => {
    setLocalConfig({
      ...localConfig,
      values: localConfig.values.filter(v => v.field !== fieldName),
    })
  }

  const handleUpdateValueAggregation = (
    fieldName: string,
    aggregation: ValueField["aggregation"]
  ): void => {
    setLocalConfig({
      ...localConfig,
      values: localConfig.values.map(v =>
        v.field === fieldName ? { ...v, aggregation } : v
      ),
    })
  }

  const handleApply = (): void => {
    onApply(localConfig)
  }

  return (
    <Modal isOpen onClose={onCancel} size="large">
      <ModalHeader>Configure Pivot Table</ModalHeader>
      <ModalBody>
        <StyledDialogContent>
          <StyledLeftPanel>
            <h3>All Fields</h3>
            <FieldList
              fields={allFields}
              onAddToRows={handleAddToRows}
              onAddToColumns={handleAddToColumns}
              onAddToValues={handleFieldClick}
            />
          </StyledLeftPanel>

          <StyledRightPanel>
            <StyledPivotAreas>
              <DropZone
                label="Rows"
                fields={localConfig.rows}
                onRemove={handleRemoveFromRows}
              />
              <DropZone
                label="Columns"
                fields={localConfig.columns}
                onRemove={handleRemoveFromColumns}
              />
            </StyledPivotAreas>

            <DropZone
              label="Values"
              valueFields={localConfig.values}
              onRemove={handleRemoveFromValues}
              onUpdateAggregation={handleUpdateValueAggregation}
              showAggregation
            />
          </StyledRightPanel>
        </StyledDialogContent>

        <StyledDialogActions>
          <ModalButton kind={BaseButtonKind.SECONDARY} onClick={onCancel}>
            Cancel
          </ModalButton>
          <ModalButton kind={BaseButtonKind.PRIMARY} onClick={handleApply}>
            Apply
          </ModalButton>
        </StyledDialogActions>
      </ModalBody>
    </Modal>
  )
}

export default memo(PivotConfigDialog)
