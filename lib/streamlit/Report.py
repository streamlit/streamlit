# Copyright 2019 Streamlit Inc. All rights reserved.
# -*- coding: utf-8 -*-

import base58
import json
import os
import uuid

from streamlit import config
from streamlit.ReportQueue import ReportQueue
from streamlit import util

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


class Report(object):
    def __init__(self, script_path, argv):
        """Constructor.

        Parameters
        ----------
        script_path : str
            Path of the Python file from which this report is generated.

        argv : list of str
            Command-line arguments to run the script with.

        """
        basename = os.path.basename(script_path)

        self.script_path = script_path
        self.argv = argv
        self.name = os.path.splitext(basename)[0]

        # Keep the master queue private because the way we clear the master
        # queue is different from how we clear each browser-queue. The master
        # queue needs to keep the initialization message even when you clear
        # it.
        self._master_queue = ReportQueue()
        self._latest_id = None

        self.generate_new_id()

    def enqueue(self, msg):
        self._master_queue.enqueue(msg)

    def clear(self):
        initial_msg = self._master_queue.get_initial_msg()

        self._master_queue.clear()

        if initial_msg:
            self._master_queue.enqueue(initial_msg)

    def clone_queue(self):
        return self._master_queue.clone()

    def generate_new_id(self):
        """Randomly generate an ID representing this report's execution."""
        # Convert to str for Python2
        id = str(base58.b58encode(uuid.uuid4().bytes).decode("utf-8"))
        self._latest_id = id
        return id

    def serialize_running_report_to_files(self):
        """Return a running report as an easily-serializable list of tuples.

        Returns
        -------
        list of tuples
            See `CloudStorage.save_report_files()` for schema. But as to the
            output of this method, it's just a manifest pointing to the Proxy
            so browsers who go to the shareable report URL can connect to it
            live.

        """
        LOGGER.debug('Serializing running report')

        manifest = self._build_manifest(
            status='running',
            external_proxy_ip=util.get_external_ip(),
            internal_proxy_ip=util.get_internal_ip(),
        )

        manifest_json = json.dumps(manifest).encode('utf-8')

        return [(
            'reports/%s/manifest.json' % self._latest_id,
            manifest_json
        )]

    def serialize_final_report_to_files(self):
        """Return the report as an easily-serializable list of tuples.

        Returns
        -------
        list of tuples
            See `CloudStorage.save_report_files()` for schema. But as to the
            output of this method, it's (1) a simple manifest and (2) a bunch
            of serialized Deltas.

        """
        LOGGER.debug('Serializing final report')

        deltas = [
            msg.delta for msg in self._master_queue
            if msg.HasField('delta')
        ]

        manifest = self._build_manifest(
            status='done',
            n_deltas=len(deltas),
        )

        manifest_json = json.dumps(manifest).encode('utf-8')

        id = self._latest_id

        delta_tuples = [(
            'reports/%(id)s/%(idx)s.delta' % {'id': id, 'idx': idx},
            delta.SerializeToString()
        ) for idx, delta in enumerate(deltas)]

        manifest_tuples = [(
            'reports/%(id)s/manifest.json' % {'id': id}, manifest_json)]

        # Manifest must be at the end, so clients don't connect and read the
        # manifest while the deltas haven't been saved yet.
        return delta_tuples + manifest_tuples

    def _build_manifest(
            self, status, n_deltas=None, external_proxy_ip=None,
            internal_proxy_ip=None):
        """Build a manifest dict for this report.

        Parameters
        ----------
        status : 'done' or 'running'
            The report status. If the script is still executing, then the
            status should be RUNNING. Otherwise, DONE.
        n_deltas : int or None
            Only when status is DONE. The number of deltas that this report
            is made of.
        external_proxy_ip : str or None
            Only when status is RUNNING. The IP of the Proxy's websocket.
        internal_proxy_ip : str or None
            Only when status is RUNNING. The IP of the Proxy's websocket.

        Returns
        -------
        dict
            The actual manifest. Schema:
            - name: str,
            - localId: str,
            - nDeltas: int or None,
            - proxyStatus: 'running' or 'done',
            - externalProxyIP: str or None,
            - internalProxyIP: str or None,
            - proxyPort: int

        """
        if status == 'running':
            configured_proxy_address = (
                config.get_option('browser.proxyAddress'))
        else:
            configured_proxy_address = None

        return dict(
            name=self.name,
            nDeltas=n_deltas,
            proxyStatus=status,
            configuredProxyAddress=configured_proxy_address,
            externalProxyIP=external_proxy_ip,
            internalProxyIP=internal_proxy_ip,
            # Don't use _get_browser_address_bar_port() here, since we want the
            # websocket port, not the web server port. (These are the same in
            # prod, but different in dev)
            proxyPort=config.get_option('browser.proxyPort'),
        )
