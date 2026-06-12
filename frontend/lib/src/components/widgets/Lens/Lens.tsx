/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import {
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { getLogger } from "loglevel"
import { createPortal } from "react-dom"

import { Lens as LensProto } from "@streamlit/protobuf"

import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { Quiver } from "~lib/dataframes/Quiver"
import { useCopyToClipboard } from "~lib/hooks/useCopyToClipboard"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import type { EmotionTheme } from "~lib/theme/types"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import {
  StyledBoltButton,
  StyledCloseButton,
  StyledDragHandle,
  StyledHeaderButton,
  StyledHeaderLabel,
  StyledIconButton,
  StyledLensBody,
  StyledLensButton,
  StyledLensContainer,
  StyledLensHeader,
  StyledLensInput,
  StyledLensResult,
  StyledLensResultFooter,
  StyledResizeHandle,
  StyledSpinner,
  StyledSpinnerIcon,
} from "./styled-components"

const LOG = getLogger("Lens")

const DEFAULT_WIDTH = 300
const DEFAULT_HEIGHT = 280
const MIN_WIDTH = 180
const MIN_HEIGHT = 140
const MINIMIZED_HEIGHT = 36

/** Strip common markdown syntax for a plain-text preview. */
function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/__(.+?)__/g, "$1") // bold alt
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/_(.+?)_/g, "$1") // italic alt
    .replace(/~~(.+?)~~/g, "$1") // strikethrough
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1") // inline/fenced code
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links & images
    .replace(/^[\s]*[-*+]\s+/gm, "") // unordered list markers
    .replace(/^[\s]*\d+\.\s+/gm, "") // ordered list markers
    .replace(/^>\s?/gm, "") // blockquotes
    .replace(/\n{2,}/g, " ") // collapse newlines
    .replace(/\n/g, " ") // remaining newlines
    .trim()
}

const GLASS_COLORS = {
  light: {
    container: "rgba(255, 255, 255, 0.55)",
    containerBorder: "rgba(255, 255, 255, 0.35)",
    headerBorder: "rgba(0, 0, 0, 0.08)",
    innerBg: "rgba(255, 255, 255, 0.85)",
    innerBorder: "rgba(0, 0, 0, 0.06)",
  },
  dark: {
    container: "rgba(23, 26, 41, 0.55)",
    containerBorder: "rgba(255, 255, 255, 0.12)",
    headerBorder: "rgba(255, 255, 255, 0.08)",
    innerBg: "rgba(15, 17, 26, 0.75)",
    innerBorder: "rgba(255, 255, 255, 0.05)",
  },
}

function isDarkBg(hexColor: string): boolean {
  const hex = hexColor.replace("#", "")
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 <= 128
}

function getGlassColors(theme: EmotionTheme): (typeof GLASS_COLORS)["light"] {
  const bgColor = theme.colors?.bgColor ?? "#ffffff"
  return isDarkBg(bgColor) ? GLASS_COLORS.dark : GLASS_COLORS.light
}

export interface Props {
  disabled: boolean
  element: LensProto
  widgetMgr: WidgetStateManager
  fragmentId?: string
}

function getReactFiber(el: Element): any {
  const key = Object.keys(el).find(
    k =>
      k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
  )
  return key ? (el as any)[key] : null
}

function findComponentData(
  container: Element
): { type: string; data: any } | null {
  const elements = [container, ...Array.from(container.querySelectorAll("*"))]
  for (const el of elements) {
    const fiber = getReactFiber(el)
    let curr = fiber
    while (curr) {
      const props = curr.memoizedProps
      if (props) {
        if (props.element && typeof props.element === "object") {
          const elProto = props.element
          if (
            typeof elProto.spec === "string" &&
            (elProto.data !== undefined || elProto.datasets !== undefined)
          ) {
            return { type: "vega_lite_chart", data: elProto }
          }
          const arrowData =
            elProto.data?.data ||
            elProto.arrowData?.data ||
            elProto.arrow_data?.data
          if (arrowData && arrowData.length > 0) {
            return { type: "arrow_dataframe", data: elProto }
          }
          if (elProto.datasets?.length > 0) {
            const ds = elProto.datasets[0]
            if (ds.data?.data && ds.data.data.length > 0) {
              return { type: "arrow_dataframe", data: elProto }
            }
          }
        }
        if (
          props.data &&
          typeof props.data === "object" &&
          props.data.columnNames &&
          props.data.dimensions
        ) {
          return { type: "quiver", data: props.data }
        }
      }
      curr = curr.return
    }
  }
  return null
}

function formatQuiver(quiver: Quiver): string {
  const dims = quiver.dimensions
  if (dims?.numDataRows === undefined || dims?.numColumns === undefined) {
    return ""
  }
  const { numDataRows, numColumns } = dims
  const colNamesMatrix = quiver.columnNames
  const lastColNames = colNamesMatrix?.[colNamesMatrix.length - 1] || []

  const headerRow = lastColNames.map((name: any) => String(name || ""))
  const separatorRow = headerRow.map(() => "---")

  const rows: string[] = [
    `| ${headerRow.join(" | ")} |`,
    `| ${separatorRow.join(" | ")} |`,
  ]

  const maxRows = Math.min(numDataRows, 100)
  for (let r = 0; r < maxRows; r++) {
    const rowCells: string[] = []
    for (let c = 0; c < Math.min(numColumns, 20); c++) {
      try {
        const cell = quiver.getCell(r, c)
        if (!cell) {
          rowCells.push("")
          continue
        }
        let val = cell.content
        if (val instanceof Date) {
          val = val.toISOString()
        } else if (val === null || val === undefined) {
          val = ""
        }
        rowCells.push(String(val))
      } catch {
        rowCells.push("")
      }
    }
    rows.push(`| ${rowCells.join(" | ")} |`)
  }

  if (numDataRows > maxRows) {
    rows.push(`| _… ${numDataRows - maxRows} more rows_ |`)
  }

  return rows.join("\n")
}

function hasReadableContent(text: string): boolean {
  if (text.length < 20) return false
  const words = text.split(/\s+/).filter(w => w.length > 1)
  return words.length >= 3
}

function captureTargetContent(
  targetKey: string | null,
  lensRect?: DOMRect
): Promise<string | null> {
  if (targetKey) {
    const targetEl = document.querySelector(
      `[data-st-key="${CSS.escape(targetKey)}"]`
    )
    if (targetEl) {
      const text = (targetEl as HTMLElement).textContent ?? ""
      return btoa(unescape(encodeURIComponent(text)))
    }
  }

  if (lensRect) {
    const containers = document.querySelectorAll(
      '[data-testid="stElementContainer"]'
    )
    const overlappingTexts: string[] = []

    containers.forEach(container => {
      if (container.querySelector('[data-testid="stLens"]')) {
        return
      }

      const rect = container.getBoundingClientRect()
      const overlap = !(
        lensRect.right < rect.left ||
        lensRect.left > rect.right ||
        lensRect.bottom < rect.top ||
        lensRect.top > rect.bottom
      )

      if (overlap) {
        let contentStr = ""
        const foundInfo = findComponentData(container)
        if (foundInfo) {
          try {
            if (foundInfo.type === "vega_lite_chart") {
              const el = foundInfo.data
              const arrowData = el.data || el.arrowData || el.arrow_data
              if (arrowData?.data && arrowData.data.length > 0) {
                const quiver = new Quiver(arrowData)
                contentStr += `Chart Data Table:\n${formatQuiver(quiver)}\n\n`
              }
              if (el.datasets && el.datasets.length > 0) {
                el.datasets.forEach((ds: any) => {
                  const dsData = ds.data?.data || ds.data
                  if (dsData?.data && dsData.data.length > 0) {
                    const quiver = new Quiver(dsData)
                    contentStr += `Chart Dataset "${ds.name || "source"}":\n${formatQuiver(quiver)}\n\n`
                  }
                })
              }
            } else if (foundInfo.type === "arrow_dataframe") {
              const el = foundInfo.data
              const arrowData = el.arrowData || el.arrow_data || el.data
              if (arrowData?.data && arrowData.data.length > 0) {
                const quiver = new Quiver(arrowData)
                contentStr += `Table/DataFrame Data:\n${formatQuiver(quiver)}\n\n`
              }
            } else if (foundInfo.type === "quiver") {
              contentStr += `Data Table:\n${formatQuiver(foundInfo.data)}\n\n`
            }
          } catch (err) {
            LOG.error("Failed to extract data from fiber:", err)
          }
        }

        const hasFiberData = !!foundInfo
        const text = (container as HTMLElement).textContent ?? ""
        const trimmed = text.trim()
        if (trimmed && (!hasFiberData || hasReadableContent(trimmed))) {
          contentStr += `Visual Labels/Text:\n${trimmed.slice(0, 500)}`
        }

        if (contentStr.trim()) {
          overlappingTexts.push(contentStr.trim())
        }
      }
    })

    if (overlappingTexts.length > 0) {
      const combinedText = overlappingTexts.join("\n\n---\n\n")
      return btoa(unescape(encodeURIComponent(combinedText)))
    }
  }

  return null
}

function Lens({
  element,
  disabled,
  widgetMgr,
  fragmentId,
}: Readonly<Props>): ReactElement {
  const [position, setPosition] = useState(() => {
    if (element.positionX && element.positionY) {
      return { x: element.positionX, y: element.positionY }
    }
    const w = element.width || DEFAULT_WIDTH
    const h = element.height || DEFAULT_HEIGHT
    // eslint-disable-next-line no-restricted-properties -- centering on mount
    const width = window.innerWidth
    // eslint-disable-next-line no-restricted-properties
    const height = window.innerHeight
    return {
      x: Math.max(0, (width - w) / 2),
      y: Math.max(0, (height - h) / 2),
    }
  })
  const [size, setSize] = useState({
    width: element.width || DEFAULT_WIDTH,
    height: element.height || DEFAULT_HEIGHT,
  })
  const [isOpen, setIsOpen] = useState(!element.closed)
  const [minimized, setMinimized] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState(element.result ?? "")
  const [resultReady, setResultReady] = useState(element.resultReady ?? false)
  const [autoAnalyze, setAutoAnalyze] = useState(false)
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 })

  const theme = useEmotionTheme()
  const glass = getGlassColors(theme)

  const containerRef = useRef<HTMLDivElement | null>(null)

  const autoAnalyzeRef = useRef(false)
  autoAnalyzeRef.current = autoAnalyze

  const isAnalyzingRef = useRef(false)
  isAnalyzingRef.current = isAnalyzing

  const minimizedRef = useRef(false)
  minimizedRef.current = minimized

  const autoAnalyzePromptRef = useRef<string | null>(null)

  const handleAnalyzeRef = useRef<() => void>(() => {})

  const dragRef = useRef<{
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

  const resizeRef = useRef<{
    startX: number
    startY: number
    origW: number
    origH: number
  } | null>(null)

  useEffect(() => {
    if (element.resultReady) {
      setResult(element.result ?? "")
      setResultReady(true)
      setIsAnalyzing(false)
    }
  }, [element.result, element.resultReady])

  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing
  }, [isAnalyzing])

  const toggleAutoAnalyze = useCallback(() => {
    setAutoAnalyze(prev => !prev)
  }, [])

  const triggerAnalyze = useCallback(() => {
    if (
      !autoAnalyzeRef.current ||
      isAnalyzingRef.current ||
      minimizedRef.current
    )
      return
    autoAnalyzePromptRef.current =
      "Analyze this data: summarize key insights, trends, and notable data points."
    handleAnalyzeRef.current()
  }, [])

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: position.x,
        origY: position.y,
      }
      let didDrag = false
      const handleMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return
        didDrag = true
        const dx = ev.clientX - dragRef.current.startX
        const dy = ev.clientY - dragRef.current.startY
        setPosition({
          x: Math.max(0, dragRef.current.origX + dx),
          y: Math.max(0, dragRef.current.origY + dy),
        })
      }
      const handleMouseUp = () => {
        dragRef.current = null
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
        if (didDrag) triggerAnalyze()
      }
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    },
    [disabled, position, triggerAnalyze]
  )

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (disabled) return
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: size.width,
        origH: size.height,
      }
      const handleMouseMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return
        const dw = ev.clientX - resizeRef.current.startX
        const dh = ev.clientY - resizeRef.current.startY
        setSize({
          width: Math.max(MIN_WIDTH, resizeRef.current.origW + dw),
          height: Math.max(MIN_HEIGHT, resizeRef.current.origH + dh),
        })
      }
      const handleMouseUp = () => {
        resizeRef.current = null
        window.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("mouseup", handleMouseUp)
      }
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleMouseUp)
    },
    [disabled, size]
  )

  const handleAnalyze = useCallback(() => {
    if (disabled || isAnalyzing) return
    setIsAnalyzing(true)
    setResultReady(false)
    setResult("")

    const effectivePrompt = autoAnalyzePromptRef.current ?? prompt
    autoAnalyzePromptRef.current = null

    let lensRect: DOMRect | undefined
    if (containerRef.current) {
      lensRect = containerRef.current.getBoundingClientRect()
    }

    const doAnalyze = async () => {
      const snapshotB64 = await captureTargetContent(
        element.targetKey || null,
        lensRect
      )

      const payload = {
        snapshot:
          snapshotB64 ||
          btoa(
            unescape(encodeURIComponent(effectivePrompt || "lens capture"))
          ),
        prompt: effectivePrompt,
      }

      widgetMgr.setJsonValue(element, payload, { fromUi: true }, fragmentId)
    }
    void doAnalyze()
  }, [disabled, isAnalyzing, element, widgetMgr, fragmentId, prompt])
  handleAnalyzeRef.current = handleAnalyze

  const handleReset = useCallback(() => {
    setPrompt("")
    setResult("")
    setResultReady(false)
    setIsAnalyzing(false)
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    widgetMgr.setJsonValue(
      element,
      { closed: true },
      { fromUi: true },
      fragmentId
    )
  }, [element, widgetMgr, fragmentId])

  const toggleMinimized = useCallback(() => {
    setMinimized(prev => !prev)
  }, [])

  const containerHeight = minimized ? MINIMIZED_HEIGHT : size.height

  if (!isOpen) return null

  const overlay = (
    <StyledLensContainer
      ref={containerRef}
      isMinimized={minimized}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: containerHeight,
        background: glass.container,
        border: `1px solid ${glass.containerBorder}`,
      }}
      data-testid="stLens"
    >
      <StyledLensHeader
        onMouseDown={handleDragStart}
        style={{
          borderBottom: `1px solid ${glass.headerBorder}`,
        }}
      >
        <StyledDragHandle data-testid="stLensDragHandle">
          {"⠿"}
        </StyledDragHandle>
        <StyledHeaderLabel>
          {minimized && result
            ? `${element.label || ""} — ${stripMarkdown(result).slice(0, 50)}${stripMarkdown(result).length > 50 ? "..." : ""}`
            : element.label || ""}
        </StyledHeaderLabel>
        <StyledHeaderButton
          onClick={handleReset}
          data-testid="stLensResetButton"
          title="Reset"
        >
          {"↺"}
        </StyledHeaderButton>
        <StyledBoltButton
          isActive={autoAnalyze}
          onClick={toggleAutoAnalyze}
          data-testid="stLensBoltButton"
          title={autoAnalyze ? "Auto-Analyze: ON" : "Auto-Analyze: OFF"}
        >
          {"⚡"}
        </StyledBoltButton>
        <StyledHeaderButton
          onClick={toggleMinimized}
          data-testid="stLensMinimizeButton"
          title={minimized ? "Expand" : "Minimize"}
        >
          {minimized ? "□" : "━"}
        </StyledHeaderButton>
        <StyledCloseButton
          onClick={handleClose}
          data-testid="stLensCloseButton"
          title="Close"
        >
          {"×"}
        </StyledCloseButton>
      </StyledLensHeader>
      {!minimized && (
        <StyledLensBody>
          {isAnalyzing ? (
            <StyledSpinner data-testid="stLensSpinner">
              <StyledSpinnerIcon />
              Analyzing...
            </StyledSpinner>
          ) : resultReady && result ? (
            <>
              <StyledLensResult
                data-testid="stLensResult"
                style={{
                  background: glass.innerBg,
                  border: `1px solid ${glass.innerBorder}`,
                }}
              >
                <StreamlitMarkdown source={result} allowHTML={false} />
              </StyledLensResult>
              <StyledLensResultFooter>
                <StyledIconButton
                  onClick={() => copyToClipboard(result)}
                  data-testid="stLensCopyButton"
                  title={isCopied ? "Copied!" : "Copy to clipboard"}
                >
                  {isCopied ? "✓" : "⎘"}
                </StyledIconButton>
              </StyledLensResultFooter>
            </>
          ) : (
            <>
              <StyledLensInput
                placeholder="Ask about this content..."
                value={prompt}
                onChange={e => setPrompt(e.currentTarget.value)}
                disabled={disabled}
                data-testid="stLensPromptInput"
                style={{
                  background: glass.innerBg,
                  border: `1px solid ${glass.innerBorder}`,
                }}
              />
              <StyledLensButton
                onClick={handleAnalyze}
                disabled={disabled || isAnalyzing}
                data-testid="stLensAnalyzeButton"
              >
                Analyze
              </StyledLensButton>
            </>
          )}
        </StyledLensBody>
      )}
      {!minimized && <StyledResizeHandle onMouseDown={handleResizeStart} />}
    </StyledLensContainer>
  )

  return createPortal(overlay, document.body)
}

export default memo(Lens)
