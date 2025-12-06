import stripe
import logging
from decimal import Decimal
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from ..models import Content, Chapter, Purchase
from ..utils import calculate_fees

logger = logging.getLogger(__name__)

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


class CreateCheckoutSessionView(APIView):
    """
    Create Stripe Checkout session for purchasing content or chapters.

    Supports both legacy Content purchases and new Chapter purchases.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        content_id = request.data.get('content_id')
        chapter_id = request.data.get('chapter_id')

        if not content_id and not chapter_id:
            return Response(
                {'error': 'Either content_id or chapter_id is required', 'code': 'MISSING_ID'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                # Handle chapter purchase
                if chapter_id:
                    try:
                        chapter = Chapter.objects.select_related('book_project__creator').get(id=chapter_id)
                    except Chapter.DoesNotExist:
                        return Response(
                            {'error': 'Chapter not found', 'code': 'CHAPTER_NOT_FOUND'},
                            status=status.HTTP_404_NOT_FOUND
                        )

                    # Check if user already purchased this chapter
                    if Purchase.objects.filter(user=request.user, chapter=chapter, status='completed').exists():
                        return Response(
                            {'error': 'You already own this chapter', 'code': 'ALREADY_OWNED'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    # TODO: Add chapter price field - for now use fixed $3
                    price = Decimal('3.00')
                    item_title = f'{chapter.book_project.title} - Chapter {chapter.order}: {chapter.title}'
                    item_description = f'By {chapter.book_project.creator.username}'
                    cancel_url = f"{settings.FRONTEND_URL}/chapters/{chapter.id}"

                # Handle legacy content purchase
                elif content_id:
                    content = Content.objects.select_for_update().get(id=content_id)

                    if content.inventory_status != 'minted':
                        return Response(
                            {'error': 'Content not available for purchase', 'code': 'NOT_MINTED'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    if content.editions <= 0:
                        return Response(
                            {'error': 'Content is sold out', 'code': 'SOLD_OUT'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    if content.is_owned_by(request.user):
                        return Response(
                            {'error': 'You already own this content', 'code': 'ALREADY_OWNED'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    price = content.price_usd
                    item_title = content.title
                    item_description = f'By {content.creator.username}'
                    cancel_url = f"{settings.FRONTEND_URL}/content/{content.id}"

                logger.info(
                    f'[Checkout] Creating session: '
                    f'chapter_id={chapter_id}, content_id={content_id}, '
                    f'user_id={request.user.id}, price=${price}'
                )

                # Create Stripe Checkout Session
                try:
                    checkout_session = stripe.checkout.Session.create(
                        payment_method_types=['card'],
                        line_items=[{
                            'price_data': {
                                'currency': 'usd',
                                'product_data': {
                                    'name': item_title,
                                    'description': item_description,
                                },
                                'unit_amount': int(float(price) * 100),  # Convert to cents
                            },
                            'quantity': 1,
                        }],
                        mode='payment',
                        success_url=f"{settings.FRONTEND_URL}/purchase/success?session_id={{CHECKOUT_SESSION_ID}}",
                        cancel_url=cancel_url,
                        metadata={
                            'chapter_id': str(chapter_id) if chapter_id else '',
                            'content_id': str(content_id) if content_id else '',
                            'user_id': str(request.user.id),
                        },
                    )

                    # Create Purchase record immediately
                    purchase = Purchase.objects.create(
                        user=request.user,
                        content=content if content_id else None,
                        chapter=chapter if chapter_id else None,
                        purchase_price_usd=price,
                        gross_amount=price,
                        stripe_checkout_session_id=checkout_session.id,
                        status='payment_pending',
                        payment_provider='stripe'
                    )

                    logger.info(
                        f'[Checkout] ✅ Session created: session_id={checkout_session.id}, '
                        f'purchase_id={purchase.id}'
                    )

                    return Response({
                        'checkout_url': checkout_session.url,
                        'session_id': checkout_session.id,
                        'purchase_id': purchase.id
                    }, status=status.HTTP_200_OK)

                except stripe.error.StripeError as e:
                    logger.error(f'[Checkout] Stripe error: {e}')
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
            logger.error(f'[Checkout] Error: {e}', exc_info=True)
            return Response(
                {'error': str(e), 'code': 'INTERNAL_ERROR'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DevProcessPurchaseView(APIView):
    """
    DEVELOPMENT ONLY: Process a pending purchase synchronously.

    This bypasses the Stripe webhook + Celery workflow for local testing.
    DO NOT USE IN PRODUCTION.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Process a purchase immediately (dev mode only)."""
        # Only allow in DEBUG mode
        if not settings.DEBUG:
            return Response(
                {'error': 'This endpoint is only available in DEBUG mode'},
                status=status.HTTP_403_FORBIDDEN
            )

        purchase_id = request.data.get('purchase_id')

        if not purchase_id:
            return Response(
                {'error': 'purchase_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            purchase = Purchase.objects.get(id=purchase_id)

            # Verify this is the user's purchase
            if purchase.user != request.user:
                return Response(
                    {'error': 'Not your purchase'},
                    status=status.HTTP_403_FORBIDDEN
                )

            logger.info(f'[DEV] Processing purchase {purchase_id} synchronously')

            # Simulate webhook: Mark as payment_completed
            purchase.status = 'payment_completed'
            purchase.gross_amount = purchase.purchase_price_usd
            purchase.stripe_fee = Decimal('0.05')  # Mock fee
            purchase.net_after_stripe = purchase.purchase_price_usd - Decimal('0.05')
            purchase.save()

            logger.info(f'[DEV] Updated purchase {purchase_id} to payment_completed')

            # Run atomic purchase processing synchronously (instead of Celery)
            from ..tasks import process_atomic_purchase

            # Call the task function directly (not .delay())
            try:
                # Import the actual function, not the Celery task
                from ..tasks import process_atomic_purchase as task_func

                # If it's a Celery task, get the underlying function
                if hasattr(task_func, 'run'):
                    result = task_func.run(purchase_id)
                else:
                    # Call directly if not a Celery task
                    result = task_func(purchase_id)

                logger.info(f'[DEV] ✅ Purchase {purchase_id} processed successfully')

                # Refresh purchase to get updated data
                purchase.refresh_from_db()

                return Response({
                    'success': True,
                    'purchase_id': purchase.id,
                    'status': purchase.status,
                    'message': 'Purchase processed successfully (dev mode)'
                }, status=status.HTTP_200_OK)

            except Exception as e:
                logger.error(f'[DEV] ❌ Error processing purchase: {e}', exc_info=True)
                return Response(
                    {'error': f'Processing failed: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except Purchase.DoesNotExist:
            return Response(
                {'error': 'Purchase not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f'[DEV] Error: {e}', exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
