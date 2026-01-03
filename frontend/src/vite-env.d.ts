/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEB3AUTH_CLIENT_ID: string
  readonly VITE_SOLANA_NETWORK?: string
  readonly VITE_SOLANA_RPC_URL?: string
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

