from django.urls import path
from .views import home, ContentListView, MintView, DashboardView, SearchView, Web3AuthLoginView, FlagView, InviteView, AuthStatusView, LinkWalletView, CsrfTokenView, UserSearchView, SignupView, ProfileEditView, AdminStatsUpdateView, ProfileStatusView, ContentDetailView, ContentPreviewView, AnalyticsFeesView, ContentTextTeaserView, NotificationsView

urlpatterns = [
    path('', home, name='home'),
    path('api/content/', ContentListView.as_view(), name='content'),
    path('api/mint/', MintView.as_view(), name='mint'),
    path('api/content/<int:pk>/', ContentDetailView.as_view(), name='content_detail'),
    path('api/content/<int:pk>/preview/', ContentPreviewView.as_view(), name='content_preview'),
    path('api/content/<int:pk>/teaser/', ContentTextTeaserView.as_view(), name='content_teaser'),
    path('api/content/detail/<int:pk>/', ContentDetailView.as_view(), name='content_detail_view'),
    path('api/analytics/fees/', AnalyticsFeesView.as_view(), name='analytics_fees'),
    path('api/admin/user-stats/', AdminStatsUpdateView.as_view(), name='admin_user_stats_update'),
    path('api/dashboard/', DashboardView.as_view(), name='dashboard'),
    path('api/search/', SearchView.as_view(), name='search'),
    path('auth/web3/', Web3AuthLoginView.as_view(), name='web3_login'),
    path('api/flag/', FlagView.as_view(), name='flag'),
    path('api/invite/', InviteView.as_view(), name='invite'),
    path('api/auth/status/', AuthStatusView.as_view(), name='auth_status'),
    path('api/wallet/link/', LinkWalletView.as_view(), name='wallet_link'),
    path('api/auth/csrf/', CsrfTokenView.as_view(), name='csrf'),
    path('api/users/search/', UserSearchView.as_view(), name='user_search'),
    path('api/users/signup/', SignupView.as_view(), name='user_signup'),
    path('api/users/profile/', ProfileEditView.as_view(), name='user_profile_edit'),
    path('api/profile/status/', ProfileStatusView.as_view(), name='profile_status_update'),
    path('api/notifications/', NotificationsView.as_view(), name='notifications'),
]
