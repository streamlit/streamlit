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

import React, { ReactElement } from "react"

interface MediaStreamVisualizerProps {
  heightPx: number
  mediaStream: MediaStream
}

const MediaStreamVisualizer: React.FC<MediaStreamVisualizerProps> = ({
  heightPx,
  mediaStream,
}): ReactElement => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const dataArrayRef = React.useRef<number[]>([])
  const maxDataPoints = 100
  const frameSkip = 4 // Number of frames to skip
  const frameCountRef = React.useRef(0)

  React.useEffect(() => {
    if (mediaStream && canvasRef.current) {
      const canvas = canvasRef.current
      const canvasCtx = canvas.getContext("2d")

      if (canvasCtx === null) {
        return
      }

      // Adjust for device pixel ratio
      const devicePixelRatio = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * devicePixelRatio
      canvas.height = heightPx * devicePixelRatio
      canvasCtx.scale(devicePixelRatio, devicePixelRatio)

      const audioContext = new window.AudioContext()
      const source = audioContext.createMediaStreamSource(mediaStream)
      const analyser = audioContext.createAnalyser()

      analyser.fftSize = 256 // Smaller fftSize to get more frequent updates
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      source.connect(analyser)

      const draw = () => {
        if (!canvasCtx) return

        frameCountRef.current++
        if (frameCountRef.current % frameSkip !== 0) {
          requestAnimationFrame(draw)
          return
        }

        analyser.getByteTimeDomainData(dataArray)

        // Calculate average volume
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += Math.abs(dataArray[i] - 128)
        }
        const average = sum / bufferLength

        // Update data array
        if (dataArrayRef.current.length >= maxDataPoints) {
          dataArrayRef.current.shift()
        }
        dataArrayRef.current.push(average)

        // Clear canvas
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw horizontal grey line
        canvasCtx.strokeStyle = "grey"
        canvasCtx.lineWidth = 1
        canvasCtx.beginPath()
        canvasCtx.moveTo(0, canvas.height / devicePixelRatio / 2)
        canvasCtx.lineTo(
          canvas.width / devicePixelRatio,
          canvas.height / devicePixelRatio / 2
        )
        canvasCtx.stroke()

        // Draw vertical bars with spacing
        const barWidth =
          (canvas.width / devicePixelRatio / maxDataPoints) * 0.4 // 40% of the allocated width per bar
        const barSpacing =
          (canvas.width / devicePixelRatio / maxDataPoints) * 0.6 // 60% spacing between bars
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          const barHeight =
            (dataArrayRef.current[i] / 128) *
            (canvas.height / devicePixelRatio / 2)
          const x =
            canvas.width / devicePixelRatio -
            (dataArrayRef.current.length - i) * (barWidth + barSpacing)

          // TODO: don't hardcode colors
          canvasCtx.fillStyle = "#ff4b4b"
          canvasCtx.fillRect(
            x,
            canvas.height / devicePixelRatio / 2 - barHeight,
            barWidth,
            barHeight * 2
          )
        }

        requestAnimationFrame(draw)
      }

      draw()

      return () => {
        audioContext.close()
      }
    }
  }, [mediaStream])

  return <canvas ref={canvasRef} style={{ width: "100%", height: heightPx }} />
}

export default MediaStreamVisualizer

const AlternateMediaStreamVisualizer: React.FC<MediaStreamVisualizerProps> = ({
  mediaStream,
  heightPx,
}): ReactElement => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    if (mediaStream && canvasRef.current) {
      const audioContext = new window.AudioContext()
      const source = audioContext.createMediaStreamSource(mediaStream)
      const analyser = audioContext.createAnalyser()

      analyser.fftSize = 2048
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      source.connect(analyser)

      const canvas = canvasRef.current
      const canvasCtx = canvas.getContext("2d")

      const draw = () => {
        requestAnimationFrame(draw)

        analyser.getByteTimeDomainData(dataArray)

        if (canvasCtx) {
          canvasCtx.fillStyle = "rgb(255, 255, 255)"
          canvasCtx.fillRect(0, 0, canvas.width, canvas.height)

          canvasCtx.lineWidth = 2
          canvasCtx.strokeStyle = "#ff4b4b"

          canvasCtx.beginPath()

          const sliceWidth = (canvas.width * 1.0) / bufferLength
          let x = 0

          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0
            const y = (v * canvas.height) / 2

            if (i === 0) {
              canvasCtx.moveTo(x, y)
            } else {
              canvasCtx.lineTo(x, y)
            }

            x += sliceWidth
          }

          canvasCtx.lineTo(canvas.width, canvas.height / 2)
          canvasCtx.stroke()
        }
      }

      draw()

      return () => {
        audioContext.close()
      }
    }
  }, [mediaStream])

  return <canvas ref={canvasRef} style={{ width: "100%", height: heightPx }} />
}
