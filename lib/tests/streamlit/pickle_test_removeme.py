import pickle
import unittest
from typing import Any

import pandas as pd
import numpy as np

from streamlit.uploaded_file_manager import UploadedFile, UploadedFileRec


def _serialize(obj: Any) -> bytes:
    return pickle.dumps(obj)


def _deserialize(pickled: bytes) -> Any:
    return pickle.loads(pickled)


def _roundtrip(obj: Any) -> Any:
    return _deserialize(_serialize(obj))


class PickleTest(unittest.TestCase):
    def test_primitives(self):
        self.assertEqual(None, _roundtrip(None))
        self.assertEqual(True, _roundtrip(True))
        self.assertEqual(False, _roundtrip(False))
        self.assertEqual(3.14, _roundtrip(3.14))
        self.assertEqual("Ahoy", _roundtrip("Ahoy"))
        self.assertEqual(b"12345", _roundtrip(b"12345"))
        self.assertEqual([], _roundtrip([]))
        self.assertEqual({}, _roundtrip({}))
        self.assertEqual(["a", 4, {}], _roundtrip(["a", 4, {}]))

    def test_list_self_reference(self):
        orig = [1, 2]
        orig.append(orig)
        copy = _roundtrip(orig)
        self.assertEqual(len(orig), len(copy))
        self.assertEqual(orig[:-1], copy[:-1])
        self.assertIs(copy[-1], copy)

    def test_dataframe(self):
        orig = pd.DataFrame(
            [["A", "B", "C", "D"], [28, 55, 43, 91]], index=["a", "b"]
        ).T
        copy = _roundtrip(orig)
        self.assertEqual(type(orig), type(copy))
        self.assertTrue(orig.equals(copy))

    def test_numpy(self):
        orig = np.ndarray(shape=(1, 2, 2))
        copy = _roundtrip(orig)
        self.assertEqual(type(orig), type(copy))
        self.assertTrue(np.array_equal(orig, copy))

    def test_uploaded_file(self):
        orig = UploadedFile(
            UploadedFileRec(id=1, name="foo", type="type", data=b"3214")
        )
        copy = _roundtrip(orig)
        self.assertEqual(type(orig), type(copy))
        self.assertEqual(orig.id, copy.id)
        self.assertEqual(orig.name, copy.name)
        self.assertEqual(orig.type, copy.type)
        self.assertEqual(orig.size, copy.size)
        self.assertEqual(orig.read(), copy.read())
