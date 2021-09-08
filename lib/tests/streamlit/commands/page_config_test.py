from tests import testutil
import streamlit as st

from streamlit.errors import StreamlitAPIException
from streamlit.proto.PageConfig_pb2 import PageConfig as PageConfigProto


class PageConfigTest(testutil.DeltaGeneratorTestCase):
    def test_set_page_config_title(self):
        st.set_page_config(page_title="Hello")
        c = self.get_message_from_queue().page_config_changed
        self.assertEqual(c.title, "Hello")

    def test_set_page_config_icon(self):
        st.set_page_config(page_icon="st.balloons")
        c = self.get_message_from_queue().page_config_changed
        print(f"{c}")
        self.assertEqual(c.favicon, "st.balloons")

    def test_set_page_config_layout_wide(self):
        st.set_page_config(layout="wide")
        c = self.get_message_from_queue().page_config_changed
        print(f"{c}")
        self.assertEqual(c.layout, PageConfigProto.WIDE)

    def test_set_page_config_layout_centered(self):
        st.set_page_config(layout="centered")
        c = self.get_message_from_queue().page_config_changed
        print(f"{c}")
        self.assertEqual(c.layout, PageConfigProto.CENTERED)

    def test_set_page_config_layout_invalid(self):
        with self.assertRaises(StreamlitAPIException):
            st.set_page_config(layout="invalid")

    def test_set_page_config_sidebar_auto(self):
        st.set_page_config(initial_sidebar_state="auto")
        c = self.get_message_from_queue().page_config_changed
        print(f"{c}")
        self.assertEqual(c.initial_sidebar_state, PageConfigProto.AUTO)

    def test_set_page_config_sidebar_expanded(self):
        st.set_page_config(initial_sidebar_state="expanded")
        c = self.get_message_from_queue().page_config_changed
        print(f"{c}")
        self.assertEqual(c.initial_sidebar_state, PageConfigProto.EXPANDED)

    def test_set_page_config_sidebar_collapsed(self):
        st.set_page_config(initial_sidebar_state="collapsed")
        c = self.get_message_from_queue().page_config_changed
        print(f"{c}")
        self.assertEqual(c.initial_sidebar_state, PageConfigProto.COLLAPSED)

    def test_set_page_config_sidebar_invalid(self):
        with self.assertRaises(StreamlitAPIException):
            st.set_page_config(initial_sidebar_state="INVALID")

    def test_set_page_config_menu_options_about(self):
        menu_options = {" about": "*This is an about. This accepts markdown.*"}
        st.set_page_config(menu_options=menu_options)
        c = self.get_message_from_queue().page_config_changed.menu_options
        print(f"{c}")
        self.assertEqual(
            c.about_section_md, "*This is an about. This accepts markdown.*"
        )

    def test_set_page_config_menu_options_bug_and_help(self):
        menu_options = {"report a bug": "google.com", "GET HELP": "linkedin.com"}
        st.set_page_config(menu_options=menu_options)
        c = self.get_message_from_queue().page_config_changed.menu_options
        print(f"{c}")
        self.assertFalse(c.hide_report_a_bug)
        self.assertFalse(c.hide_get_help)
        self.assertEqual(c.about_section_md, "")
        self.assertEqual(c.report_a_bug_url, "http://www.google.com")
        self.assertEqual(c.get_help_url, "http://www.linkedin.com")

    def test_set_page_config_menu_options_empty_string(self):
        menu_options = {"report a bug": "", "GET HELP": "", "about": ""}
        st.set_page_config(menu_options=menu_options)
        c = self.get_message_from_queue().page_config_changed.menu_options
        print(f"{c}")
        self.assertTrue(c.hide_report_a_bug)
        self.assertTrue(c.hide_get_help)
        self.assertEqual(c.about_section_md, "")

    def test_set_page_config_menu_options_none(self):
        menu_options = {"report a bug": None, "GET HELP": None, "about": None}
        st.set_page_config(menu_options=menu_options)
        c = self.get_message_from_queue().page_config_changed.menu_options
        print(f"{c}")
        self.assertTrue(c.hide_report_a_bug)
        self.assertTrue(c.hide_get_help)
        self.assertEqual(c.about_section_md, "")

    def test_set_page_config_menu_options_invalid(self):
        menu_options = {"fdsafdsafdsa": "fdsa"}
        st.set_page_config(menu_options=menu_options)
        c = self.get_message_from_queue().page_config_changed.menu_options
        print(f"{type(c)}")
        self.assertEqual(c.about_section_md, "")
