import React from "react"

import { Arrow, Arrow as ArrowProto } from "@streamlit/protobuf"

import { Quiver } from "~lib/dataframes/Quiver"

import DataFrame from "./DataFrame"

interface ReadOnlyGridProps {
  data: Quiver
  height?: number
  customToolbarActions?: React.ReactNode[]
}

export const ReadOnlyGrid = ({
  data,
  height,
  customToolbarActions,
}: ReadOnlyGridProps): React.ReactElement => {
  return (
    <DataFrame
      element={
        new ArrowProto({
          useContainerWidth: true,
          editingMode: Arrow.EditingMode.READ_ONLY,
          disabled: true,
          // data provided via the data property
          data: undefined,
          styler: null,
          // eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values
          width: null,
          height: height ?? null,
          id: "",
          columns: "",
          formId: "",
          columnOrder: [],
          selectionMode: [],
        })
      }
      data={data}
      widgetMgr={undefined}
      disabled={true}
      fragmentId={undefined}
      disableFullscreenMode={true}
      customToolbarActions={customToolbarActions}
    />
  )
}
