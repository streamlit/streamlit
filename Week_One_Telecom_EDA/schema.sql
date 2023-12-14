--
-- PostgreSQL database dump
--

-- Dumped from database version 14.10 (Ubuntu 14.10-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.10 (Ubuntu 14.10-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: xdr_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.xdr_data (
    "Bearer Id" double precision,
    "Start" text,
    "Start ms" double precision,
    "End" text,
    "End ms" double precision,
    "Dur. (ms)" double precision,
    "IMSI" double precision,
    "MSISDN/Number" double precision,
    "IMEI" double precision,
    "Last Location Name" text,
    "Avg RTT DL (ms)" double precision,
    "Avg RTT UL (ms)" double precision,
    "Avg Bearer TP DL (kbps)" double precision,
    "Avg Bearer TP UL (kbps)" double precision,
    "TCP DL Retrans. Vol (Bytes)" double precision,
    "TCP UL Retrans. Vol (Bytes)" double precision,
    "DL TP < 50 Kbps (%)" double precision,
    "50 Kbps < DL TP < 250 Kbps (%)" double precision,
    "250 Kbps < DL TP < 1 Mbps (%)" double precision,
    "DL TP > 1 Mbps (%)" double precision,
    "UL TP < 10 Kbps (%)" double precision,
    "10 Kbps < UL TP < 50 Kbps (%)" double precision,
    "50 Kbps < UL TP < 300 Kbps (%)" double precision,
    "UL TP > 300 Kbps (%)" double precision,
    "HTTP DL (Bytes)" double precision,
    "HTTP UL (Bytes)" double precision,
    "Activity Duration DL (ms)" double precision,
    "Activity Duration UL (ms)" double precision,
    "Dur. (ms).1" double precision,
    "Handset Manufacturer" text,
    "Handset Type" text,
    "Nb of sec with 125000B < Vol DL" double precision,
    "Nb of sec with 1250B < Vol UL < 6250B" double precision,
    "Nb of sec with 31250B < Vol DL < 125000B" double precision,
    "Nb of sec with 37500B < Vol UL" double precision,
    "Nb of sec with 6250B < Vol DL < 31250B" double precision,
    "Nb of sec with 6250B < Vol UL < 37500B" double precision,
    "Nb of sec with Vol DL < 6250B" double precision,
    "Nb of sec with Vol UL < 1250B" double precision,
    "Social Media DL (Bytes)" double precision,
    "Social Media UL (Bytes)" double precision,
    "Google DL (Bytes)" double precision,
    "Google UL (Bytes)" double precision,
    "Email DL (Bytes)" double precision,
    "Email UL (Bytes)" double precision,
    "Youtube DL (Bytes)" double precision,
    "Youtube UL (Bytes)" double precision,
    "Netflix DL (Bytes)" double precision,
    "Netflix UL (Bytes)" double precision,
    "Gaming DL (Bytes)" double precision,
    "Gaming UL (Bytes)" double precision,
    "Other DL (Bytes)" double precision,
    "Other UL (Bytes)" double precision,
    "Total UL (Bytes)" double precision,
    "Total DL (Bytes)" double precision
);


ALTER TABLE public.xdr_data OWNER TO postgres;

--
-- PostgreSQL database dump complete
--

