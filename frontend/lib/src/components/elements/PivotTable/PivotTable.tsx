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

import React, { memo, ReactElement, useMemo, useState } from "react"

import { Settings } from "@emotion-icons/material-outlined"

import {
  Arrow as ArrowProto,
  PivotTable as PivotTableProto,
} from "@streamlit/protobuf"

import { ArrowTable } from "~lib/components/elements/ArrowTable/ArrowTable"
import Toolbar, { ToolbarAction } from "~lib/components/shared/Toolbar"
import { Quiver } from "~lib/dataframes/Quiver"

import PivotConfigDialog from "./PivotConfigDialog"
import { PivotConfig, transformToPivotQuiver } from "./pivotTransform"
import { StyledPivotTableContainer } from "./styled-components"

export interface PivotTableProps {
  element: PivotTableProto
  data: Quiver
  width?: number
  height?: number
}

export function PivotTable(props: PivotTableProps): ReactElement {
  const [showDialog, setShowDialog] = useState(false)
  const [pivotConfig, setPivotConfig] = useState<PivotConfig>({
    rows: [],
    columns: [],
    values: [],
    filters: {},
  })

  // Transform data based on pivot configuration
  const transformedData = useMemo(
    () => transformToPivotQuiver(props.data, pivotConfig),
    [props.data, pivotConfig]
  )

  // Create an ArrowProto element for the transformed data
  const arrowElement = useMemo(() => {
    return ArrowProto.create({
      data: new Uint8Array(), // ArrowTable uses the Quiver data directly
      useContainerWidth: false,
      width: 0,
      borderMode: props.element.borderMode as ArrowProto.BorderMode,
    })
  }, [props.element.borderMode])

  return (
    <StyledPivotTableContainer
      className="stPivotTable"
      data-testid="stPivotTable"
    >
      <Toolbar target={StyledPivotTableContainer}>
        <ToolbarAction
          label="Configure Pivot"
          icon={Settings}
          onClick={() => setShowDialog(true)}
        />
      </Toolbar>

      <ArrowTable element={arrowElement} data={transformedData} />

      {showDialog && (
        <PivotConfigDialog
          data={props.data}
          config={pivotConfig}
          onApply={newConfig => {
            setPivotConfig(newConfig)
            setShowDialog(false)
          }}
          onCancel={() => setShowDialog(false)}
        />
      )}
    </StyledPivotTableContainer>
  )
}

export default memo(PivotTable)
