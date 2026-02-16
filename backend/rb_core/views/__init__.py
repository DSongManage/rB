from django.shortcuts import render
from django.http import HttpResponse
from django.db import models
import logging
from rest_framework import generics
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from ..models import Content, UserProfile, User as CoreUser, BookProject, Chapter, CollaborativeProject, CollaboratorRole, ContractTask, Tag, Series
from ..serializers import ContentSerializer, UserProfileSerializer, SignupSerializer, ProfileEditSerializer, ProfileStatusUpdateSerializer, BookProjectSerializer, ChapterSerializer, SeriesSerializer
from ..utils import verify_web3auth_jwt, extract_wallet_from_claims, Web3AuthVerificationError
from ..utils.ipfs_utils import upload_to_ipfs
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
from ..notifications_utils import notify_collaboration_invitation
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

# Initialize logger
logger = logging.getLogger(__name__)

# Create your views here.

def home(request):
    return HttpResponse("renaissBlock Backend Running")


class HealthCheckView(APIView):
    """
    Comprehensive health check endpoint for monitoring.

    Returns:
        - status: 'healthy' or 'degraded'
        - version: Application version from git commit
        - checks: Individual component status
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = []  # No throttling on health checks

    def get(self, request):
        import time
        from django.db import connection
        from django.core.cache import cache
        start_time = time.time()

        checks = {}
        overall_healthy = True

        # Check database connectivity
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            checks['database'] = {'status': 'healthy', 'latency_ms': None}
        except Exception as e:
            checks['database'] = {'status': 'unhealthy', 'error': str(e)}
            overall_healthy = False

        # Check Redis/Celery broker (if configured)
        try:
            from django.conf import settings
            if 'redis' in settings.CELERY_BROKER_URL.lower():
                import redis
                r = redis.from_url(settings.CELERY_BROKER_URL)
                r.ping()
                checks['redis'] = {'status': 'healthy'}
            else:
                checks['redis'] = {'status': 'skipped', 'reason': 'not using redis'}
        except ImportError:
            checks['redis'] = {'status': 'skipped', 'reason': 'redis not installed'}
        except Exception as e:
            checks['redis'] = {'status': 'unhealthy', 'error': str(e)}
            # Redis being down is degraded, not critical
            overall_healthy = overall_healthy  # Don't fail on Redis

        # Check Cloudinary (if configured)
        try:
            from django.conf import settings
            if settings.CLOUDINARY_STORAGE.get('CLOUD_NAME'):
                checks['storage'] = {'status': 'configured', 'provider': 'cloudinary'}
            else:
                checks['storage'] = {'status': 'configured', 'provider': 'filesystem'}
        except Exception as e:
            checks['storage'] = {'status': 'unknown', 'error': str(e)}

        # Get version info
        version = os.getenv('RAILWAY_GIT_COMMIT_SHA', 'development')[:8]
        environment = getattr(settings, 'ENVIRONMENT', 'unknown')

        # Calculate response time
        response_time = round((time.time() - start_time) * 1000, 2)

        response_data = {
            'status': 'healthy' if overall_healthy else 'degraded',
            'version': version,
            'environment': environment,
            'response_time_ms': response_time,
            'checks': checks,
        }

        status_code = 200 if overall_healthy else 503
        return Response(response_data, status=status_code)


class AuthStatusView(APIView):
    permission_classes = [permissions.AllowAny]  # Explicit: handles both authenticated and unauthenticated

    def get(self, request):
        import logging
        logger = logging.getLogger(__name__)

        logger.info(f'[AuthStatus] Session key: {request.session.session_key}')
        logger.info(f'[AuthStatus] Session data: {dict(request.session)}')
        logger.info(f'[AuthStatus] Cookies received: {request.COOKIES}')
        logger.info(f'[AuthStatus] User: {request.user}, Authenticated: {request.user.is_authenticated}')

        is_authed = request.user.is_authenticated
        wallet = None
        user_data = None

        if is_authed:
            prof = None
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
            avatar_url = None
            try:
                if prof:
                    avatar_url = prof.resolved_avatar_url
            except Exception:
                pass

            user_data = {
                'id': request.user.id,
                'username': request.user.username,
                'email': getattr(request.user, 'email', ''),
                'display_name': display_name,
                'avatar_url': avatar_url,
                'has_seen_beta_welcome': prof.has_seen_beta_welcome if prof else False,
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

    # Add pagination to prevent loading all content at once
    from rest_framework.pagination import PageNumberPagination

    class ContentPagination(PageNumberPagination):
        page_size = 20
        page_size_query_param = 'page_size'
        max_page_size = 100

    pagination_class = ContentPagination

    # Filter by inventory status or mine
    def get_queryset(self):
        from django.db.models import Q

        # Optimize with select_related to avoid N+1 queries on creator
        qs = Content.objects.select_related('creator').all()

        # Exclude collaboration placeholder content from public listings (FR8 bug fix)
        # Collaboration invites create placeholder content with title starting with "Collaboration Invite"
        # These should only appear in collaboration management, not public browse
        qs = qs.exclude(title__startswith='Collaboration Invite')

        # Content Removal Policy: Exclude delisted and orphaned content from marketplace
        # 1. Hide content where source chapter is delisted (is_listed=False)
        # 2. Hide orphaned BOOK content (chapter/book/collaborative project was deleted)
        #    - Only apply to books, as art/music/film can be standalone uploads
        #    - Include collaborative projects as valid book sources
        qs = qs.exclude(
            Q(source_chapter__isnull=False) & Q(source_chapter__is_listed=False)
        ).exclude(
            Q(content_type='book') &
            Q(source_chapter__isnull=True) &
            Q(source_book_project__isnull=True) &
            Q(source_collaborative_project__isnull=True)
        )

        status_f = self.request.query_params.get('inventory_status')
        mine = self.request.query_params.get('mine')

        # When viewing own content (mine=1), show all statuses unless explicitly filtered
        # This allows users to see their minted, draft, AND delisted content
        if mine and self.request.user.is_authenticated:
            try:
                core_user = CoreUser.objects.get(username=self.request.user.username)
                # Include content where user is creator OR user is an accepted collaborator
                # on a collaborative project that published this content
                from django.contrib.auth import get_user_model
                AuthUser = get_user_model()
                auth_user = AuthUser.objects.get(username=self.request.user.username)

                # Get collaborative projects where user is an accepted collaborator
                collab_project_ids = CollaboratorRole.objects.filter(
                    user=auth_user,
                    status='accepted'
                ).values_list('project_id', flat=True)

                # Get content IDs from those collaborative projects
                collab_content_ids = CollaborativeProject.objects.filter(
                    id__in=collab_project_ids,
                    published_content__isnull=False
                ).values_list('published_content_id', flat=True)

                # Filter: creator=user OR content is from a collab project user is part of
                qs = qs.filter(
                    Q(creator=core_user) |
                    Q(id__in=collab_content_ids)
                )

                # Apply status filter only if explicitly requested
                if status_f:
                    qs = qs.filter(inventory_status=status_f)
                # Otherwise show all statuses (minted, draft, delisted) for own content

            except CoreUser.DoesNotExist:
                qs = qs.none()
        else:
            # Public browsing: filter by status
            if status_f:
                qs = qs.filter(inventory_status=status_f)
            else:
                # Default to showing only minted content for public home page
                qs = qs.filter(inventory_status='minted')

        # Apply genre filter if specified
        genre_param = self.request.query_params.get('genre')
        if genre_param and genre_param != 'all':
            qs = qs.filter(genre=genre_param)

        # Apply sorting based on sort parameter
        sort_param = self.request.query_params.get('sort', 'newest')

        if sort_param == 'popular':
            # Sort by view count (most popular)
            qs = qs.order_by('-view_count', '-created_at')
        elif sort_param == 'rated':
            # Sort by average rating (highest rated, with ratings first)
            qs = qs.order_by(
                models.F('average_rating').desc(nulls_last=True),
                '-rating_count',
                '-created_at'
            )
        elif sort_param == 'bestsellers':
            # Sort by purchase count
            from django.db.models import Count
            qs = qs.annotate(
                purchase_count=Count('purchases', filter=Q(purchases__status='completed'))
            ).order_by('-purchase_count', '-created_at')
        else:  # 'newest' is default
            qs = qs.order_by('-created_at')

        return qs

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return super().get_permissions()

    def perform_create(self, serializer):
        from ..utils.file_validation import validate_upload
        import cloudinary.uploader
        import logging

        logger = logging.getLogger(__name__)

        file = self.request.FILES.get('file')
        text = self.request.data.get('text')
        ipfs_hash = ''  # Will store original file Cloudinary URL temporarily, then IPFS hash after minting
        teaser_link = ''

        # Basic moderation: simple keyword filter on title
        bad_words = { 'porn', 'explicit', 'illegal' }
        title = (self.request.data.get('title') or '').lower()
        flagged = any(w in title for w in bad_words)

        # MVP: Film and Music content types are coming soon - reject creation attempts
        content_type_check = (self.request.data.get('content_type') or '').strip().lower()
        if content_type_check in ('film', 'music', 'video'):
            from rest_framework.exceptions import ValidationError
            raise ValidationError({
                'content_type': 'Film and Music content types are coming soon. Please create Books or Art for now.'
            })

        # Validate upload if a file was provided (with magic byte validation)
        if file:
            validate_upload(file)

            # Upload to Cloudinary (FAST!) instead of IPFS (slow)
            # IPFS upload will happen later during minting
            try:
                content_type = (self.request.data.get('content_type') or '').strip()
                name = getattr(file, 'name', '').lower()
                is_image = any(name.endswith(ext) for ext in ('.png', '.jpg', '.jpeg', '.webp'))

                if is_image and Image is not None:
                    # First, upload original file (for later IPFS minting)
                    try:
                        file.seek(0)
                        original_result = cloudinary.uploader.upload(
                            file,
                            folder='content_originals',
                            resource_type='image'
                        )
                        ipfs_hash = original_result['secure_url']  # Store temporarily in ipfs_hash
                        logger.info(f'[Cloudinary] ✅ Original uploaded: {ipfs_hash}')
                    except Exception as e:
                        logger.error(f'[Cloudinary] Original upload failed: {e}')

                    # Create watermarked version for preview
                    try:
                        # Reset file pointer
                        file.seek(0)
                        img = Image.open(file)

                        # Add watermark
                        draw = ImageDraw.Draw(img)
                        text_wm = 'renaissBlock'
                        w, h = img.size

                        # Semi-transparent watermark box at bottom-right
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

                        # Save watermarked image to BytesIO
                        out = BytesIO()
                        fmt = 'PNG' if name.endswith('.png') else 'JPEG'
                        img.save(out, format=fmt)
                        out.seek(0)

                        # Upload watermarked image to Cloudinary
                        logger.info(f'[Cloudinary] Uploading watermarked image for content')
                        result = cloudinary.uploader.upload(
                            out,
                            folder='content_previews',
                            resource_type='image',
                            quality='auto:good',
                            fetch_format='auto'
                        )

                        teaser_link = result['secure_url']
                        logger.info(f'[Cloudinary] ✅ Watermarked image uploaded: {teaser_link}')

                    except Exception as e:
                        # Fallback: upload original without watermark
                        logger.error(f'[Cloudinary] Watermark failed, uploading original: {e}')
                        file.seek(0)
                        result = cloudinary.uploader.upload(
                            file,
                            folder='content_previews',
                            resource_type='image'
                        )
                        teaser_link = result['secure_url']

                else:
                    # Non-image file (PDF, video, audio, etc.)
                    # Upload original for later IPFS minting
                    file.seek(0)
                    logger.info(f'[Cloudinary] Uploading original non-image file: {name}')
                    original_result = cloudinary.uploader.upload(
                        file,
                        folder='content_originals',
                        resource_type='auto'  # Auto-detect file type
                    )
                    ipfs_hash = original_result['secure_url']  # Store temporarily
                    logger.info(f'[Cloudinary] ✅ Original file uploaded: {ipfs_hash}')

                    # For non-images, use the same file as preview (no watermarking)
                    teaser_link = ipfs_hash
                    logger.info(f'[Cloudinary] Using original as preview for non-image content')

            except Exception as e:
                logger.error(f'[Cloudinary] Upload failed: {e}')
                # Fallback to placeholder
                teaser_link = 'https://via.placeholder.com/400x300?text=Upload+Failed'

        elif text:
            # Text-only content (books, articles)
            # Build a teaser from first portion (watermarked preview)
            try:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(text or '', 'lxml')
                plain = soup.get_text(separator='\n')
                # Take first ~15% of content for teaser
                n = max(200, min(len(plain) // 6, 1500))
                snippet = plain[:n]
                teaser_html_local = f"<div style=\"white-space: pre-wrap;\">{snippet}...</div>"
            except Exception:
                teaser_html_local = ''

            # Set a temporary internal route; finalize after save when we have an ID
            teaser_link = ''  # Will be set to /api/content/{id}/teaser/ below

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
        collaborator_role = request.data.get('role', 'collaborator')  # Role name
        tasks_data = request.data.get('tasks', [])  # Contract tasks
        project_type = request.data.get('project_type', 'book')  # Project type: book, art, music, video

        # Validate project_type
        valid_types = ['book', 'art', 'music', 'video', 'comic']
        if project_type not in valid_types:
            project_type = 'book'  # Fallback to book if invalid
        
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

        # === BRIDGE TO NEW COLLABORATION SYSTEM ===
        # Also create CollaborativeProject and CollaboratorRole for the new invite system
        # IMPORTANT: All foreign keys (created_by, user) expect Django User objects, NOT UserProfile
        try:
            # Create CollaborativeProject - created_by expects Django User
            project = CollaborativeProject.objects.create(
                title=content.title or f"Collaboration with {', '.join(c.username for c in collaborators)}",
                description=message_clean,
                content_type=project_type,  # User-selected project type (book, art, music, video)
                created_by=request.user,  # Django User, not UserProfile
                status='active',
            )

            # Add creator as accepted collaborator (owner)
            # CollaboratorRole.user expects Django User
            CollaboratorRole.objects.create(
                project=project,
                user=request.user,  # Django User, not UserProfile
                role='creator',
                status='accepted',
                revenue_percentage=100 - equity_percent,
                can_edit_text=True,
                can_edit_images=True,
                can_edit_audio=True,
                can_edit_video=True,
            )

            # Add each invited collaborator
            per_collaborator_equity = equity_percent // len(collaborators) if collaborators else equity_percent
            for collaborator in collaborators:
                # Create CollaboratorRole with 'invited' status
                # collaborator is already a Django User object from AuthUser.objects.filter()
                collab_role = CollaboratorRole.objects.create(
                    project=project,
                    user=collaborator,  # Django User, not UserProfile
                    role=collaborator_role,  # Use provided role name
                    status='invited',  # THIS IS THE KEY - status must be 'invited'
                    revenue_percentage=per_collaborator_equity,
                    can_edit_text=True,
                    can_edit_images=False,
                    can_edit_audio=False,
                    can_edit_video=False,
                )

                # Create contract tasks if provided
                if tasks_data:
                    from dateutil.parser import parse as parse_datetime
                    for i, task_data in enumerate(tasks_data):
                        try:
                            deadline = parse_datetime(task_data.get('deadline'))
                            ContractTask.objects.create(
                                collaborator_role=collab_role,
                                title=task_data.get('title', '')[:200],
                                description=task_data.get('description', ''),
                                deadline=deadline,
                                status='pending',  # Will become 'in_progress' on acceptance
                                order=i,
                            )
                        except Exception as task_err:
                            logger.warning(f"[Invite] Failed to create task: {task_err}")

                    # Update task count
                    collab_role.tasks_total = len(tasks_data)
                    collab_role.save(update_fields=['tasks_total'])

                # Send notification via new system
                # notify_collaboration_invitation expects Django User objects
                notify_collaboration_invitation(
                    request.user,      # Django User (inviter)
                    collaborator,      # Django User (invitee)
                    project,
                    'collaborator'
                )

            logger.info(f"[Invite] Created CollaborativeProject #{project.id} with {len(collaborators)} invited collaborator(s)")
        except Exception as e:
            # Log but don't fail the request - legacy system still works
            logger.error(f"[Invite] Failed to create CollaborativeProject bridge: {e}")

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

                # Upload to IPFS if not already done
                # Check if ipfs_hash contains a Cloudinary URL (temporary storage)
                if c.ipfs_hash and 'cloudinary.com' in c.ipfs_hash:
                    try:
                        import requests
                        logger.info(f'[IPFS] Fetching original file from Cloudinary: {c.ipfs_hash}')

                        # Fetch the original file from Cloudinary
                        response = requests.get(c.ipfs_hash, timeout=30)
                        response.raise_for_status()

                        # Upload to IPFS
                        file_data = BytesIO(response.content)
                        file_data.seek(0)

                        logger.info(f'[IPFS] Uploading to IPFS...')
                        ipfs_result = upload_to_ipfs(file_data)

                        if ipfs_result:
                            c.ipfs_hash = ipfs_result  # Replace Cloudinary URL with IPFS hash
                            logger.info(f'[IPFS] ✅ Uploaded successfully: {ipfs_result}')
                        else:
                            logger.error(f'[IPFS] Upload failed, keeping Cloudinary URL')

                    except Exception as e:
                        logger.error(f'[IPFS] Upload error: {e}')
                        # Keep the Cloudinary URL as fallback

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

                # If this content is linked to a collaborative project (comic), mark as minted
                collab_projects = c.source_collaborative_project.all()
                for collab_project in collab_projects:
                    if collab_project.status != 'minted':
                        collab_project.status = 'minted'
                        collab_project.save()
                        logger.info(f'[MINT] Updated CollaborativeProject {collab_project.id} status to minted')

                # If this content is linked to a comic issue, mark as published
                from ..models import ComicIssue
                comic_issue = ComicIssue.objects.filter(published_content=c).first()
                if comic_issue:
                    comic_issue.is_published = True
                    comic_issue.save()
                    logger.info(f'[MINT] Updated ComicIssue {comic_issue.id} is_published to True')

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
        # Flat 10% platform fee for all creators
        profile.fee_bps = 1000  # Always 10%
        # Keep tier for gamification/display (no fee impact)
        s = float(profile.total_sales_usd or 0)
        if s < 500:
            profile.tier = 'Basic'
        elif s < 5000:
            profile.tier = 'Pro'
        else:
            profile.tier = 'Elite'
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

    def perform_update(self, serializer):
        """Handle tag_ids when updating content."""
        instance = serializer.save()

        # Handle tags if tag_ids provided in request
        tag_ids = self.request.data.get('tag_ids')
        if tag_ids is not None:
            # Set the tags (replaces existing tags)
            instance.tags.set(tag_ids)
            # Update usage counts for newly added tags
            Tag.objects.filter(id__in=tag_ids).update(
                usage_count=models.F('usage_count') + 1
            )


class ContentUnpublishView(APIView):
    """Unpublish solo art/music/film content.

    Collaborative content must be unpublished through the project proposal system.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        try:
            core_user = CoreUser.objects.get(username=request.user.username)
        except CoreUser.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            content = Content.objects.get(id=pk)
        except Content.DoesNotExist:
            return Response({'error': 'Content not found'}, status=status.HTTP_404_NOT_FOUND)

        # Verify ownership
        if content.creator != core_user:
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        # Only allow for non-collaborative content
        if content.source_collaborative_project.exists():
            return Response(
                {'error': 'Collaborative content must be unpublished through the project'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Only allow for minted non-book content (art, music, film)
        if content.inventory_status != 'minted':
            return Response(
                {'error': 'Only published content can be unpublished'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if content.content_type == 'book':
            return Response(
                {'error': 'Books cannot be unpublished this way'},
                status=status.HTTP_400_BAD_REQUEST
            )

        content.inventory_status = 'unpublished'
        content.save()

        return Response({'status': 'unpublished', 'id': content.id})


class ContentPreviewView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request, pk:int):
        try:
            c = Content.objects.get(id=pk)
        except Content.DoesNotExist:
            return Response({'error':'not found'}, status=404)
        data = ContentSerializer(c, context={'request': request}).data
        return Response({
            'id': c.id,
            'title': c.title,
            'teaser_link': c.teaser_link,
            'content_type': c.content_type,
            'genre': c.genre,
            'created_at': c.created_at.isoformat() if c.created_at else None,
            'authors_note': c.authors_note or '',
            'inventory_status': c.inventory_status,
            'nft_contract': c.nft_contract,
            'price_usd': float(c.price_usd),
            'editions': c.editions,
            'creator_username': data.get('creator_username'),
            'creator_avatar': data.get('creator_avatar'),
            'is_collaborative': data.get('is_collaborative', False),
            'collaborators': data.get('collaborators', []),
            'like_count': data.get('like_count', 0),
            'user_has_liked': data.get('user_has_liked', False),
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
    throttle_classes = []  # No throttling for search

    def get(self, request):
        q = request.query_params.get('q', '').strip()

        # Input validation - allow empty query for browse/filter mode
        if q and len(q) > 100:
            return Response({'error': 'Query too long (max 100 characters)'}, status=400)

        genre = request.query_params.get('genre')
        ctype = request.query_params.get('type')

        # Only search minted (public) content
        qs = Content.objects.filter(inventory_status='minted')

        # Content Removal Policy: Exclude delisted and orphaned content from search
        # 1. Hide content where source chapter is delisted (is_listed=False)
        # 2. Hide orphaned BOOK content (chapter/book/collaborative project was deleted)
        #    - Only apply to books, as art/music/film can be standalone uploads
        #    - Include collaborative projects as valid book sources
        from django.db.models import Q
        qs = qs.exclude(
            Q(source_chapter__isnull=False) & Q(source_chapter__is_listed=False)
        ).exclude(
            Q(content_type='book') &
            Q(source_chapter__isnull=True) &
            Q(source_book_project__isnull=True) &
            Q(source_collaborative_project__isnull=True)
        )

        # Only apply text search if query provided and at least 2 characters
        # Search in title, creator username, and tags (name and slug)
        if q and len(q) >= 2:
            qs = qs.filter(
                models.Q(title__icontains=q) |
                models.Q(creator__username__icontains=q) |
                models.Q(tags__name__icontains=q) |
                models.Q(tags__slug__icontains=q)
            ).distinct()  # Avoid duplicates from tag joins
        if genre and genre != 'all':
            qs = qs.filter(genre=genre)
        if ctype and ctype != 'all':
            qs = qs.filter(content_type=ctype)

        # Filter by specific tag slug (for tag-based navigation)
        tag_slug = request.query_params.get('tag')
        if tag_slug:
            qs = qs.filter(tags__slug=tag_slug)

        # Limit results to prevent abuse
        data = ContentSerializer(qs.order_by('-view_count', '-created_at')[:50], many=True, context={'request': request}).data
        return Response(data)


class TrackContentViewView(APIView):
    """Track unique content views for analytics and discovery.

    - Deduplicates views: logged-in users tracked by user_id, anonymous by session
    - Excludes self-views: creators viewing their own content don't count
    - Only increments view_count for new unique views
    """
    permission_classes = [permissions.AllowAny]
    # Exempt from CSRF since this is a non-sensitive tracking endpoint
    authentication_classes = []

    def get_client_ip(self, request):
        """Extract client IP from request headers."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    def post(self, request, pk):
        from django.db.models import F
        from django.utils import timezone
        from datetime import timedelta
        from ..models import ContentView

        try:
            content = Content.objects.select_related('creator').get(pk=pk, inventory_status='minted')
        except Content.DoesNotExist:
            return Response({'error': 'Content not found'}, status=404)

        user = request.user if request.user.is_authenticated else None

        # Self-view check: creator viewing their own content doesn't count
        if user and content.creator_id == user.id:
            return Response({
                'view_count': content.view_count,
                'counted': False,
                'reason': 'self_view'
            })

        # Check for collaborative content - exclude all collaborators' self-views
        if user:
            from ..models import CollaborativeProject, CollaboratorRole
            # Check if this content belongs to a collaborative project where user is a collaborator
            is_collaborator = CollaboratorRole.objects.filter(
                project__content=content,
                user=user,
                status='accepted'
            ).exists()
            if is_collaborator:
                return Response({
                    'view_count': content.view_count,
                    'counted': False,
                    'reason': 'collaborator_view'
                })

        # Deduplication check
        is_new_view = False

        if user:
            # Logged-in user: check if they've ever viewed this content
            existing_view = ContentView.objects.filter(content=content, user=user).exists()
            if not existing_view:
                ContentView.objects.create(content=content, user=user, ip_address=self.get_client_ip(request))
                is_new_view = True
        else:
            # Anonymous user: use session key with 24-hour window
            session_key = request.session.session_key
            if not session_key:
                # Create session if it doesn't exist
                request.session.create()
                session_key = request.session.session_key

            if session_key:
                # Check for view in last 24 hours from this session
                cutoff = timezone.now() - timedelta(hours=24)
                existing_view = ContentView.objects.filter(
                    content=content,
                    session_key=session_key,
                    created_at__gte=cutoff
                ).exists()
                if not existing_view:
                    ContentView.objects.create(
                        content=content,
                        session_key=session_key,
                        ip_address=self.get_client_ip(request)
                    )
                    is_new_view = True
            else:
                # Fallback: use IP with 24-hour window (less reliable but better than nothing)
                ip_address = self.get_client_ip(request)
                if ip_address:
                    cutoff = timezone.now() - timedelta(hours=24)
                    existing_view = ContentView.objects.filter(
                        content=content,
                        user__isnull=True,
                        session_key__isnull=True,
                        ip_address=ip_address,
                        created_at__gte=cutoff
                    ).exists()
                    if not existing_view:
                        ContentView.objects.create(content=content, ip_address=ip_address)
                        is_new_view = True

        # Only increment view_count for new unique views
        if is_new_view:
            Content.objects.filter(pk=pk).update(view_count=F('view_count') + 1)
            content.refresh_from_db()

        return Response({
            'view_count': content.view_count,
            'counted': is_new_view
        })

class DashboardView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        # Bridge to core user to avoid FK mismatches
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        profile, _ = UserProfile.objects.get_or_create(user=core_user, defaults={'username': core_user.username})
        # Flat 10% platform fee for all creators
        sales = float(profile.total_sales_usd or 0)
        profile.fee_bps = 1000  # Always 10%
        # Keep tier for gamification/display (no fee impact)
        if sales < 500:
            profile.tier = 'Basic'
        elif sales < 5000:
            profile.tier = 'Pro'
        else:
            profile.tier = 'Elite'
        profile.save()
        return Response({
            'content_count': profile.content_count,
            'collabs': Collaboration.objects.filter(initiators=core_user).count(),
            'sales': sales,
            'tier': profile.tier,
            'fee': round(profile.fee_bps / 100.0, 2)
        })


class SalesAnalyticsView(APIView):
    """Detailed sales analytics for creator dashboard.

    All earnings are tracked via CollaboratorPayment records.
    - Solo content: Purchases where user is the only recipient
    - Collaborations: Purchases where multiple people received payment
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum, Count
        from django.db.models.functions import TruncDate
        from rb_core.models import Purchase, CollaboratorPayment, Content, CollaborativeProject

        # Get current user
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        profile, _ = UserProfile.objects.get_or_create(user=core_user, defaults={'username': core_user.username})

        # ========== ALL EARNINGS FROM COLLABORATORPAYMENT ==========
        # CollaboratorPayment is the single source of truth for all earnings
        user_payments = CollaboratorPayment.objects.filter(
            collaborator=core_user
        ).select_related(
            'purchase__content',
            'purchase__chapter',
            'purchase__user'
        ).order_by('-paid_at')

        # Group payments by content/chapter and determine if solo or collaborative
        content_earnings = {}  # content_id -> {earnings data}

        for payment in user_payments:
            # Determine content info
            if payment.purchase.content:
                content_key = f"content_{payment.purchase.content.id}"
                content_obj = payment.purchase.content
                content_title = content_obj.title
                content_type = content_obj.content_type
                content_price = float(content_obj.price_usd)
                content_editions = content_obj.editions
                # Check if this is from a collaborative project (not a solo project)
                is_from_collab_project = False
                if hasattr(content_obj, 'source_collaborative_project') and content_obj.source_collaborative_project.exists():
                    collab_proj = content_obj.source_collaborative_project.first()
                    is_from_collab_project = collab_proj is not None and not collab_proj.is_solo
            elif payment.purchase.chapter:
                content_key = f"chapter_{payment.purchase.chapter.id}"
                content_title = payment.purchase.chapter.title
                content_type = 'book'
                content_price = float(payment.purchase.chapter.price)
                content_editions = 0  # Chapters don't have edition limits
                is_from_collab_project = False
            else:
                continue

            # Count how many recipients this purchase had
            recipients_count = CollaboratorPayment.objects.filter(
                purchase=payment.purchase
            ).count()

            # Determine if this is a collaboration (multiple recipients OR from collab project)
            is_collaborative = recipients_count > 1 or is_from_collab_project

            if content_key not in content_earnings:
                content_earnings[content_key] = {
                    'id': content_key,
                    'title': content_title,
                    'content_type': content_type,
                    'price': content_price,
                    'editions_remaining': content_editions,
                    'role': payment.role or 'Creator',
                    'percentage': payment.percentage,
                    'total_earnings': 0,
                    'sales_count': 0,
                    'is_collaborative': is_collaborative,
                    'transactions': [],  # Individual sale records
                }

            content_earnings[content_key]['total_earnings'] += float(payment.amount_usdc)
            content_earnings[content_key]['sales_count'] += 1

            # Add individual transaction for detailed view
            content_earnings[content_key]['transactions'].append({
                'id': payment.id,
                'buyer': payment.purchase.user.username,
                'amount': float(payment.amount_usdc),
                'percentage': payment.percentage,
                'date': payment.paid_at.isoformat(),
                'tx_signature': payment.transaction_signature[:16] + '...' if payment.transaction_signature else None,
            })

        # Split into solo and collaborative
        solo_content = []
        collab_content = []

        for key, data in content_earnings.items():
            if data['is_collaborative']:
                collab_content.append(data)
            else:
                solo_content.append(data)

        # ========== RECENT TRANSACTIONS (all payments) ==========
        recent_transactions = []
        for payment in user_payments[:30]:  # Get more recent ones
            if payment.purchase.content:
                title = payment.purchase.content.title
            elif payment.purchase.chapter:
                title = payment.purchase.chapter.title
            else:
                title = 'Unknown'

            # Check if collaborative
            recipients_count = CollaboratorPayment.objects.filter(
                purchase=payment.purchase
            ).count()

            recent_transactions.append({
                'id': payment.id,
                'type': 'collaboration' if recipients_count > 1 else 'solo',
                'title': title,
                'buyer': payment.purchase.user.username,
                'amount': float(payment.amount_usdc),
                'role': payment.role,
                'percentage': payment.percentage,
                'date': payment.paid_at.isoformat(),
                'tx_signature': payment.transaction_signature[:16] + '...' if payment.transaction_signature else None,
            })

        # ========== SUMMARY STATS ==========
        total_solo_earnings = sum(c['total_earnings'] for c in solo_content)
        total_collab_earnings = sum(c['total_earnings'] for c in collab_content)
        total_earnings = total_solo_earnings + total_collab_earnings

        return Response({
            'summary': {
                'total_earnings_usdc': round(total_earnings, 2),
                'solo_earnings': round(total_solo_earnings, 2),
                'collaboration_earnings': round(total_collab_earnings, 2),
                'content_count': len(solo_content),
                'collaboration_count': len(collab_content),
                'total_sales': sum(c['sales_count'] for c in content_earnings.values()),
            },
            'content_sales': sorted(solo_content, key=lambda x: x['total_earnings'], reverse=True),
            'collaboration_sales': sorted(collab_content, key=lambda x: x['total_earnings'], reverse=True),
            'recent_transactions': recent_transactions[:20],
        })


class Web3AuthLoginView(APIView):
    """Web3Auth login endpoint with strict rate limiting."""
    throttle_classes = ['rb_core.throttling.AuthAnonRateThrottle']

    def post(self, request):
        import logging
        logger = logging.getLogger(__name__)

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
            # Check if this wallet is already linked to a DIFFERENT user
            existing_wallet_profile = UserProfile.objects.filter(wallet_address=addr).exclude(user=core_user).first()
            if existing_wallet_profile:
                # This wallet belongs to a different account - log in as that account instead
                logger.warning(
                    f'Web3Auth wallet {addr[:20]}... already linked to {existing_wallet_profile.username}. '
                    f'Logging in as {existing_wallet_profile.username} instead of {core_user.username}'
                )
                # Update the existing profile's web3auth_sub to link the identities
                existing_wallet_profile.web3auth_sub = sub
                try:
                    existing_wallet_profile.save(update_fields=['web3auth_sub'])
                except Exception as e:
                    logger.error(f'Failed to save web3auth_sub for {existing_wallet_profile.username}: {e}')

                # Log in as the account that owns this wallet
                core_user = existing_wallet_profile.user
            else:
                # Wallet is free, link it
                prof.wallet_address = addr
                changed = True
        if changed:
            try:
                prof.save()
            except Exception as e:
                logger.error(f'Failed to save profile for {core_user.username}: {e}')
                # Try to save just web3auth_sub
                try:
                    prof.save(update_fields=['web3auth_sub'])
                except Exception as e2:
                    logger.error(f'Failed to save web3auth_sub for {core_user.username}: {e2}')
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
        """Link wallet to user account (Web3Auth or external with signature verification)"""
        import logging
        logger = logging.getLogger(__name__)

        addr = request.data.get('wallet_address', '').strip()
        token = request.data.get('web3auth_token', '').strip()
        signature = request.data.get('signature', '').strip()
        message = request.data.get('message', '').strip()

        # Path 1: Web3Auth token (derive address from JWT)
        if token and not addr:
            try:
                claims = verify_web3auth_jwt(token)
                derived = extract_wallet_from_claims(claims)
                addr = (derived or '').strip()

                # Also store Web3Auth subject identifier for future reference
                web3auth_sub = claims.get('sub', '')
            except Web3AuthVerificationError as exc:
                return Response({'error': f'web3auth verification failed: {exc}'}, status=400)

        # Path 2: External wallet with signature verification (SECURE)
        elif addr and signature and message:
            try:
                # Import Solana cryptography libraries
                from solders.pubkey import Pubkey as SoldersPubkey
                from nacl.signing import VerifyKey
                from nacl.exceptions import BadSignatureError
                import base64

                # Parse the public key
                try:
                    pubkey = SoldersPubkey.from_string(addr)
                except Exception as e:
                    return Response({'error': f'Invalid Solana address: {e}'}, status=400)

                # Decode signature from base64
                try:
                    signature_bytes = base64.b64decode(signature)
                except Exception as e:
                    return Response({'error': f'Invalid signature format: {e}'}, status=400)

                # Verify signature
                try:
                    verify_key = VerifyKey(bytes(pubkey))
                    message_bytes = message.encode('utf-8')
                    verify_key.verify(message_bytes, signature_bytes)
                except BadSignatureError:
                    return Response({'error': 'Signature verification failed - wallet ownership not proven'}, status=400)
                except Exception as e:
                    return Response({'error': f'Signature verification error: {e}'}, status=400)

                # Signature verified! Proceed with linking
                web3auth_sub = None

            except ImportError as e:
                # SECURITY: Fail closed - don't allow linking without verification
                logger.error(f'CRITICAL: Solana libraries not installed - cannot verify wallet signatures: {e}')
                return Response({
                    'error': 'Wallet verification is currently unavailable. Please try again later.',
                    'code': 'VERIFICATION_UNAVAILABLE'
                }, status=503)  # Service Unavailable

        # Path 3: Manual wallet address - REJECTED for security
        elif addr and not signature:
            # SECURITY: Reject wallet linking without proof of ownership
            logger.warning(f'REJECTED: Manual wallet linking attempt without signature: {addr[:8]}...')
            return Response({
                'error': 'Signature verification required. Please sign a message with your wallet to prove ownership.',
                'code': 'SIGNATURE_REQUIRED'
            }, status=400)
        else:
            return Response({'error':'wallet_address or web3auth_token required'}, status=400)

        if not addr:
            return Response({'error':'Could not derive wallet address'}, status=400)

        # Bridge auth.User -> rb_core.User by username
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        prof, _ = UserProfile.objects.get_or_create(user=core_user, defaults={'username': request.user.username})

        # Enforce uniqueness: wallet can't be linked to a DIFFERENT user's profile
        # (Allow re-linking the same wallet to the same user)
        existing_profile = UserProfile.objects.filter(wallet_address=addr).exclude(user=core_user).first()
        if existing_profile:
            logger.warning(
                f'Wallet link conflict: User {request.user.username} tried to link wallet {addr[:20]}... '
                f'but it is already linked to user {existing_profile.username}'
            )
            return Response({
                'error': f'This wallet is already linked to the account "{existing_profile.username}". Please log out and log in as {existing_profile.username} to access that account.',
                'code': 'WALLET_ALREADY_LINKED',
                'conflicting_wallet': addr[:20] + '...',
                'linked_to': existing_profile.username,
                'current_user': request.user.username,
                'suggestion': f'Log out and log in as {existing_profile.username}'
            }, status=400)

        # Update wallet info
        prof.wallet_address = addr[:44]
        prof.wallet_provider = 'web3auth' if token else 'external'

        # Store Web3Auth sub if available (for Web3Auth wallets)
        if web3auth_sub:
            prof.web3auth_sub = web3auth_sub

        prof.save()

        return Response({
            'ok': True,
            'wallet_address': addr[:44],
            'wallet_provider': prof.wallet_provider
        })

    def delete(self, request):
        """Disconnect wallet from user account"""
        # Bridge auth.User -> rb_core.User by username
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        prof, _ = UserProfile.objects.get_or_create(user=core_user, defaults={'username': request.user.username})

        # Clear wallet fields
        old_address = prof.wallet_address
        prof.wallet_address = None
        prof.wallet_provider = None
        prof.web3auth_sub = None
        prof.save()

        import logging
        logger = logging.getLogger(__name__)
        logger.info(f'User {request.user.username} disconnected wallet {old_address}')

        return Response({
            'success': True,
            'message': 'Wallet disconnected',
            'disconnected_address': old_address
        })

class CsrfTokenView(APIView):
    def get(self, request):
        # Ensure CSRF cookie is set in the response
        token = get_token(request)
        response = Response({'csrfToken': token})
        # Explicitly set the CSRF cookie for cross-origin requests
        # Use settings to get the correct cookie name and settings
        response.set_cookie(
            settings.CSRF_COOKIE_NAME,  # 'rb_csrftoken' from settings
            token,
            max_age=31449600,  # 1 year
            secure=settings.CSRF_COOKIE_SECURE,
            httponly=settings.CSRF_COOKIE_HTTPONLY,
            samesite=settings.CSRF_COOKIE_SAMESITE,
            domain=settings.CSRF_COOKIE_DOMAIN
        )
        return response

class UserSearchView(APIView):
    FEE_PERCENT_MAP = {
        'founding': '1%', 'level_5': '5%', 'level_4': '6%',
        'level_3': '7%', 'level_2': '8%', 'level_1': '9%', 'standard': '10%',
    }

    def _get_fee_percent(self, tier):
        return self.FEE_PERCENT_MAP.get(tier or 'standard', '10%')

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        role = (request.query_params.get('role') or '').strip()
        genre = (request.query_params.get('genre') or '').strip()
        loc = (request.query_params.get('location') or '').strip()
        status_param = (request.query_params.get('status') or '').strip().lower()
        exact_username = (request.query_params.get('exact_username') or '').strip()
        tier_filter = (request.query_params.get('tier') or '').strip()
        sort_param = (request.query_params.get('sort') or '').strip()
        if q.startswith('@'):
            q = q[1:]
        if exact_username.startswith('@'):
            exact_username = exact_username[1:]

        # If exact_username is provided, look up that specific user (for invitations)
        # This bypasses the private filter but only returns exact matches
        if exact_username:
            qs = UserProfile.objects.filter(username__iexact=exact_username).select_related('user')
        else:
            # Only show public profiles (is_private=False) in collaborator search
            qs = UserProfile.objects.filter(is_private=False).select_related('user')
        if q:
            qs = qs.filter(username__icontains=q)
        if role:
            qs = qs.filter(roles__icontains=role)
        if genre:
            qs = qs.filter(genres__icontains=genre)
        if loc:
            qs = qs.filter(location__icontains=loc)
        if status_param:
            # Map status categories to actual status values
            green_statuses = ['Available', 'Open to Offers', 'Open Node']
            yellow_statuses = ['Selective', 'Booked']
            red_statuses = ['Unavailable', 'On Hiatus']
            st = None
            if status_param == 'green':
                st = green_statuses
            elif status_param == 'yellow':
                st = yellow_statuses
            elif status_param == 'red':
                st = red_statuses
            if st:
                qs = qs.filter(status__in=st)
        # Tier filter: comma-separated list of tier names
        if tier_filter:
            valid_tiers = {'founding', 'level_5', 'level_4', 'level_3', 'level_2', 'level_1', 'standard'}
            tiers = [t.strip() for t in tier_filter.split(',') if t.strip() in valid_tiers]
            if tiers:
                qs = qs.filter(tier__in=tiers)
        # Exclude current logged-in user if authenticated
        try:
            if request.user and request.user.is_authenticated:
                qs = qs.exclude(username=request.user.username)
        except Exception:
            pass

        # Sorting
        TIER_PRIORITY_ORDER = ['founding', 'level_5', 'level_4', 'level_3', 'level_2', 'level_1', 'standard']
        if sort_param == 'tier':
            # Order by tier priority (best first) using CASE/WHEN
            from django.db.models import Case, When, IntegerField
            tier_ordering = Case(
                *[When(tier=t, then=i) for i, t in enumerate(TIER_PRIORITY_ORDER)],
                default=len(TIER_PRIORITY_ORDER),
                output_field=IntegerField(),
            )
            qs = qs.annotate(tier_rank=tier_ordering).order_by('tier_rank', 'username')
        else:
            qs = qs.order_by('username')

        # Pagination
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 12))
        page_size = min(page_size, 50)  # Cap at 50
        total_count = qs.count()
        total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1
        start = (page - 1) * page_size
        end = start + page_size
        qs = qs[start:end]
        
        # Enhance response with capabilities, accomplishments, and stats (FR8)
        results = []
        for p in qs:
            # Count successful (minted) collaborations - same logic as PublicProfileView
            successful_collabs = CollaborativeProject.objects.filter(
                collaborators__user=p.user,
                collaborators__status='accepted',
                status='minted'
            ).distinct().count()

            # Calculate total views from all user's content
            total_views = Content.objects.filter(
                creator=p.user,
                inventory_status='minted'
            ).aggregate(total=models.Sum('view_count'))['total'] or 0

            # Determine status category for badge color
            status_category = 'green'  # default
            if p.status:
                green_statuses = {'Available', 'Open to Offers'}
                yellow_statuses = {'Selective', 'Booked'}
                red_statuses = {'Unavailable', 'On Hiatus'}
                if p.status in green_statuses:
                    status_category = 'green'
                elif p.status in yellow_statuses:
                    status_category = 'yellow'
                elif p.status in red_statuses:
                    status_category = 'red'

            # Build absolute URLs for avatar and banner
            avatar_url = p.resolved_avatar_url
            banner_url = p.resolved_banner_url

            # Convert relative URLs to absolute URLs for frontend
            if avatar_url and avatar_url.startswith('/'):
                avatar_url = request.build_absolute_uri(avatar_url)
            if banner_url and banner_url.startswith('/'):
                banner_url = request.build_absolute_uri(banner_url)

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
                'tier': p.tier or 'standard',
                'fee_percent': self._get_fee_percent(p.tier),
                # Status
                'status': p.status or '',
                'status_category': status_category,  # 'green', 'yellow', 'red' for UI
                # Profile media - use resolved methods to get uploaded images
                'avatar_url': avatar_url,
                'banner_url': banner_url,
                'location': p.location or '',
                # Additional public profile stats
                'bio': p.bio or '',
                'follower_count': p.follower_count or 0,
                'total_views': total_views,
                'average_rating': float(p.average_review_rating) if p.average_review_rating else None,
            })

        response_data = {
            'results': results,
            'page': page,
            'page_size': page_size,
            'total_count': total_count,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1,
        }

        # Featured creators: on page 1 with no tier filter, include top-tier creators
        if page == 1 and not tier_filter and not exact_username:
            featured_qs = UserProfile.objects.filter(
                is_private=False,
                tier__in=['founding', 'level_5'],
            ).select_related('user').order_by('-lifetime_project_sales')[:6]
            try:
                if request.user and request.user.is_authenticated:
                    featured_qs = featured_qs.exclude(username=request.user.username)
            except Exception:
                pass
            featured = []
            for p in featured_qs:
                avatar_url = p.resolved_avatar_url
                if avatar_url and avatar_url.startswith('/'):
                    avatar_url = request.build_absolute_uri(avatar_url)
                featured.append({
                    'id': p.user.id,
                    'username': p.username,
                    'display_name': p.display_name,
                    'avatar_url': avatar_url,
                    'tier': p.tier or 'standard',
                    'fee_percent': self._get_fee_percent(p.tier),
                    'roles': p.roles or [],
                    'lifetime_project_sales': float(p.lifetime_project_sales or 0),
                })
            if featured:
                response_data['featured_creators'] = featured

        return Response(response_data)


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


class TestSessionView(APIView):
    """Test endpoint to verify session creation works."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        import logging
        logger = logging.getLogger(__name__)

        # Set a test value in session
        request.session['test_key'] = 'test_value'
        request.session.save()

        logger.info(f'Test session created: {request.session.session_key}')
        logger.info(f'Session data: {dict(request.session)}')

        return Response({
            'session_key': request.session.session_key,
            'session_data': dict(request.session),
            'cookies_will_be_set': True
        })


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
        import logging
        logger = logging.getLogger(__name__)

        logger.info(f'Logging in user: {user.username}')
        django_login(request, user)

        # Verify session was created
        logger.info(f'Session key after login: {request.session.session_key}')
        logger.info(f'Session data: {dict(request.session)}')

        # Trigger balance sync on login if user has a wallet
        balance_syncing = False
        if user.wallet_address:
            try:
                from rb_core.tasks import sync_user_balance_task
                sync_user_balance_task.delay(user.id)
                balance_syncing = True
                logger.info(f'Queued balance sync for user {user.id} on login')
            except Exception as e:
                logger.warning(f'Failed to queue balance sync on login: {e}')

        return Response({
            'message': 'Login successful',
            'username': user.username,
            'user_id': user.id,
            'balance_syncing': balance_syncing
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

        # Handle file uploads separately (not part of ProfileEditSerializer)
        files_updated = False
        if 'avatar' in request.FILES:
            validate_avatar(request.FILES['avatar'])
            profile.avatar_image = request.FILES['avatar']
            files_updated = True
        if 'banner' in request.FILES:
            validate_banner(request.FILES['banner'])
            profile.banner_image = request.FILES['banner']
            files_updated = True

        # If only uploading files, save and return early
        if files_updated and len(request.data) <= 2:  # Only file fields present
            profile.save()
            return Response(UserProfileSerializer(profile, context={'request': request}).data)

        # Otherwise, update other fields via serializer
        # Filter out file fields from data (serializer doesn't handle them)
        data = {k: v for k, v in request.data.items() if k not in ['avatar', 'banner']}
        if data:  # Only validate if there's non-file data
            serializer = ProfileEditSerializer(profile, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        elif files_updated:
            profile.save()

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


class PublicProfileView(APIView):
    """Public profile view - no authentication required.

    Returns comprehensive profile data for any user by username.
    """

    def get(self, request, username):
        from django.db.models import Exists, OuterRef
        from ..models import Content, ExternalPortfolioItem, CollaboratorRating, BookProject, Chapter
        from ..serializers import PublicProfileSerializer

        # Find the user profile
        try:
            profile = UserProfile.objects.select_related('user').get(username=username)
        except UserProfile.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        user = profile.user

        # Get platform works (minted content by this user)
        # Exclude individual book chapters - these will be grouped under book_projects
        # Use Exists() subquery for reliable filtering on reverse FK relations
        chapter_subquery = Chapter.objects.filter(published_content=OuterRef('pk'))
        platform_works = Content.objects.filter(
            creator=user,
            inventory_status='minted'
        ).exclude(
            # Exclude content that is linked as published_content from any Chapter
            Exists(chapter_subquery)
        ).order_by('-created_at')[:20]

        # Get book projects with published chapters for grouping
        book_projects = BookProject.objects.filter(
            creator=user
        ).prefetch_related(
            'chapters',
            'chapters__published_content'
        ).order_by('-updated_at')

        # Get external portfolio items
        external_portfolio = ExternalPortfolioItem.objects.filter(
            user=user
        ).order_by('order', '-created_at')

        # Get collaboration history - only show minted (completed) collaborations
        # Exclude solo projects and placeholder invite titles for a cleaner public profile
        collaborations = CollaborativeProject.objects.filter(
            collaborators__user=user,
            collaborators__status='accepted',
            status='minted',  # Only show completed collaborations
            is_solo=False,  # Exclude solo projects — not real collaborations
        ).exclude(
            title__startswith='Collaboration Invite'  # Filter out placeholder titles
        ).distinct().order_by('-created_at')[:10]

        # Count successful (minted) collaborations (exclude solo)
        successful_collabs_count = CollaborativeProject.objects.filter(
            collaborators__user=user,
            collaborators__status='accepted',
            status='minted',
            is_solo=False,
        ).distinct().count()

        # Get testimonials (public feedback from ratings)
        testimonials = CollaboratorRating.objects.filter(
            rated_user=user
        ).exclude(
            public_feedback=''
        ).select_related('rater', 'project').order_by('-created_at')[:10]

        # Prepare data for serializer
        data = {
            'profile': profile,
            'user': user,
            'platform_works': platform_works,
            'book_projects': book_projects,
            'external_portfolio': external_portfolio,
            'collaborations': collaborations,
            'testimonials': testimonials,
            'successful_collabs_count': successful_collabs_count,
        }

        serializer = PublicProfileSerializer(data, context={'request': request})
        return Response(serializer.data)


class ExternalPortfolioListCreateView(APIView):
    """List and create external portfolio items for authenticated user."""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        from ..models import ExternalPortfolioItem
        from ..serializers import ExternalPortfolioItemSerializer

        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        items = ExternalPortfolioItem.objects.filter(user=core_user).order_by('order', '-created_at')
        serializer = ExternalPortfolioItemSerializer(items, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        from ..models import ExternalPortfolioItem
        from ..serializers import ExternalPortfolioItemSerializer

        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)

        # Get max order for this user
        max_order = ExternalPortfolioItem.objects.filter(user=core_user).aggregate(
            max_order=models.Max('order')
        )['max_order'] or 0

        serializer = ExternalPortfolioItemSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=core_user, order=max_order + 1)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ExternalPortfolioDetailView(APIView):
    """Update or delete a specific external portfolio item."""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_object(self, pk, user):
        from ..models import ExternalPortfolioItem
        core_user, _ = CoreUser.objects.get_or_create(username=user.username)
        try:
            return ExternalPortfolioItem.objects.get(pk=pk, user=core_user)
        except ExternalPortfolioItem.DoesNotExist:
            return None

    def get(self, request, pk):
        from ..serializers import ExternalPortfolioItemSerializer

        item = self.get_object(pk, request.user)
        if not item:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ExternalPortfolioItemSerializer(item, context={'request': request})
        return Response(serializer.data)

    def patch(self, request, pk):
        from ..serializers import ExternalPortfolioItemSerializer

        item = self.get_object(pk, request.user)
        if not item:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ExternalPortfolioItemSerializer(item, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        item = self.get_object(pk, request.user)
        if not item:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExternalPortfolioReorderView(APIView):
    """Reorder external portfolio items."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from ..models import ExternalPortfolioItem

        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        item_ids = request.data.get('item_ids', [])

        if not item_ids:
            return Response({'error': 'item_ids required'}, status=status.HTTP_400_BAD_REQUEST)

        # Update order for each item
        for index, item_id in enumerate(item_ids):
            ExternalPortfolioItem.objects.filter(
                pk=item_id,
                user=core_user
            ).update(order=index)

        return Response({'success': True})


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
        from ..utils.file_validation import validate_upload
        from rest_framework import serializers as drf_serializers

        project = self.get_object(pk, request.user)
        if not project:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        # Handle cover_image upload separately to avoid serializer issues
        cover_image_updated = False
        if 'cover_image' in request.FILES:
            try:
                # Validate cover image
                allowed_types = {'image/jpeg', 'image/png', 'image/webp'}
                max_size = 5 * 1024 * 1024  # 5MB for covers
                validate_upload(request.FILES['cover_image'], allowed_types=allowed_types, max_size=max_size)

                # Truncate long filenames to avoid database errors
                uploaded_file = request.FILES['cover_image']
                original_name = uploaded_file.name
                if len(original_name) > 100:
                    import os
                    import uuid
                    name, ext = os.path.splitext(original_name)
                    # Use first 50 chars + uuid for uniqueness + extension
                    short_name = f"{name[:50]}_{uuid.uuid4().hex[:8]}{ext}"
                    uploaded_file.name = short_name

                project.cover_image = uploaded_file
                cover_image_updated = True
            except drf_serializers.ValidationError as e:
                return Response({'error': str(e.detail[0]) if isinstance(e.detail, list) else str(e.detail)}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({'error': f'File upload failed: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        # If only uploading cover image, save and return early
        if cover_image_updated and len(request.data) <= 1:  # Only cover_image field present
            project.save()

            # Update teaser links for published content
            if project.cover_image:
                published_chapters = project.chapters.filter(is_published=True)
                for chapter in published_chapters:
                    if chapter.published_content:
                        chapter.published_content.teaser_link = project.cover_image.url
                        chapter.published_content.save(update_fields=['teaser_link'])

                if project.published_content:
                    project.published_content.teaser_link = project.cover_image.url
                    project.published_content.save(update_fields=['teaser_link'])

            return Response(BookProjectSerializer(project, context={'request': request}).data)

        # Otherwise, update other fields via serializer
        # Filter out file fields from data (handle files separately above)
        data = {k: v for k, v in request.data.items() if k not in ['cover_image']}
        if data:  # Only validate if there's non-file data
            serializer = BookProjectSerializer(project, data=data, partial=True, context={'request': request})
            if serializer.is_valid():
                updated_project = serializer.save()

                # Update teaser links if needed
                if cover_image_updated and updated_project.cover_image:
                    published_chapters = updated_project.chapters.filter(is_published=True)
                    for chapter in published_chapters:
                        if chapter.published_content:
                            chapter.published_content.teaser_link = updated_project.cover_image.url
                            chapter.published_content.save(update_fields=['teaser_link'])

                    if updated_project.published_content:
                        updated_project.published_content.teaser_link = updated_project.cover_image.url
                        updated_project.published_content.save(update_fields=['teaser_link'])

                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        elif cover_image_updated:
            project.save()
            return Response(BookProjectSerializer(project, context={'request': request}).data)

        return Response({'error': 'No data provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    def delete(self, request, pk):
        project = self.get_object(pk, request.user)
        if not project:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        project.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyPublishedBooksView(APIView):
    """Get user's book projects for display on the profile page.

    Returns all book projects (both published and draft) with their chapters
    grouped by book rather than individual chapters.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)

        # Get all book projects for this user
        projects = BookProject.objects.filter(
            creator=core_user
        ).prefetch_related(
            'chapters',
            'chapters__published_content'
        ).order_by('-updated_at')

        result = []
        for project in projects:
            # Get all chapters with their status
            chapters_data = []
            total_views = 0
            total_price = 0
            published_count = 0

            for chapter in project.chapters.all().order_by('order'):
                content = chapter.published_content if chapter.is_published else None
                chapter_data = {
                    'id': chapter.id,
                    'title': chapter.title,
                    'order': chapter.order,
                    'is_published': chapter.is_published,
                    'content_id': content.id if content else None,
                    'price_usd': float(content.price_usd) if content else 0,
                    'view_count': content.view_count if content else 0,
                }
                chapters_data.append(chapter_data)
                if chapter.is_published and content:
                    published_count += 1
                    total_views += content.view_count
                    total_price += float(content.price_usd or 0)

            # Build cover image URL with fallbacks
            cover_url = None
            if project.cover_image:
                cover_url = request.build_absolute_uri(project.cover_image.url)
            else:
                # Fallback to first published chapter's teaser_link
                first_published = project.chapters.filter(
                    is_published=True,
                    published_content__isnull=False
                ).order_by('order').first()
                if first_published and first_published.published_content:
                    cover_url = first_published.published_content.teaser_link

            result.append({
                'id': project.id,
                'title': project.title,
                'cover_image_url': cover_url,
                'total_chapters': project.chapters.count(),
                'published_chapters': published_count,
                'is_published': project.is_published,
                'chapters': chapters_data,
                'total_views': total_views,
                'total_price': round(total_price, 2),
                'updated_at': project.updated_at.isoformat(),
            })

        return Response(result)


class MyComicProjectsView(APIView):
    """Get user's comic projects for display on the profile page.

    Returns all comic projects (both published and draft) with their issues
    grouped by project rather than individual issues.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from ..models import ComicIssue
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)

        projects = CollaborativeProject.objects.filter(
            content_type='comic',
            created_by=core_user
        ).prefetch_related(
            'comic_issues',
            'comic_issues__published_content',
            'published_content',
        ).order_by('-updated_at')

        result = []
        for project in projects:
            issues_data = []
            total_views = 0
            total_price = 0
            published_count = 0

            for issue in project.comic_issues.all().order_by('issue_number'):
                content = issue.published_content if issue.is_published else None
                issue_data = {
                    'id': issue.id,
                    'title': issue.title,
                    'issue_number': issue.issue_number,
                    'is_published': issue.is_published,
                    'content_id': content.id if content else None,
                    'price_usd': float(content.price_usd) if content else 0,
                    'view_count': content.view_count if content else 0,
                }
                issues_data.append(issue_data)
                if issue.is_published and content:
                    published_count += 1
                    total_views += content.view_count or 0
                    total_price += float(content.price_usd or 0)

            # Build cover image URL with fallbacks
            cover_url = None
            if project.cover_image:
                cover_url = request.build_absolute_uri(project.cover_image.url)
            elif project.published_content and project.published_content.teaser_link:
                cover_url = project.published_content.teaser_link
            else:
                first_published = project.comic_issues.filter(
                    is_published=True,
                    published_content__isnull=False
                ).order_by('issue_number').first()
                if first_published and first_published.published_content:
                    cover_url = first_published.published_content.teaser_link

            # Check if the project itself is published (whole-comic flow)
            is_published = project.published_content is not None

            result.append({
                'id': project.id,
                'title': project.title,
                'cover_image_url': cover_url,
                'total_issues': len(issues_data),
                'published_issues': published_count,
                'is_published': is_published,
                'issues': issues_data,
                'total_views': total_views,
                'total_price': round(total_price, 2),
                'updated_at': project.updated_at.isoformat(),
            })

        return Response(result)


class PublicBookProjectsView(APIView):
    """Get all published book projects for public discovery on home page.

    Returns aggregated book projects (only those with at least one published chapter
    OR projects published as a whole book) with their chapters grouped by book.
    This allows the home page to display books as single cards instead of
    showing each chapter separately.
    """
    permission_classes = []  # Public endpoint

    def get(self, request):
        from django.db.models import Sum, Count, F, Q

        # Get all book projects that either:
        # 1. Have at least one published chapter (chapter-by-chapter flow)
        # 2. Are published as a whole book (whole-book flow)
        projects = BookProject.objects.filter(
            Q(chapters__is_published=True, chapters__published_content__isnull=False) |
            Q(is_published=True, published_content__isnull=False)
        ).distinct().prefetch_related(
            'chapters',
            'chapters__published_content',
            'creator__profile',
            'published_content'  # For whole-book publishing
        ).select_related('creator').order_by('-updated_at')

        # Apply genre filter if specified (filter by chapter content genre or book content genre)
        genre_param = request.query_params.get('genre')
        if genre_param and genre_param != 'all':
            projects = projects.filter(
                Q(chapters__published_content__genre=genre_param) |
                Q(published_content__genre=genre_param)
            ).distinct()

        result = []
        for project in projects:
            # Get only published chapters with their content
            chapters_data = []
            total_views = 0
            total_price = 0
            total_likes = 0
            total_rating_sum = 0
            total_rating_count = 0
            published_count = 0
            latest_published_at = None

            for chapter in project.chapters.all().order_by('order'):
                if not chapter.is_published or not chapter.published_content:
                    continue

                content = chapter.published_content
                chapter_data = {
                    'id': chapter.id,
                    'title': chapter.title,
                    'order': chapter.order,
                    'content_id': content.id,
                    'price_usd': float(content.price_usd) if content.price_usd else 0,
                    'view_count': content.view_count or 0,
                    'editions': content.editions,
                }
                chapters_data.append(chapter_data)
                published_count += 1
                total_views += content.view_count or 0
                total_price += float(content.price_usd or 0)
                total_likes += content.like_count or 0
                if content.average_rating and content.rating_count:
                    total_rating_sum += float(content.average_rating) * content.rating_count
                    total_rating_count += content.rating_count

                # Track latest published chapter
                if latest_published_at is None or content.created_at > latest_published_at:
                    latest_published_at = content.created_at

            # Handle whole-book publishing (project.published_content without individual chapter publishing)
            if published_count == 0 and project.is_published and project.published_content:
                # Whole book was published as one Content item
                content = project.published_content
                # Create a single chapter entry for the entire book
                chapters_data = [{
                    'id': 0,  # Virtual chapter
                    'title': project.title,
                    'order': 0,
                    'content_id': content.id,
                    'price_usd': float(content.price_usd) if content.price_usd else 0,
                    'view_count': content.view_count or 0,
                    'editions': content.editions,
                }]
                published_count = 1
                total_views = content.view_count or 0
                total_price = float(content.price_usd or 0)
                total_likes = content.like_count or 0
                if content.average_rating and content.rating_count:
                    total_rating_sum = float(content.average_rating) * content.rating_count
                    total_rating_count = content.rating_count
                latest_published_at = content.created_at
            elif published_count == 0:
                # No published chapters and not a whole-book publish - skip
                continue

            # Build cover image URL with fallbacks
            cover_url = None
            if project.cover_image:
                cover_url = request.build_absolute_uri(project.cover_image.url)
            elif project.published_content and project.published_content.teaser_link:
                # For whole-book publishing, use the book content's teaser_link
                cover_url = project.published_content.teaser_link
            elif chapters_data:
                # Fallback to first published chapter's teaser_link (for seed data)
                first_content = project.chapters.filter(
                    is_published=True,
                    published_content__isnull=False
                ).order_by('order').first()
                if first_content and first_content.published_content:
                    cover_url = first_content.published_content.teaser_link

            # Calculate average rating across all chapters
            avg_rating = None
            if total_rating_count > 0:
                avg_rating = round(total_rating_sum / total_rating_count, 2)

            # Get the first chapter's content_id for linking
            first_chapter_content_id = chapters_data[0]['content_id'] if chapters_data else None

            result.append({
                'id': project.id,
                'title': project.title,
                'cover_image_url': cover_url,
                'creator_username': project.creator.username,
                'published_chapters': published_count,
                'chapters': chapters_data,
                'total_views': total_views,
                'total_price': round(total_price, 2),
                'total_likes': total_likes,
                'average_rating': avg_rating,
                'rating_count': total_rating_count,
                'first_chapter_content_id': first_chapter_content_id,
                'created_at': latest_published_at.isoformat() if latest_published_at else project.created_at.isoformat(),
                'content_type': 'book',  # For frontend filtering
            })

        # Apply sorting based on sort parameter
        sort_param = request.query_params.get('sort', 'newest')

        if sort_param == 'popular':
            result.sort(key=lambda x: x['total_views'], reverse=True)
        elif sort_param == 'rated':
            result.sort(key=lambda x: (x['average_rating'] or 0, x['rating_count']), reverse=True)
        elif sort_param == 'bestsellers':
            # Count purchases per book project (across all chapters)
            for item in result:
                item['purchase_count'] = Purchase.objects.filter(
                    content__source_chapter__book_project_id=item['id'],
                    status='completed'
                ).count()
            result.sort(key=lambda x: x.get('purchase_count', 0), reverse=True)
        # else: 'newest' - already sorted by created_at (latest_published_at)

        return Response(result)


class PublicComicProjectsView(APIView):
    """Get all published comic projects for public discovery on home page.

    Returns aggregated comic projects (only those with at least one published issue
    OR projects published as a whole comic) with their issues grouped by project.
    """
    permission_classes = []  # Public endpoint

    def get(self, request):
        from django.db.models import Q
        from ..models import ComicIssue, Purchase

        # Get all comic projects that either:
        # 1. Have at least one published issue (issue-by-issue flow)
        # 2. Are published as a whole comic (whole-project flow)
        projects = CollaborativeProject.objects.filter(
            Q(content_type='comic') & (
                Q(comic_issues__is_published=True, comic_issues__published_content__isnull=False) |
                Q(published_content__isnull=False)
            )
        ).distinct().prefetch_related(
            'comic_issues',
            'comic_issues__published_content',
            'collaborators',
            'created_by__profile',
            'published_content',
        ).select_related('created_by').order_by('-updated_at')

        # Apply genre filter if specified
        genre_param = request.query_params.get('genre')
        if genre_param and genre_param != 'all':
            projects = projects.filter(
                Q(comic_issues__published_content__genre=genre_param) |
                Q(published_content__genre=genre_param)
            ).distinct()

        result = []
        for project in projects:
            issues_data = []
            total_views = 0
            total_price = 0
            total_likes = 0
            total_rating_sum = 0
            total_rating_count = 0
            published_count = 0
            latest_published_at = None

            for issue in project.comic_issues.all().order_by('issue_number'):
                if not issue.is_published or not issue.published_content:
                    continue

                content = issue.published_content
                issue_data = {
                    'id': issue.id,
                    'title': issue.title,
                    'issue_number': issue.issue_number,
                    'content_id': content.id,
                    'price_usd': float(content.price_usd) if content.price_usd else 0,
                    'view_count': content.view_count or 0,
                    'editions': content.editions,
                }
                issues_data.append(issue_data)
                published_count += 1
                total_views += content.view_count or 0
                total_price += float(content.price_usd or 0)
                total_likes += content.like_count or 0
                if content.average_rating and content.rating_count:
                    total_rating_sum += float(content.average_rating) * content.rating_count
                    total_rating_count += content.rating_count

                if latest_published_at is None or content.created_at > latest_published_at:
                    latest_published_at = content.created_at

            # Handle whole-comic publishing (project.published_content without individual issues)
            if published_count == 0 and project.published_content:
                content = project.published_content
                issues_data = [{
                    'id': 0,
                    'title': project.title,
                    'issue_number': 1,
                    'content_id': content.id,
                    'price_usd': float(content.price_usd) if content.price_usd else 0,
                    'view_count': content.view_count or 0,
                    'editions': content.editions,
                }]
                published_count = 1
                total_views = content.view_count or 0
                total_price = float(content.price_usd or 0)
                total_likes = content.like_count or 0
                if content.average_rating and content.rating_count:
                    total_rating_sum = float(content.average_rating) * content.rating_count
                    total_rating_count = content.rating_count
                latest_published_at = content.created_at
            elif published_count == 0:
                continue

            # Build cover image URL with fallbacks
            cover_url = None
            if project.cover_image:
                cover_url = request.build_absolute_uri(project.cover_image.url)
            elif project.published_content and project.published_content.teaser_link:
                cover_url = project.published_content.teaser_link
            elif issues_data:
                first_issue = project.comic_issues.filter(
                    is_published=True,
                    published_content__isnull=False
                ).order_by('issue_number').first()
                if first_issue and first_issue.published_content:
                    cover_url = first_issue.published_content.teaser_link

            avg_rating = None
            if total_rating_count > 0:
                avg_rating = round(total_rating_sum / total_rating_count, 2)

            first_issue_content_id = issues_data[0]['content_id'] if issues_data else None

            # Check if this is a collaborative project
            is_collaborative = project.collaborators.filter(status='accepted').count() > 1

            result.append({
                'id': project.id,
                'title': project.title,
                'cover_image_url': cover_url,
                'creator_username': project.created_by.username,
                'published_issues': published_count,
                'issues': issues_data,
                'total_views': total_views,
                'total_price': round(total_price, 2),
                'total_likes': total_likes,
                'average_rating': avg_rating,
                'rating_count': total_rating_count,
                'first_issue_content_id': first_issue_content_id,
                'created_at': latest_published_at.isoformat() if latest_published_at else project.created_at.isoformat(),
                'content_type': 'comic',
                'is_collaborative': is_collaborative,
            })

        # Apply sorting
        sort_param = request.query_params.get('sort', 'newest')

        if sort_param == 'popular':
            result.sort(key=lambda x: x['total_views'], reverse=True)
        elif sort_param == 'rated':
            result.sort(key=lambda x: (x['average_rating'] or 0, x['rating_count']), reverse=True)
        elif sort_param == 'bestsellers':
            for item in result:
                item['purchase_count'] = Purchase.objects.filter(
                    content__source_comic_issue__project_id=item['id'],
                    status='completed'
                ).count()
            result.sort(key=lambda x: x.get('purchase_count', 0), reverse=True)

        return Response(result)


# ==================== Series Views ====================

class SeriesListCreateView(APIView):
    """List all series for authenticated user or create a new one."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        series = Series.objects.filter(creator=core_user)
        serializer = SeriesSerializer(series, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        serializer = SeriesSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(creator=core_user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SeriesDetailView(APIView):
    """Retrieve, update, or delete a specific series."""
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        core_user, _ = CoreUser.objects.get_or_create(username=user.username)
        try:
            return Series.objects.get(pk=pk, creator=core_user)
        except Series.DoesNotExist:
            return None

    def get(self, request, pk):
        series = self.get_object(pk, request.user)
        if not series:
            return Response({'error': 'Series not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = SeriesSerializer(series, context={'request': request})
        return Response(serializer.data)

    def patch(self, request, pk):
        series = self.get_object(pk, request.user)
        if not series:
            return Response({'error': 'Series not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = SeriesSerializer(series, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        series = self.get_object(pk, request.user)
        if not series:
            return Response({'error': 'Series not found'}, status=status.HTTP_404_NOT_FOUND)
        # Check if series has published books
        if series.books.filter(is_published=True).exists():
            return Response(
                {'error': 'Cannot delete series with published books'},
                status=status.HTTP_400_BAD_REQUEST
            )
        series.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AddBookToSeriesView(APIView):
    """Add a book to a series."""
    permission_classes = [IsAuthenticated]

    def post(self, request, series_pk, book_pk):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        try:
            series = Series.objects.get(pk=series_pk, creator=core_user)
            book = BookProject.objects.get(pk=book_pk, creator=core_user)

            # Get next order number
            from django.db.models import Max
            max_order = series.books.aggregate(Max('series_order'))['series_order__max'] or 0

            book.series = series
            book.series_order = max_order + 1
            book.save()

            return Response({
                'message': f'Added "{book.title}" to series "{series.title}"',
                'series_order': book.series_order
            })
        except Series.DoesNotExist:
            return Response({'error': 'Series not found'}, status=status.HTTP_404_NOT_FOUND)
        except BookProject.DoesNotExist:
            return Response({'error': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)


class RemoveBookFromSeriesView(APIView):
    """Remove a book from its series."""
    permission_classes = [IsAuthenticated]

    def post(self, request, book_pk):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        try:
            book = BookProject.objects.get(pk=book_pk, creator=core_user)

            if not book.series:
                return Response({'error': 'Book is not in a series'}, status=status.HTTP_400_BAD_REQUEST)

            series_title = book.series.title
            book.series = None
            book.series_order = 0
            book.save()

            return Response({'message': f'Removed "{book.title}" from series "{series_title}"'})
        except BookProject.DoesNotExist:
            return Response({'error': 'Book not found'}, status=status.HTTP_404_NOT_FOUND)


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

        # Compact chapter ordering to fix gaps from deletions
        # This ensures chapters are always numbered sequentially (0, 1, 2, ...)
        existing_chapters = list(project.chapters.all().order_by('order'))
        for index, chapter in enumerate(existing_chapters):
            if chapter.order != index:
                chapter.order = index
                chapter.save(update_fields=['order'])

        # New chapter gets the next sequential number
        order = len(existing_chapters)

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
            inventory_status='draft',  # Keep as draft until minted
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
            genre='other',
            source_chapter=chapter  # Link to source chapter to prevent orphan exclusion
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


class UnpublishBookView(APIView):
    """Unpublish a book project, removing its Content and resetting publish state."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        core_user, _ = CoreUser.objects.get_or_create(username=request.user.username)
        try:
            project = BookProject.objects.get(pk=pk, creator=core_user)
        except BookProject.DoesNotExist:
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

        if not project.is_published:
            return Response({'error': 'Book is not published'}, status=status.HTTP_400_BAD_REQUEST)

        # Store old content ID for response
        old_content_id = project.published_content.id if project.published_content else None

        # Delete the associated Content object if it exists
        if project.published_content:
            project.published_content.delete()

        # Reset the book project
        project.is_published = False
        project.published_content = None
        project.save()

        # Also reset any chapters that were marked as published for this book
        project.chapters.filter(is_published=True).update(
            is_published=False,
            published_content=None
        )

        return Response({
            'message': 'Book unpublished successfully',
            'deleted_content_id': old_content_id
        })


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
                data = serializer.data
                # Include the chapter ID so frontend can select the correct chapter
                data['target_chapter_id'] = chapter.id
                return Response(data)

            return Response({'error': 'No book project found for this content'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
