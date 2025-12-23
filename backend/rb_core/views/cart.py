"""
Shopping Cart API Views

Endpoints for managing shopping cart and batch checkout.
Supports adding/removing items, calculating fees, and creating Stripe checkout sessions.
"""

import json
import logging
import stripe
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import Cart, CartItem, Chapter, Content, Purchase, BatchPurchase
from ..payment_utils import calculate_cart_breakdown

logger = logging.getLogger(__name__)
stripe.api_key = settings.STRIPE_SECRET_KEY

# Stripe minimum charge is $0.50 USD
STRIPE_MINIMUM_CHARGE = Decimal('0.50')


class CartView(APIView):
    """
    Get current user's cart with items and totals.

    GET /api/cart/
    Returns cart with items, totals, and savings information.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cart, created = Cart.objects.get_or_create(
            user=request.user,
            defaults={'status': 'active'}
        )

        # If cart was in checkout but user came back, check if we should reset
        if cart.status == 'checkout' and cart.stripe_checkout_session_id:
            # Check if there's a pending/processing batch purchase for this session
            pending_batch = BatchPurchase.objects.filter(
                stripe_checkout_session_id=cart.stripe_checkout_session_id,
                status__in=['payment_pending', 'payment_completed', 'processing']
            ).first()

            if pending_batch:
                # Batch purchase in progress - return empty cart to frontend
                # (items are preserved in DB for batch processing, but hidden from user)
                return Response({
                    'id': cart.id,
                    'status': 'processing',  # Special status for frontend
                    'item_count': 0,
                    'max_items': Cart.MAX_ITEMS,
                    'items': [],
                    'batch_purchase_id': pending_batch.id,
                    'batch_status': pending_batch.status,
                })
            else:
                # User cancelled checkout or session expired - safe to reset
                cart.status = 'active'
                cart.stripe_checkout_session_id = ''
                cart.save(update_fields=['status', 'stripe_checkout_session_id'])

        # Recalculate totals
        breakdown = None
        if cart.items.exists():
            breakdown = cart.calculate_totals()

        items = []
        for item in cart.items.select_related(
            'chapter__book_project__creator__profile',
            'content__creator__profile',
            'creator__profile'
        ).all():
            purchasable = item.chapter or item.content

            # Get cover URL - chapters use book's cover, content uses teaser_link
            cover_url = None
            if item.chapter and item.chapter.book_project.cover_image:
                cover_url = item.chapter.book_project.cover_image.url
            elif item.content and item.content.teaser_link:
                # For art/film/music content, teaser_link might be an image
                teaser = item.content.teaser_link
                if teaser and any(teaser.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                    cover_url = teaser

            items.append({
                'id': item.id,
                'type': item.item_type,
                'item_id': purchasable.id,
                'title': purchasable.title,
                'creator_username': item.creator.username,
                'unit_price': str(item.unit_price),
                'added_at': item.added_at.isoformat(),
                # Chapter-specific
                'book_title': item.chapter.book_project.title if item.chapter else None,
                'chapter_order': item.chapter.order if item.chapter else None,
                # Cover art
                'cover_url': cover_url,
            })

        response_data = {
            'id': cart.id,
            'status': cart.status,
            'item_count': len(items),
            'max_items': Cart.MAX_ITEMS,
            'items': items,
        }

        if breakdown:
            response_data.update({
                'subtotal': str(cart.subtotal),
                'credit_card_fee': str(cart.credit_card_fee),
                'total': str(cart.total),
                'savings_vs_individual': str(breakdown.get('savings_vs_individual', '0.00')),
                'breakdown_display': breakdown['breakdown_display'],
            })

        return Response(response_data)


class AddToCartView(APIView):
    """
    Add chapter or content to cart.

    POST /api/cart/add/
    Body: { chapter_id: int } OR { content_id: int }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        chapter_id = request.data.get('chapter_id')
        content_id = request.data.get('content_id')

        if not chapter_id and not content_id:
            return Response(
                {'error': 'chapter_id or content_id required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify user has wallet
        if not request.user.wallet_address:
            return Response(
                {'error': 'Web3Auth wallet required for purchases', 'code': 'NO_WALLET'},
                status=status.HTTP_400_BAD_REQUEST
            )

        cart, _ = Cart.objects.get_or_create(
            user=request.user,
            defaults={'status': 'active'}
        )

        # Reset cart if it was in checkout
        if cart.status == 'checkout':
            cart.status = 'active'
            cart.stripe_checkout_session_id = ''
            cart.save(update_fields=['status', 'stripe_checkout_session_id'])

        # Check cart limit
        if not cart.can_add_item():
            return Response(
                {'error': f'Cart is full (max {Cart.MAX_ITEMS} items)', 'code': 'CART_FULL'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with transaction.atomic():
                if chapter_id:
                    chapter = Chapter.objects.select_related('book_project__creator').get(id=chapter_id)

                    # Check if already owned
                    if Purchase.objects.filter(
                        user=request.user,
                        chapter=chapter,
                        status__in=['completed', 'payment_completed', 'minting']
                    ).exists():
                        return Response(
                            {'error': 'You already own this chapter', 'code': 'ALREADY_OWNED'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    # Check if already in cart
                    if CartItem.objects.filter(cart=cart, chapter=chapter).exists():
                        return Response(
                            {'error': 'Item already in cart', 'code': 'ALREADY_IN_CART'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    CartItem.objects.create(
                        cart=cart,
                        chapter=chapter,
                        unit_price=chapter.price,
                        creator=chapter.book_project.creator
                    )

                elif content_id:
                    content = Content.objects.get(id=content_id)

                    if content.is_owned_by(request.user):
                        return Response(
                            {'error': 'You already own this content', 'code': 'ALREADY_OWNED'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    if CartItem.objects.filter(cart=cart, content=content).exists():
                        return Response(
                            {'error': 'Item already in cart', 'code': 'ALREADY_IN_CART'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    CartItem.objects.create(
                        cart=cart,
                        content=content,
                        unit_price=content.price_usd,
                        creator=content.creator
                    )

                # Recalculate totals
                breakdown = cart.calculate_totals()

                return Response({
                    'success': True,
                    'item_count': cart.items.count(),
                    'total': str(cart.total),
                    'breakdown': breakdown['breakdown_display']
                })

        except Chapter.DoesNotExist:
            return Response(
                {'error': 'Chapter not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class RemoveFromCartView(APIView):
    """
    Remove item from cart.

    DELETE /api/cart/remove/<item_id>/
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, item_id):
        try:
            cart = Cart.objects.get(user=request.user)

            # Don't allow removal during active checkout
            if cart.status == 'checkout':
                return Response(
                    {'error': 'Cart is locked during checkout', 'code': 'CART_LOCKED'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            item = CartItem.objects.get(id=item_id, cart=cart)
            item.delete()

            # Recalculate totals
            if cart.items.exists():
                breakdown = cart.calculate_totals()
                return Response({
                    'success': True,
                    'item_count': cart.items.count(),
                    'total': str(cart.total),
                    'breakdown': breakdown['breakdown_display']
                })
            else:
                cart.clear()
                return Response({
                    'success': True,
                    'item_count': 0,
                    'total': '0.00'
                })

        except Cart.DoesNotExist:
            return Response({'error': 'No active cart'}, status=status.HTTP_404_NOT_FOUND)
        except CartItem.DoesNotExist:
            return Response({'error': 'Item not in cart'}, status=status.HTTP_404_NOT_FOUND)


class ClearCartView(APIView):
    """
    Clear all items from cart.

    POST /api/cart/clear/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            cart = Cart.objects.get(user=request.user)

            # Don't allow clearing during active checkout
            if cart.status == 'checkout':
                return Response(
                    {'error': 'Cart is locked during checkout', 'code': 'CART_LOCKED'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            cart.clear()
            return Response({'success': True, 'item_count': 0})
        except Cart.DoesNotExist:
            return Response({'success': True, 'item_count': 0})


class CartCheckoutView(APIView):
    """
    Create Stripe checkout session for cart purchase.

    POST /api/cart/checkout/
    Returns checkout_url for redirect to Stripe.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            cart = Cart.objects.prefetch_related(
                'items__chapter__book_project__creator',
                'items__content__creator'
            ).get(user=request.user)

            if cart.status == 'checkout':
                return Response(
                    {'error': 'Checkout already in progress', 'code': 'CHECKOUT_IN_PROGRESS'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not cart.items.exists():
                return Response(
                    {'error': 'Cart is empty'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Verify wallet
            if not request.user.wallet_address:
                return Response(
                    {'error': 'Web3Auth wallet required', 'code': 'NO_WALLET'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            with transaction.atomic():
                # Lock cart during checkout
                cart.status = 'checkout'
                cart.save(update_fields=['status'])

                # Calculate final totals
                breakdown = cart.calculate_totals()

                # Validate minimum charge amount for Stripe
                if cart.total < STRIPE_MINIMUM_CHARGE:
                    cart.status = 'active'
                    cart.save(update_fields=['status'])
                    return Response(
                        {
                            'error': f'Minimum purchase amount is ${STRIPE_MINIMUM_CHARGE}. Please add more items to your cart.',
                            'code': 'BELOW_MINIMUM',
                            'minimum': str(STRIPE_MINIMUM_CHARGE),
                            'current_total': str(cart.total)
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Build Stripe line items
                line_items = []
                item_metadata = []

                for i, item in enumerate(cart.items.all()):
                    purchasable = item.chapter or item.content
                    creator = item.creator

                    # Each item gets its proportional share of the CC fee
                    if cart.subtotal > 0:
                        item_share = item.unit_price / cart.subtotal
                    else:
                        item_share = Decimal('1')
                    item_cc_fee = (cart.credit_card_fee * item_share).quantize(Decimal('0.01'))
                    item_total = item.unit_price + item_cc_fee

                    line_items.append({
                        'price_data': {
                            'currency': 'usd',
                            'product_data': {
                                'name': purchasable.title,
                                'description': f'By {creator.username}',
                            },
                            'unit_amount': int(item_total * 100),  # Convert to cents
                        },
                        'quantity': 1,
                    })

                    item_metadata.append({
                        'index': i,
                        'type': item.item_type,
                        'item_id': purchasable.id,
                        'price': str(item.unit_price),
                        'creator_id': creator.id,
                    })

                # Create batch purchase record
                batch = BatchPurchase.objects.create(
                    user=request.user,
                    stripe_checkout_session_id='pending',  # Updated after session creation
                    total_items=cart.items.count(),
                    subtotal=cart.subtotal,
                    credit_card_fee=cart.credit_card_fee,
                    total_charged=cart.total,
                    status='payment_pending'
                )

                # Get frontend URL for success/cancel redirects
                frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')

                # Create Stripe session with aggregated line items
                checkout_session = stripe.checkout.Session.create(
                    payment_method_types=['card'],
                    line_items=line_items,
                    mode='payment',
                    success_url=f"{frontend_url}/cart/success?session_id={{CHECKOUT_SESSION_ID}}",
                    cancel_url=f"{frontend_url}/cart",
                    metadata={
                        'batch_purchase_id': str(batch.id),
                        'user_id': str(request.user.id),
                        'item_count': str(cart.items.count()),
                        'items': json.dumps(item_metadata),
                    },
                )

                # Update records with session ID
                batch.stripe_checkout_session_id = checkout_session.id
                batch.save(update_fields=['stripe_checkout_session_id'])

                cart.stripe_checkout_session_id = checkout_session.id
                cart.save(update_fields=['stripe_checkout_session_id'])

                logger.info(f"[Cart Checkout] Created batch purchase {batch.id} with {cart.items.count()} items")

                return Response({
                    'checkout_url': checkout_session.url,
                    'session_id': checkout_session.id,
                    'batch_purchase_id': batch.id,
                    'item_count': cart.items.count(),
                    'total': str(cart.total),
                    'savings': str(breakdown['savings_vs_individual']),
                })

        except Cart.DoesNotExist:
            return Response(
                {'error': 'No active cart found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except stripe.StripeError as e:
            logger.error(f"[Cart Checkout] Stripe error: {e}")
            # Unlock cart on error
            try:
                cart.status = 'active'
                cart.save(update_fields=['status'])
            except Exception:
                pass
            return Response(
                {'error': 'Payment service error', 'code': 'STRIPE_ERROR'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.error(f"[Cart Checkout] Error: {e}")
            # Unlock cart on error
            try:
                cart.status = 'active'
                cart.save(update_fields=['status'])
            except Exception:
                pass
            raise


class CartBreakdownView(APIView):
    """
    Get fee breakdown for current cart.

    GET /api/cart/breakdown/
    Returns detailed fee calculation including savings.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            cart = Cart.objects.prefetch_related('items').get(user=request.user)

            if not cart.items.exists():
                return Response({'error': 'Cart is empty'}, status=status.HTTP_400_BAD_REQUEST)

            item_prices = [item.unit_price for item in cart.items.all()]
            breakdown = calculate_cart_breakdown(item_prices)

            return Response({
                'subtotal': str(breakdown['subtotal']),
                'credit_card_fee': str(breakdown['credit_card_fee']),
                'buyer_total': str(breakdown['buyer_total']),
                'savings_vs_individual': str(breakdown['savings_vs_individual']),
                'item_count': breakdown['num_items'],
                'breakdown_display': breakdown['breakdown_display'],
            })

        except Cart.DoesNotExist:
            return Response({'error': 'No cart found'}, status=status.HTTP_404_NOT_FOUND)
