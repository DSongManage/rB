from django.shortcuts import render
from django.http import HttpResponse
from rest_framework import generics
from .models import Content, UserProfile, User
from .serializers import ContentSerializer, UserProfileSerializer, SignupSerializer, ProfileEditSerializer
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
from django.contrib.auth.models import User
from .models import Collaboration
import ipfshttpclient
from django.conf import settings
from rest_framework import permissions
from rest_framework import serializers
from django.db import models
from django.middleware.csrf import get_token

# Create your views here.

def home(request):
    return HttpResponse("renaissBlock Backend Running")

class AuthStatusView(APIView):
    def get(self, request):
        is_authed = request.user.is_authenticated
        return Response({
            'authenticated': is_authed,
            'user_id': request.user.id if is_authed else None,
            'username': request.user.username if is_authed else None,
            'wallet_address': getattr(request.user, 'wallet_address', None) if is_authed else None,
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

    # Dev: return all content; remove placeholder geo check
    def get_queryset(self):
        return Content.objects.all()

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return super().get_permissions()

    def perform_create(self, serializer):
        file = self.request.FILES.get('file')
        if file:
            client = ipfshttpclient.connect(settings.IPFS_API_URL)
            res = client.add(file)
            ipfs_hash = res['Hash']
            # Generate teaser (example: first 10% of content)
            teaser = file.read()[:int(file.size * 0.1)].decode('utf-8')  # Simplify for text; expand for other formats
            teaser_link = f'https://ipfs.io/ipfs/{ipfs_hash}?teaser=true'  # Placeholder
            serializer.save(creator=self.request.user, ipfs_hash=ipfs_hash, teaser_link=teaser_link)
        else:
            raise serializers.ValidationError('File required')

class InviteView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        collaborator_id = request.data.get('collaborator')
        split = request.data.get('split', 50)  # Default 50/50
        content_id = request.data.get('content')
        content = Content.objects.get(id=content_id, creator=request.user)
        collaborator = User.objects.get(id=collaborator_id)
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
        collab_id = request.data.get('collab')
        if collab_id:
            collab = Collaboration.objects.get(id=collab_id)
            royalties = [(u.wallet_address, collab.revenue_split.get(u.username, 0)) for u in collab.collaborators.all()]
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
        # connection = SolanaClient("https://api.devnet.solana.com")
        # wallet = Keypair()  # Placeholder; integrate Web3Auth later
        # provider = Provider(connection, wallet, {})
        # program_id = PublicKey("YourDeployedProgramID")
        # # Temp sync load from file (after anchor build); switch to async fetch later with ASGI
        # idl_path = Path("/Users/davidsong/repos/songProjects/rB/blockchain/rb_contracts/target/idl/rb_contracts.json")
        # with idl_path.open() as f:
        #     idl_json = json.load(f)
        # idl_obj = idl.from_json(idl_json)
        # program = Program(idl_obj, program_id, provider)
        # tx = program.rpc["mintNft"]("metadata", [(PublicKey(r['pubkey']), r['percent']) for r in royalties])
        return Response({'tx_sig': 'dummy_tx_for_testing', 'royalties': royalties})

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
        content_count = Content.objects.filter(creator=request.user).count()
        collabs = Collaboration.objects.filter(initiators=request.user).count()
        sales = 1000  # Placeholder: Query Anchor for total sales in USD
        if sales < 500:
            fee = 10
            tier = 'Basic'
        elif sales < 5000:
            fee = 8
            tier = 'Pro'
        else:
            fee = 5
            tier = 'Elite'
        return Response({'content_count': content_count, 'collabs': collabs, 'sales': sales, 'tier': tier, 'fee': fee})

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
        user, created = User.objects.get_or_create(username=base_handle)
        prof, _ = UserProfile.objects.get_or_create(user=user, defaults={'username': user.username})
        addr = extract_wallet_from_claims(claims)
        if addr and not prof.wallet_address:
            prof.wallet_address = addr
            prof.save()
            user.wallet_address = addr
            user.save()
        from django.contrib.auth import login as django_login
        django_login(request, user)
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
        if UserProfile.objects.filter(wallet_address=addr).exclude(user=request.user).exists():
            return Response({'error':'wallet already linked to another account'}, status=400)
        request.user.wallet_address = addr[:44]
        request.user.save()
        prof, _ = UserProfile.objects.get_or_create(user=request.user, defaults={'username': request.user.username})
        prof.wallet_address = addr[:44]
        prof.save()
        return Response({'ok': True, 'wallet_address': addr[:44]})

class CsrfTokenView(APIView):
    def get(self, request):
        token = get_token(request)
        return Response({'csrfToken': token})

class UserSearchView(APIView):
    def get(self, request):
        q = request.query_params.get('q', '').strip()
        if q.startswith('@'):
            q = q[1:]
        qs = UserProfile.objects.filter(username__icontains=q).select_related('user')[:20]
        return Response([{ 'id':p.user.id, 'username':p.username, 'display_name':p.display_name, 'wallet_address':p.wallet_address or p.user.wallet_address } for p in qs])


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
        profile, _ = UserProfile.objects.get_or_create(user=request.user, defaults={'username': request.user.username})
        return Response(UserProfileSerializer(profile).data)
    def patch(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user, defaults={'username': request.user.username})
        serializer = ProfileEditSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserProfileSerializer(profile).data)
