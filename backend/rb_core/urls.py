from django.urls import path
from .views import home, ContentListView, MintView, DashboardView, SearchView

urlpatterns = [
    path('', home, name='home'),
    path('api/content/', ContentListView.as_view(), name='content-list'),  # API for content (FR4)
    path('api/mint/', MintView.as_view(), name='mint'),  # Placeholder for NFT minting (FR5)
    path('api/dashboard/', DashboardView.as_view(), name='dashboard'),  # FR7
    path('api/search/', SearchView.as_view(), name='search'),  # FR8
    # Future: Add endpoints for fiat (FR2), auth (FR3)
]
