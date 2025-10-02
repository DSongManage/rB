#!/usr/bin/env python3
"""
Generate a devnet platform wallet keypair using the Solana CLI and write the
public key into backend/.env as PLATFORM_WALLET_PUBKEY, and save the keypair
JSON in blockchain/target/platform_wallet.json.

Notes:
- Requires Solana CLI to be installed and available in PATH
- Never commit the generated keypair file; it will be in .gitignore by default
"""

import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BLOCKCHAIN_DIR = ROOT / 'blockchain'
TARGET_DIR = BLOCKCHAIN_DIR / 'target'
KEYPAIR_PATH = TARGET_DIR / 'platform_wallet.json'
BACKEND_ENV = ROOT / 'backend' / '.env'


def run(cmd: list[str]) -> str:
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=True)
    return proc.stdout.decode('utf-8').strip()


def main() -> None:
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    # 1) Create new keypair
    if KEYPAIR_PATH.exists():
        print(f"Keypair already exists at {KEYPAIR_PATH}")
    else:
        print("Creating new devnet keypair…")
        run(['solana-keygen', 'new', '-o', str(KEYPAIR_PATH), '--no-bip39-passphrase', '--force'])
    # 2) Extract public key
    print("Extracting public key…")
    pubkey = run(['solana-keygen', 'pubkey', str(KEYPAIR_PATH)])
    print(f"Devnet platform pubkey: {pubkey}")
    # 3) Write to backend/.env
    lines: list[str] = []
    if BACKEND_ENV.exists():
        lines = BACKEND_ENV.read_text().splitlines()
        lines = [ln for ln in lines if not ln.startswith('PLATFORM_WALLET_PUBKEY=')]
    lines.append(f'PLATFORM_WALLET_PUBKEY={pubkey}')
    BACKEND_ENV.write_text('\n'.join(lines) + '\n')
    print(f"Wrote PLATFORM_WALLET_PUBKEY to {BACKEND_ENV}")


if __name__ == '__main__':
    main()


