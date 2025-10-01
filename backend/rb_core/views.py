from django.shortcuts import render
from django.http import HttpResponse
from rest_framework import generics
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Content, UserProfile, User as CoreUser
from .serializers import ContentSerializer, UserProfileSerializer, SignupSerializer, ProfileEditSerializer, ProfileStatusUpdateSerializer
from .utils import verify_web3auth_jwt, extract_wallet_from_claims, Web3AuthVerificationError
from rest_framework.response import Response
from rest_framework.views import APIView
import random
# Temporarily comment blockchain integrations to unblock backend
# from anchorpy import Provider, Program
# from solana.publickey import PublicKey
from rest_framework.permissions import IsAuthenticated
# from solana.rpc.api import Client as SolanaClient
# from solana.keypair import Keypair
# from pathlib import Path
# import json
# from anchorpy.idl import idl
# from django.contrib.auth import login
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate
from django.contrib.auth.models import User as AuthUser
from .models import Collaboration
import ipfshttpclient
from django.conf import settings
from rest_framework import permissions
from rest_framework import serializers
from django.db import models
from django.middleware.csrf import get_token
from rest_framework.decorators import permission_classes
from rest_framework import generics as drf_generics
from io import BytesIO
try:
    from PIL import Image, ImageDraw, ImageFont  # type: ignore
except Exception:
    Image = None  # Pillow optional at runtime

# Create your views here.

def home(request):
    return HttpResponse("renaissBlock Backend Running")

class AuthStatusView(APIView):
    def get(self, request):
        is_authed = request.user.is_authenticated
        wallet = None
        if is_authed:
            try:
                core_user = CoreUser.objects.get(username=request.user.username)
                wallet = core_user.wallet_address
                # Prefer profile value if present
                try:
                    prof = core_user.profile
                    wallet = prof.wallet_address or wallet
                except Exception:
                    pass
            except CoreUser.DoesNotExist:
                wallet = None
        return Response({
            'authenticated': is_authed,
            'user_id': request.user.id if is_authed else None,
            'username': request.user.username if is_authed else None,
            'wallet_address': wallet,
        })

class ContentListView(generics.ListCreateAPIView):
    """API view for listing and creating Content (FR1/FR4 in REQUIREMENTS.md).
    
    - Public for teasers (no auth); gate full access via NFT (client-side per ARCHITECTURE.md).
    - Future: Integrate with IPFS upload, mint trigger via Anchor (FR5).
    - Security: Rate limiting, input sanitization (GUIDELINES.md).
    """
    queryset = Content.objects.all()
    serializer_class = ContentSerializer
    permission_classes = [permissions.AllowAny]  # Public browse (FR1)
    parser_classes = [MultiPartParser, FormParser]

    # Filter by inventory status or mine
    def get_queryset(self):
        qs = Content.objects.all()
        status_f = self.request.query_params.get('inventory_status')
        mine = self.request.query_params.get('mine')
        if status_f:
            qs = qs.filter(inventory_status=status_f)
        if mine and self.request.user.is_authenticated:
            try:
                core_user = CoreUser.objects.get(username=self.request.user.username)
                qs = qs.filter(creator=core_user)
            except CoreUser.DoesNotExist:
                qs = qs.none()
        return qs

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return super().get_permissions()

    def perform_create(self, serializer):
        file = self.request.FILES.get('file')
        text = self.request.data.get('text')
        ipfs_hash = ''
        teaser_link = 'https://example.com/teaser'
        # Basic moderation: simple keyword filter on title
        bad_words = { 'porn', 'explicit', 'illegal' }
        title = (self.request.data.get('title') or '').lower()
        flagged = any(w in title for w in bad_words)
        # Try IPFS if a file was provided
        if file:
            try:
                client = ipfshttpclient.connect(settings.IPFS_API_URL)
                # If this looks like an image and Pillow is available, make a watermarked teaser
                content_type = (self.request.data.get('content_type') or '').strip()
                name = getattr(file, 'name', '').lower()
                is_image = any(name.endswith(ext) for ext in ('.png', '.jpg', '.jpeg', '.webp'))
                if is_image and Image is not None:
                    try:
                        img = Image.open(file)
                        draw = ImageDraw.Draw(img)
                        text_wm = 'renaissBlock'
                        w, h = img.size
                        # Simple semi-transparent box + text at bottom-right
                        box_w = int(w * 0.35)
                        box_h = int(h * 0.08)
                        box_x = w - box_w - 10
                        box_y = h - box_h - 10
                        draw.rectangle([box_x, box_y, box_x+box_w, box_y+box_h], fill=(0,0,0,128))
                        try:
                            font = ImageFont.load_default()
                        except Exception:
                            font = None
                        draw.text((box_x+12, box_y+10), text_wm, fill=(255,255,255,200), font=font)
                        out = BytesIO()
                        fmt = 'PNG' if name.endswith('.png') else 'JPEG'
                        img.save(out, format=fmt)
                        out.seek(0)
                        res = client.add(out)
                    except Exception:
                        out = None
                        res = client.add(file)
                else:
                    res = client.add(file)
                ipfs_hash = res.get('Hash', '')
                teaser_link = f'https://ipfs.io/ipfs/{ipfs_hash}?teaser=true'
            except Exception:
                # Fallback to placeholder teaser link
                ipfs_hash = ''
        elif text:
            # No file; accept text-only content and generate a teaser placeholder
            teaser_link = 'https://example.com/text-teaser'
        else:
            raise serializers.ValidationError('File required')
        # Bridge auth user -> core user for FK consistency
        core_user, _ = CoreUser.objects.get_or_create(username=self.request.user.username)
        instance = serializer.save(creator=core_user, ipfs_hash=ipfs_hash, teaser_link=teaser_link)
        if flagged:
            instance.flagged = True
            instance.save()
        # Increment creator stats
        try:
            profile, _ = UserProfile.objects.get_or_create(user=core_user, defaults={'username': core_user.username})
            profile.content_count = (profile.content_count or 0) + 1
            profile.save()
        except Exception:
            pass

class InviteView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        collaborator_id = request.data.get('collaborator')
        split = request.data.get('split', 50)  # Default 50/50
        content_id = request.data.get('content')
        content = Content.objects.get(id=content_id, creator=request.user)
        collaborator = AuthUser.objects.get(id=collaborator_id)
        collab = Collaboration.objects.create(
            content=content,
            status='pending'
        )
        collab.initiators.add(request.user)
        collab.collaborators.add(collaborator)
        collab.revenue_split = {'initiator': 100 - split, 'collaborator': split}
        collab.save()
        return Response({'message': 'Invite sent'})

class MintView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        royalties = request.data.get('royalties', [])
        content_id = request.data.get('content_id')
        collab_id = request.data.get('collab')
        if collab_id:
            collab = Collaboration.objects.get(id=collab_id)
            royalties = [(u.wallet_address, collab.revenue_split.get(u.username, 0)) for u in collab.collaborators.all()]
        # Update content as minted (mock program call)
        if content_id:
            try:
                c = Content.objects.get(id=content_id)
                c.inventory_status = 'minted'
                if not c.nft_contract:
                    c.nft_contract = 'mock_contract_'+str(c.id)
                c.save()
                # Log platform fee amount to TestFeeLog for MVP tracking
                try:
                    fee_bps = int(getattr(settings, 'PLATFORM_FEE_BPS', 1000))
                except Exception:
                    fee_bps = 1000
                try:
                    gross = float(c.price_usd or 0) * float(c.editions or 1)
                except Exception:
                    gross = 0.0
                fee_amt = round(gross * (fee_bps/10000.0), 2)
                from .models import TestFeeLog
                if fee_amt > 0:
                    TestFeeLog.objects.create(amount=fee_amt)
            except Content.DoesNotExist:
                pass
        # Inject platform fee
        try:
            fee_bps = int(getattr(settings, 'PLATFORM_FEE_BPS', 1000))
        except Exception:
            fee_bps = 1000
        platform_pct = max(0, min(100, fee_bps / 100.0))
        platform_wallet = getattr(settings, 'PLATFORM_WALLET_ADDRESS', '').strip()[:44]
        # Normalize royalties to list of (address, percent)
        norm: list[tuple[str, float]] = []
        for r in royalties:
            if isinstance(r, dict):
                addr = (r.get('pubkey') or r.get('address') or '').strip()[:44]
                pct = float(r.get('percent') or 0)
            else:
                addr = (r[0] or '').strip()[:44]
                pct = float(r[1] or 0)
            if addr and pct > 0:
                norm.append((addr, pct))
        # Reserve space for platform fee by proportional scaling if needed
        total_creator_pct = sum(p for _, p in norm)
        target_creator_pct = max(0.0, 100.0 - platform_pct)
        scaled: list[tuple[str, float]] = norm
        if total_creator_pct > 0 and total_creator_pct > target_creator_pct:
            scale = target_creator_pct / total_creator_pct
            scaled = [(a, round(p * scale, 4)) for a, p in norm]
        # Add platform last
        if platform_wallet and platform_pct > 0:
            scaled.append((platform_wallet, platform_pct))
        royalties = scaled
        # Anchor placeholder (to be integrated):
        # - Resolve Web3Auth-derived wallet locally for devnet
        # - Call mint instruction on Anchor program, pass royalty splits
        # - Receive on-chain mint/contract address and persist to c.nft_contract
        # For MVP we return a dummy tx signature and log the fee server-side.
        return Response({'tx_sig': 'dummy_tx_for_testing', 'royalties': royalties})

class AnalyticsFeesView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        # Minimal admin check
        try:
            if not request.user.is_superuser:
                return Response({'error': 'forbidden'}, status=403)
        except Exception:
            return Response({'error': 'forbidden'}, status=403)
        from .models import TestFeeLog
        qs = TestFeeLog.objects.order_by('-timestamp')[:100]
        total = sum([float(x.amount) for x in qs])
        data = [{ 'amount': float(x.amount), 'timestamp': x.timestamp.isoformat() } for x in qs]
        return Response({ 'total_amount': round(total, 2), 'count': len(data), 'items': data })

class AdminStatsUpdateView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        # Minimal admin gate: superuser only for now
        try:
            if not request.user.is_superuser:
                return Response({'error': 'forbidden'}, status=403)
        except Exception:
            return Response({'error': 'forbidden'}, status=403)
        username = (request.data.get('username') or '').strip()
        sales = request.data.get('total_sales_usd')
        content_count = request.data.get('content_count')
        if not username:
            return Response({'error': 'username required'}, status=400)
        core_user, _ = CoreUser.objects.get_or_create(username=username)
        profile, _ = UserProfile.objects.get_or_create(user=core_user, defaults={'username': username})
        if sales is not None:
            try:
                profile.total_sales_usd = float(sales)
            except Exception:
                return Response({'error': 'invalid sales'}, status=400)
        if content_count is not None:
            try:
                profile.content_count = int(content_count)
            except Exception:
                return Response({'error': 'invalid content_count'}, status=400)
        # Recalculate tier/fee
        s = float(profile.total_sales_usd or 0)
        if s < 500:
            profile.tier = 'Basic'
            profile.fee_bps = 1000
        elif s < 5000:
            profile.tier = 'Pro'
            profile.fee_bps = 800
        else:
            profile.tier = 'Elite'
            profile.fee_bps = 500
        profile.save()
        return Response(UserProfileSerializer(profile, context={'request': request}).data)

class ContentDetailView(drf_generics.RetrieveUpdateAPIView):
    serializer_class = ContentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only allow owners to view/update via this view
        try:
            core_user = CoreUser.objects.get(username=self.request.user.username)
            return Content.objects.filter(creator=core_user)
        except CoreUser.DoesNotExist:
            return Content.objects.none()

class ContentPreviewView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request, pk:int):
        try:
            c = Content.objects.get(id=pk)
        except Content.DoesNotExist:
            return Response({'error':'not found'}, status=404)
        data = ContentSerializer(c).data
        return Response({'id': c.id, 'title': c.title, 'teaser_link': c.teaser_link, 'content_type': c.content_type, 'inventory_status': c.inventory_status, 'nft_contract': c.nft_contract, 'preview': data})

class SearchView(APIView):
    def get(self, request):
        q = request.query_params.get('q', '').strip()
        genre = request.query_params.get('genre')
        ctype = request.query_params.get('type')
        qs = Content.objects.all()
        if q:
            qs = qs.filter(models.Q(title__icontains=q) | models.Q(creator__username__icontains=q))
        if genre:
            qs = qs.filter(genre=genre)
        if ctype:
            qs = qs.filter(content_type=ctype)
        data = ContentSerializer(qs.order_by('-created_at')[:100], many=True).data
        return Response(data)

class DashboardView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        # Bridge to core user to avoid FK mismatches
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        profile, _ = UserProfile.objects.get_or_create(user=core_user, defaults={'username': core_user.username})
        # Derive tier/fee from profile stats; recalc simple rule if totals changed
        sales = float(profile.total_sales_usd or 0)
        if sales < 500:
            profile.tier = 'Basic'
            profile.fee_bps = 1000
        elif sales < 5000:
            profile.tier = 'Pro'
            profile.fee_bps = 800
        else:
            profile.tier = 'Elite'
            profile.fee_bps = 500
        profile.save()
        return Response({
            'content_count': profile.content_count,
            'collabs': Collaboration.objects.filter(initiators=core_user).count(),
            'sales': sales,
            'tier': profile.tier,
            'fee': round(profile.fee_bps / 100.0, 2)
        })

class Web3AuthLoginView(APIView):
    def post(self, request):
        token = request.data.get('token', '').strip()
        if not token:
            return Response({'error': 'token required'}, status=400)
        try:
            claims = verify_web3auth_jwt(token)
        except Web3AuthVerificationError as exc:
            return Response({'error': f'web3auth verification failed: {exc}'}, status=400)
        sub = claims.get('sub')
        if not sub:
            return Response({'error': 'missing subject'}, status=400)
        base_handle = f"renaiss{sub[:6]}"
        auth_user, created = AuthUser.objects.get_or_create(username=base_handle)
        # Ensure a local CoreUser exists for profile link
        core_user, _ = CoreUser.objects.get_or_create(username=auth_user.username)
        prof, _ = UserProfile.objects.get_or_create(user=core_user, defaults={'username': core_user.username})
        addr = extract_wallet_from_claims(claims)
        if addr and not prof.wallet_address:
            prof.wallet_address = addr
            prof.save()
        from django.contrib.auth import login as django_login
        django_login(request, auth_user)
        return Response({'message': 'Login successful'})

class FlagView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        content_id = request.data.get('content')
        content = Content.objects.get(id=content_id)
        content.flagged = True
        content.save()
        return Response({'message': 'Content flagged for review'})

class LinkWalletView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        addr = request.data.get('wallet_address', '').strip()
        token = request.data.get('web3auth_token', '').strip()
        # If token provided and no address, derive address server-side
        if token and not addr:
            try:
                claims = verify_web3auth_jwt(token)
                derived = extract_wallet_from_claims(claims)
                addr = (derived or '').strip()
            except Web3AuthVerificationError as exc:
                return Response({'error': f'web3auth verification failed: {exc}'}, status=400)
        if not addr:
            return Response({'error':'wallet_address required'}, status=400)
        # Enforce uniqueness at profile level (optional connection)
        # Compare by immutable handle to avoid cross-model FK type mismatch
        if UserProfile.objects.filter(wallet_address=addr).exclude(username=getattr(request.user, 'username', '')).exists():
            return Response({'error':'wallet already linked to another account'}, status=400)
        # Bridge auth.User -> rb_core.User by username
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        prof, _ = UserProfile.objects.get_or_create(user=core_user, defaults={'username': request.user.username})
        prof.wallet_address = addr[:44]
        prof.save()
        return Response({'ok': True, 'wallet_address': addr[:44]})

class CsrfTokenView(APIView):
    def get(self, request):
        token = get_token(request)
        return Response({'csrfToken': token})

class UserSearchView(APIView):
    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        role = (request.query_params.get('role') or '').strip()
        genre = (request.query_params.get('genre') or '').strip()
        loc = (request.query_params.get('location') or '').strip()
        status_param = (request.query_params.get('status') or '').strip().lower()
        if q.startswith('@'):
            q = q[1:]
        qs = UserProfile.objects.all().select_related('user')
        if q:
            qs = qs.filter(username__icontains=q)
        if role:
            qs = qs.filter(roles__icontains=role)
        if genre:
            qs = qs.filter(genres__icontains=genre)
        if loc:
            qs = qs.filter(location__icontains=loc)
        if status_param:
            green = {'mint-ready partner', 'chain builder', 'open node'}
            yellow = {'selective forge', 'linked capacity', 'partial protocol'}
            red = {'locked chain', 'sealed vault', 'exclusive mint'}
            st = None
            if status_param in ('green', 'high'):
                st = list(green)
            elif status_param in ('yellow', 'conditional'):
                st = list(yellow)
            elif status_param in ('red', 'low'):
                st = list(red)
            if st:
                qs = qs.filter(status__in=[s.title() for s in st])
        # Exclude current logged-in user if authenticated
        try:
            if request.user and request.user.is_authenticated:
                qs = qs.exclude(username=request.user.username)
        except Exception:
            pass
        qs = qs.order_by('username')[:20]
        return Response([{ 'id':p.user.id, 'username':p.username, 'display_name':p.display_name, 'wallet_address':p.wallet_address } for p in qs])


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data.get('web3auth_token')
        if token:
            try:
                claims = verify_web3auth_jwt(token)
                derived = extract_wallet_from_claims(claims)
                if derived and not serializer.validated_data.get('wallet_address'):
                    serializer.validated_data['wallet_address'] = derived
            except Web3AuthVerificationError as exc:
                return Response({'error': f'web3auth verification failed: {exc}'}, status=400)
        profile = serializer.save()
        return Response(UserProfileSerializer(profile).data, status=201)


class ProfileEditView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        profile, _ = UserProfile.objects.get_or_create(user=core_user, defaults={'username': request.user.username})
        return Response(UserProfileSerializer(profile, context={'request': request}).data)
    def patch(self, request):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        profile, _ = UserProfile.objects.get_or_create(user=core_user, defaults={'username': request.user.username})
        # Support multipart form data for file uploads
        # Avoid deepcopy of uploaded files (causes BufferedRandom pickle error)
        data = request.data
        if 'avatar' in request.FILES:
            profile.avatar_image = request.FILES['avatar']
        if 'banner' in request.FILES:
            profile.banner_image = request.FILES['banner']
        serializer = ProfileEditSerializer(profile, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserProfileSerializer(profile, context={'request': request}).data)

class ProfileStatusView(APIView):
    permission_classes = [IsAuthenticated]
    def patch(self, request):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        profile, _ = UserProfile.objects.get_or_create(user=core_user, defaults={'username': request.user.username})
        serializer = ProfileStatusUpdateSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserProfileSerializer(profile, context={'request': request}).data)
