from django.shortcuts import render
from django.http import HttpResponse
from django.db import models
from rest_framework import generics
from rest_framework.parsers import MultiPartParser, FormParser
from ..models import Content, UserProfile, User as CoreUser, BookProject, Chapter
from ..serializers import ContentSerializer, UserProfileSerializer, SignupSerializer, ProfileEditSerializer, ProfileStatusUpdateSerializer, BookProjectSerializer, ChapterSerializer
from ..utils import verify_web3auth_jwt, extract_wallet_from_claims, Web3AuthVerificationError
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
from django.contrib.auth import get_user_model
from ..models import Collaboration
import ipfshttpclient
from django.conf import settings
from rest_framework import permissions
from rest_framework import serializers
from django.db import models
from django.middleware.csrf import get_token
from rest_framework.decorators import permission_classes
from rest_framework import generics as drf_generics
from io import BytesIO
from django.core.files.uploadedfile import UploadedFile
import os
import asyncio
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
        user_data = None

        if is_authed:
            try:
                core_user = CoreUser.objects.get(username=request.user.username)
                wallet = core_user.wallet_address
                # Prefer profile value if present
                try:
                    prof = core_user.profile
                    wallet = prof.wallet_address or wallet
                    display_name = prof.display_name or request.user.username
                except Exception:
                    display_name = request.user.username
            except CoreUser.DoesNotExist:
                wallet = None
                display_name = request.user.username

            # Build user object for frontend
            user_data = {
                'id': request.user.id,
                'username': request.user.username,
                'email': getattr(request.user, 'email', ''),
                'display_name': display_name,
            }

        return Response({
            'authenticated': is_authed,
            'user_id': request.user.id if is_authed else None,
            'username': request.user.username if is_authed else None,
            'wallet_address': wallet,
            'user': user_data,  # Add user object for useAuth hook
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
        
        # Exclude collaboration placeholder content from public listings (FR8 bug fix)
        # Collaboration invites create placeholder content with title starting with "Collaboration Invite"
        # These should only appear in collaboration management, not public browse
        qs = qs.exclude(title__startswith='Collaboration Invite')
        
        status_f = self.request.query_params.get('inventory_status')
        mine = self.request.query_params.get('mine')
        
        # Default to showing only minted content for public browsing
        # Allow explicit filtering via query params (e.g., ?inventory_status=draft for profile/studio)
        if status_f:
            qs = qs.filter(inventory_status=status_f)
        else:
            # If no status filter specified, default to minted for public home page
            qs = qs.filter(inventory_status='minted')
        
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
        from ..utils.file_validation import validate_upload

        file = self.request.FILES.get('file')
        text = self.request.data.get('text')
        ipfs_hash = ''
        teaser_link = 'https://example.com/teaser'
        # Basic moderation: simple keyword filter on title
        bad_words = { 'porn', 'explicit', 'illegal' }
        title = (self.request.data.get('title') or '').lower()
        flagged = any(w in title for w in bad_words)
        # Validate upload if a file was provided (with magic byte validation)
        if file:
            validate_upload(file)
            # Try IPFS
            try:
                # Prefer multiaddr form for Infura; fall back to settings URL
                try:
                    client = ipfshttpclient.connect('/dns/ipfs.infura.io/tcp/5001/https')
                except Exception:
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
            # No file; accept text-only content and persist HTML to IPFS (best-effort)
            try:
                try:
                    client = ipfshttpclient.connect('/dns/ipfs.infura.io/tcp/5001/https')
                except Exception:
                    client = ipfshttpclient.connect(settings.IPFS_API_URL)
                from io import BytesIO as _BytesIO
                data = (text or '').encode('utf-8')
                res = client.add(_BytesIO(data))
                ipfs_hash = res.get('Hash', '')
            except Exception:
                ipfs_hash = ''
            # Build a teaser fallback (first 15%, bounded) and store locally
            try:
                from bs4 import BeautifulSoup  # type: ignore
                soup = BeautifulSoup(text or '', 'lxml')
                plain = soup.get_text(separator='\n')
                n = max(200, min(len(plain) // 6, 1500))
                snippet = plain[:n]
                teaser_html_local = f"<div style=\"white-space: pre-wrap;\">{snippet}</div>"
            except Exception:
                teaser_html_local = ''
            # Set a temporary internal route; finalize after save when we have an ID
            teaser_link = ''
        else:
            raise serializers.ValidationError('File required')
        # Bridge auth user -> core user for FK consistency
        core_user, _ = CoreUser.objects.get_or_create(username=self.request.user.username)
        instance = serializer.save(creator=core_user, ipfs_hash=ipfs_hash, teaser_link=teaser_link)
        # For text content, finalize internal teaser route now that we have an ID
        try:
            if not file and (text or ''):
                # Use backend-served teaser to avoid external iframes/wallet warnings
                internal = f"/api/content/{instance.id}/teaser/"
                instance.teaser_link = internal
                if 'teaser_html_local' in locals() and teaser_html_local:
                    instance.teaser_html = teaser_html_local
                instance.save(update_fields=['teaser_link'])
        except Exception:
            pass
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
        """Enhanced collaboration invite endpoint (FR8)
        
        Accepts:
        - message: str (project pitch, sanitized)
        - equity_percent: int (0-100, collaborator's share)
        - collaborators: list[int] (user IDs to invite)
        - attachments: str (optional IPFS CID for pitch deck/samples)
        - content_id: int (optional, if invite for specific content)
        
        Returns:
        - invite_id: int
        - status: 'pending'
        - invited_users: list[str] (usernames)
        """
        from bs4 import BeautifulSoup
        
        # Parse request data
        message = request.data.get('message', '').strip()
        equity_percent = min(100, max(0, int(request.data.get('equity_percent', 50))))
        collaborator_ids = request.data.get('collaborators', [])
        attachments = request.data.get('attachments', '').strip()  # IPFS CID
        content_id = request.data.get('content_id')  # Optional
        
        # Sanitize message (prevent XSS in stored invites)
        soup = BeautifulSoup(message, 'html.parser')
        message_clean = soup.get_text()[:1000]  # Limit to 1000 chars
        
        # Validate collaborators
        if not isinstance(collaborator_ids, list) or len(collaborator_ids) == 0:
            return Response({'error': 'At least one collaborator required'}, status=400)
        
        AuthUser = get_user_model()
        collaborators = list(AuthUser.objects.filter(id__in=collaborator_ids))
        
        if len(collaborators) == 0:
            return Response({'error': 'No valid collaborators found'}, status=400)
        
        # Get or create content (if content_id not provided, create placeholder)
        if content_id:
            try:
                content = Content.objects.get(id=content_id, creator=request.user)
            except Content.DoesNotExist:
                return Response({'error': 'Content not found or not yours'}, status=404)
        else:
            # Create placeholder collaboration content (can be updated later)
            content = Content.objects.create(
                title=f"Collaboration Invite - {message_clean[:50]}",
                creator=request.user,
                content_type='other',
                genre='other'
            )
        
        # Create Collaboration record
        collab = Collaboration.objects.create(
            content=content,
            status='pending',
            revenue_split={
                'initiator': 100 - equity_percent,
                'collaborators': equity_percent,
                'message': message_clean,
                'attachments': attachments,
            }
        )
        
        # Add initiator (ensure using correct User model)
        collab.initiators.add(request.user)
        
        # Add all collaborators
        for collaborator in collaborators:
            collab.collaborators.add(collaborator)
        
        collab.save()
        
        # Return response with invite details
        return Response({
            'invite_id': collab.id,
            'status': 'pending',
            'invited_users': [c.username for c in collaborators],
            'equity_percent': equity_percent,
            'message': f'Invite sent to {len(collaborators)} collaborator(s)',
        }, status=201)

class MintView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        royalties = request.data.get('royalties', [])
        content_id = request.data.get('content_id')
        collab_id = request.data.get('collab')
        # New: accept sale_amount (lamports) for fee calculation logging
        sale_amount = request.data.get('sale_amount')
        if collab_id:
            collab = Collaboration.objects.get(id=collab_id)
            royalties = [(u.wallet_address, collab.revenue_split.get(u.username, 0)) for u in collab.collaborators.all()]
        # Update content as minted (mock program call or devnet call below)
        if content_id:
            try:
                c = Content.objects.get(id=content_id)
                c.inventory_status = 'minted'
                if not c.nft_contract:
                    c.nft_contract = getattr(settings, 'ANCHOR_PROGRAM_ID', '') or 'mock_contract_'+str(c.id)
                c.save()
                
                # If this content is linked to a chapter or book project, mark as published
                from ..models import Chapter, BookProject
                chapter = Chapter.objects.filter(published_content=c).first()
                if chapter:
                    chapter.is_published = True
                    chapter.save()
                
                book_project = BookProject.objects.filter(published_content=c).first()
                if book_project:
                    book_project.is_published = True
                    book_project.save()
                
                # Log platform fee amount to TestFeeLog for MVP tracking
                try:
                    fee_bps = int(getattr(settings, 'PLATFORM_FEE_BPS', 1000))
                except Exception:
                    fee_bps = 1000
                # Prefer on-chain sale_amount if provided; otherwise fall back to content fields
                gross: float
                if sale_amount is not None:
                    try:
                        gross = float(sale_amount)
                    except Exception:
                        gross = 0.0
                else:
                    try:
                        gross = float(c.price_usd or 0) * float(c.editions or 1)
                    except Exception:
                        gross = 0.0
                fee_amt = round(gross * (fee_bps/10000.0), 2)
                from ..models import TestFeeLog
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
        platform_wallet = getattr(settings, 'PLATFORM_WALLET_PUBKEY', '').strip()[:44]
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
        # Feature-flagged Anchor devnet call (prototype)
        tx_sig = 'dummy_tx_for_testing'
        if getattr(settings, 'FEATURE_ANCHOR_MINT', False):
            try:
                # Attempt a real AnchorPy call if available
                from anchorpy import Program, Provider, Wallet  # type: ignore
                from solana.rpc.async_api import AsyncClient  # type: ignore
                from solana.keypair import Keypair  # type: ignore
                from solders.pubkey import Pubkey  # type: ignore
                # Config
                rpc_url = getattr(settings, 'SOLANA_RPC_URL', 'https://api.devnet.solana.com')
                program_str = getattr(settings, 'ANCHOR_PROGRAM_ID', '') or os.getenv('RENAISS_BLOCK_PROGRAM_ID', '')
                if not program_str:
                    raise RuntimeError('ANCHOR_PROGRAM_ID not set')
                program_id = Pubkey.from_string(program_str)
                # Load a devnet signer (platform wallet) for MVP server-side call
                keypair_path = getattr(settings, 'PLATFORM_WALLET_KEYPAIR_PATH', '') or os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'blockchain', 'target', 'platform_wallet.json')
                if not os.path.isabs(keypair_path):
                    keypair_path = os.path.abspath(os.path.join(os.path.dirname(settings.BASE_DIR), 'blockchain', 'target', 'platform_wallet.json'))
                try:
                    kp = Keypair.from_secret_key(bytes(bytearray(__import__('json').loads(open(keypair_path, 'r').read()))))  # type: ignore
                except Exception:
                    # Fallback: keep dummy signature if key not present
                    kp = None

                async def _mint():
                    client = AsyncClient(rpc_url)
                    if not kp:
                        await client.close()
                        return None
                    provider = Provider(client, Wallet(kp))
                    # Attempt to load IDL from local target if available; otherwise assume empty and call method by name
                    idl_path = os.path.abspath(os.path.join(os.path.dirname(settings.BASE_DIR), 'blockchain', 'rb_contracts', 'target', 'idl', 'renaiss_block.json'))
                    idl = None
                    try:
                        import json as _json
                        with open(idl_path, 'r') as f:
                            idl = _json.load(f)
                    except Exception:
                        idl = None
                    if idl is not None:
                        program = await Program.create(idl, program_id, provider)
                        # Optional: accept pre-created mint and recipient token from request for devnet-only flow
                        mint_str = (request.data.get('mint') or '').strip()
                        rcv_str = (request.data.get('recipient_token') or '').strip()
                        if mint_str and rcv_str and sale_amount is not None:
                            try:
                                # Resolve accounts
                                mint_pk = Pubkey.from_string(mint_str)
                                rcv_pk = Pubkey.from_string(rcv_str)
                                # Prefer configured platform wallet pubkey; fall back to provider wallet
                                platform_str = (getattr(settings, 'PLATFORM_WALLET_PUBKEY', '') or '').strip() or str(kp.public_key)
                                platform_pk = Pubkey.from_string(platform_str)
                                token_program = Pubkey.from_string('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
                                system_program = Pubkey.from_string('11111111111111111111111111111111')
                                accounts = {
                                    'payer': kp.public_key,
                                    'mint': mint_pk,
                                    'recipient_token': rcv_pk,
                                    'platform_wallet': platform_pk,
                                    'token_program': token_program,
                                    'system_program': system_program,
                                }
                                # Call Anchor method using on-chain IDL; sale_amount drives fee transfer
                                meta_uri = 'ipfs://metadata'
                                amt = int(float(sale_amount)) if sale_amount is not None else 0
                                tx = await program.rpc['mint_nft'](meta_uri, amt, ctx={ 'accounts': accounts })
                            except Exception:
                                tx = None
                        else:
                            tx = None
                    else:
                        # Fallback: construct Program without IDL by name (unsupported); skip real call
                        tx = None
                    await client.close()
                    return tx

                out = asyncio.run(_mint())
                if out:
                    tx_sig = out
                # Attach program id to content record on successful connectivity
                if content_id:
                    try:
                        c = Content.objects.get(id=content_id)
                        if getattr(settings, 'ANCHOR_PROGRAM_ID', ''):
                            c.nft_contract = getattr(settings, 'ANCHOR_PROGRAM_ID')
                        c.save()
                    except Exception:
                        pass
            except Exception:
                # Keep dummy signature if deps or env not available
                pass
        return Response({'tx_sig': tx_sig, 'royalties': royalties})

class AnalyticsFeesView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        # Minimal admin check
        try:
            if not request.user.is_superuser:
                return Response({'error': 'forbidden'}, status=403)
        except Exception:
            return Response({'error': 'forbidden'}, status=403)
        from ..models import TestFeeLog
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
        return Response({
            'id': c.id,
            'title': c.title,
            'teaser_link': c.teaser_link,
            'content_type': c.content_type,
            'inventory_status': c.inventory_status,
            'nft_contract': c.nft_contract,
            'price_usd': float(c.price_usd),
            'editions': c.editions,
            'preview': data
        })

class ContentTextTeaserView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request, pk:int):
        # Serve a sanitized text teaser as text/html
        try:
            from bs4 import BeautifulSoup  # type: ignore
        except Exception:
            return HttpResponse("<p>Teaser unavailable</p>", content_type='text/html')
        try:
            c = Content.objects.get(id=pk)
        except Content.DoesNotExist:
            return HttpResponse("<p>Not found</p>", status=404, content_type='text/html')
        # If teaser_link points to /api/content/<id>/teaser/ and ipfs_hash is present, fetch from IPFS
        html = ''
        try:
            if c.ipfs_hash:
                import requests as _req  # type: ignore
                r = _req.get(f"https://ipfs.io/ipfs/{c.ipfs_hash}", timeout=5)
                if r.ok:
                    html = r.text
        except Exception:
            html = ''
        # Fallback to empty
        body = ''
        try:
            if html:
                soup = BeautifulSoup(html or '', 'lxml')
                text = soup.get_text(separator='\n')
                n = max(200, min(len(text) // 6, 1500))
                snippet = text[:n]
                body = f"<div style=\"font-family: ui-sans-serif, system-ui; white-space: pre-wrap;\">{snippet}</div>"
        except Exception:
            body = ''
        # If empty, serve persisted fallback teaser
        if not body:
            try:
                if getattr(c, 'teaser_html', ''):
                    body = c.teaser_html
            except Exception:
                body = ''
        if not body:
            body = "<div><p></p></div>"
        return HttpResponse(body, content_type='text/html')

class SearchView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [permissions.AllowAny]  # Will use DRF default throttling

    def get(self, request):
        q = request.query_params.get('q', '').strip()

        # Input validation
        if len(q) < 2:
            return Response({'error': 'Query must be at least 2 characters'}, status=400)
        if len(q) > 100:
            return Response({'error': 'Query too long (max 100 characters)'}, status=400)

        genre = request.query_params.get('genre')
        ctype = request.query_params.get('type')

        # Only search minted (public) content
        qs = Content.objects.filter(inventory_status='minted')

        if q:
            qs = qs.filter(models.Q(title__icontains=q) | models.Q(creator__username__icontains=q))
        if genre:
            qs = qs.filter(genre=genre)
        if ctype:
            qs = qs.filter(content_type=ctype)

        # Limit results to prevent abuse
        data = ContentSerializer(qs.order_by('-created_at')[:50], many=True).data
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
    """Web3Auth login endpoint with strict rate limiting."""
    throttle_classes = ['rb_core.throttling.AuthAnonRateThrottle']

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
        addr = extract_wallet_from_claims(claims)
        # Resolve or create user based on web3auth subject or wallet
        AuthUser = get_user_model()
        # First preference: subject match
        prof = UserProfile.objects.filter(web3auth_sub=sub).select_related('user').first()
        if not prof and addr:
            # Fallback: wallet match (may be pre-linked via API signup)
            prof = UserProfile.objects.filter(wallet_address=addr).select_related('user').first()
        if prof:
            core_user = prof.user
        else:
            # Create a new handle; ensure uniqueness
            base_handle = f"renaiss{sub[:6]}"
            handle = base_handle
            n = 0
            while AuthUser.objects.filter(username=handle).exists():
                n += 1
                handle = f"{base_handle}{n}"
            core_user = AuthUser.objects.create_user(username=handle, password=None)
            prof = UserProfile.objects.create(user=core_user, username=handle)
        # Update identity mapping and wallet if available
        changed = False
        if getattr(prof, 'web3auth_sub', None) != sub:
            prof.web3auth_sub = sub
            changed = True
        if addr and not prof.wallet_address:
            # Only set if free; uniqueness is enforced at DB level
            prof.wallet_address = addr
            changed = True
        if changed:
            try:
                prof.save()
            except Exception:
                # If wallet uniqueness blocks save, keep subject mapping only
                prof.wallet_address = prof.wallet_address  # no-op safeguard
                try:
                    prof.save(update_fields=['web3auth_sub'])
                except Exception:
                    pass
        from django.contrib.auth import login as django_login
        django_login(request, core_user)
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
        # Ensure CSRF cookie is set in the response
        token = get_token(request)
        response = Response({'csrfToken': token})
        # Explicitly set the CSRF cookie for cross-origin requests
        response.set_cookie(
            'csrftoken',
            token,
            max_age=31449600,  # 1 year
            secure=False,  # True in production with HTTPS
            httponly=False,  # Must be False so JS can read it
            samesite='Lax'
        )
        return response

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
        
        # Enhance response with capabilities, accomplishments, and stats (FR8)
        results = []
        for p in qs:
            # Count successful collaborations
            successful_collabs = (
                p.user.initiated_collabs.filter(status='active').count() +
                p.user.joined_collabs.filter(status='active').count()
            )
            
            # Determine status category for badge color
            status_category = 'green'  # default
            if p.status:
                green_statuses = {'Mint-Ready Partner', 'Chain Builder', 'Open Node'}
                yellow_statuses = {'Selective Forge', 'Linked Capacity', 'Partial Protocol'}
                red_statuses = {'Locked Chain', 'Sealed Vault', 'Exclusive Mint'}
                if p.status in green_statuses:
                    status_category = 'green'
                elif p.status in yellow_statuses:
                    status_category = 'yellow'
                elif p.status in red_statuses:
                    status_category = 'red'
            
            results.append({
                'id': p.user.id,
                'username': p.username,
                'display_name': p.display_name,
                'wallet_address': p.wallet_address,
                # Capabilities (FR8)
                'roles': p.roles or [],
                'genres': p.genres or [],
                # Accomplishments
                'content_count': p.content_count,
                'total_sales_usd': float(p.total_sales_usd) if p.total_sales_usd else 0.0,
                'successful_collabs': successful_collabs,
                'tier': p.tier if hasattr(p, 'tier') else 'Basic',
                # Status
                'status': p.status or '',
                'status_category': status_category,  # 'green', 'yellow', 'red' for UI
                # Profile media
                'avatar_url': p.avatar_url or '',
                'location': p.location or '',
            })
        
        return Response(results)


class NotificationsView(APIView):
    """Return pending collaboration invites for the authenticated user (FR8)"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Find all pending collaborations where user is a recipient
        pending_invites = Collaboration.objects.filter(
            collaborators=request.user,
            status='pending'
        ).select_related('content').prefetch_related('initiators')
        
        results = []
        for collab in pending_invites:
            initiator = collab.initiators.first()  # Get first initiator
            if not initiator:
                continue
                
            # Extract invite details from revenue_split JSON
            message = collab.revenue_split.get('message', '')
            attachments = collab.revenue_split.get('attachments', '')
            collaborators_equity = collab.revenue_split.get('collaborators', 50)
            
            # Get initiator profile for avatar
            try:
                initiator_profile = UserProfile.objects.get(user=initiator)
                initiator_avatar = initiator_profile.avatar_url or ''
                initiator_display = initiator_profile.display_name or initiator.username
            except UserProfile.DoesNotExist:
                initiator_avatar = ''
                initiator_display = initiator.username
            
            results.append({
                'id': collab.id,
                'sender_id': initiator.id,
                'sender_username': initiator.username,
                'sender_display_name': initiator_display,
                'sender_avatar': initiator_avatar,
                'message': message[:200] + ('...' if len(message) > 200 else ''),  # Snippet
                'message_full': message,
                'equity_percent': collaborators_equity,
                'attachments': attachments,
                'content_id': collab.content.id if collab.content else None,
                'content_title': collab.content.title if collab.content else '',
                'created_at': collab.content.created_at.isoformat() if collab.content and hasattr(collab.content, 'created_at') else '',
            })
        
        return Response(results)


class LogoutView(APIView):
    """API endpoint to log out the current session cleanly.

    Frontend can POST here with CSRF and then redirect client-side
    without relying on allauth's HTML flow, avoiding redirect loops
    in proxied dev environments.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from django.contrib.auth import logout as django_logout
        try:
            django_logout(request)
        except Exception:
            pass
        # Return a simple JSON and let client redirect
        resp = Response({'ok': True})
        try:
            # Proactively expire session cookie in dev
            resp.delete_cookie('sessionid', path='/', samesite='Lax')
        except Exception:
            pass
        return resp


class SignupView(APIView):
    """User signup endpoint with strict rate limiting."""
    from ..throttling import SignupRateThrottle

    permission_classes = [permissions.AllowAny]
    throttle_classes = [SignupRateThrottle]

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


class LoginView(APIView):
    """Custom login endpoint for username/password authentication."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '').strip()

        if not username or not password:
            return Response({'error': 'Username and password are required'}, status=400)

        # Authenticate user
        user = authenticate(request, username=username, password=password)

        if user is None:
            return Response({'error': 'Invalid username or password'}, status=401)

        if not user.is_active:
            return Response({'error': 'Account is disabled'}, status=401)

        # Log the user in
        from django.contrib.auth import login as django_login
        django_login(request, user)

        return Response({
            'message': 'Login successful',
            'username': user.username,
            'user_id': user.id
        }, status=200)


class ProfileEditView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        profile, _ = UserProfile.objects.get_or_create(user=core_user, defaults={'username': request.user.username})
        return Response(UserProfileSerializer(profile, context={'request': request}).data)
    def patch(self, request):
        from ..utils.file_validation import validate_avatar, validate_banner

        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        profile, _ = UserProfile.objects.get_or_create(user=core_user, defaults={'username': request.user.username})
        # Support multipart form data for file uploads
        # Avoid deepcopy of uploaded files (causes BufferedRandom pickle error)
        data = request.data
        if 'avatar' in request.FILES:
            validate_avatar(request.FILES['avatar'])
            profile.avatar_image = request.FILES['avatar']
        if 'banner' in request.FILES:
            validate_banner(request.FILES['banner'])
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


# Book Project and Chapter Views

class BookProjectListCreateView(APIView):
    """List all book projects for authenticated user or create a new one."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        projects = BookProject.objects.filter(creator=core_user)
        serializer = BookProjectSerializer(projects, many=True)
        return Response(serializer.data)
    
    def post(self, request):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        serializer = BookProjectSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(creator=core_user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BookProjectDetailView(APIView):
    """Retrieve, update, or delete a specific book project."""
    permission_classes = [IsAuthenticated]
    
    def get_object(self, pk, user):
        core_user, _ = CoreUser.objects.get_or_create(username=user.username)
        try:
            return BookProject.objects.get(pk=pk, creator=core_user)
        except BookProject.DoesNotExist:
            return None
    
    def get(self, request, pk):
        project = self.get_object(pk, request.user)
        if not project:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = BookProjectSerializer(project)
        return Response(serializer.data)
    
    def patch(self, request, pk):
        project = self.get_object(pk, request.user)
        if not project:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if cover_image is being updated
        cover_image_updated = 'cover_image' in request.FILES
        
        serializer = BookProjectSerializer(project, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            updated_project = serializer.save()
            
            # If cover image was updated, update all published chapters' teaser_link
            if cover_image_updated and updated_project.cover_image:
                published_chapters = updated_project.chapters.filter(is_published=True)
                for chapter in published_chapters:
                    if chapter.published_content:
                        chapter.published_content.teaser_link = updated_project.cover_image.url
                        chapter.published_content.save(update_fields=['teaser_link'])
                
                # Also update the book's published content if it exists
                if updated_project.published_content:
                    updated_project.published_content.teaser_link = updated_project.cover_image.url
                    updated_project.published_content.save(update_fields=['teaser_link'])
            
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def delete(self, request, pk):
        project = self.get_object(pk, request.user)
        if not project:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        project.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChapterListCreateView(APIView):
    """List chapters for a project or create a new chapter."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, project_id):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        try:
            project = BookProject.objects.get(pk=project_id, creator=core_user)
        except BookProject.DoesNotExist:
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
        
        chapters = project.chapters.all()
        serializer = ChapterSerializer(chapters, many=True)
        return Response(serializer.data)
    
    def post(self, request, project_id):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        try:
            project = BookProject.objects.get(pk=project_id, creator=core_user)
        except BookProject.DoesNotExist:
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Auto-assign order as the next available number
        max_order = project.chapters.aggregate(models.Max('order'))['order__max']
        order = (max_order + 1) if max_order is not None else 0
        
        serializer = ChapterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(book_project=project, order=order)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ChapterDetailView(APIView):
    """Retrieve, update, or delete a specific chapter."""
    permission_classes = [IsAuthenticated]
    
    def get_object(self, pk, user):
        core_user, _ = CoreUser.objects.get_or_create(username=user.username)
        try:
            chapter = Chapter.objects.select_related('book_project').get(pk=pk)
            if chapter.book_project.creator == core_user:
                return chapter
        except Chapter.DoesNotExist:
            pass
        return None
    
    def get(self, request, pk):
        chapter = self.get_object(pk, request.user)
        if not chapter:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ChapterSerializer(chapter)
        return Response(serializer.data)
    
    def patch(self, request, pk):
        chapter = self.get_object(pk, request.user)
        if not chapter:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ChapterSerializer(chapter, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def delete(self, request, pk):
        chapter = self.get_object(pk, request.user)
        if not chapter:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if chapter.is_published:
            return Response({'error': 'Cannot delete a minted chapter'}, status=status.HTTP_400_BAD_REQUEST)
        chapter.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PrepareChapterView(APIView):
    """Prepare a chapter for minting (creates draft Content)."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        try:
            chapter = Chapter.objects.select_related('book_project').get(pk=pk)
            if chapter.book_project.creator != core_user:
                return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)
        except Chapter.DoesNotExist:
            return Response({'error': 'Chapter not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Create draft Content item for this chapter
        # Use book cover image as teaser_link if available
        teaser_link = f'/api/content/{pk}/teaser/'
        if chapter.book_project.cover_image:
            teaser_link = chapter.book_project.cover_image.url
        
        content = Content.objects.create(
            creator=core_user,
            title=f"{chapter.book_project.title} - {chapter.title}",
            teaser_html=chapter.content_html,
            teaser_link=teaser_link,
            content_type='book',
            genre='other',
            inventory_status='draft'  # Keep as draft until minted
        )
        if not chapter.book_project.cover_image:
            content.teaser_link = f'/api/content/{content.id}/teaser/'
            content.save()
        
        # Don't mark as published yet - that happens after minting
        chapter.published_content = content
        chapter.save()
        
        return Response({
            'content_id': content.id,
            'message': 'Chapter prepared for minting'
        }, status=status.HTTP_201_CREATED)


class PublishChapterView(APIView):
    """Publish a single chapter as Content/NFT."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        try:
            chapter = Chapter.objects.select_related('book_project').get(pk=pk)
            if chapter.book_project.creator != core_user:
                return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)
        except Chapter.DoesNotExist:
            return Response({'error': 'Chapter not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Create Content item for this chapter
        # Use book cover image as teaser_link if available
        teaser_link = f'/api/content/{pk}/teaser/'
        if chapter.book_project.cover_image:
            teaser_link = chapter.book_project.cover_image.url
        
        content = Content.objects.create(
            creator=core_user,
            title=f"{chapter.book_project.title} - {chapter.title}",
            teaser_html=chapter.content_html,
            teaser_link=teaser_link,
            content_type='book',
            genre='other'
        )
        if not chapter.book_project.cover_image:
            content.teaser_link = f'/api/content/{content.id}/teaser/'
            content.save()
        
        chapter.is_published = True
        chapter.published_content = content
        chapter.save()
        
        return Response({
            'content_id': content.id,
            'message': 'Chapter published successfully'
        }, status=status.HTTP_201_CREATED)


class PrepareBookView(APIView):
    """Prepare entire book for minting (creates draft Content)."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        try:
            project = BookProject.objects.get(pk=pk, creator=core_user)
        except BookProject.DoesNotExist:
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Combine all chapters into one HTML document
        chapters = project.chapters.all().order_by('order')
        if not chapters.exists():
            return Response({'error': 'No chapters to publish'}, status=status.HTTP_400_BAD_REQUEST)
        
        combined_html = ''
        for chapter in chapters:
            combined_html += f'<h2>{chapter.title}</h2>\n{chapter.content_html}\n\n'
        
        # Create draft Content item for the entire book
        # Use book cover image as teaser_link if available
        teaser_link = f'/api/content/{pk}/teaser/'
        if project.cover_image:
            teaser_link = project.cover_image.url
        
        content = Content.objects.create(
            creator=core_user,
            title=project.title,
            teaser_html=combined_html,
            teaser_link=teaser_link,
            content_type='book',
            genre='other',
            inventory_status='draft'  # Keep as draft until minted
        )
        if not project.cover_image:
            content.teaser_link = f'/api/content/{content.id}/teaser/'
            content.save()
        
        # Don't mark as published yet - that happens after minting
        project.published_content = content
        project.save()
        
        return Response({
            'content_id': content.id,
            'message': 'Book prepared for minting'
        }, status=status.HTTP_201_CREATED)


class PublishBookView(APIView):
    """Publish entire book (all chapters combined) as Content/NFT."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        try:
            project = BookProject.objects.get(pk=pk, creator=core_user)
        except BookProject.DoesNotExist:
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Combine all chapters into one HTML document
        chapters = project.chapters.all().order_by('order')
        if not chapters.exists():
            return Response({'error': 'No chapters to publish'}, status=status.HTTP_400_BAD_REQUEST)
        
        combined_html = ''
        for chapter in chapters:
            combined_html += f'<h2>{chapter.title}</h2>\n{chapter.content_html}\n\n'
        
        # Create Content item for the entire book
        # Use book cover image as teaser_link if available
        teaser_link = f'/api/content/{pk}/teaser/'
        if project.cover_image:
            teaser_link = project.cover_image.url
        
        content = Content.objects.create(
            creator=core_user,
            title=project.title,
            teaser_html=combined_html,
            teaser_link=teaser_link,
            content_type='book',
            genre='other'
        )
        if not project.cover_image:
            content.teaser_link = f'/api/content/{content.id}/teaser/'
            content.save()
        
        project.is_published = True
        project.published_content = content
        project.save()
        
        return Response({
            'content_id': content.id,
            'message': 'Book published successfully'
        }, status=status.HTTP_201_CREATED)


class BookProjectByContentView(APIView):
    """Get book project by its published content ID."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, content_id):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        try:
            # Try to find a book project that published this content
            project = BookProject.objects.filter(
                creator=core_user,
                published_content_id=content_id
            ).first()
            
            if project:
                serializer = BookProjectSerializer(project)
                return Response(serializer.data)
            
            # Also check if any chapter published this content
            chapter = Chapter.objects.filter(
                book_project__creator=core_user,
                published_content_id=content_id
            ).select_related('book_project').first()
            
            if chapter:
                serializer = BookProjectSerializer(chapter.book_project)
                return Response(serializer.data)
            
            return Response({'error': 'No book project found for this content'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
