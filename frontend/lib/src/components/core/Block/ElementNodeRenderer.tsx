/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React, { ReactElement, Suspense } from "react"

import debounceRender from "react-debounce-render"
import classNames from "classnames"

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
} from "@streamlit/lib/src/proto"
import { ElementNode } from "@streamlit/lib/src/AppNode"
import { Quiver } from "@streamlit/lib/src/dataframes/Quiver"
// Load (non-lazy) elements.
import AlertElement from "@streamlit/lib/src/components/elements/AlertElement"
import ArrowTable from "@streamlit/lib/src/components/elements/ArrowTable"
import DocString from "@streamlit/lib/src/components/elements/DocString"
import ErrorBoundary from "@streamlit/lib/src/components/shared/ErrorBoundary"
import ExceptionElement from "@streamlit/lib/src/components/elements/ExceptionElement"
import Json from "@streamlit/lib/src/components/elements/Json"
import Markdown from "@streamlit/lib/src/components/elements/Markdown"
import Metric from "@streamlit/lib/src/components/elements/Metric"
import { Skeleton } from "@streamlit/lib/src/components/elements/Skeleton"
import TextElement from "@streamlit/lib/src/components/elements/TextElement"
import { ComponentInstance } from "@streamlit/lib/src/components/widgets/CustomComponent"
import { VegaLiteChartElement } from "@streamlit/lib/src/components/elements/ArrowVegaLiteChart"
import { getAlertElementKind } from "@streamlit/lib/src/components/elements/AlertElement/AlertElement"
import Maybe from "@streamlit/lib/src/components/core/Maybe"
import { FormSubmitContent } from "@streamlit/lib/src/components/widgets/Form"
import Heading from "@streamlit/lib/src/components/shared/StreamlitMarkdown/Heading"
import { LibContext } from "@streamlit/lib/src/components/core/LibContext"
import { getElementId } from "@streamlit/lib/src/util/utils"

import {
  BaseBlockProps,
  convertKeyToClassName,
  getKeyFromId,
  isComponentStale,
  shouldComponentBeEnabled,
} from "./utils"
import { StyledElementContainer } from "./styled-components"

// Lazy-load elements.
const Audio = React.lazy(
  () => import("@streamlit/lib/src/components/elements/Audio")
)
const Balloons = React.lazy(
  () => import("@streamlit/lib/src/components/elements/Balloons")
)
const Snow = React.lazy(
  () => import("@streamlit/lib/src/components/elements/Snow")
)
const ArrowDataFrame = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/DataFrame")
)
const ArrowVegaLiteChart = React.lazy(
  () => import("@streamlit/lib/src/components/elements/ArrowVegaLiteChart")
)
const Toast = React.lazy(
  () => import("@streamlit/lib/src/components/elements/Toast")
)

// BokehChart render function is sluggish. If the component is not debounced,
// AutoSizer causes it to rerender multiple times for different widths
// when the sidebar is toggled, which significantly slows down the app.
const BokehChart = React.lazy(
  () => import("@streamlit/lib/src/components/elements/BokehChart")
)

// RTL ESLint triggers a false positive on this render function
// eslint-disable-next-line testing-library/render-result-naming-convention
const DebouncedBokehChart = debounceRender(BokehChart, 100)

const DeckGlJsonChart = React.lazy(
  () => import("@streamlit/lib/src/components/elements/DeckGlJsonChart")
)
const GraphVizChart = React.lazy(
  () => import("@streamlit/lib/src/components/elements/GraphVizChart")
)
const IFrame = React.lazy(
  () => import("@streamlit/lib/src/components/elements/IFrame")
)
const ImageList = React.lazy(
  () => import("@streamlit/lib/src/components/elements/ImageList")
)

const LinkButton = React.lazy(
  () => import("@streamlit/lib/src/components/elements/LinkButton")
)

const PageLink = React.lazy(
  () => import("@streamlit/lib/src/components/elements/PageLink")
)

const PlotlyChart = React.lazy(
  () => import("@streamlit/lib/src/components/elements/PlotlyChart")
)
const Video = React.lazy(
  () => import("@streamlit/lib/src/components/elements/Video")
)

// Lazy-load widgets.
const AudioInput = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/AudioInput")
)

const Button = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/Button")
)
const ButtonGroup = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/ButtonGroup")
)
const DownloadButton = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/DownloadButton")
)
const CameraInput = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/CameraInput")
)
const ChatInput = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/ChatInput")
)
const Checkbox = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/Checkbox")
)
const ColorPicker = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/ColorPicker")
)
const DateInput = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/DateInput")
)
const Html = React.lazy(
  () => import("@streamlit/lib/src/components/elements/Html")
)
const Multiselect = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/Multiselect")
)
const Progress = React.lazy(
  () => import("@streamlit/lib/src/components/elements/Progress")
)
const Spinner = React.lazy(
  () => import("@streamlit/lib/src/components/elements/Spinner")
)
const Radio = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/Radio")
)
const Selectbox = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/Selectbox")
)
const Slider = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/Slider")
)
const FileUploader = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/FileUploader")
)
const TextArea = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/TextArea")
)
const TextInput = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/TextInput")
)
const TimeInput = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/TimeInput")
)
const NumberInput = React.lazy(
  () => import("@streamlit/lib/src/components/widgets/NumberInput")
)
const StreamlitSyntaxHighlighter = React.lazy(
  () =>
    import(
      "@streamlit/lib/src/components/elements/CodeBlock/StreamlitSyntaxHighlighter"
    )
)

export interface ElementNodeRendererProps extends BaseBlockProps {
  node: ElementNode
  width: number
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
    width: props.width,
    disableFullscreenMode: props.disableFullscreenMode,
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
      return (
        <ArrowTable element={node.quiverElement as Quiver} {...elementProps} />
      )

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
      return hideIfStale(
        props.isStale,
        <Balloons scriptRunId={props.scriptRunId} />
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
      return <Metric element={node.element.metric as MetricProto} />

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
      return hideIfStale(
        props.isStale,
        <Snow scriptRunId={props.scriptRunId} />
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
          body={toastProto.body}
          icon={toastProto.icon}
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
          element={arrowProto}
          data={node.quiverElement as Quiver}
          // Arrow dataframe can be used as a widget (data_editor) or
          // an element (dataframe). We only want to set the key in case of
          // it being used as a widget. For the non-widget usage, the id will
          // be undefined.
          {...(arrowProto.id && {
            key: arrowProto.id,
          })}
          {...widgetProps}
        />
      )
    }

    case "arrowVegaLiteChart":
      const vegaLiteElement = node.vegaLiteChartElement as VegaLiteChartElement
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
        const { formId } = buttonProto
        const hasInProgressUpload =
          props.formsData.formsWithUploads.has(formId)
        return (
          <FormSubmitContent
            element={buttonProto}
            hasInProgressUpload={hasInProgressUpload}
            {...widgetProps}
          />
        )
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
          registry={props.componentRegistry}
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
      widgetProps.disabled = widgetProps.disabled || linkButtonProto.disabled
      return <LinkButton element={linkButtonProto} {...widgetProps} />
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
  const { isFullScreen, fragmentIdsThisRun } = React.useContext(LibContext)
  const { node, width } = props

  const elementType = node.element.type || ""
  const enable = shouldComponentBeEnabled(elementType, props.scriptRunState)
  const isStale = isComponentStale(
    enable,
    node,
    props.scriptRunState,
    props.scriptRunId,
    fragmentIdsThisRun
  )

  // Get the user key - if it was specified - and use it as CSS class name:
  const elementId = getElementId(node.element)
  const userKey = getKeyFromId(elementId)

  // TODO: If would be great if we could return an empty fragment if isHidden is true, to keep the
  // DOM clean. But this would require the keys passed to ElementNodeRenderer at Block.tsx to be a
  // stable hash of some sort.

  return (
    <Maybe enable={enable}>
      <StyledElementContainer
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
        width={width}
        elementType={elementType}
      >
        <ErrorBoundary width={width}>
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
      </StyledElementContainer>
    </Maybe>
  )
}

export default ElementNodeRenderer
