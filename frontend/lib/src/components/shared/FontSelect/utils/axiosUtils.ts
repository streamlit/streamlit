/**
 * @file This module sets up Axios instances for making HTTP requests.
 */
import axios, { AxiosInstance, AxiosRequestConfig } from "axios"

/**
 * Configuration for Webfont Axios instance.
 */
export const webfontAxiosConfig: AxiosRequestConfig = {
  withCredentials: false,
}

/**
 * Axios instance for fetching web fonts.
 */
export const WebfontAxios: AxiosInstance = axios.create(webfontAxiosConfig)

/**
 * Configuration for Font Family Axios instance.
 */
export const fontFamilyAxiosConfig: AxiosRequestConfig = {
  headers: { 
    "Access-Control-Allow-Origin": "*",
  },
}

/**
 * Axios instance for fetching font family details.
 */
export const FontFamilyAxios: AxiosInstance = axios.create(
  fontFamilyAxiosConfig
)
