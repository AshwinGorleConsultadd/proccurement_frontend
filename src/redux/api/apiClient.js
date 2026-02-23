import axios from 'axios'

export const api = axios.create({
    baseURL: 'http://localhost:8000',
    timeout: 30000,
})

// Only inject Content-Type: application/json for non-FormData requests.
// For FormData (file uploads, multipart forms), let the browser set the
// correct multipart/form-data header with the proper boundary automatically.
api.interceptors.request.use((config) => {
    if (!(config.data instanceof FormData)) {
        config.headers['Content-Type'] = 'application/json'
    }
    return config
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('[API Error]', error.response?.data || error.message)
        return Promise.reject(error)
    }
)
