# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

{ pkgs ? import <nixpkgs> {
  overlays = [(
    self: super: {
      yarn = super.yarn.override {
        nodejs = pkgs.nodejs-16_x;
      };
    }
  )];
} }:
pkgs.mkShell {

  buildInputs = [
    pkgs.python39
    pkgs.python39Packages.virtualenv
    pkgs.nodejs-16_x
    pkgs.yarn
    pkgs.protobuf
    pkgs.mypy-protobuf
    pkgs.graphviz
    pkgs.gawk
    pkgs.mysql
    pkgs.libmysqlclient
    pkgs.pipenv
    pkgs.postgresql
    pkgs.pre-commit
  ];

}
