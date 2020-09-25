import { CancelTokenSource } from "axios"

export interface ExtendedFile extends File {
  id?: string
  status?: string
  errorMessage?: string
  cancelToken?: CancelTokenSource
  progress?: number
}

export enum FileStatuses {
  ERROR = "ERROR",
  DELETING = "DELETING",
  READY = "READY",
  UPLOADING = "UPLOADING",
  UPLOADED = "UPLOADED",
}

const sizeUnitSequence = ["gb", "mb", "kb", "b"]
export const getSizeDisplay = (
  size: number,
  unit: string,
  rounding = 1
): string => {
  if (!unit) unit = "b"

  if (rounding < 0) rounding = 0

  if (size < 0) throw new Error("Size must be greater than or equal to 0")

  const sizeIndex = sizeUnitSequence.indexOf(unit)
  const nextUnitSize = size / 1024
  if (sizeIndex && size > 500) {
    return getSizeDisplay(
      nextUnitSize,
      sizeUnitSequence[sizeIndex - 1],
      rounding
    )
  }
  return `${size.toFixed(rounding)}${unit.toUpperCase()}`
}
