"""
Bridge.xyz API Client

Provides fiat <-> USDC conversion functionality:
- OFF-RAMP: Creator USDC → USD to bank account (via Liquidation Addresses)
- ON-RAMP: Buyer USD → USDC to platform wallet (via Transfers API)

API Reference: https://apidocs.bridge.xyz

Off-Ramp Flow (Creators):
1. Create customer (POST /v0/customers)
2. Complete KYC (GET /v0/customers/{id}/kyc_link)
3. Link bank account (POST /v0/customers/{id}/external_accounts)
4. Create liquidation address (POST /v0/customers/{id}/liquidation_addresses)
5. Send USDC to liquidation address -> auto-converts to USD -> deposits to bank

On-Ramp Flow (Purchases):
1. Stripe processes credit card payment
2. Create transfer (POST /v0/transfers) to convert USD → USDC
3. Wait for transfer.completed webhook
4. USDC arrives in destination wallet -> trigger NFT mint
"""
import logging
import requests
import uuid
from typing import Optional, Dict, Any, List
from decimal import Decimal
from django.conf import settings

logger = logging.getLogger(__name__)


class BridgeAPIError(Exception):
    """Custom exception for Bridge API errors."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        response: Optional[Dict] = None,
        error_code: Optional[str] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.response = response
        self.error_code = error_code
        super().__init__(self.message)

    def __str__(self) -> str:
        if self.status_code:
            return f"BridgeAPIError ({self.status_code}): {self.message}"
        return f"BridgeAPIError: {self.message}"


class BridgeService:
    """Service class for Bridge.xyz API interactions.

    Handles all communication with Bridge's API for:
    - Customer management (creation, KYC)
    - External accounts (bank account linking)
    - Liquidation addresses (USDC -> USD conversion)
    - Drains (off-ramp transaction tracking)

    Usage:
        service = BridgeService()
        customer = service.create_customer(user_id=123, email="user@example.com")
        kyc_link = service.get_kyc_link(customer['id'])
    """

    BASE_URL = "https://api.bridge.xyz/v0"
    SANDBOX_URL = "https://api.sandbox.bridge.xyz/v0"

    # Default timeout for API requests (seconds)
    DEFAULT_TIMEOUT = 30

    def __init__(self, api_key: Optional[str] = None, sandbox: Optional[bool] = None):
        """Initialize BridgeService.

        Args:
            api_key: Bridge API key. Defaults to settings.BRIDGE_API_KEY.
            sandbox: Use sandbox environment. Defaults to settings.BRIDGE_SANDBOX_MODE.
        """
        self.api_key = api_key or getattr(settings, 'BRIDGE_API_KEY', '')
        self.is_sandbox = sandbox if sandbox is not None else getattr(settings, 'BRIDGE_SANDBOX_MODE', True)
        self.base_url = self.SANDBOX_URL if self.is_sandbox else self.BASE_URL

        if not self.api_key:
            logger.warning("BridgeService initialized without API key")

    def _headers(self) -> Dict[str, str]:
        """Build request headers with authentication."""
        return {
            "Api-Key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        timeout: int = DEFAULT_TIMEOUT,
    ) -> Dict:
        """Make authenticated request to Bridge API.

        Args:
            method: HTTP method (GET, POST, DELETE, etc.)
            endpoint: API endpoint path (e.g., "/customers")
            data: JSON body for POST/PUT requests
            params: Query parameters for GET requests
            timeout: Request timeout in seconds

        Returns:
            Parsed JSON response

        Raises:
            BridgeAPIError: On API errors or network failures
        """
        url = f"{self.base_url}{endpoint}"
        headers = self._headers()

        # Bridge API requires Idempotency-Key for POST requests
        if method.upper() == "POST":
            headers["Idempotency-Key"] = str(uuid.uuid4())

        try:
            response = requests.request(
                method,
                url,
                headers=headers,
                json=data,
                params=params,
                timeout=timeout,
            )

            # Log request details (without sensitive data)
            logger.info(f"Bridge API {method} {endpoint} -> {response.status_code}")

            if not response.ok:
                error_data = None
                error_code = None
                try:
                    error_data = response.json()
                    error_code = error_data.get('code') or error_data.get('error_code')
                except Exception:
                    pass

                raise BridgeAPIError(
                    message=response.text or f"HTTP {response.status_code}",
                    status_code=response.status_code,
                    response=error_data,
                    error_code=error_code,
                )

            # Handle empty responses
            if not response.text:
                return {}

            return response.json()

        except requests.exceptions.Timeout:
            logger.error(f"Bridge API timeout: {method} {endpoint}")
            raise BridgeAPIError(
                message="Request timed out",
                error_code="TIMEOUT",
            )
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Bridge API connection error: {e}")
            raise BridgeAPIError(
                message="Connection failed",
                error_code="CONNECTION_ERROR",
            )
        except requests.exceptions.RequestException as e:
            logger.error(f"Bridge API request error: {e}")
            raise BridgeAPIError(
                message=str(e),
                error_code="REQUEST_ERROR",
            )

    # =========================================================================
    # Customer Management
    # =========================================================================

    def create_customer(
        self,
        user_id: int,
        email: str,
        customer_type: str = "individual",
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Create a new Bridge customer.

        Args:
            user_id: Our internal user ID (stored as external_id)
            email: Customer's email address
            customer_type: "individual" or "business"
            first_name: Customer's first name (optional)
            last_name: Customer's last name (optional)
            **kwargs: Additional customer fields

        Returns:
            Customer object from Bridge
        """
        data = {
            "type": customer_type,
            "email": email,
            "external_id": str(user_id),
        }

        if first_name:
            data["first_name"] = first_name
        if last_name:
            data["last_name"] = last_name

        data.update(kwargs)

        logger.info(f"Creating Bridge customer for user {user_id}")
        return self._request("POST", "/customers", data)

    def get_customer(self, customer_id: str) -> Dict[str, Any]:
        """Get customer details.

        Args:
            customer_id: Bridge customer ID

        Returns:
            Customer object from Bridge
        """
        return self._request("GET", f"/customers/{customer_id}")

    def get_kyc_link(self, customer_id: str) -> Dict[str, Any]:
        """Get KYC verification link for customer.

        The returned URL opens Bridge's hosted KYC flow.
        User completes verification in their browser.

        Args:
            customer_id: Bridge customer ID

        Returns:
            Dict with 'url' key containing KYC verification URL
        """
        logger.info(f"Getting KYC link for customer {customer_id}")
        return self._request("GET", f"/customers/{customer_id}/kyc_link")

    def get_kyc_status(self, customer_id: str) -> str:
        """Get current KYC status for customer.

        Args:
            customer_id: Bridge customer ID

        Returns:
            KYC status string: 'not_started', 'pending', 'approved', 'rejected', 'incomplete'
        """
        customer = self.get_customer(customer_id)
        return customer.get('kyc_status', 'not_started')

    # =========================================================================
    # External Accounts (Bank Accounts)
    # =========================================================================

    def create_external_account_plaid(
        self,
        customer_id: str,
        plaid_processor_token: str,
    ) -> Dict[str, Any]:
        """Create external account using Plaid Link.

        Plaid handles bank account verification securely.

        Args:
            customer_id: Bridge customer ID
            plaid_processor_token: Token from Plaid Link flow

        Returns:
            External account object from Bridge
        """
        data = {
            "type": "plaid",
            "plaid_processor_token": plaid_processor_token,
        }
        logger.info(f"Creating Plaid-linked account for customer {customer_id}")
        return self._request("POST", f"/customers/{customer_id}/external_accounts", data)

    def create_external_account_manual(
        self,
        customer_id: str,
        account_number: str,
        routing_number: str,
        account_type: str = "checking",
        account_owner_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create external account with manual bank details entry.

        Args:
            customer_id: Bridge customer ID
            account_number: Bank account number
            routing_number: Bank routing number (ABA)
            account_type: "checking" or "savings"
            account_owner_name: Name on the bank account

        Returns:
            External account object from Bridge
        """
        data = {
            "type": "us_bank_account",
            "account_number": account_number,
            "routing_number": routing_number,
            "account_type": account_type,
        }

        if account_owner_name:
            data["account_owner_name"] = account_owner_name

        logger.info(f"Creating manual bank account for customer {customer_id}")
        return self._request("POST", f"/customers/{customer_id}/external_accounts", data)

    def list_external_accounts(self, customer_id: str) -> List[Dict[str, Any]]:
        """List all external accounts for customer.

        Args:
            customer_id: Bridge customer ID

        Returns:
            List of external account objects
        """
        response = self._request("GET", f"/customers/{customer_id}/external_accounts")
        return response.get('data', []) if isinstance(response, dict) else response

    def get_external_account(self, customer_id: str, account_id: str) -> Dict[str, Any]:
        """Get specific external account details.

        Args:
            customer_id: Bridge customer ID
            account_id: External account ID

        Returns:
            External account object from Bridge
        """
        return self._request("GET", f"/customers/{customer_id}/external_accounts/{account_id}")

    def delete_external_account(self, customer_id: str, account_id: str) -> Dict[str, Any]:
        """Delete an external account.

        Args:
            customer_id: Bridge customer ID
            account_id: External account ID to delete

        Returns:
            Deletion confirmation
        """
        logger.info(f"Deleting external account {account_id} for customer {customer_id}")
        return self._request("DELETE", f"/customers/{customer_id}/external_accounts/{account_id}")

    # =========================================================================
    # Liquidation Addresses
    # =========================================================================

    def create_liquidation_address(
        self,
        customer_id: str,
        external_account_id: str,
        chain: str = "solana",
        currency: str = "usdc",
        destination_currency: str = "usd",
    ) -> Dict[str, Any]:
        """Create a new liquidation address.

        A liquidation address is a blockchain address that automatically:
        1. Receives incoming crypto (USDC)
        2. Converts to fiat (USD)
        3. Deposits to the linked bank account

        Args:
            customer_id: Bridge customer ID
            external_account_id: ID of linked bank account to receive funds
            chain: Blockchain network ("solana", "ethereum", etc.)
            currency: Crypto currency to receive ("usdc")
            destination_currency: Fiat currency for conversion ("usd")

        Returns:
            Liquidation address object with 'address' field containing Solana address
        """
        data = {
            "chain": chain,
            "currency": currency,
            "external_account_id": external_account_id,
            "destination_currency": destination_currency,
        }
        logger.info(f"Creating liquidation address for customer {customer_id} on {chain}")
        return self._request("POST", f"/customers/{customer_id}/liquidation_addresses", data)

    def get_liquidation_address(
        self,
        customer_id: str,
        address_id: str,
    ) -> Dict[str, Any]:
        """Get liquidation address details.

        Args:
            customer_id: Bridge customer ID
            address_id: Liquidation address ID

        Returns:
            Liquidation address object from Bridge
        """
        return self._request("GET", f"/customers/{customer_id}/liquidation_addresses/{address_id}")

    def list_liquidation_addresses(self, customer_id: str) -> List[Dict[str, Any]]:
        """List all liquidation addresses for customer.

        Args:
            customer_id: Bridge customer ID

        Returns:
            List of liquidation address objects
        """
        response = self._request("GET", f"/customers/{customer_id}/liquidation_addresses")
        return response.get('data', []) if isinstance(response, dict) else response

    # =========================================================================
    # Drains (Off-ramp Transactions)
    # =========================================================================

    def list_drains(
        self,
        customer_id: str,
        address_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Get drain history for a liquidation address.

        A drain is an individual off-ramp transaction where USDC is
        converted to USD and deposited to the bank account.

        Args:
            customer_id: Bridge customer ID
            address_id: Liquidation address ID
            limit: Maximum results to return
            offset: Pagination offset

        Returns:
            List of drain objects with transaction details
        """
        response = self._request(
            "GET",
            f"/customers/{customer_id}/liquidation_addresses/{address_id}/drains",
            params={"limit": limit, "offset": offset},
        )
        return response.get('data', []) if isinstance(response, dict) else response

    def get_drain(
        self,
        customer_id: str,
        address_id: str,
        drain_id: str,
    ) -> Dict[str, Any]:
        """Get specific drain details.

        Args:
            customer_id: Bridge customer ID
            address_id: Liquidation address ID
            drain_id: Drain ID

        Returns:
            Drain object with transaction details
        """
        return self._request(
            "GET",
            f"/customers/{customer_id}/liquidation_addresses/{address_id}/drains/{drain_id}",
        )

    # =========================================================================
    # Transfers (On-Ramp: USD → USDC)
    # =========================================================================

    def create_onramp_transfer(
        self,
        amount: Decimal,
        destination_address: str,
        external_id: str,
        source_currency: str = "usd",
        destination_currency: str = "usdc",
        destination_chain: str = "solana",
        on_behalf_of: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create an on-ramp transfer to convert USD to USDC.

        Used after Stripe payment to convert fiat to crypto for NFT purchases.
        Bridge will send USDC to the destination address once funds are received.

        Args:
            amount: Amount in USD to convert
            destination_address: Solana wallet to receive USDC
            external_id: Our internal reference ID (Purchase ID or BatchPurchase ID)
            source_currency: Source currency ("usd")
            destination_currency: Target currency ("usdc")
            destination_chain: Blockchain network ("solana", "ethereum", etc.)
            on_behalf_of: Optional customer ID if transfer is on behalf of a customer

        Returns:
            Transfer object from Bridge with 'id', 'status', 'source_deposit_instructions', etc.
            {
                "id": "transfer_xxx",
                "state": "awaiting_funds",
                "source_currency": "usd",
                "source_amount": "100.00",
                "destination_currency": "usdc",
                "destination_amount": null,  # Set when completed
                "destination_address": "...",
                "fee": "0.10",
                "source_deposit_instructions": {
                    "payment_rail": "ach",
                    "bank_name": "...",
                    "account_number": "...",
                    "routing_number": "...",
                    "reference": "..."  # Important for tracking
                }
            }
        """
        data = {
            "amount": str(amount),
            "source": {
                "currency": source_currency,
                "payment_rail": "ach",  # ACH for USD transfers
            },
            "destination": {
                "currency": destination_currency,
                "address": destination_address,
                "payment_rail": destination_chain,
            },
            "developer_fee_percent": "0",  # Platform doesn't take additional cut from Bridge
            "external_id": external_id,
        }

        if on_behalf_of:
            data["on_behalf_of"] = on_behalf_of

        logger.info(f"Creating on-ramp transfer for ${amount} USD -> USDC to {destination_address[:8]}... (ref: {external_id})")
        return self._request("POST", "/transfers", data)

    def get_transfer(self, transfer_id: str) -> Dict[str, Any]:
        """Get transfer details by ID.

        Args:
            transfer_id: Bridge transfer ID

        Returns:
            Transfer object with current status
            {
                "id": "transfer_xxx",
                "state": "awaiting_funds" | "funds_received" | "in_review" | "completed" | "failed" | "returned",
                "source_amount": "100.00",
                "destination_amount": "99.90",  # After fees
                "fee": "0.10",
                "receipt": {
                    "tx_hash": "...",  # Solana transaction signature
                    "destination_tx_hash": "...",
                }
            }
        """
        return self._request("GET", f"/transfers/{transfer_id}")

    def list_transfers(
        self,
        external_id: Optional[str] = None,
        state: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """List transfers with optional filters.

        Args:
            external_id: Filter by our internal reference ID
            state: Filter by state (awaiting_funds, funds_received, completed, failed, etc.)
            limit: Maximum results
            offset: Pagination offset

        Returns:
            List of transfer objects
        """
        params = {"limit": limit, "offset": offset}
        if external_id:
            params["external_id"] = external_id
        if state:
            params["state"] = state

        response = self._request("GET", "/transfers", params=params)
        return response.get('data', []) if isinstance(response, dict) else response

    def cancel_transfer(self, transfer_id: str) -> Dict[str, Any]:
        """Cancel a pending transfer.

        Only works if transfer is in 'awaiting_funds' state.

        Args:
            transfer_id: Bridge transfer ID

        Returns:
            Updated transfer object with state='canceled'
        """
        logger.info(f"Canceling transfer {transfer_id}")
        return self._request("DELETE", f"/transfers/{transfer_id}")

    # =========================================================================
    # Utility Methods
    # =========================================================================

    def verify_webhook_signature(
        self,
        payload: bytes,
        signature_header: str,
        public_key_pem: Optional[str] = None,
    ) -> bool:
        """Verify webhook signature from Bridge using RSA public key.

        Bridge signs webhooks with their private key. The signature header
        format is: t=<timestamp_ms>,v0=<base64_encoded_signature>

        Verification:
        1. Parse timestamp and signature from header
        2. Create message: timestamp + "." + raw_payload
        3. SHA256 hash the message
        4. Verify the RSA signature against the hash using the public key

        Args:
            payload: Raw request body bytes
            signature_header: Value of X-Webhook-Signature header
            public_key_pem: PEM-encoded public key. Defaults to settings.BRIDGE_WEBHOOK_PUBLIC_KEY.

        Returns:
            True if signature is valid
        """
        import base64
        import hashlib
        import time
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding

        pem = public_key_pem or getattr(settings, 'BRIDGE_WEBHOOK_PUBLIC_KEY', '')
        if not pem:
            logger.warning("Bridge webhook public key not configured")
            return False

        # Normalize PEM: env vars may store \n as literal backslash-n
        pem = pem.replace('\\n', '\n')

        # Parse header: t=<timestamp>,v0=<base64 signature>
        try:
            parts = {}
            for part in signature_header.split(','):
                key, _, value = part.partition('=')
                parts[key.strip()] = value.strip()

            timestamp = parts.get('t', '')
            sig_b64 = parts.get('v0', '')

            if not timestamp or not sig_b64:
                logger.warning(f"Bridge webhook signature header missing t or v0. Header: {signature_header[:100]}")
                return False
        except Exception as e:
            logger.warning(f"Failed to parse Bridge webhook signature header: {e}")
            return False

        # Reject events older than 10 minutes (replay protection)
        try:
            event_time_ms = int(timestamp)
            now_ms = int(time.time() * 1000)
            age_ms = abs(now_ms - event_time_ms)
            if age_ms > 600_000:
                logger.warning(f"Bridge webhook event too old ({age_ms}ms), possible replay attack")
                return False
        except ValueError:
            logger.warning("Bridge webhook timestamp not a valid integer")
            return False

        # Create signed payload string and compute SHA256 digest
        # Bridge uses double-SHA256: hash the message, then verify() hashes again internally
        signed_payload = f"{timestamp}.{payload.decode('utf-8')}"
        digest = hashlib.sha256(signed_payload.encode('utf-8')).digest()

        # Verify RSA-PKCS1v15 signature against the digest
        try:
            public_key = serialization.load_pem_public_key(pem.encode('utf-8'))
            sig_bytes = base64.b64decode(sig_b64)

            public_key.verify(
                sig_bytes,
                digest,
                padding.PKCS1v15(),
                hashes.SHA256(),
            )
            logger.info("Bridge webhook: signature verified successfully")
            return True
        except Exception as e:
            logger.warning(f"Bridge webhook signature verification failed: {type(e).__name__}: {e}")
            return False

    def health_check(self) -> bool:
        """Check if Bridge API is reachable.

        Returns:
            True if API is healthy
        """
        try:
            # Use a lightweight endpoint for health check
            self._request("GET", "/health", timeout=5)
            return True
        except BridgeAPIError:
            return False
        except Exception:
            return False
