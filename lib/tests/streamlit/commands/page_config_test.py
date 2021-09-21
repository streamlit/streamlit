from tests import testutil
from parameterized import parameterized
import streamlit as st

from streamlit.errors import StreamlitAPIException
from streamlit.proto.PageConfig_pb2 import PageConfig as PageConfigProto
from streamlit.commands.page_config import valid_url


class PageConfigTest(testutil.DeltaGeneratorTestCase):
    def test_set_page_config_title(self):
        st.set_page_config(page_title="Hello")
        c = self.get_message_from_queue().page_config_changed
        self.assertEqual(c.title, "Hello")

    def test_set_page_config_icon(self):
        st.set_page_config(page_icon="st.balloons")
        c = self.get_message_from_queue().page_config_changed
        self.assertEqual(c.favicon, "st.balloons")

    def test_set_page_config_layout_wide(self):
        st.set_page_config(layout="wide")
        c = self.get_message_from_queue().page_config_changed
        self.assertEqual(c.layout, PageConfigProto.WIDE)

    def test_set_page_config_layout_centered(self):
        st.set_page_config(layout="centered")
        c = self.get_message_from_queue().page_config_changed
        self.assertEqual(c.layout, PageConfigProto.CENTERED)

    def test_set_page_config_layout_invalid(self):
        with self.assertRaises(StreamlitAPIException):
            st.set_page_config(layout="invalid")

    def test_set_page_config_sidebar_auto(self):
        st.set_page_config(initial_sidebar_state="auto")
        c = self.get_message_from_queue().page_config_changed
        self.assertEqual(c.initial_sidebar_state, PageConfigProto.AUTO)

    def test_set_page_config_sidebar_expanded(self):
        st.set_page_config(initial_sidebar_state="expanded")
        c = self.get_message_from_queue().page_config_changed
        self.assertEqual(c.initial_sidebar_state, PageConfigProto.EXPANDED)

    def test_set_page_config_sidebar_collapsed(self):
        st.set_page_config(initial_sidebar_state="collapsed")
        c = self.get_message_from_queue().page_config_changed
        self.assertEqual(c.initial_sidebar_state, PageConfigProto.COLLAPSED)

    def test_set_page_config_sidebar_invalid(self):
        with self.assertRaises(StreamlitAPIException) as e:
            st.set_page_config(initial_sidebar_state="INVALID")
            self.assertEquals(
                str(e),
                '`initial_sidebar_state` must be "auto" or "expanded" or "collapsed" (got "INVALID")',
            )

    def test_set_page_config_menu_items_about(self):
        menu_items = {" about": "*This is an about. This accepts markdown.*"}
        st.set_page_config(menu_items=menu_items)
        c = self.get_message_from_queue().page_config_changed.menu_items
        self.assertEqual(
            c.about_section_md, "*This is an about. This accepts markdown.*"
        )

    def test_set_page_config_menu_items_bug_and_help(self):
        menu_items = {
            "report a bug": "https://report_a_bug.com",
            "GET HELP": "https://get_help.com",
        }
        st.set_page_config(menu_items=menu_items)
        c = self.get_message_from_queue().page_config_changed.menu_items
        self.assertFalse(c.hide_report_a_bug)
        self.assertFalse(c.hide_get_help)
        self.assertEqual(c.about_section_md, "")
        self.assertEqual(c.report_a_bug_url, "https://report_a_bug.com")
        self.assertEqual(c.get_help_url, "https://get_help.com")

    def test_set_page_config_menu_items_empty_string(self):
        with self.assertRaises(StreamlitAPIException) as e:
            menu_items = {"report a bug": "", "GET HELP": "", "about": ""}
            st.set_page_config(menu_items=menu_items)
            self.assertEquals(str(e), "' ' is not a valid URL!")

    def test_set_page_config_menu_items_none(self):
        menu_items = {"report a bug": None, "GET HELP": None, "about": None}
        st.set_page_config(menu_items=menu_items)
        c = self.get_message_from_queue().page_config_changed.menu_items
        self.assertTrue(c.hide_report_a_bug)
        self.assertTrue(c.hide_get_help)
        self.assertEqual(c.about_section_md, "")

    def test_set_page_config_menu_items_invalid(self):
        with self.assertRaises(StreamlitAPIException) as e:
            menu_items = {"invalid": "fdsa"}
            st.set_page_config(menu_items=menu_items)
            self.assertEquals(
                str(e),
                "We only accept the keys: 'Get help', 'Report a bug', and 'About' ('invalid' is not a valid key.)",
            )

    def test_set_page_config_menu_items_empty_dict(self):
        st.set_page_config(menu_items={})
        c = self.get_message_from_queue().page_config_changed.menu_items
        self.assertEqual(c.about_section_md, "")

    @parameterized.expand(
        [
            ("http://www.cwi.nl:80/%7Eguido/Python.html", True),
            ("/data/Python.html", False),
            (532, False),
            ("dkakasdkjdjakdjadjfalskdjfalk", False),
            ("https://stackoverflow.com", True),
        ]
    )
    def test_valid_url(self, url, expected_value):
        if expected_value:
            self.assertTrue(valid_url(url))
        else:
            self.assertFalse(valid_url(url))
