ARG STREAMLIT_VERSION
FROM streamlit/streamlit:${STREAMLIT_VERSION}
ENV PYTHONUNBUFFERED 1

RUN pip uninstall -y streamlit
RUN pip install --upgrade ./my_streamlit.whl

ENTRYPOINT ["streamlit", "run"]
