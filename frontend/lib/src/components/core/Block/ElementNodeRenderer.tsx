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

import React, { lazy, ReactElement, Suspense, useContext } from "react"

import classNames from "classnames"
import debounceRender from "react-debounce-render"

import {
  Alert as AlertProto,
  Arrow as ArrowProto,
  AudioInput as AudioInputProto,
  Audio as AudioProto,
  BokehChart as BokehChartProto,
  ButtonGroup as ButtonGroupProto,
  Button as ButtonProto,
  CameraInput as CameraInputProto,
  ChatInput as ChatInputProto,
  Checkbox as CheckboxProto,
  Code as CodeProto,
  ColorPicker as ColorPickerProto,
  ComponentInstance as ComponentInstanceProto,
  DateInput as DateInputProto,
  DeckGlJsonChart as DeckGlJsonChartProto,
  DocString as DocStringProto,
  DownloadButton as DownloadButtonProto,
  Exception as ExceptionProto,
  FileUploader as FileUploaderProto,
  GraphVizChart as GraphVizChartProto,
  Heading as HeadingProto,
  Html as HtmlProto,
  IFrame as IFrameProto,
  ImageList as ImageListProto,
  Json as JsonProto,
  LinkButton as LinkButtonProto,
  Markdown as MarkdownProto,
  Metric as MetricProto,
  MultiSelect as MultiSelectProto,
  NumberInput as NumberInputProto,
  PageLink as PageLinkProto,
  PlotlyChart as PlotlyChartProto,
  Progress as ProgressProto,
  Radio as RadioProto,
  Selectbox as SelectboxProto,
  Skeleton as SkeletonProto,
  Slider as SliderProto,
  Spinner as SpinnerProto,
  TextArea as TextAreaProto,
  TextInput as TextInputProto,
  Text as TextProto,
  TimeInput as TimeInputProto,
  Toast as ToastProto,
  Video as VideoProto,
} from "@streamlit/protobuf"

import { ElementNode } from "~lib/AppNode"
// Load (non-lazy) elements.
import { withCalculatedWidth } from "~lib/components/core/Layout/withCalculatedWidth"
import { LibContext } from "~lib/components/core/LibContext"
import Maybe from "~lib/components/core/Maybe"
import AlertElement, {
  getAlertElementKind,
} from "~lib/components/elements/AlertElement"
import ArrowTable from "~lib/components/elements/ArrowTable"
import DocString from "~lib/components/elements/DocString"
import ExceptionElement from "~lib/components/elements/ExceptionElement"
import Json from "~lib/components/elements/Json"
import Markdown from "~lib/components/elements/Markdown"
import Metric from "~lib/components/elements/Metric"
import { Skeleton } from "~lib/components/elements/Skeleton"
import TextElement from "~lib/components/elements/TextElement"
import ErrorBoundary from "~lib/components/shared/ErrorBoundary"
import Heading from "~lib/components/shared/StreamlitMarkdown/Heading"
import { ComponentInstance } from "~lib/components/widgets/CustomComponent"
import { FormSubmitContent } from "~lib/components/widgets/Form"
import { getElementId } from "~lib/util/utils"

import { StyledElementContainerLayoutWrapper } from "./StyledElementContainerLayoutWrapper"
import {
  BaseBlockProps,
  convertKeyToClassName,
  getKeyFromId,
  isComponentStale,
  shouldComponentBeEnabled,
} from "./utils"

// Lazy-load elements.
const Audio = lazy(() => import("~lib/components/elements/Audio"))
const Balloons = lazy(() => import("~lib/components/elements/Balloons"))
const Snow = lazy(() => import("~lib/components/elements/Snow"))
const ArrowDataFrame = lazy(() => import("~lib/components/widgets/DataFrame"))
const ArrowVegaLiteChart = lazy(
  () => import("~lib/components/elements/ArrowVegaLiteChart")
)
const Toast = lazy(() => import("~lib/components/elements/Toast"))

// BokehChart render function is sluggish. If the component is not debounced,
// AutoSizer causes it to rerender multiple times for different widths
// when the sidebar is toggled, which significantly slows down the app.
const BokehChart = lazy(() => import("~lib/components/elements/BokehChart"))

const DebouncedBokehChart = withCalculatedWidth(
  debounceRender(BokehChart, 100)
)

const DeckGlJsonChart = lazy(
  () => import("~lib/components/elements/DeckGlJsonChart")
)
const GraphVizChart = lazy(
  () => import("~lib/components/elements/GraphVizChart")
)
const IFrame = lazy(() => import("~lib/components/elements/IFrame"))
const ImageList = lazy(() => import("~lib/components/elements/ImageList"))

const LinkButton = lazy(() => import("~lib/components/elements/LinkButton"))

const PageLink = lazy(() => import("~lib/components/elements/PageLink"))

const PlotlyChart = lazy(() => import("~lib/components/elements/PlotlyChart"))
const Video = lazy(() => import("~lib/components/elements/Video"))

// Lazy-load widgets.
const AudioInput = lazy(() => import("~lib/components/widgets/AudioInput"))

const Button = lazy(() => import("~lib/components/widgets/Button"))
const ButtonGroup = lazy(() => import("~lib/components/widgets/ButtonGroup"))
const DownloadButton = lazy(
  () => import("~lib/components/widgets/DownloadButton")
)
const CameraInput = lazy(() => import("~lib/components/widgets/CameraInput"))
const ChatInput = lazy(() => import("~lib/components/widgets/ChatInput"))
const Checkbox = lazy(() => import("~lib/components/widgets/Checkbox"))
const ColorPicker = lazy(() => import("~lib/components/widgets/ColorPicker"))
const DateInput = lazy(() => import("~lib/components/widgets/DateInput"))
const Html = lazy(() => import("~lib/components/elements/Html"))
const Multiselect = lazy(() => import("~lib/components/widgets/Multiselect"))
const Progress = lazy(() => import("~lib/components/elements/Progress"))
const Spinner = lazy(() => import("~lib/components/elements/Spinner"))
const Radio = lazy(() => import("~lib/components/widgets/Radio"))
const Selectbox = lazy(() => import("~lib/components/widgets/Selectbox"))
const Slider = lazy(() => import("~lib/components/widgets/Slider"))
const FileUploader = lazy(() => import("~lib/components/widgets/FileUploader"))
const TextArea = lazy(() => import("~lib/components/widgets/TextArea"))
const TextInput = lazy(() => import("~lib/components/widgets/TextInput"))
const TimeInput = lazy(() => import("~lib/components/widgets/TimeInput"))
const NumberInput = lazy(() => import("~lib/components/widgets/NumberInput"))
const StreamlitSyntaxHighlighter = lazy(
  () => import("~lib/components/elements/CodeBlock/StreamlitSyntaxHighlighter")
)

export interface ElementNodeRendererProps extends BaseBlockProps {
  node: ElementNode
}

interface RawElementNodeRendererProps extends ElementNodeRendererProps {
  isStale: boolean
}

function hideIfStale(isStale: boolean, component: ReactElement): ReactElement {
  return isStale ? <></> : component
}

// Render ElementNodes (i.e. leaf nodes).
const RawElementNodeRenderer = (
  props: RawElementNodeRendererProps
): ReactElement => {
  const { node } = props

  if (!node) {
    throw new Error("ElementNode not found.")
  }

  const elementProps = {
    disableFullscreenMode: props.disableFullscreenMode,
    widthConfig: node.element.widthConfig,
    heightConfig: node.element.heightConfig,
  }

  const widgetProps = {
    ...elementProps,
    widgetMgr: props.widgetMgr,
    disabled: props.widgetsDisabled,
    fragmentId: node.fragmentId,
  }

  switch (node.element.type) {
    case "alert": {
      const alertProto = node.element.alert as AlertProto
      return (
        <AlertElement
          icon={alertProto.icon}
          body={alertProto.body}
          kind={getAlertElementKind(alertProto.format)}
          {...elementProps}
        />
      )
    }

    case "arrowTable":
      return <ArrowTable element={node.quiverElement} {...elementProps} />

    case "audio":
      return (
        <Audio
          element={node.element.audio as AudioProto}
          endpoints={props.endpoints}
          {...elementProps}
          elementMgr={props.widgetMgr}
        />
      )

    case "balloons":
      // Specifically use node.scriptRunId vs. scriptRunId from context
      // See issue #10961: https://github.com/streamlit/streamlit/issues/10961
      return hideIfStale(
        props.isStale,
        <Balloons scriptRunId={node.scriptRunId} />
      )

    case "bokehChart":
      return (
        <DebouncedBokehChart
          element={node.element.bokehChart as BokehChartProto}
          {...elementProps}
        />
      )

    case "code": {
      const codeProto = node.element.code as CodeProto
      return (
        <StreamlitSyntaxHighlighter
          language={codeProto.language}
          showLineNumbers={codeProto.showLineNumbers}
          wrapLines={codeProto.wrapLines}
        >
          {codeProto.codeText}
        </StreamlitSyntaxHighlighter>
      )
    }

    case "deckGlJsonChart":
      return (
        <DeckGlJsonChart
          element={node.element.deckGlJsonChart as DeckGlJsonChartProto}
          {...widgetProps}
        />
      )

    case "docString":
      return (
        <DocString
          element={node.element.docString as DocStringProto}
          {...elementProps}
        />
      )

    case "empty":
      return <div className="stEmpty" data-testid="stEmpty" />

    case "exception":
      return (
        <ExceptionElement
          element={node.element.exception as ExceptionProto}
          {...elementProps}
        />
      )

    case "graphvizChart":
      return (
        <GraphVizChart
          element={node.element.graphvizChart as GraphVizChartProto}
          {...elementProps}
        />
      )

    case "heading":
      return (
        <Heading
          element={node.element.heading as HeadingProto}
          {...elementProps}
        />
      )

    case "iframe":
      return (
        <IFrame
          element={node.element.iframe as IFrameProto}
          {...elementProps}
        />
      )

    case "imgs":
      return (
        <ImageList
          element={node.element.imgs as ImageListProto}
          endpoints={props.endpoints}
          {...elementProps}
        />
      )

    case "json":
      return (
        <Json element={node.element.json as JsonProto} {...elementProps} />
      )

    case "markdown":
      return (
        <Markdown
          element={node.element.markdown as MarkdownProto}
          {...elementProps}
        />
      )

    case "metric":
      return (
        <Metric
          element={node.element.metric as MetricProto}
          {...elementProps}
        />
      )

    case "html":
      return (
        <Html element={node.element.html as HtmlProto} {...elementProps} />
      )

    case "pageLink": {
      const pageLinkProto = node.element.pageLink as PageLinkProto
      const isDisabled = widgetProps.disabled || pageLinkProto.disabled
      return (
        <PageLink
          element={pageLinkProto}
          disabled={isDisabled}
          {...elementProps}
        />
      )
    }

    case "progress":
      return (
        <Progress
          element={node.element.progress as ProgressProto}
          {...elementProps}
        />
      )

    case "skeleton": {
      return <Skeleton element={node.element.skeleton as SkeletonProto} />
    }

    case "snow":
      // Specifically use node.scriptRunId vs. scriptRunId from context
      // See issue #10961: https://github.com/streamlit/streamlit/issues/10961
      return hideIfStale(
        props.isStale,
        <Snow scriptRunId={node.scriptRunId} />
      )

    case "spinner":
      return (
        <Spinner
          element={node.element.spinner as SpinnerProto}
          {...elementProps}
        />
      )

    case "text":
      return (
        <TextElement
          element={node.element.text as TextProto}
          {...elementProps}
        />
      )

    case "video":
      return (
        <Video
          element={node.element.video as VideoProto}
          endpoints={props.endpoints}
          {...elementProps}
          elementMgr={props.widgetMgr}
        />
      )

    // Events:
    case "toast": {
      const toastProto = node.element.toast as ToastProto
      return (
        <Toast
          // React key needed so toasts triggered on re-run
          key={node.scriptRunId}
          element={toastProto}
          {...elementProps}
        />
      )
    }

    // Widgets:
    case "arrowDataFrame": {
      const arrowProto = node.element.arrowDataFrame as ArrowProto
      widgetProps.disabled = widgetProps.disabled || arrowProto.disabled
      return (
        <ArrowDataFrame
          // Arrow dataframe can be used as a widget (data_editor) or
          // an element (dataframe). We only want to set the key in case of
          // it being used as a widget. For the non-widget usage, the id will
          // be undefined.
          key={arrowProto.id || undefined}
          element={arrowProto}
          data={node.quiverElement}
          {...widgetProps}
        />
      )
    }

    case "arrowVegaLiteChart": {
      const vegaLiteElement = node.vegaLiteChartElement
      return (
        <ArrowVegaLiteChart
          element={vegaLiteElement}
          // Vega-lite chart can be used as a widget (when selections are activated) or
          // an element. We only want to set the key in case of it being used as a widget
          // since otherwise it might break some apps that show the same charts multiple times.
          // So we only compute an element ID if it's a widget, otherwise its an empty string.
          key={vegaLiteElement.id || undefined}
          {...widgetProps}
        />
      )
    }

    case "audioInput": {
      const audioInputProto = node.element.audioInput as AudioInputProto
      widgetProps.disabled = widgetProps.disabled || audioInputProto.disabled

      return (
        <AudioInput
          key={audioInputProto.id}
          uploadClient={props.uploadClient}
          element={audioInputProto}
          {...widgetProps}
        ></AudioInput>
      )
    }

    case "button": {
      const buttonProto = node.element.button as ButtonProto
      widgetProps.disabled = widgetProps.disabled || buttonProto.disabled
      if (buttonProto.isFormSubmitter) {
        return <FormSubmitContent element={buttonProto} {...widgetProps} />
      }
      return <Button element={buttonProto} {...widgetProps} />
    }

    case "buttonGroup": {
      const buttonGroupProto = node.element.buttonGroup as ButtonGroupProto
      widgetProps.disabled = widgetProps.disabled || buttonGroupProto.disabled
      return (
        <ButtonGroup
          key={buttonGroupProto.id}
          element={buttonGroupProto}
          {...widgetProps}
        />
      )
    }

    case "downloadButton": {
      const downloadButtonProto = node.element
        .downloadButton as DownloadButtonProto
      widgetProps.disabled =
        widgetProps.disabled || downloadButtonProto.disabled
      return (
        <DownloadButton
          endpoints={props.endpoints}
          key={downloadButtonProto.id}
          element={downloadButtonProto}
          {...widgetProps}
        />
      )
    }

    case "cameraInput": {
      const cameraInputProto = node.element.cameraInput as CameraInputProto
      widgetProps.disabled = widgetProps.disabled || cameraInputProto.disabled
      return (
        <CameraInput
          key={cameraInputProto.id}
          element={cameraInputProto}
          uploadClient={props.uploadClient}
          {...widgetProps}
        />
      )
    }

    case "chatInput": {
      const chatInputProto = node.element.chatInput as ChatInputProto
      widgetProps.disabled = widgetProps.disabled || chatInputProto.disabled
      return (
        <ChatInput
          key={chatInputProto.id}
          element={chatInputProto}
          uploadClient={props.uploadClient}
          {...widgetProps}
        />
      )
    }

    case "checkbox": {
      const checkboxProto = node.element.checkbox as CheckboxProto
      widgetProps.disabled = widgetProps.disabled || checkboxProto.disabled
      return (
        <Checkbox
          key={checkboxProto.id}
          element={checkboxProto}
          {...widgetProps}
        />
      )
    }

    case "colorPicker": {
      const colorPickerProto = node.element.colorPicker as ColorPickerProto
      widgetProps.disabled = widgetProps.disabled || colorPickerProto.disabled
      return (
        <ColorPicker
          key={colorPickerProto.id}
          element={colorPickerProto}
          {...widgetProps}
        />
      )
    }

    case "componentInstance":
      return (
        <ComponentInstance
          element={node.element.componentInstance as ComponentInstanceProto}
          {...widgetProps}
        />
      )

    case "dateInput": {
      const dateInputProto = node.element.dateInput as DateInputProto
      widgetProps.disabled = widgetProps.disabled || dateInputProto.disabled
      return (
        <DateInput
          key={dateInputProto.id}
          element={dateInputProto}
          {...widgetProps}
        />
      )
    }

    case "fileUploader": {
      const fileUploaderProto = node.element.fileUploader as FileUploaderProto
      widgetProps.disabled = widgetProps.disabled || fileUploaderProto.disabled
      return (
        <FileUploader
          key={fileUploaderProto.id}
          element={fileUploaderProto}
          uploadClient={props.uploadClient}
          {...widgetProps}
        />
      )
    }

    case "linkButton": {
      const linkButtonProto = node.element.linkButton as LinkButtonProto
      return <LinkButton element={linkButtonProto} {...elementProps} />
    }

    case "multiselect": {
      const multiSelectProto = node.element.multiselect as MultiSelectProto
      widgetProps.disabled = widgetProps.disabled || multiSelectProto.disabled
      return (
        <Multiselect
          key={multiSelectProto.id}
          element={multiSelectProto}
          {...widgetProps}
        />
      )
    }

    case "numberInput": {
      const numberInputProto = node.element.numberInput as NumberInputProto
      widgetProps.disabled = widgetProps.disabled || numberInputProto.disabled
      return (
        <NumberInput
          key={numberInputProto.id}
          element={numberInputProto}
          {...widgetProps}
        />
      )
    }

    case "plotlyChart": {
      const plotlyProto = node.element.plotlyChart as PlotlyChartProto
      return (
        <PlotlyChart
          key={plotlyProto.id}
          element={plotlyProto}
          {...widgetProps}
        />
      )
    }

    case "radio": {
      const radioProto = node.element.radio as RadioProto
      widgetProps.disabled = widgetProps.disabled || radioProto.disabled
      return (
        <Radio key={radioProto.id} element={radioProto} {...widgetProps} />
      )
    }

    case "selectbox": {
      const selectboxProto = node.element.selectbox as SelectboxProto
      widgetProps.disabled = widgetProps.disabled || selectboxProto.disabled
      return (
        <Selectbox
          key={selectboxProto.id}
          element={selectboxProto}
          {...widgetProps}
        />
      )
    }

    case "slider": {
      const sliderProto = node.element.slider as SliderProto
      widgetProps.disabled = widgetProps.disabled || sliderProto.disabled
      return (
        <Slider key={sliderProto.id} element={sliderProto} {...widgetProps} />
      )
    }

    case "textArea": {
      const textAreaProto = node.element.textArea as TextAreaProto
      widgetProps.disabled = widgetProps.disabled || textAreaProto.disabled
      return (
        <TextArea
          key={textAreaProto.id}
          element={textAreaProto}
          outerElement={node.element}
          {...widgetProps}
        />
      )
    }

    case "textInput": {
      const textInputProto = node.element.textInput as TextInputProto
      widgetProps.disabled = widgetProps.disabled || textInputProto.disabled
      return (
        <TextInput
          key={textInputProto.id}
          element={textInputProto}
          {...widgetProps}
        />
      )
    }

    case "timeInput": {
      const timeInputProto = node.element.timeInput as TimeInputProto
      widgetProps.disabled = widgetProps.disabled || timeInputProto.disabled
      return (
        <TimeInput
          key={timeInputProto.id}
          element={timeInputProto}
          {...widgetProps}
        />
      )
    }

    default:
      throw new Error(`Unrecognized Element type ${node.element.type}`)
  }
}

// Render ElementNodes (i.e. leaf nodes) wrapped in error catchers and all sorts of other //
// utilities.
const ElementNodeRenderer = (
  props: ElementNodeRendererProps
): ReactElement => {
  const { isFullScreen, fragmentIdsThisRun, scriptRunState, scriptRunId } =
    useContext(LibContext)
  const { node } = props

  const elementType = node.element.type || ""

  const enable = shouldComponentBeEnabled(elementType, scriptRunState)
  const isStale = isComponentStale(
    enable,
    node,
    scriptRunState,
    scriptRunId,
    fragmentIdsThisRun
  )

  // Get the user key - if it was specified - and use it as CSS class name:
  const elementId = getElementId(node.element)
  const userKey = getKeyFromId(elementId)

  // TODO: It would be great if we could return an empty fragment if isHidden is true, to keep the
  // DOM clean. But this would require the keys passed to ElementNodeRenderer at Block.tsx to be a
  // stable hash of some sort.

  return (
    <Maybe enable={enable}>
      <StyledElementContainerLayoutWrapper
        className={classNames(
          "stElementContainer",
          "element-container",
          convertKeyToClassName(userKey)
        )}
        data-testid="stElementContainer"
        data-stale={isStale}
        // Applying stale opacity in fullscreen mode
        // causes the fullscreen overlay to be transparent.
        isStale={isStale && !isFullScreen}
        elementType={elementType}
        node={node}
      >
        <ErrorBoundary>
          <Suspense
            fallback={
              <Skeleton
                element={SkeletonProto.create({
                  style: SkeletonProto.SkeletonStyle.ELEMENT,
                })}
              />
            }
          >
            <RawElementNodeRenderer {...props} isStale={isStale} />
          </Suspense>
        </ErrorBoundary>
      </StyledElementContainerLayoutWrapper>
    </Maybe>
  )
}

export default ElementNodeRenderer
