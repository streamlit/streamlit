from langchain.chains import RetrievalQA
from langchain_openai import ChatOpenAI

db = Chroma(persist_directory="./chroma_db", embedding_function=embeddings)
retriever = db.as_retriever(search_kwargs={"k": 2})

qa = RetrievalQA.from_chain_type(llm=ChatOpenAI(model="gpt-4o-mini"), retriever=retriever)
print(qa.invoke("What is TCS known for?")["result"])
