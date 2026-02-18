/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEB3AUTH_CLIENT_ID: string
  readonly VITE_SOLANA_NETWORK?: string
  readonly VITE_SOLANA_RPC_URL?: string
  readonly VITE_API_URL?: string
  readonly VITE_GOOGLE_PLACES_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Google Maps Places Autocomplete types
declare namespace google.maps.places {
  class Autocomplete {
    constructor(input: HTMLInputElement, opts?: AutocompleteOptions);
    addListener(event: string, handler: () => void): void;
    getPlace(): PlaceResult;
  }
  interface AutocompleteOptions {
    types?: string[];
    componentRestrictions?: { country: string | string[] };
    fields?: string[];
  }
  interface PlaceResult {
    address_components?: AddressComponent[];
  }
  interface AddressComponent {
    long_name: string;
    short_name: string;
    types: string[];
  }
}

