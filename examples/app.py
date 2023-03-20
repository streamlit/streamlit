#LIBRARIES
from faker import Faker
import random
import pandas as pd
from sqlalchemy import create_engine
import mysql.connector 
from mysql.connector import Error
import streamlit as st

#PAGE CONFIG PARAMETERS
st.set_page_config(layout="centered")

#EASY LOGO AND TITLE
col1, col2, col3 = st.columns(3)
with col1:
    st.write(' ')
with col2:
    st.image("https://maia.run/wp-content/uploads/2022/12/Emblema-MAIA-DIAPO-BLANCO-RGB-150x150.png", width = 101)
with col3:
    st.write(' ')
st.title('Creating Fake People APP')


#FAKE ID'S CREATION
fake = Faker()
data = []
numbers= st.number_input("Number of users needed? Press enter to apply",min_value=0, max_value=10000000,step=1)

for i in range(0, numbers):
    data.append({
        'name': fake.name(),
        'email': fake.email(),
        'address': fake.address(),
        'phone_number': fake.phone_number(),
        'city': fake.city(),
        'state': fake.state(), 
        'zip_code': fake.zipcode(),
        'job': fake.job(),
        'card_number': fake.credit_card_number(),
        'card_ssn': fake.ssn(),
        'score' : random.choice(range(100)),
        'date' : fake.date(pattern="%Y-%m-%d", end_datetime=None),
        'bank' : fake.credit_card_provider(card_type=None)      
        }) 
    
    
#FAKE DF CREATION
count = numbers
st.dataframe(data[:count])
df = pd.DataFrame(data[:count])

#OPTION TO DOWNLOAD DATAFRAME IN CSV
st.subheader('Download the table')
csv_download = st.button("Create your DATA")
if csv_download:
    output = df.to_csv(index_label = False) 
    st.download_button(
        label = "Download CSV file", 
        data = output, 
        file_name = "data.csv",
        mime = "text/csv"
        )
    
#DB INPUTS
st.title("Database Connection")
host = st.text_input("Host: ")
database = st.text_input("Database: ")
user = st.text_input("User: ")
password = st.text_input("Password: ")

#BUTTON CHECKER 
if st.button("Connect"):
    try:
        connection = mysql.connector.connect(host=host, database=database, user=user, password=password, connection_timeout=180)
        cursor=connection.cursor()
        st.success("You are now connected to the database!")
    except:
        st.write("Conection dont stabilished, verify the information, database is running?")

#TABLE CREATION
tablename = st.text_input("Enter Table Name to create")
if st.button('Create Table'):
	st.write('Table Created Successfully')
	testDF = """CREATE TABLE IF NOT EXISTS {} (    name VARCHAR(255),	email VARCHAR(255),	address VARCHAR(255),	phone_number VARCHAR(16),	city VARCHAR(255),	state VARCHAR(255),	zip_code VARCHAR(16),	job VARCHAR(255),	card_number VARCHAR(64),	card_ssn VARCHAR(32),	score SMALLINT,	transaction_date DATETIME,	bank_name VARCHAR(64))""".format(tablename)
	connection = mysql.connector.connect(host=host, database=database, user=user, password=password, connection_timeout=180)
	cursor=connection.cursor()
	cursor.execute(testDF)
	connection.commit()

#DF TO SQL
def sql_df_upload(df):
    connection = mysql.connector.connect(host=host, database=database, user=user, password=password, connection_timeout=180)
    cursor=connection.cursor()     
    for index, row in df.iterrows():
        sql = "INSERT INTO {} (name, email, address, phone_number, city, state, zip_code, job, card_number, card_ssn, score, transaction_date, bank_name ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)" .format(tablename)
        cursor.execute(sql, tuple(row))
        connection.commit()
    connection.close()
    print("Upload complete")

#BUTTON TO PUSH TO SQL
st.text("Push ur Data to the Table on the db")
if st.button("Push to DB"):
    sql_df_upload(df)
    st.success('Upload to DB complete!')

