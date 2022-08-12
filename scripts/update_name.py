#!/usr/bin/env python

"""Update project name across the entire repo"""
import fileinput
import logging
import os
import re
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Warning: Advanced regex foo.
# If another file has a project name that needs updating, add it here.
# These regex's are super greedy in that it actually matches everything
# but the project name so we can throw any string in there
PYTHON = {
    "lib/setup.py": r"(?P<pre>.*NAME = \").*(?P<post>\")",
    "lib/streamlit/__init__.py": r"(?P<pre>.*_version\(\").*(?P<post>\"\)$)",
}


def update_files(data, python=True):
    """Update files with new project name."""

    if len(sys.argv) != 2:
        e = Exception('Specify project name: "%s streamlit"' % sys.argv[0])
        raise (e)

    project_name = sys.argv[1]

    for filename, regex in data.items():
        filename = os.path.join(BASE_DIR, filename)
        matched = False
        pattern = re.compile(regex)
        for line in fileinput.input(filename, inplace=True):
            if pattern.match(line.rstrip()):
                matched = True
            line = re.sub(regex, r"\g<pre>%s\g<post>" % project_name, line.rstrip())
            print(line)
        if not matched:
            raise Exception('In file "%s", did not find regex "%s"' % (filename, regex))


def main():
    """Run main loop."""

    update_files(PYTHON)


if __name__ == "__main__":
    main()
