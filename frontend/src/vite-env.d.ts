/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEB3AUTH_CLIENT_ID: string
  // Add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

