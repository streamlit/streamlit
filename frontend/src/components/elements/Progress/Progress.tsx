import React, { ReactElement } from "react"
import { Progress as ProgressProto } from "src/autogen/proto"
import ProgressBar from "src/components/shared/ProgressBar"

export interface ProgressProps {
  width: number
  element: ProgressProto
}

export const FAST_UPDATE_MS = 50

function Progress({ element, width }: ProgressProps): ReactElement {
  return (
    <div className="stProgress">
      <ProgressBar value={element.value} width={width} />
    </div>
  )
}

export default Progress
