from django.shortcuts import render
from django.http import HttpResponse
from rest_framework import generics
from .models import Content
from .serializers import ContentSerializer
from rest_framework.response import Response
from rest_framework.views import APIView
import random
from anchorpy import Provider, Program
from solana.publickey import PublicKey
from rest_framework.permissions import IsAuthenticated
from solana.rpc.coretypes import Client, Keypair
from solana.rpc.idl import Idl

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
        # Full Anchor call (FR5/FR9)
        connection = Client("https://api.devnet.solana.com")
        wallet = Keypair()  # Placeholder; integrate Web3Auth
        program_id = PublicKey("YourDeployedProgramID")
        program = Program(idl, program_id, Provider(connection, wallet))
        royalties = request.data.get('royalties', [])  # e.g., [(pubkey, percent)]
        tx = program.rpc["mintNft"]("metadata", royalties)
        return Response({'tx_sig': tx})
