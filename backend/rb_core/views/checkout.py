import stripe
import logging
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from ..models import Content
from ..utils import calculate_fees

logger = logging.getLogger(__name__)

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class CreateCheckoutSessionView(APIView):
    """Create Stripe Checkout session for purchasing content."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        content_id = request.data.get('content_id')

        if not content_id:
            return Response(
                {'error': 'content_id is required', 'code': 'MISSING_CONTENT_ID'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Lock content row to prevent race conditions
            with transaction.atomic():
                content = Content.objects.select_for_update().get(id=content_id)

                # Check if content exists and is minted
                if content.inventory_status != 'minted':
                    return Response(
                        {'error': 'Content not available for purchase', 'code': 'NOT_MINTED'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Check if sold out
                if content.editions <= 0:
                    return Response(
                        {'error': 'Content is sold out', 'code': 'SOLD_OUT'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Check if user already owns it
                if content.is_owned_by(request.user):
                    return Response(
                        {'error': 'You already own this content', 'code': 'ALREADY_OWNED'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Calculate fees
                price = float(content.price_usd)
                fees = calculate_fees(price)

                logger.info(
                    f'[Checkout] Creating session for content_id={content.id}, '
                    f'user_id={request.user.id}, price=${price}, editions_before={content.editions}'
                )

                # Create Stripe Checkout Session
                try:
                    checkout_session = stripe.checkout.Session.create(
                        payment_method_types=['card'],
                        line_items=[{
                            'price_data': {
                                'currency': 'usd',
                                'product_data': {
                                    'name': content.title,
                                    'description': f'By {content.creator.username}',
                                },
                                'unit_amount': int(price * 100),  # Convert to cents
                            },
                            'quantity': 1,
                        }],
                        mode='payment',
                        success_url=f"{settings.FRONTEND_URL}/purchase/success?session_id={{CHECKOUT_SESSION_ID}}",
                        cancel_url=f"{settings.FRONTEND_URL}/content/{content.id}",
                        metadata={
                            'content_id': str(content.id),  # Convert to string for consistency
                            'user_id': str(request.user.id),  # Convert to string for consistency
                            'stripe_fee': fees['stripe_fee'],
                            'platform_fee': fees['platform_fee'],
                            'creator_earnings': fees['creator_gets'],
                        },
                    )

                    logger.info(
                        f'[Checkout] ✅ Session created: session_id={checkout_session.id}, '
                        f'payment_intent={checkout_session.payment_intent}'
                    )

                    return Response({
                        'checkout_url': checkout_session.url,
                        'session_id': checkout_session.id,
                    }, status=status.HTTP_200_OK)

                except stripe.error.StripeError as e:
                    return Response(
                        {'error': str(e), 'code': 'STRIPE_ERROR'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found', 'code': 'CONTENT_NOT_FOUND'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e), 'code': 'INTERNAL_ERROR'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
