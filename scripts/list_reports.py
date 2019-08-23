#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Lists all the reports in share.streamlit.io.
"""

import streamlit as st
import subprocess, re

st.title('All Reports')
BUCKET = 'share.streamlit.io'
COMMAND = ['aws', 's3', 'ls', '--recursive', 's3://%s/' % BUCKET]

# this is what a report manifest looks likely
REPORT_MANIFEST = re.compile(r'(?P<version>\d+\.\d+\.\d+\-([a-zA-Z0-9]{1,8}))/reports/(?P<id>[a-zA-Z0-9]{15,25})/manifest\.json')
"0.14.0-22mjb/reports/7aT29q3YdErJPRaCS629bT/manifest.json"

process = subprocess.Popen(COMMAND,
    stdout=subprocess.PIPE, stderr=subprocess.PIPE)

for line in process.stdout.readlines():
    try:
        date, time, size, filename = line.decode('utf-8').strip().split()
        match = REPORT_MANIFEST.match(filename)
        if match:
            id, version = match.group('id'), match.group('version')
            st.write('- [`%s`](https://share.streamlit.io/%s/index.html?id=%s) (`%s`) (%s)' % \
                (id, version, id, version, date))
    except ValueError:
        st.warning('Trouble parsing "%s".' % line)
