!pip install openai langchain chromadb python-dotenv

import os
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.text_splitter import RecursiveCharacterTextSplitter

# --- Set your API Key directly (or upload .env file) ---
os.environ["OPENAI_API_KEY"] = "AIzaSyAK8ikIFnz954LwTTZO7utJ3s79yPRHiWM"

# --- Sample document ---
os.makedirs("data", exist_ok=True)
with open("data/example.txt", "w") as f:
    f.write("TCS is a leading IT services company providing digital solutions worldwide.")

# --- Load and split document ---
from langchain_community.document_loaders import DirectoryLoader
loader = DirectoryLoader("data", glob="**/*.txt")
docs = loader.load()

splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
texts = splitter.split_documents(docs)

# --- Create embeddings and store in vector DB ---
embeddings = OpenAIEmbeddings()
db = Chroma.from_documents(texts, embeddings, persist_directory="./chroma_db")
db.persist()

print("✅ Database created!")
