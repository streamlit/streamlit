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

import { exec, execSync } from "child_process"
import fs from "fs"
import path from "path"

// Paths
const gitRoot = execSync("git rev-parse --show-toplevel", {
  encoding: "utf8",
}).trim()
const protoDir = path.join(gitRoot, "proto")
const protoGlob = path.join(protoDir, "streamlit/proto/*.proto")
console.log(`Proto files: ${protoGlob}`)
const outputJsFile = "proto.js"
const outputDtsFile = "proto.d.ts"

// Commands to run
const pbjsCommand = `yarn run --silent pbjs ${protoGlob} --path ${protoDir} -t static-module --wrap es6`
const pbtsCommand = `yarn run --silent pbts proto.js`
const TEMPLATE = "/* eslint-disable */\n\n"

const runCommand = (command, outputFile) => {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 4096 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`)
        reject(error)
        return
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`)
      }
      fs.writeFileSync(outputFile, `${TEMPLATE}${stdout}`, "utf8")
      console.log(`Generated: ${outputFile}`)
      resolve()
    })
  })
}

// Run the commands sequentially
;(async () => {
  try {
    console.log("Generating proto.js...")
    await runCommand(pbjsCommand, outputJsFile)

    console.log("Generating proto.d.ts...")
    await runCommand(pbtsCommand, outputDtsFile)

    console.log("Protobuf files generated successfully!")
  } catch (err) {
    console.error("Failed to generate protobuf files:", err)
    process.exit(1)
  }
})()
