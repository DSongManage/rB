from django.urls import path
from .views import home, ContentListView, MintView, DashboardView, SearchView, Web3AuthLoginView

urlpatterns = [
    path('', home, name='home'),
    path('api/content/', ContentListView.as_view(), name='content-list'),  # API for content (FR4)
    path('api/mint/', MintView.as_view(), name='mint'),  # Placeholder for NFT minting (FR5)
    path('api/dashboard/', DashboardView.as_view(), name='dashboard'),  # FR7
    path('api/search/', SearchView.as_view(), name='search'),  # FR8
    path('auth/web3/', Web3AuthLoginView.as_view(), name='web3_login'),  # Handles Web3Auth callbacks (FR3)
    # Future: Add endpoints for fiat (FR2), auth (FR3)
]
