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

import React, { useEffect, useRef, useState } from "react"
import WaveSurfer from "wavesurfer.js"
import RecordPlugin from "wavesurfer.js/dist/plugins/record"

const NewWaveSurfer: React.FC = () => {
  const scrollingWaveform = true
  const [wavesurfer, setWaveSurfer] = useState<WaveSurfer | null>(null)
  const [recordPlugin, setRecordPlugin] = useState<RecordPlugin | null>(null)

  const [progressTime, setProgressTime] = useState<string>("00:00")
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [, setRerender] = useState(0)

  const forceRerender = () => {
    setRerender(prev => prev + 1)
  }

  const waveSurferRef = useRef<HTMLDivElement | null>(null)
  const playButtonRef = useRef<HTMLButtonElement | null>(null)
  const downloadLinkRef = useRef<HTMLAnchorElement | null>(null)

  const [availableAudioDevices, setAvailableAudioDevices] = useState<
    MediaDeviceInfo[]
  >([])
  const [activeAudioDeviceId, setActiveAudioDeviceId] = useState<
    string | null
  >(null)
  const [downloadFilename, setDownloadFilename] = useState<string | null>(null)

  useEffect(() => {
    RecordPlugin.getAvailableAudioDevices().then(devices => {
      setAvailableAudioDevices(devices)
      if (devices.length > 0) {
        setActiveAudioDeviceId(devices[0].deviceId)
      }
    })
  }, [])

  useEffect(() => {
    const createWaveSurfer = () => {
      if (waveSurferRef.current === null) {
        return
      }

      if (wavesurfer) {
        wavesurfer.destroy()
      }

      const ws = WaveSurfer.create({
        container: waveSurferRef.current,
        waveColor: "#FF4B4B",
        progressColor: "#8d1515",
      })

      const recordPlugin = ws.registerPlugin(
        RecordPlugin.create({ scrollingWaveform, renderRecordedAudio: true })
      )

      recordPlugin.on("record-end", blob => {
        const url = URL.createObjectURL(blob)
        console.log({ blob })
        setRecordingUrl(url)
        setDownloadFilename(blob.type.split(";")[0].split("/")[1] || "webm")

        if (downloadLinkRef.current) {
          downloadLinkRef.current.style.display = "inline"
          downloadLinkRef.current.href = url
          downloadLinkRef.current.download =
            "recording." + blob.type.split(";")[0].split("/")[1] || "webm"
        }
      })

      recordPlugin.on("record-progress", time => {
        updateProgress(time)
      })

      setWaveSurfer(ws)
      setRecordPlugin(recordPlugin)
    }

    const updateProgress = (time: number) => {
      const formattedTime = [
        Math.floor((time % 3600000) / 60000), // minutes
        Math.floor((time % 60000) / 1000), // seconds
      ]
        .map(v => (v < 10 ? "0" + v : v))
        .join(":")
      setProgressTime(formattedTime)
    }

    createWaveSurfer()

    return () => {
      if (wavesurfer) {
        wavesurfer.destroy()
      }
    }
  }, [])

  const handlePause = () => {
    if (!recordPlugin) {
      return
    }

    if (recordPlugin.isPaused()) {
      recordPlugin.resumeRecording()
    } else {
      recordPlugin.pauseRecording()
    }
  }

  const handleRecord = () => {
    if (!recordPlugin || !activeAudioDeviceId) {
      return
    }

    if (recordPlugin.isRecording() || recordPlugin.isPaused()) {
      recordPlugin.stopRecording()
    } else {
      const deviceId = activeAudioDeviceId
      if (deviceId == null) {
        return
      }

      recordPlugin
        .startRecording({ deviceId: activeAudioDeviceId })
        .then(() => {
          forceRerender()
          // Update the record button to show the user that they can stop recording
        })

      // if (playButtonRef.current) {
      //   playButtonRef.current.style.display = "none"
      // }
      // if (downloadLinkRef.current) {
      //   downloadLinkRef.current.style.display = "none"
      // }
    }
  }

  // const handlePlayPause = () => {
  //   if (wavesurfer) {
  //     wavesurfer.playPause()
  //   }
  // }

  return (
    <div style={{ height: 400 }}>
      {/* <button id="record" onClick={handleRecord}>
        {recordPlugin && recordPlugin.isRecording() ? "Stop" : "Record"}
      </button>
      <button onClick={handlePause}>
        {recordPlugin && recordPlugin.isPaused() ? "Resume" : "Pause"}
      </button>
      <select
        onChange={e => setActiveAudioDeviceId(e.target.value)}
        id="mic-select"
      >
        {availableAudioDevices.map(device => (
          <option value={device.deviceId}>{device.label}</option>
        ))}
      </select> */}
      <p id="progress">{progressTime}</p>
      <div
        ref={waveSurferRef}
        style={
          {
            // border: "1px solid #ddd",
            // borderRadius: "4px",
            // marginTop: "1rem",
          }
        }
      ></div>
      {/* <button
        ref={playButtonRef}
        onClick={handlePlayPause}
        style={{ display: "none" }}
      >
        Play
      </button> */}
      {/* {recordingUrl && (
        <a
          ref={downloadLinkRef}
          download={downloadFilename}
          href={recordingUrl}
        >
          Download recording
        </a>
      )} */}
    </div>
  )
}

export default NewWaveSurfer
