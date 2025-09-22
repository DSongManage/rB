from django.urls import path
from .views import home, ContentListView, MintView, DashboardView, SearchView, Web3AuthLoginView, FlagView, InviteView, AuthStatusView, LinkWalletView, CsrfTokenView, UserSearchView, SignupView, ProfileEditView

urlpatterns = [
    path('', home, name='home'),
    path('api/content/', ContentListView.as_view(), name='content'),
    path('api/mint/', MintView.as_view(), name='mint'),
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
]
