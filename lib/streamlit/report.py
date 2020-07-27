# Copyright 2018-2020 Streamlit Inc.
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

import base58
import copy
import os
import uuid
from typing import Any, Dict

from streamlit import config
from streamlit.report_queue import ReportQueue
from streamlit import net_util

from streamlit.logger import get_logger
from streamlit.proto.StaticManifest_pb2 import StaticManifest

LOGGER = get_logger(__name__)


class Report(object):
    """
    Contains parameters related to running a report, and also houses
    the two ReportQueues (master_queue and browser_queue) that are used
    to deliver messages to a connected browser, and to serialize the
    running report.
    """

    @classmethod
    def get_url(cls, host_ip):
        """Get the URL for any app served at the given host_ip.

        Parameters
        ----------
        host_ip : str
            The IP address of the machine that is running the Streamlit Server.

        Returns
        -------
        str
            The URL.
        """
        port = _get_browser_address_bar_port()
        base_path = config.get_option("server.baseUrlPath").strip("/")

        if base_path:
            base_path = "/" + base_path

        return "http://%(host_ip)s:%(port)s%(base_path)s" % {
            "host_ip": host_ip.strip("/"),
            "port": port,
            "base_path": base_path,
        }

    def __init__(self, script_path, command_line):
        """Constructor.

        Parameters
        ----------
        script_path : str
            Path of the Python file from which this app is generated.

        command_line : string
            Command line as input by the user

        """
        basename = os.path.basename(script_path)

        self.script_path = os.path.abspath(script_path)
        self.script_folder = os.path.dirname(self.script_path)
        self.name = os.path.splitext(basename)[0]

        # The master queue contains all messages that comprise the report.
        # If the user chooses to share a saved version of the report,
        # we serialize the contents of the master queue.
        self._master_queue = ReportQueue()

        # The browser queue contains messages that haven't yet been
        # delivered to the browser. Periodically, the server flushes
        # this queue and delivers its contents to the browser.
        self._browser_queue = ReportQueue()

        self.generate_new_id()

        self.command_line = command_line

    def get_debug(self) -> Dict[str, Dict[str, Any]]:
        return {"master queue": self._master_queue.get_debug()}

    def enqueue(self, msg):
        self._master_queue.enqueue(msg)
        self._browser_queue.enqueue(msg)

    def clear(self):
        # Master_queue retains its initial message; browser_queue is
        # completely cleared.
        initial_msg = self._master_queue.get_initial_msg()
        self._master_queue.clear()
        if initial_msg:
            self._master_queue.enqueue(initial_msg)

        self._browser_queue.clear()

    def flush_browser_queue(self):
        """Clears our browser queue and returns the messages it contained.

        The Server calls this periodically to deliver new messages
        to the browser connected to this report.

        This doesn't affect the master_queue.

        Returns
        -------
        list[ForwardMsg]
            The messages that were removed from the queue and should
            be delivered to the browser.

        """
        return self._browser_queue.flush()

    def generate_new_id(self) -> None:
        """Randomly generate an ID representing this report's execution."""
        self.report_id = base58.b58encode(uuid.uuid4().bytes).decode()

    def serialize_running_report_to_files(self):
        """Return a running report as an easily-serializable list of tuples.

        Returns
        -------
        list of tuples
            See `CloudStorage.save_report_files()` for schema. But as to the
            output of this method, it's just a manifest pointing to the Server
            so browsers who go to the shareable report URL can connect to it
            live.

        """
        LOGGER.debug("Serializing running report")

        manifest = self._build_manifest(
            status=StaticManifest.RUNNING,
            external_server_ip=net_util.get_external_ip(),
            internal_server_ip=net_util.get_internal_ip(),
        )

        return [
            ("reports/%s/manifest.pb" % self.report_id, manifest.SerializeToString())
        ]

    def serialize_final_report_to_files(self):
        """Return the report as an easily-serializable list of tuples.

        Returns
        -------
        list of tuples
            See `CloudStorage.save_report_files()` for schema. But as to the
            output of this method, it's (1) a simple manifest and (2) a bunch
            of serialized ForwardMsgs.

        """
        LOGGER.debug("Serializing final report")

        messages = [
            copy.deepcopy(msg)
            for msg in self._master_queue
            if _should_save_report_msg(msg)
        ]

        manifest = self._build_manifest(
            status=StaticManifest.DONE, num_messages=len(messages)
        )

        # Build a list of message tuples: (message_location, serialized_message)
        message_tuples = [
            (
                "reports/%(id)s/%(idx)s.pb" % {"id": self.report_id, "idx": msg_idx},
                msg.SerializeToString(),
            )
            for msg_idx, msg in enumerate(messages)
        ]

        manifest_tuples = [
            (
                "reports/%(id)s/manifest.pb" % {"id": self.report_id},
                manifest.SerializeToString(),
            )
        ]

        # Manifest must be at the end, so clients don't connect and read the
        # manifest while the deltas haven't been saved yet.
        return message_tuples + manifest_tuples

    def _build_manifest(
        self,
        status,
        num_messages=None,
        external_server_ip=None,
        internal_server_ip=None,
    ):
        """Build a manifest dict for this report.

        Parameters
        ----------
        status : StaticManifest.ServerStatus
            The report status. If the script is still executing, then the
            status should be RUNNING. Otherwise, DONE.
        num_messages : int or None
            Set only when status is DONE. The number of ForwardMsgs that this report
            is made of.
        external_server_ip : str or None
            Only when status is RUNNING. The IP of the Server's websocket.
        internal_server_ip : str or None
            Only when status is RUNNING. The IP of the Server's websocket.

        Returns
        -------
        StaticManifest
            A StaticManifest protobuf message

        """

        manifest = StaticManifest()
        manifest.name = self.name
        manifest.server_status = status

        if status == StaticManifest.RUNNING:
            manifest.external_server_ip = external_server_ip
            manifest.internal_server_ip = internal_server_ip
            manifest.configured_server_address = config.get_option(
                "browser.serverAddress"
            )
            # Don't use _get_browser_address_bar_port() here, since we want the
            # websocket port, not the web server port. (These are the same in
            # prod, but different in dev)
            manifest.server_port = config.get_option("browser.serverPort")
            manifest.server_base_path = config.get_option("server.baseUrlPath")
        else:
            manifest.num_messages = num_messages

        return manifest


def _should_save_report_msg(msg):
    """Returns True if the given ForwardMsg should be serialized into
    a shared report.

    We serialize report & session metadata and deltas, but not transient
    events such as upload progress.

    """

    msg_type = msg.WhichOneof("type")
    return msg_type == "initialize" or msg_type == "new_report" or msg_type == "delta"


def _get_browser_address_bar_port():
    """Get the report URL that will be shown in the browser's address bar.

    That is, this is the port where static assets will be served from. In dev,
    this is different from the URL that will be used to connect to the
    server-browser websocket.

    """
    if config.get_option("global.developmentMode"):
        return 3000
    return config.get_option("browser.serverPort")
