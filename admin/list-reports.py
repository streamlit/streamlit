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
            st.write('- [`%s`](http://share.streamlit.io/%s/index.html?id=%s) (`%s`) (%s)' % \
                (id, version, id, version, date))
    except ValueError:
        st.warning('Trouble parsing "%s".' % line)
