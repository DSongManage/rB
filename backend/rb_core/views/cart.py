"""
Shopping Cart API Views

Endpoints for managing shopping cart and batch checkout.
Purchases are paid with USDC from the user's Web3Auth wallet.
"""

import json
import logging
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import Cart, CartItem, Chapter, Content, Purchase, BatchPurchase, ComicIssue
from ..payment_utils import calculate_cart_breakdown

logger = logging.getLogger(__name__)


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

        # If cart was in checkout, check if we should reset
        if cart.status == 'checkout':
            pending_batch = BatchPurchase.objects.filter(
                user=request.user,
                status__in=['payment_pending', 'payment_completed', 'processing']
            ).order_by('-created_at').first()

            if pending_batch:
                return Response({
                    'id': cart.id,
                    'status': 'processing',
                    'item_count': 0,
                    'max_items': Cart.MAX_ITEMS,
                    'items': [],
                    'batch_purchase_id': pending_batch.id,
                    'batch_status': pending_batch.status,
                })
            else:
                cart.status = 'active'
                cart.save(update_fields=['status'])

        # Recalculate totals
        breakdown = None
        if cart.items.exists():
            breakdown = cart.calculate_totals()

        items = []
        for item in cart.items.select_related(
            'chapter__book_project__creator__profile',
            'content__creator__profile',
            'comic_issue__series',
            'comic_issue__project',
            'creator__profile'
        ).prefetch_related(
            'content__source_collaborative_project',
            'content__source_book_project'
        ).all():
            purchasable = item.chapter or item.content or item.comic_issue

            # Get cover URL
            cover_url = None
            if item.chapter and item.chapter.book_project.cover_image:
                cover_url = item.chapter.book_project.cover_image.url
            elif item.content:
                if hasattr(item.content, 'source_collaborative_project'):
                    collab_project = item.content.source_collaborative_project.first()
                    if collab_project and collab_project.cover_image:
                        cover_url = collab_project.cover_image.url

                if not cover_url and hasattr(item.content, 'source_book_project'):
                    book_project = item.content.source_book_project.first()
                    if book_project and book_project.cover_image:
                        cover_url = book_project.cover_image.url

                if not cover_url and item.content.teaser_link:
                    teaser = item.content.teaser_link
                    if teaser and any(teaser.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                        cover_url = teaser

            elif item.comic_issue:
                if item.comic_issue.cover_image:
                    cover_url = item.comic_issue.cover_image.url

            items.append({
                'id': item.id,
                'type': item.item_type,
                'item_id': purchasable.id,
                'title': purchasable.title,
                'creator_username': item.creator.username,
                'unit_price': str(item.unit_price),
                'added_at': item.added_at.isoformat(),
                'book_title': item.chapter.book_project.title if item.chapter else None,
                'chapter_order': item.chapter.order if item.chapter else None,
                'series_title': item.comic_issue.series.title if item.comic_issue and item.comic_issue.series else None,
                'issue_number': item.comic_issue.issue_number if item.comic_issue else None,
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
                'total': str(cart.subtotal),  # No processing fee — buyer pays subtotal
                'breakdown_display': breakdown['breakdown_display'],
            })

        return Response(response_data)


class AddToCartView(APIView):
    """
    Add chapter, content, or comic issue to cart.

    POST /api/cart/add/
    Body: { chapter_id: int } OR { content_id: int } OR { comic_issue_id: int }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        chapter_id = request.data.get('chapter_id')
        content_id = request.data.get('content_id')
        comic_issue_id = request.data.get('comic_issue_id')

        if not chapter_id and not content_id and not comic_issue_id:
            return Response(
                {'error': 'chapter_id, content_id, or comic_issue_id required'},
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
            cart.save(update_fields=['status'])

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

                    if Purchase.objects.filter(
                        user=request.user,
                        chapter=chapter,
                        status__in=['completed', 'payment_completed', 'minting']
                    ).exists():
                        return Response(
                            {'error': 'You already own this chapter', 'code': 'ALREADY_OWNED'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

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

                elif comic_issue_id:
                    comic_issue = ComicIssue.objects.select_related(
                        'series__creator', 'project__created_by'
                    ).get(id=comic_issue_id)

                    if not comic_issue.is_published:
                        return Response(
                            {'error': 'This issue is not available for purchase', 'code': 'NOT_PUBLISHED'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    if Purchase.objects.filter(
                        user=request.user,
                        comic_issue=comic_issue,
                        status__in=['completed', 'payment_completed', 'minting']
                    ).exists():
                        return Response(
                            {'error': 'You already own this issue', 'code': 'ALREADY_OWNED'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    if CartItem.objects.filter(cart=cart, comic_issue=comic_issue).exists():
                        return Response(
                            {'error': 'Item already in cart', 'code': 'ALREADY_IN_CART'},
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    creator = comic_issue.series.creator if comic_issue.series else (
                        comic_issue.project.created_by if comic_issue.project else request.user
                    )

                    CartItem.objects.create(
                        cart=cart,
                        comic_issue=comic_issue,
                        unit_price=comic_issue.price,
                        creator=creator
                    )

                # Recalculate totals
                breakdown = cart.calculate_totals()

                return Response({
                    'success': True,
                    'item_count': cart.items.count(),
                    'total': str(cart.subtotal),
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
        except ComicIssue.DoesNotExist:
            return Response(
                {'error': 'Comic issue not found'},
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

            if cart.status == 'checkout':
                return Response(
                    {'error': 'Cart is locked during checkout', 'code': 'CART_LOCKED'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            item = CartItem.objects.get(id=item_id, cart=cart)
            item.delete()

            if cart.items.exists():
                breakdown = cart.calculate_totals()
                return Response({
                    'success': True,
                    'item_count': cart.items.count(),
                    'total': str(cart.subtotal),
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
    Initiate checkout for cart — pays with USDC from user's wallet.

    POST /api/cart/checkout/
    Creates a BatchPurchase and triggers atomic minting for each item.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            cart = Cart.objects.prefetch_related(
                'items__chapter__book_project__creator',
                'items__content__creator',
                'items__comic_issue__series__creator',
                'items__comic_issue__project__created_by',
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

            if not request.user.wallet_address:
                return Response(
                    {'error': 'Web3Auth wallet required', 'code': 'NO_WALLET'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            with transaction.atomic():
                cart.status = 'checkout'
                cart.save(update_fields=['status'])

                breakdown = cart.calculate_totals()

                # Create batch purchase record
                batch = BatchPurchase.objects.create(
                    user=request.user,
                    total_items=cart.items.count(),
                    subtotal=cart.subtotal,
                    credit_card_fee=Decimal('0'),  # No processing fee
                    total_charged=cart.subtotal,    # Buyer pays subtotal
                    status='payment_pending'
                )

                logger.info(f"[Cart Checkout] Created batch purchase {batch.id} with {cart.items.count()} items, total: ${cart.subtotal}")

                return Response({
                    'batch_purchase_id': batch.id,
                    'item_count': cart.items.count(),
                    'total': str(cart.subtotal),
                })

        except Cart.DoesNotExist:
            return Response(
                {'error': 'No active cart found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"[Cart Checkout] Error: {e}")
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
    Returns detailed fee calculation.
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
                'buyer_total': str(breakdown['buyer_total']),
                'item_count': breakdown['num_items'],
                'breakdown_display': breakdown['breakdown_display'],
            })

        except Cart.DoesNotExist:
            return Response({'error': 'No cart found'}, status=status.HTTP_404_NOT_FOUND)
