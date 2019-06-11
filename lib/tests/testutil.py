# Copyright 2019 Streamlit Inc. All rights reserved.

"""Utility functions to use in our tests."""

import unittest

import streamlit as st
from streamlit import config
from streamlit.DeltaGenerator import DeltaGenerator
from streamlit.ReportQueue import ReportQueue

def build_mock_config_get_option(overrides_dict):
    orig_get_option = config.get_option

    def mock_config_get_option(name):
        if name in overrides_dict:
            return overrides_dict[name]
        return orig_get_option(name)

    return mock_config_get_option


def build_mock_config_is_manually_set(overrides_dict):
    orig_is_manually_set = config.is_manually_set

    def mock_config_is_manually_set(name):
        if name in overrides_dict:
            return overrides_dict[name]
        return orig_is_manually_set(name)

    return mock_config_is_manually_set


class DeltaGeneratorTestCase(unittest.TestCase):
    def setUp(self, override_root=True):
        self.report_queue = ReportQueue()

        if override_root:
            st._delta_generator = self.new_delta_generator()

    def tearDown(self):
        self.report_queue._clear()

    def new_delta_generator(self, *args, **kwargs):
        def enqueue_fn(msg):
            self.report_queue.enqueue(msg)
            return True

        if len(args) > 0:
            enqueue = args[0]
            args = args[1:]
        elif 'enqueue' in kwargs:
            enqueue = kwargs.pop('enqueue')
        else:
            enqueue = enqueue_fn

        return DeltaGenerator(enqueue, *args, **kwargs)

    def get_message_from_queue(self, index=-1):
        return self.report_queue._queue[index]

    def get_delta_from_queue(self, index=-1):
        return self.report_queue._queue[index].delta
