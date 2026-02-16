"""
Bridge.xyz API Views

Provides endpoints for:
- Customer/KYC management
- Bank account linking
- Liquidation address management
- Payout history and preferences
"""
import logging
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import (
    BridgeCustomer, BridgeExternalAccount, BridgeLiquidationAddress, BridgeDrain
)
from ..serializers import (
    BridgeCustomerSerializer, BridgeExternalAccountSerializer,
    BridgeLiquidationAddressSerializer, BridgeDrainSerializer,
    PayoutPreferencesSerializer, BridgeOnboardingStatusSerializer,
    ManualBankAccountSerializer, PlaidLinkAccountSerializer
)
from ..services import BridgeService, BridgeAPIError

logger = logging.getLogger(__name__)


class BridgeOnboardingStatusView(APIView):
    """Get current Bridge onboarding status for the user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get complete onboarding status."""
        user = request.user
        profile = user.profile

        # Check for Bridge customer
        bridge_customer = getattr(user, 'bridge_customer', None)
        has_bridge_customer = bridge_customer is not None
        kyc_status = bridge_customer.kyc_status if bridge_customer else None
        kyc_link = bridge_customer.kyc_link if bridge_customer else None

        # Check for bank accounts and liquidation addresses
        has_bank_account = False
        has_liquidation_address = False
        if bridge_customer:
            has_bank_account = bridge_customer.external_accounts.filter(is_active=True).exists()
            has_liquidation_address = bridge_customer.liquidation_addresses.filter(is_active=True).exists()

        # Fully set up = KYC approved + has bank account + has liquidation address
        is_fully_setup = (
            kyc_status == 'approved' and
            has_bank_account and
            has_liquidation_address
        )

        data = {
            'has_bridge_customer': has_bridge_customer,
            'kyc_status': kyc_status,
            'kyc_link': kyc_link,
            'has_bank_account': has_bank_account,
            'has_liquidation_address': has_liquidation_address,
            'is_fully_setup': is_fully_setup,
            'payout_destination': profile.payout_destination,
            'bridge_payout_percentage': profile.bridge_payout_percentage,
            'pending_bridge_amount': profile.pending_bridge_amount,
        }

        serializer = BridgeOnboardingStatusSerializer(data)
        return Response(serializer.data)


class CreateBridgeCustomerView(APIView):
    """Create a Bridge customer for the current user."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Create a new Bridge customer."""
        user = request.user

        # Check if customer already exists
        if hasattr(user, 'bridge_customer'):
            return Response({
                'error': 'Bridge customer already exists',
                'customer': BridgeCustomerSerializer(user.bridge_customer).data
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get email from user
        email = user.email
        if not email:
            return Response({
                'error': 'User must have an email address to create Bridge customer'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            bridge_service = BridgeService()

            # Try to create customer in Bridge
            try:
                bridge_response = bridge_service.create_customer(
                    user_id=user.id,
                    email=email,
                    first_name=getattr(user, 'first_name', None),
                    last_name=getattr(user, 'last_name', None),
                )
                customer_id = bridge_response['id']
            except BridgeAPIError as e:
                # If customer already exists on Bridge, look them up
                if e.error_code == 'invalid_parameters' and 'already exists' in str(e):
                    logger.info(f"Bridge customer already exists for email {email}, looking up...")
                    customers = bridge_service._request('GET', '/customers')
                    customer_id = None
                    for c in customers.get('data', []):
                        if c.get('email') == email:
                            customer_id = c['id']
                            break
                    if not customer_id:
                        raise BridgeAPIError(message="Customer exists on Bridge but could not be found")
                    bridge_response = bridge_service.get_customer(customer_id)
                else:
                    raise

            # Get KYC link
            kyc_response = bridge_service.get_kyc_link(customer_id)

            # Create local record
            bridge_customer = BridgeCustomer.objects.create(
                user=user,
                bridge_customer_id=customer_id,
                kyc_status=bridge_response.get('kyc_status') or 'not_started',
                kyc_link=kyc_response.get('url', ''),
            )

            logger.info(f"Created Bridge customer for user {user.id}: {bridge_customer.bridge_customer_id}")

            return Response({
                'message': 'Bridge customer created successfully',
                'customer': BridgeCustomerSerializer(bridge_customer).data
            }, status=status.HTTP_201_CREATED)

        except BridgeAPIError as e:
            logger.error(f"Bridge API error creating customer for user {user.id}: {e}")
            return Response({
                'error': 'Failed to create Bridge customer',
                'detail': str(e)
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            logger.exception(f"Unexpected error creating Bridge customer for user {user.id}: {e}")
            return Response({
                'error': 'Failed to create Bridge customer',
                'detail': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GetKYCLinkView(APIView):
    """Get KYC verification link for the user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get or refresh KYC link."""
        user = request.user

        if not hasattr(user, 'bridge_customer'):
            return Response({
                'error': 'Bridge customer not found. Create one first.'
            }, status=status.HTTP_404_NOT_FOUND)

        bridge_customer = user.bridge_customer

        # If already approved, no need for KYC link
        if bridge_customer.kyc_status == 'approved':
            return Response({
                'message': 'KYC already approved',
                'kyc_status': 'approved'
            })

        try:
            # Get fresh KYC link from Bridge
            bridge_service = BridgeService()
            kyc_response = bridge_service.get_kyc_link(bridge_customer.bridge_customer_id)

            # Update stored link
            bridge_customer.kyc_link = kyc_response.get('url', '')
            bridge_customer.save(update_fields=['kyc_link', 'updated_at'])

            return Response({
                'url': bridge_customer.kyc_link,
                'kyc_status': bridge_customer.kyc_status
            })

        except BridgeAPIError as e:
            logger.error(f"Bridge API error getting KYC link for user {user.id}: {e}")
            return Response({
                'error': 'Failed to get KYC link',
                'detail': str(e)
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class GetKYCStatusView(APIView):
    """Get current KYC status for the user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get KYC status, refreshing from Bridge if pending."""
        user = request.user

        if not hasattr(user, 'bridge_customer'):
            return Response({
                'error': 'Bridge customer not found'
            }, status=status.HTTP_404_NOT_FOUND)

        bridge_customer = user.bridge_customer

        # If not approved, refresh status from Bridge
        if bridge_customer.kyc_status not in ['approved', 'rejected']:
            try:
                bridge_service = BridgeService()
                customer_data = bridge_service.get_customer(bridge_customer.bridge_customer_id)
                new_status = customer_data.get('kyc_status', bridge_customer.kyc_status)

                if new_status != bridge_customer.kyc_status:
                    bridge_customer.kyc_status = new_status
                    if new_status == 'approved':
                        bridge_customer.kyc_completed_at = timezone.now()
                    bridge_customer.save()
                    logger.info(f"Updated KYC status for user {user.id}: {new_status}")

            except BridgeAPIError as e:
                logger.warning(f"Could not refresh KYC status for user {user.id}: {e}")

        return Response({
            'kyc_status': bridge_customer.kyc_status,
            'kyc_completed_at': bridge_customer.kyc_completed_at
        })


class ListExternalAccountsView(APIView):
    """List linked bank accounts."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get all linked bank accounts."""
        user = request.user

        if not hasattr(user, 'bridge_customer'):
            return Response({'accounts': []})

        accounts = user.bridge_customer.external_accounts.filter(is_active=True)
        serializer = BridgeExternalAccountSerializer(accounts, many=True)
        return Response({'accounts': serializer.data})


class LinkBankAccountPlaidView(APIView):
    """Link bank account via Plaid."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Link bank account using Plaid processor token."""
        user = request.user

        if not hasattr(user, 'bridge_customer'):
            return Response({
                'error': 'Bridge customer not found. Create one first.'
            }, status=status.HTTP_404_NOT_FOUND)

        bridge_customer = user.bridge_customer

        # Validate KYC status
        if bridge_customer.kyc_status != 'approved':
            return Response({
                'error': 'KYC must be approved before linking bank account'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = PlaidLinkAccountSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            bridge_service = BridgeService()
            account_response = bridge_service.create_external_account_plaid(
                customer_id=bridge_customer.bridge_customer_id,
                plaid_processor_token=serializer.validated_data['plaid_processor_token']
            )

            # Create local record
            external_account = BridgeExternalAccount.objects.create(
                bridge_customer=bridge_customer,
                bridge_external_account_id=account_response['id'],
                account_name=account_response.get('account_name', 'Bank Account'),
                bank_name=account_response.get('bank_name', ''),
                last_four=account_response.get('last_4', ''),
                account_type=account_response.get('account_type', 'checking'),
                is_default=not bridge_customer.external_accounts.filter(is_active=True).exists()
            )

            logger.info(f"Linked Plaid bank account for user {user.id}")

            return Response({
                'message': 'Bank account linked successfully',
                'account': BridgeExternalAccountSerializer(external_account).data
            }, status=status.HTTP_201_CREATED)

        except BridgeAPIError as e:
            logger.error(f"Bridge API error linking Plaid account for user {user.id}: {e}")
            return Response({
                'error': 'Failed to link bank account',
                'detail': str(e)
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class LinkBankAccountManualView(APIView):
    """Link bank account with manual details."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Link bank account using manual account/routing numbers."""
        user = request.user

        if not hasattr(user, 'bridge_customer'):
            return Response({
                'error': 'Bridge customer not found. Create one first.'
            }, status=status.HTTP_404_NOT_FOUND)

        bridge_customer = user.bridge_customer

        # Validate KYC status
        if bridge_customer.kyc_status != 'approved':
            return Response({
                'error': 'KYC must be approved before linking bank account'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = ManualBankAccountSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            bridge_service = BridgeService()
            account_response = bridge_service.create_external_account_manual(
                customer_id=bridge_customer.bridge_customer_id,
                account_number=serializer.validated_data['account_number'],
                routing_number=serializer.validated_data['routing_number'],
                account_type=serializer.validated_data['account_type'],
                account_owner_name=serializer.validated_data.get('account_owner_name'),
            )

            # Create local record
            last_four = serializer.validated_data['account_number'][-4:]
            external_account = BridgeExternalAccount.objects.create(
                bridge_customer=bridge_customer,
                bridge_external_account_id=account_response['id'],
                account_name=f"****{last_four}",
                bank_name=account_response.get('bank_name', ''),
                last_four=last_four,
                account_type=serializer.validated_data['account_type'],
                is_default=not bridge_customer.external_accounts.filter(is_active=True).exists()
            )

            logger.info(f"Linked manual bank account for user {user.id}")

            return Response({
                'message': 'Bank account linked successfully',
                'account': BridgeExternalAccountSerializer(external_account).data
            }, status=status.HTTP_201_CREATED)

        except BridgeAPIError as e:
            logger.error(f"Bridge API error linking manual account for user {user.id}: {e}")
            return Response({
                'error': 'Failed to link bank account',
                'detail': str(e)
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class DeleteExternalAccountView(APIView):
    """Delete a linked bank account."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, account_id):
        """Soft delete a bank account."""
        user = request.user

        if not hasattr(user, 'bridge_customer'):
            return Response({
                'error': 'Bridge customer not found'
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            account = user.bridge_customer.external_accounts.get(id=account_id)
        except BridgeExternalAccount.DoesNotExist:
            return Response({
                'error': 'Bank account not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Check if this account has active liquidation addresses
        if account.liquidation_addresses.filter(is_active=True).exists():
            return Response({
                'error': 'Cannot delete account with active liquidation addresses'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            bridge_service = BridgeService()
            bridge_service.delete_external_account(
                customer_id=user.bridge_customer.bridge_customer_id,
                account_id=account.bridge_external_account_id
            )
        except BridgeAPIError as e:
            logger.warning(f"Bridge API error deleting account for user {user.id}: {e}")
            # Continue with local deletion even if Bridge fails

        account.is_active = False
        account.save()

        logger.info(f"Deleted bank account {account_id} for user {user.id}")

        return Response({'message': 'Bank account deleted'})


class SetDefaultExternalAccountView(APIView):
    """Set a bank account as default."""
    permission_classes = [IsAuthenticated]

    def post(self, request, account_id):
        """Set bank account as default for new liquidation addresses."""
        user = request.user

        if not hasattr(user, 'bridge_customer'):
            return Response({
                'error': 'Bridge customer not found'
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            account = user.bridge_customer.external_accounts.get(id=account_id, is_active=True)
        except BridgeExternalAccount.DoesNotExist:
            return Response({
                'error': 'Bank account not found'
            }, status=status.HTTP_404_NOT_FOUND)

        account.is_default = True
        account.save()  # save() method handles unsetting other defaults

        return Response({
            'message': 'Default bank account updated',
            'account': BridgeExternalAccountSerializer(account).data
        })


class ListLiquidationAddressesView(APIView):
    """List liquidation addresses."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get all liquidation addresses."""
        user = request.user

        if not hasattr(user, 'bridge_customer'):
            return Response({'addresses': []})

        addresses = user.bridge_customer.liquidation_addresses.filter(is_active=True)
        serializer = BridgeLiquidationAddressSerializer(addresses, many=True)
        return Response({'addresses': serializer.data})


class CreateLiquidationAddressView(APIView):
    """Create a new liquidation address."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Create a new liquidation address for receiving USDC."""
        user = request.user

        if not hasattr(user, 'bridge_customer'):
            return Response({
                'error': 'Bridge customer not found'
            }, status=status.HTTP_404_NOT_FOUND)

        bridge_customer = user.bridge_customer

        # Validate KYC status
        if bridge_customer.kyc_status != 'approved':
            return Response({
                'error': 'KYC must be approved before creating liquidation address'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get external account (from request or default)
        external_account_id = request.data.get('external_account_id')
        if external_account_id:
            try:
                external_account = bridge_customer.external_accounts.get(
                    id=external_account_id, is_active=True
                )
            except BridgeExternalAccount.DoesNotExist:
                return Response({
                    'error': 'Bank account not found'
                }, status=status.HTTP_404_NOT_FOUND)
        else:
            # Use default account
            external_account = bridge_customer.external_accounts.filter(
                is_active=True, is_default=True
            ).first()
            if not external_account:
                external_account = bridge_customer.external_accounts.filter(
                    is_active=True
                ).first()

        if not external_account:
            return Response({
                'error': 'No bank account linked. Link a bank account first.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            bridge_service = BridgeService()
            address_response = bridge_service.create_liquidation_address(
                customer_id=bridge_customer.bridge_customer_id,
                external_account_id=external_account.bridge_external_account_id,
                chain='solana',
                currency='usdc',
                destination_currency='usd',
            )

            # Create local record
            is_primary = not bridge_customer.liquidation_addresses.filter(is_active=True).exists()
            liquidation_address = BridgeLiquidationAddress.objects.create(
                bridge_customer=bridge_customer,
                external_account=external_account,
                bridge_liquidation_address_id=address_response['id'],
                solana_address=address_response['address'],
                is_primary=is_primary,
            )

            logger.info(f"Created liquidation address for user {user.id}: {liquidation_address.solana_address}")

            return Response({
                'message': 'Liquidation address created successfully',
                'address': BridgeLiquidationAddressSerializer(liquidation_address).data
            }, status=status.HTTP_201_CREATED)

        except BridgeAPIError as e:
            logger.error(f"Bridge API error creating liquidation address for user {user.id}: {e}")
            return Response({
                'error': 'Failed to create liquidation address',
                'detail': str(e)
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class SetPrimaryLiquidationAddressView(APIView):
    """Set a liquidation address as primary for receiving payouts."""
    permission_classes = [IsAuthenticated]

    def post(self, request, address_id):
        """Set liquidation address as primary."""
        user = request.user

        if not hasattr(user, 'bridge_customer'):
            return Response({
                'error': 'Bridge customer not found'
            }, status=status.HTTP_404_NOT_FOUND)

        try:
            address = user.bridge_customer.liquidation_addresses.get(
                id=address_id, is_active=True
            )
        except BridgeLiquidationAddress.DoesNotExist:
            return Response({
                'error': 'Liquidation address not found'
            }, status=status.HTTP_404_NOT_FOUND)

        address.is_primary = True
        address.save()  # save() method handles unsetting other primaries

        return Response({
            'message': 'Primary liquidation address updated',
            'address': BridgeLiquidationAddressSerializer(address).data
        })


class ListPayoutsView(APIView):
    """List payout history (drains)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get payout history."""
        user = request.user

        if not hasattr(user, 'bridge_customer'):
            return Response({'payouts': []})

        # Get all drains for this user's liquidation addresses
        drains = BridgeDrain.objects.filter(
            liquidation_address__bridge_customer=user.bridge_customer
        ).order_by('-initiated_at')[:100]

        serializer = BridgeDrainSerializer(drains, many=True)
        return Response({'payouts': serializer.data})


class GetPayoutPreferencesView(APIView):
    """Get payout preferences."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get current payout preferences."""
        user = request.user
        profile = user.profile

        data = {
            'payout_destination': profile.payout_destination,
            'bridge_payout_percentage': profile.bridge_payout_percentage,
            'pending_bridge_amount': profile.pending_bridge_amount,
        }

        serializer = PayoutPreferencesSerializer(data)
        return Response(serializer.data)


class UpdatePayoutPreferencesView(APIView):
    """Update payout preferences."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Update payout preferences."""
        user = request.user
        profile = user.profile

        serializer = PayoutPreferencesSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Validate that user has Bridge set up if choosing bridge/split
        destination = serializer.validated_data['payout_destination']
        if destination in ['bridge', 'split']:
            if not hasattr(user, 'bridge_customer'):
                return Response({
                    'error': 'Bridge customer not set up. Complete Bridge onboarding first.'
                }, status=status.HTTP_400_BAD_REQUEST)

            bridge_customer = user.bridge_customer
            if bridge_customer.kyc_status != 'approved':
                return Response({
                    'error': 'KYC not approved. Complete KYC verification first.'
                }, status=status.HTTP_400_BAD_REQUEST)

            if not bridge_customer.liquidation_addresses.filter(is_active=True, is_primary=True).exists():
                return Response({
                    'error': 'No primary liquidation address. Create one first.'
                }, status=status.HTTP_400_BAD_REQUEST)

        # Update preferences
        profile.payout_destination = serializer.validated_data['payout_destination']
        profile.bridge_payout_percentage = serializer.validated_data['bridge_payout_percentage']
        profile.save(update_fields=['payout_destination', 'bridge_payout_percentage'])

        logger.info(f"Updated payout preferences for user {user.id}: {profile.payout_destination}")

        return Response({
            'message': 'Payout preferences updated',
            'payout_destination': profile.payout_destination,
            'bridge_payout_percentage': profile.bridge_payout_percentage,
        })
