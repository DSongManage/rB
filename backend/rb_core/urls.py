from django.urls import path, include, re_path
from django.views.generic import RedirectView
from rest_framework.routers import DefaultRouter
from .views import home, ContentListView, MintView, DashboardView, SearchView, Web3AuthLoginView, FlagView, InviteView, AuthStatusView, LinkWalletView, CsrfTokenView, UserSearchView, SignupView, LoginView, ProfileEditView, AdminStatsUpdateView, ProfileStatusView, ContentDetailView, ContentPreviewView, AnalyticsFeesView, ContentTextTeaserView, NotificationsView, LogoutView, BookProjectListCreateView, BookProjectDetailView, ChapterListCreateView, ChapterDetailView, PrepareChapterView, PublishChapterView, PrepareBookView, PublishBookView, BookProjectByContentView
from .views.checkout import CreateCheckoutSessionView
from .views.webhook import stripe_webhook
from .views.purchases import UserPurchasesView
from .views.library import LibraryView, FullContentView, ReadingProgressView
from .payments.views import CircleCheckoutView, circle_webhook
from .views.collaboration import (
    CollaborativeProjectViewSet, ProjectSectionViewSet, ProjectCommentViewSet
)
from .views.notifications import NotificationViewSet
from .views import beta
from .views.feedback import submit_feedback

# Router for collaboration and notification ViewSets
router = DefaultRouter()
router.register(r'collaborative-projects', CollaborativeProjectViewSet, basename='collaborative-project')
router.register(r'project-sections', ProjectSectionViewSet, basename='project-section')
router.register(r'project-comments', ProjectCommentViewSet, basename='project-comment')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('', home, name='home'),
    path('api/content/', ContentListView.as_view(), name='content'),
    path('api/mint/', MintView.as_view(), name='mint'),
    path('api/content/<int:pk>/', ContentDetailView.as_view(), name='content_detail'),
    path('api/content/<int:pk>/preview/', ContentPreviewView.as_view(), name='content_preview'),
    path('api/content/<int:pk>/teaser/', ContentTextTeaserView.as_view(), name='content_teaser'),
    path('api/content/detail/<int:pk>/', ContentDetailView.as_view(), name='content_detail_view'),
    # Stripe checkout and payment processing
    path('api/checkout/session/', CreateCheckoutSessionView.as_view(), name='checkout_session'),
    path('api/checkout/webhook/', stripe_webhook, name='stripe_webhook'),
    # Circle payment processing (credit cards → USDC on Solana)
    path('api/checkout/circle/', CircleCheckoutView.as_view(), name='circle_checkout'),
    # Use re_path to handle trailing slash flexibility (prevents 307 redirects from Circle webhooks)
    re_path(r'^api/checkout/circle/webhook/?$', circle_webhook, name='circle_webhook'),
    path('api/purchases/', UserPurchasesView.as_view(), name='user_purchases'),
    # Library and reading
    path('api/library/', LibraryView.as_view(), name='library'),
    path('api/content/<int:pk>/full/', FullContentView.as_view(), name='content_full'),
    path('api/reading-progress/', ReadingProgressView.as_view(), name='reading_progress'),
    path('api/reading-progress/<int:content_id>/', ReadingProgressView.as_view(), name='reading_progress_detail'),
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
    path('api/users/login/', LoginView.as_view(), name='user_login'),
    path('api/users/profile/', ProfileEditView.as_view(), name='user_profile_edit'),
    path('api/profile/status/', ProfileStatusView.as_view(), name='profile_status_update'),
    path('api/notifications/', NotificationsView.as_view(), name='notifications'),
    path('api/auth/logout/', LogoutView.as_view(), name='auth_logout'),
    # Backward-compatible aliases (some clients may call without the /api prefix)
    path('auth/status/', AuthStatusView.as_view(), name='auth_status_alias'),
    path('auth/csrf/', CsrfTokenView.as_view(), name='csrf_alias'),
    path('auth/logout/', LogoutView.as_view(), name='auth_logout_alias'),
    # Non-API aliases for common endpoints used by the frontend when opened on :8000
    path('notifications/', NotificationsView.as_view(), name='notifications_alias'),
    path('users/profile/', ProfileEditView.as_view(), name='user_profile_edit_alias'),
    path('users/search/', UserSearchView.as_view(), name='user_search_alias'),
    path('dashboard/', DashboardView.as_view(), name='dashboard_alias'),
    path('content/', ContentListView.as_view(), name='content_alias'),
    path('content/detail/<int:pk>/', ContentDetailView.as_view(), name='content_detail_alias'),
    # Book project and chapter endpoints
    path('api/book-projects/', BookProjectListCreateView.as_view(), name='book_projects'),
    path('api/book-projects/<int:pk>/', BookProjectDetailView.as_view(), name='book_project_detail'),
    path('api/book-projects/<int:project_id>/chapters/', ChapterListCreateView.as_view(), name='chapters'),
    path('api/book-projects/by-content/<int:content_id>/', BookProjectByContentView.as_view(), name='book_project_by_content'),
    path('api/chapters/<int:pk>/', ChapterDetailView.as_view(), name='chapter_detail'),
    path('api/chapters/<int:pk>/prepare/', PrepareChapterView.as_view(), name='prepare_chapter'),
    path('api/chapters/<int:pk>/publish/', PublishChapterView.as_view(), name='publish_chapter'),
    path('api/book-projects/<int:pk>/prepare/', PrepareBookView.as_view(), name='prepare_book'),
    path('api/book-projects/<int:pk>/publish/', PublishBookView.as_view(), name='publish_book'),
    # Beta access management
    path('api/beta/request-access/', beta.request_beta_access, name='beta_request'),
    path('api/beta/approve/', beta.approve_beta_request, name='beta_approve'),
    path('api/beta/validate/', beta.validate_invite_code, name='beta_validate'),
    path('api/beta/mark-used/', beta.mark_invite_used, name='beta_mark_used'),
    # Beta feedback
    path('api/feedback/', submit_feedback, name='submit_feedback'),
    # Collaboration API endpoints
    path('api/', include(router.urls)),
]
