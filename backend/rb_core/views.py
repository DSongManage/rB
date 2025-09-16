from django.shortcuts import render
from django.http import HttpResponse
from rest_framework import generics
from .models import Content
from .serializers import ContentSerializer
from rest_framework.response import Response
from rest_framework.views import APIView
import random
from anchorpy import Provider, Program
from anchorpy.idl import IdlFetcher
from solana.publickey import PublicKey
from rest_framework.permissions import IsAuthenticated
from solana.rpc.api import Client as SolanaClient
from solana.keypair import Keypair
from pathlib import Path
from anchorpy.idl import Idl

# Create your views here.

def home(request):
    return HttpResponse("Welcome to renaissBlock Backend!")  # Placeholder

class ContentListView(generics.ListCreateAPIView):
    """API view for listing and creating Content (FR1/FR4 in REQUIREMENTS.md).
    
    - Public for teasers (no auth); gate full access via NFT (client-side per ARCHITECTURE.md).
    - Future: Integrate with IPFS upload, mint trigger via Anchor (FR5).
    - Security: Rate limiting, input sanitization (GUIDELINES.md).
    """
    queryset = Content.objects.all()
    serializer_class = ContentSerializer
    
    def perform_create(self, serializer):
        # Placeholder for teaser generation and IPFS upload
        serializer.save(creator=self.request.user)  # Assumes authenticated creator

class MintView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        royalties = request.data.get('royalties', [])
        connection = SolanaClient("https://api.devnet.solana.com")
        wallet = Keypair()  # Placeholder; integrate Web3Auth later
        provider = Provider(connection, wallet, {})
        program_id = PublicKey("YourDeployedProgramID")
        # Temp sync load from file (after anchor build); switch to async fetch later with ASGI
        idl_path = Path("/Users/davidsong/repos/songProjects/rB/blockchain/rb_contracts/target/idl/rb_contracts.json")
        idl = Idl.from_json(idl_path.read_text())
        program = Program(idl, program_id, provider)
        tx = program.rpc["mintNft"]("metadata", [(PublicKey(r['pubkey']), r['percent']) for r in royalties])
        return Response({'tx_sig': tx})

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
        revenue = 0  # Query Anchor for royalties (FR13) - expand with RPC call
        return Response({'content_count': content_count, 'collabs': collabs, 'revenue': revenue})
