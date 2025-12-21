from django.urls import path, include, re_path
from django.views.generic import RedirectView
from rest_framework.routers import DefaultRouter
from .views import home, ContentListView, MintView, DashboardView, SalesAnalyticsView, SearchView, Web3AuthLoginView, FlagView, InviteView, AuthStatusView, LinkWalletView, CsrfTokenView, UserSearchView, SignupView, LoginView, TestSessionView, ProfileEditView, AdminStatsUpdateView, ProfileStatusView, ContentDetailView, ContentPreviewView, ContentUnpublishView, AnalyticsFeesView, ContentTextTeaserView, NotificationsView, LogoutView, BookProjectListCreateView, BookProjectDetailView, ChapterListCreateView, ChapterDetailView, PrepareChapterView, PublishChapterView, PrepareBookView, PublishBookView, BookProjectByContentView, MyPublishedBooksView, PublicBookProjectsView, PublicProfileView, ExternalPortfolioListCreateView, ExternalPortfolioDetailView, ExternalPortfolioReorderView, TrackContentViewView
from .views.checkout import CreateCheckoutSessionView, DevProcessPurchaseView, FeeBreakdownView
from .views.webhook import stripe_webhook
from .views.purchases import UserPurchasesView
from .views.library import LibraryView, FullContentView, ReadingProgressView
from .views.collaboration import (
    CollaborativeProjectViewSet, ProjectSectionViewSet, ProjectCommentViewSet,
    ProposalViewSet, CollaboratorRatingViewSet, get_user_ratings, RoleDefinitionViewSet
)
from .views.notifications import NotificationViewSet
from .views.social import (
    ContentLikeView, ContentCommentViewSet, ContentRatingViewSet, CreatorReviewViewSet,
    FollowView, FollowersListView, FollowingListView, FollowingFeedView
)
from .views import beta
from .views.feedback import submit_feedback
from .views.admin_treasury import treasury_dashboard, treasury_api
from .views.chapter_management import (
    RemoveChapterView, DelistChapterView, RelistChapterView,
    ChapterRemovalStatusView, RespondToDelistRequestView, PendingDelistRequestsView
)
from .views.tags import TagListView
from .views.legal import (
    LegalDocumentView, LegalAcceptView, LegalCheckAcceptanceView,
    LegalPendingAcceptancesView, CreatorAgreementStatusView
)

# Router for collaboration and notification ViewSets
router = DefaultRouter()
router.register(r'collaborative-projects', CollaborativeProjectViewSet, basename='collaborative-project')
router.register(r'project-sections', ProjectSectionViewSet, basename='project-section')
router.register(r'project-comments', ProjectCommentViewSet, basename='project-comment')
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'role-definitions', RoleDefinitionViewSet, basename='role-definition')
# Social engagement ViewSets
router.register(r'content-comments', ContentCommentViewSet, basename='content-comment')
router.register(r'content-ratings', ContentRatingViewSet, basename='content-rating')
router.register(r'creator-reviews', CreatorReviewViewSet, basename='creator-review')

urlpatterns = [
    path('', home, name='home'),
    path('api/content/', ContentListView.as_view(), name='content'),
    path('api/mint/', MintView.as_view(), name='mint'),
    path('api/content/<int:pk>/', ContentDetailView.as_view(), name='content_detail'),
    path('api/content/<int:pk>/preview/', ContentPreviewView.as_view(), name='content_preview'),
    path('api/content/<int:pk>/teaser/', ContentTextTeaserView.as_view(), name='content_teaser'),
    path('api/content/<int:pk>/view/', TrackContentViewView.as_view(), name='track_content_view'),
    path('api/content/<int:pk>/unpublish/', ContentUnpublishView.as_view(), name='content_unpublish'),
    path('api/content/<int:content_id>/like/', ContentLikeView.as_view(), name='content_like'),
    path('api/content/detail/<int:pk>/', ContentDetailView.as_view(), name='content_detail_view'),
    # Stripe checkout and payment processing
    path('api/checkout/create/', CreateCheckoutSessionView.as_view(), name='checkout_create'),
    path('api/checkout/session/', CreateCheckoutSessionView.as_view(), name='checkout_session'),  # Legacy alias
    path('api/checkout/fee-breakdown/', FeeBreakdownView.as_view(), name='fee_breakdown'),
    path('api/webhooks/stripe/', stripe_webhook, name='stripe_webhook'),
    path('api/checkout/webhook/', stripe_webhook, name='stripe_webhook_legacy'),  # Legacy alias
    path('api/purchases/', UserPurchasesView.as_view(), name='user_purchases'),
    # Library and reading
    path('api/library/', LibraryView.as_view(), name='library'),
    path('api/content/<int:pk>/full/', FullContentView.as_view(), name='content_full'),
    path('api/reading-progress/', ReadingProgressView.as_view(), name='reading_progress'),
    path('api/reading-progress/<int:content_id>/', ReadingProgressView.as_view(), name='reading_progress_detail'),
    path('api/analytics/fees/', AnalyticsFeesView.as_view(), name='analytics_fees'),
    path('api/admin/user-stats/', AdminStatsUpdateView.as_view(), name='admin_user_stats_update'),
    path('api/dashboard/', DashboardView.as_view(), name='dashboard'),
    path('api/sales-analytics/', SalesAnalyticsView.as_view(), name='sales_analytics'),
    path('api/search/', SearchView.as_view(), name='search'),
    path('api/tags/', TagListView.as_view(), name='tags'),
    path('auth/web3/', Web3AuthLoginView.as_view(), name='web3_login'),
    path('api/flag/', FlagView.as_view(), name='flag'),
    path('api/invite/', InviteView.as_view(), name='invite'),
    path('api/auth/status/', AuthStatusView.as_view(), name='auth_status'),
    path('api/wallet/link/', LinkWalletView.as_view(), name='wallet_link'),
    path('api/auth/csrf/', CsrfTokenView.as_view(), name='csrf'),
    path('api/users/search/', UserSearchView.as_view(), name='user_search'),
    path('api/users/signup/', SignupView.as_view(), name='user_signup'),
    path('api/users/login/', LoginView.as_view(), name='user_login'),
    path('api/test/session/', TestSessionView.as_view(), name='test_session'),  # Debug endpoint
    path('api/users/profile/', ProfileEditView.as_view(), name='user_profile_edit'),
    path('api/profile/status/', ProfileStatusView.as_view(), name='profile_status_update'),
    # Public profile endpoint (no auth required)
    path('api/users/<str:username>/public/', PublicProfileView.as_view(), name='public_profile'),
    # Follow system endpoints
    path('api/users/<str:username>/follow/', FollowView.as_view(), name='follow_user'),
    path('api/users/<str:username>/followers/', FollowersListView.as_view(), name='user_followers'),
    path('api/users/<str:username>/following/', FollowingListView.as_view(), name='user_following'),
    path('api/feed/following/', FollowingFeedView.as_view(), name='following_feed'),
    # External portfolio management
    path('api/portfolio/', ExternalPortfolioListCreateView.as_view(), name='portfolio_list_create'),
    path('api/portfolio/<int:pk>/', ExternalPortfolioDetailView.as_view(), name='portfolio_detail'),
    path('api/portfolio/reorder/', ExternalPortfolioReorderView.as_view(), name='portfolio_reorder'),
    # Legacy notification endpoint moved - now using NotificationViewSet via router
    # path('api/notifications/', NotificationsView.as_view(), name='notifications'),
    path('api/legacy-notifications/', NotificationsView.as_view(), name='legacy_notifications'),
    path('api/auth/logout/', LogoutView.as_view(), name='auth_logout'),
    # Backward-compatible aliases (some clients may call without the /api prefix)
    path('auth/status/', AuthStatusView.as_view(), name='auth_status_alias'),
    path('auth/csrf/', CsrfTokenView.as_view(), name='csrf_alias'),
    path('auth/logout/', LogoutView.as_view(), name='auth_logout_alias'),
    # Non-API aliases for common endpoints used by the frontend when opened on :8000
    # path('notifications/', NotificationsView.as_view(), name='notifications_alias'),  # Using router now
    path('users/profile/', ProfileEditView.as_view(), name='user_profile_edit_alias'),
    path('users/search/', UserSearchView.as_view(), name='user_search_alias'),
    path('dashboard/', DashboardView.as_view(), name='dashboard_alias'),
    path('content/', ContentListView.as_view(), name='content_alias'),
    path('content/detail/<int:pk>/', ContentDetailView.as_view(), name='content_detail_alias'),
    # Book project and chapter endpoints
    path('api/book-projects/', BookProjectListCreateView.as_view(), name='book_projects'),
    path('api/book-projects/my-published/', MyPublishedBooksView.as_view(), name='my_published_books'),
    path('api/book-projects/public/', PublicBookProjectsView.as_view(), name='public_book_projects'),
    path('api/book-projects/<int:pk>/', BookProjectDetailView.as_view(), name='book_project_detail'),
    path('api/book-projects/<int:project_id>/chapters/', ChapterListCreateView.as_view(), name='chapters'),
    path('api/book-projects/by-content/<int:content_id>/', BookProjectByContentView.as_view(), name='book_project_by_content'),
    path('api/chapters/<int:pk>/', ChapterDetailView.as_view(), name='chapter_detail'),
    path('api/chapters/<int:pk>/prepare/', PrepareChapterView.as_view(), name='prepare_chapter'),
    path('api/chapters/<int:pk>/publish/', PublishChapterView.as_view(), name='publish_chapter'),
    path('api/book-projects/<int:pk>/prepare/', PrepareBookView.as_view(), name='prepare_book'),
    path('api/book-projects/<int:pk>/publish/', PublishBookView.as_view(), name='publish_book'),
    # Chapter management - content removal policy
    path('api/chapters/<int:pk>/remove/', RemoveChapterView.as_view(), name='remove_chapter'),
    path('api/chapters/<int:pk>/delist/', DelistChapterView.as_view(), name='delist_chapter'),
    path('api/chapters/<int:pk>/relist/', RelistChapterView.as_view(), name='relist_chapter'),
    path('api/chapters/<int:pk>/removal-status/', ChapterRemovalStatusView.as_view(), name='chapter_removal_status'),
    path('api/delist-approvals/<int:pk>/respond/', RespondToDelistRequestView.as_view(), name='respond_delist_request'),
    path('api/delist-approvals/pending/', PendingDelistRequestsView.as_view(), name='pending_delist_requests'),
    # Legal document and agreement endpoints
    path('api/legal/documents/<str:document_type>/', LegalDocumentView.as_view(), name='legal_document'),
    path('api/legal/accept/', LegalAcceptView.as_view(), name='legal_accept'),
    path('api/legal/check-acceptance/', LegalCheckAcceptanceView.as_view(), name='legal_check_acceptance'),
    path('api/legal/pending-acceptances/', LegalPendingAcceptancesView.as_view(), name='legal_pending_acceptances'),
    path('api/legal/creator-agreement-status/', CreatorAgreementStatusView.as_view(), name='creator_agreement_status'),
    # Beta access management
    path('api/beta/request-access/', beta.request_beta_access, name='beta_request'),
    path('api/beta/approve/', beta.approve_beta_request, name='beta_approve'),
    path('api/beta/validate/', beta.validate_invite_code, name='beta_validate'),
    path('api/beta/mark-used/', beta.mark_invite_used, name='beta_mark_used'),
    # Beta feedback
    path('api/feedback/', submit_feedback, name='submit_feedback'),
    # Admin treasury dashboard
    path('staff/treasury/', treasury_dashboard, name='admin_treasury_dashboard'),
    path('api/staff/treasury/', treasury_api, name='admin_treasury_api'),
    # Collaboration API endpoints
    path('api/', include(router.urls)),
    # Nested routes for proposals and ratings under collaborative projects
    path('api/collaborative-projects/<int:project_pk>/proposals/',
         ProposalViewSet.as_view({'get': 'list', 'post': 'create'}),
         name='project-proposals-list'),
    path('api/collaborative-projects/<int:project_pk>/proposals/<int:pk>/',
         ProposalViewSet.as_view({'get': 'retrieve'}),
         name='project-proposals-detail'),
    path('api/collaborative-projects/<int:project_pk>/proposals/<int:pk>/vote/',
         ProposalViewSet.as_view({'post': 'vote'}),
         name='project-proposals-vote'),
    path('api/collaborative-projects/<int:project_pk>/proposals/<int:pk>/cancel/',
         ProposalViewSet.as_view({'post': 'cancel'}),
         name='project-proposals-cancel'),
    path('api/collaborative-projects/<int:project_pk>/ratings/',
         CollaboratorRatingViewSet.as_view({'get': 'list', 'post': 'create'}),
         name='project-ratings-list'),
    path('api/users/<int:user_id>/ratings/',
         get_user_ratings,
         name='user-ratings'),
]

# Development-only endpoints (not exposed in production)
from django.conf import settings
if settings.DEBUG:
    urlpatterns += [
        path('api/dev/process-purchase/', DevProcessPurchaseView.as_view(), name='dev_process_purchase'),
    ]
