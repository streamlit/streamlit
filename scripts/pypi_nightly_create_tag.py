#!/usr/bin/env python

"""Create a tag for the PYPI nightly version

Increment the version number, add a dev suffix and add todays date
"""
import packaging.version
import pytz
import sys

from datetime import datetime

import streamlit.version


def create_tag():
    """Create tag with updated version, a suffix and date."""

    # Get latest version
    current_version = streamlit.version._get_latest_streamlit_version()

    # Update micro
    version_with_inc_micro = (
        current_version.major,
        current_version.minor,
        current_version.micro + 1,
    )

    # Append todays date
    version_with_date = (
        ".".join([str(x) for x in version_with_inc_micro])
        + ".dev"
        + datetime.now(pytz.timezone("US/Pacific")).strftime("%Y%m%d")
    )

    # Verify if version is PEP440 compliant.
    packaging.version.Version(version_with_date)

    return version_with_date


if __name__ == "__main__":
    tag = create_tag()

    # Print so we can access the tag in the shell
    print(tag)
