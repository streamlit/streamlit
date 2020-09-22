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

export const getFileExtension = (filename: string): string => {
  return filename.split(".").pop() || "app"
}
