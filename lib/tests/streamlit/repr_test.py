import streamlit.util as util


def test_repr_simple_class():
    class Foo:
        def __init__(self, foo, bar=5):
            self.foo = foo
            self.bar = bar

        def __repr__(self):
            return util.repr_(self)

    foo = Foo("words")
    assert repr(foo) == "Foo(foo='words', bar=5)"


def test_repr_dict_class():
    class Foo:
        def __repr__(self):
            return util.repr_(self)

    foo = Foo()
    foo.bar = "bar"
    assert repr(foo) == "Foo(bar='bar')"
