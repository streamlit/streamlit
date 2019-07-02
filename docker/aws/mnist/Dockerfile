FROM streamlit/streamlit:0.42.0

RUN pip install keras tensorflow

COPY credentials.toml config.toml /root/.streamlit/
COPY mnist-cnn.py /mnist-cnn.py
ENTRYPOINT ["streamlit", "run", "/mnist-cnn.py"]
