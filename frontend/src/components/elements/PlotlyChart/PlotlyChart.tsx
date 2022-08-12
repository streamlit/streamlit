import React, { ReactElement } from "react"
import { useTheme } from "@emotion/react"
import { Theme } from "src/theme"
import {
  Figure as FigureProto,
  PlotlyChart as PlotlyChartProto,
} from "src/autogen/proto"
import withFullScreenWrapper from "src/hocs/withFullScreenWrapper"
import Plot from "react-plotly.js"

export interface PlotlyChartProps {
  width: number
  element: PlotlyChartProto
  height: number | undefined
}

export const DEFAULT_HEIGHT = 450

export function PlotlyChart({
  width: propWidth,
  element,
  height: propHeight,
}: PlotlyChartProps): ReactElement {
  const renderIFrame = (url: string): ReactElement => {
    const height = propHeight || DEFAULT_HEIGHT
    const width = propWidth
    return <iframe title="Plotly" src={url} style={{ width, height }} />
  }

  const isFullScreen = (): boolean => !!propHeight

  const generateSpec = (figure: FigureProto): any => {
    const spec = JSON.parse(figure.spec)

    if (isFullScreen()) {
      spec.layout.width = propWidth
      spec.layout.height = propHeight
    } else if (element.useContainerWidth) {
      spec.layout.width = propWidth
    }

    const theme: Theme = useTheme()
    spec.layout = layoutWithThemeDefaults(spec.layout, theme)

    return spec
  }

  const renderFigure = (figure: FigureProto): ReactElement => {
    const config = JSON.parse(figure.config)
    const { data, layout, frames } = generateSpec(figure)

    return (
      <Plot
        key={isFullScreen() ? "fullscreen" : "original"}
        className="stPlotlyChart"
        data={data}
        layout={layout}
        config={config}
        frames={frames}
      />
    )
  }

  switch (element.chart) {
    case "url":
      return renderIFrame(element.url as string)
    case "figure":
      return renderFigure(element.figure as FigureProto)
    default:
      throw new Error(`Unrecognized PlotlyChart type: ${element.chart}`)
  }
}

function layoutWithThemeDefaults(layout: any, theme: Theme): any {
  const { colors, genericFonts } = theme

  const themeDefaults = {
    font: {
      color: colors.bodyText,
      family: genericFonts.bodyFont,
    },
    paper_bgcolor: colors.bgColor,
    plot_bgcolor: colors.secondaryBg,
  }

  // Fill in theme defaults where the user didn't specify layout options.
  return {
    ...layout,
    font: {
      ...themeDefaults.font,
      ...layout.font,
    },
    paper_bgcolor: layout.paper_bgcolor || themeDefaults.paper_bgcolor,
    plot_bgcolor: layout.plot_bgcolor || themeDefaults.plot_bgcolor,
  }
}

export default withFullScreenWrapper(PlotlyChart)
