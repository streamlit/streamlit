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

import { execSync, spawnSync } from "child_process"
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
const pbjsCommand = [
  "yarn",
  "run",
  "--silent",
  "pbjs",
  protoGlob,
  "--path",
  protoDir,
  "-t",
  "static-module",
  "--wrap",
  "es6",
]
const pbtsCommand = ["yarn", "run", "--silent", "pbts", "proto.js"]
const TEMPLATE = "/* eslint-disable */\n\n"

const runCommand = (commandAndArgs, outputFile) => {
  const [cmd, ...args] = commandAndArgs
  const result = spawnSync(cmd, args, {
    maxBuffer: 4096 * 1024,
    encoding: "utf8",
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    // command failed, stderr should have error
    throw new Error(result.stderr)
  }

  if (result.stderr) {
    // command succeeded, but there's something in stderr (e.g. warnings)
    console.warn(`Warnings:\n${result.stderr}`)
  }

  fs.writeFileSync(outputFile, `${TEMPLATE}${result.stdout}`, "utf8")
  console.log(`Generated: ${outputFile}`)
}

// Run the commands sequentially
try {
  console.log("Generating proto.js...")
  runCommand(pbjsCommand, outputJsFile)

  console.log("Generating proto.d.ts...")
  runCommand(pbtsCommand, outputDtsFile)

  console.log("Protobuf files generated successfully!")
} catch (err) {
  console.error("Failed to generate protobuf files:", err)
  process.exit(1)
}
