from django.urls import path
from .views import home, ContentListView, MintView

urlpatterns = [
    path('', home, name='home'),
    path('api/content/', ContentListView.as_view(), name='content-list'),  # API for content (FR4)
    path('api/mint/', MintView.as_view(), name='mint'),  # Placeholder for NFT minting (FR5)
    # Future: Add endpoints for fiat (FR2), auth (FR3)
]
