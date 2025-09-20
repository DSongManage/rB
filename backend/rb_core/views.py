from django.shortcuts import render
from django.http import HttpResponse
from rest_framework import generics
from .models import Content
from .serializers import ContentSerializer
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

# Create your views here.

def home(request):
    return HttpResponse("renaissBlock Backend Running")

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
        return Response({'tx_sig': 'dummy_tx_for_testing'})

class SearchView(APIView):
    def get(self, request):
        query = request.query_params.get('q', '')
        users = User.objects.filter(username__icontains=query)
        return Response([u.username for u in users])  # For collaboration search (FR8)

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
        token = request.data.get('token')
        user = authenticate(request, token=token)
        if user:
            login(request, user)
            return Response({'message': 'Login successful'}, status=status.HTTP_200_OK)
        return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)

class FlagView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        content_id = request.data.get('content')
        content = Content.objects.get(id=content_id)
        content.flagged = True
        content.save()
        return Response({'message': 'Content flagged for review'})
