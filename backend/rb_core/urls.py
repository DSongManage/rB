from django.urls import path, include, re_path
from django.views.generic import RedirectView
from rest_framework.routers import DefaultRouter
from .views import home, HealthCheckView, ContentListView, MintView, DashboardView, SalesAnalyticsView, SearchView, Web3AuthLoginView, FlagView, InviteView, AuthStatusView, LinkWalletView, CsrfTokenView, UserSearchView, SignupView, LoginView, TestSessionView, ProfileEditView, AdminStatsUpdateView, ProfileStatusView, ContentDetailView, ContentPreviewView, ContentUnpublishView, AnalyticsFeesView, ContentTextTeaserView, NotificationsView, LogoutView, BookProjectListCreateView, BookProjectDetailView, ChapterListCreateView, ChapterDetailView, PrepareChapterView, PublishChapterView, PrepareBookView, PublishBookView, UnpublishBookView, BookProjectByContentView, MyPublishedBooksView, MyComicProjectsView, PublicBookProjectsView, PublicComicProjectsView, PublicProfileView, ExternalPortfolioListCreateView, ExternalPortfolioDetailView, ExternalPortfolioReorderView, TrackContentViewView, SeriesListCreateView, SeriesDetailView, AddBookToSeriesView, RemoveBookFromSeriesView
from .views.checkout import DevProcessPurchaseView, FeeBreakdownView
from .views.cart import (
    CartView, AddToCartView, RemoveFromCartView, ClearCartView,
    CartCheckoutView, CartBreakdownView
)
from .views.webhook import bridge_webhook
from .views.bridge import (
    BridgeOnboardingStatusView, CreateBridgeCustomerView, GetKYCLinkView, GetKYCStatusView,
    ListExternalAccountsView, LinkBankAccountPlaidView, LinkBankAccountManualView,
    DeleteExternalAccountView, SetDefaultExternalAccountView,
    ListLiquidationAddressesView, CreateLiquidationAddressView, SetPrimaryLiquidationAddressView,
    ListPayoutsView, GetPayoutPreferencesView, UpdatePayoutPreferencesView,
    RoutingNumberLookupView
)
from .views.purchases import UserPurchasesView, PurchaseStatusView, BatchPurchaseStatusView, OwnedIssuesView
from .views.library import LibraryView, FullContentView, ReadingProgressView, ComicPreviewView, ComicReaderDataView
from .views.collaboration import (
    CollaborativeProjectViewSet, ProjectSectionViewSet, ProjectCommentViewSet,
    ProposalViewSet, CollaboratorRatingViewSet, get_user_ratings, RoleDefinitionViewSet
)
from .views.comic import ComicPageViewSet, ComicPanelViewSet, SpeechBubbleViewSet, ComicSeriesViewSet, ComicIssueViewSet, DividerLineViewSet, ArtworkLibraryViewSet
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
# Dual Payment System views
from .views.balance import UserBalanceView, SyncBalanceView, CheckBalanceSufficiencyView, EarningsBalanceView
from .views.payment import (
    CreatePurchaseIntentView, SelectPaymentMethodView, PayWithBalanceView,
    SubmitSponsoredPaymentView, ConfirmBalancePaymentView, PurchaseIntentStatusView
)
from .views.coinbase import (
    InitiateCoinbaseOnrampView, CoinbaseTransactionStatusView,
    CoinbaseWebhookView, CoinbaseOnrampCompleteView
)
from .views.direct_crypto import (
    InitiateDirectCryptoPaymentView, DirectCryptoPaymentStatusView,
    CancelDirectCryptoPaymentView
)
from .views.tiers import MyTierProgressView, FoundingStatusView, CreatorTierView
from .views.sitemap import DynamicSitemapView

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
# Comic collaboration ViewSets
router.register(r'comic-pages', ComicPageViewSet, basename='comic-page')
router.register(r'comic-panels', ComicPanelViewSet, basename='comic-panel')
router.register(r'speech-bubbles', SpeechBubbleViewSet, basename='speech-bubble')
router.register(r'divider-lines', DividerLineViewSet, basename='divider-line')
# Comic series and issues
router.register(r'comic-series', ComicSeriesViewSet, basename='comic-series')
router.register(r'comic-issues', ComicIssueViewSet, basename='comic-issue')

urlpatterns = [
    path('', home, name='home'),
    path('health/', HealthCheckView.as_view(), name='health_check'),
    path('api/content/', ContentListView.as_view(), name='content'),
    path('api/mint/', MintView.as_view(), name='mint'),
    path('api/content/<int:pk>/', ContentDetailView.as_view(), name='content_detail'),
    path('api/content/<int:pk>/preview/', ContentPreviewView.as_view(), name='content_preview'),
    path('api/content/<int:pk>/teaser/', ContentTextTeaserView.as_view(), name='content_teaser'),
    path('api/content/<int:pk>/view/', TrackContentViewView.as_view(), name='track_content_view'),
    path('api/content/<int:pk>/unpublish/', ContentUnpublishView.as_view(), name='content_unpublish'),
    path('api/content/<int:content_id>/like/', ContentLikeView.as_view(), name='content_like'),
    path('api/content/detail/<int:pk>/', ContentDetailView.as_view(), name='content_detail_view'),
    # Fee breakdown (used by frontend price display)
    path('api/checkout/fee-breakdown/', FeeBreakdownView.as_view(), name='fee_breakdown'),
    path('api/purchases/', UserPurchasesView.as_view(), name='user_purchases'),
    path('api/purchases/<int:purchase_id>/status/', PurchaseStatusView.as_view(), name='purchase_status'),
    path('api/batch-purchases/<int:batch_id>/status/', BatchPurchaseStatusView.as_view(), name='batch_purchase_status'),
    path('api/purchases/owned-issues/', OwnedIssuesView.as_view(), name='owned_issues'),
    # Shopping cart endpoints
    path('api/cart/', CartView.as_view(), name='cart'),
    path('api/cart/add/', AddToCartView.as_view(), name='cart_add'),
    path('api/cart/remove/<int:item_id>/', RemoveFromCartView.as_view(), name='cart_remove'),
    path('api/cart/clear/', ClearCartView.as_view(), name='cart_clear'),
    path('api/cart/checkout/', CartCheckoutView.as_view(), name='cart_checkout'),
    path('api/cart/breakdown/', CartBreakdownView.as_view(), name='cart_breakdown'),
    # Library and reading
    path('api/library/', LibraryView.as_view(), name='library'),
    path('api/content/<int:pk>/full/', FullContentView.as_view(), name='content_full'),
    path('api/content/<int:pk>/comic-preview/', ComicPreviewView.as_view(), name='comic_preview'),
    path('api/content/<int:pk>/comic-reader-data/', ComicReaderDataView.as_view(), name='comic_reader_data'),
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
    path('api/comic-projects/my-published/', MyComicProjectsView.as_view(), name='my_comic_projects'),
    path('api/comic-projects/public/', PublicComicProjectsView.as_view(), name='public_comic_projects'),
    path('api/book-projects/<int:pk>/', BookProjectDetailView.as_view(), name='book_project_detail'),
    path('api/book-projects/<int:project_id>/chapters/', ChapterListCreateView.as_view(), name='chapters'),
    path('api/book-projects/by-content/<int:content_id>/', BookProjectByContentView.as_view(), name='book_project_by_content'),
    path('api/chapters/<int:pk>/', ChapterDetailView.as_view(), name='chapter_detail'),
    path('api/chapters/<int:pk>/prepare/', PrepareChapterView.as_view(), name='prepare_chapter'),
    path('api/chapters/<int:pk>/publish/', PublishChapterView.as_view(), name='publish_chapter'),
    path('api/book-projects/<int:pk>/prepare/', PrepareBookView.as_view(), name='prepare_book'),
    path('api/book-projects/<int:pk>/publish/', PublishBookView.as_view(), name='publish_book'),
    path('api/book-projects/<int:pk>/unpublish/', UnpublishBookView.as_view(), name='unpublish_book'),
    # Series management endpoints
    path('api/series/', SeriesListCreateView.as_view(), name='series_list_create'),
    path('api/series/<int:pk>/', SeriesDetailView.as_view(), name='series_detail'),
    path('api/series/<int:series_pk>/add-book/<int:book_pk>/', AddBookToSeriesView.as_view(), name='add_book_to_series'),
    path('api/book-projects/<int:book_pk>/remove-from-series/', RemoveBookFromSeriesView.as_view(), name='remove_book_from_series'),
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
    path('api/beta/welcome-seen/', beta.mark_beta_welcome_seen, name='beta_welcome_seen'),
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
    # Artwork Library for collaborative comics
    path('api/collaborative-projects/<int:project_pk>/artwork-library/',
         ArtworkLibraryViewSet.as_view({'get': 'list', 'post': 'create'}),
         name='artwork-library-list'),
    path('api/artwork-library/<int:pk>/',
         ArtworkLibraryViewSet.as_view({'delete': 'destroy'}),
         name='artwork-library-delete'),
    path('api/artwork-library/<int:pk>/apply-to-panel/',
         ArtworkLibraryViewSet.as_view({'post': 'apply_to_panel'}),
         name='artwork-library-apply'),
    # Bridge.xyz Payout Integration
    path('api/webhooks/bridge/', bridge_webhook, name='bridge_webhook'),
    path('api/bridge/status/', BridgeOnboardingStatusView.as_view(), name='bridge_status'),
    path('api/bridge/customer/create/', CreateBridgeCustomerView.as_view(), name='bridge_customer_create'),
    path('api/bridge/kyc/link/', GetKYCLinkView.as_view(), name='bridge_kyc_link'),
    path('api/bridge/kyc/status/', GetKYCStatusView.as_view(), name='bridge_kyc_status'),
    path('api/bridge/accounts/', ListExternalAccountsView.as_view(), name='bridge_accounts'),
    path('api/bridge/accounts/plaid/', LinkBankAccountPlaidView.as_view(), name='bridge_account_plaid'),
    path('api/bridge/accounts/manual/', LinkBankAccountManualView.as_view(), name='bridge_account_manual'),
    path('api/bridge/accounts/<int:account_id>/', DeleteExternalAccountView.as_view(), name='bridge_account_delete'),
    path('api/bridge/accounts/<int:account_id>/default/', SetDefaultExternalAccountView.as_view(), name='bridge_account_default'),
    path('api/bridge/liquidation-addresses/', ListLiquidationAddressesView.as_view(), name='bridge_liquidation_list'),
    path('api/bridge/liquidation-addresses/create/', CreateLiquidationAddressView.as_view(), name='bridge_liquidation_create'),
    path('api/bridge/liquidation-addresses/<int:address_id>/primary/', SetPrimaryLiquidationAddressView.as_view(), name='bridge_liquidation_primary'),
    path('api/bridge/payouts/', ListPayoutsView.as_view(), name='bridge_payouts'),
    path('api/bridge/preferences/', GetPayoutPreferencesView.as_view(), name='bridge_preferences_get'),
    path('api/bridge/preferences/update/', UpdatePayoutPreferencesView.as_view(), name='bridge_preferences_update'),
    path('api/bridge/routing-lookup/', RoutingNumberLookupView.as_view(), name='bridge_routing_lookup'),

    # ==========================================================================
    # Dual Payment System (Coinbase Onramp + Direct Crypto)
    # ==========================================================================

    # Balance Management
    path('api/balance/', UserBalanceView.as_view(), name='user_balance'),
    path('api/balance/sync/', SyncBalanceView.as_view(), name='sync_balance'),
    path('api/balance/check/', CheckBalanceSufficiencyView.as_view(), name='check_balance'),
    path('api/earnings-balance/', EarningsBalanceView.as_view(), name='earnings_balance'),

    # Purchase Intent
    path('api/payment/intent/', CreatePurchaseIntentView.as_view(), name='create_purchase_intent'),
    path('api/payment/intent/<int:intent_id>/select/', SelectPaymentMethodView.as_view(), name='select_payment_method'),
    path('api/payment/intent/<int:intent_id>/pay-with-balance/', PayWithBalanceView.as_view(), name='pay_with_balance'),
    path('api/payment/intent/<int:intent_id>/submit/', SubmitSponsoredPaymentView.as_view(), name='submit_sponsored_payment'),
    path('api/payment/intent/<int:intent_id>/confirm/', ConfirmBalancePaymentView.as_view(), name='confirm_balance_payment'),
    path('api/payment/intent/<int:intent_id>/status/', PurchaseIntentStatusView.as_view(), name='purchase_intent_status'),

    # Coinbase Onramp
    path('api/coinbase/onramp/<int:intent_id>/', InitiateCoinbaseOnrampView.as_view(), name='coinbase_onramp_initiate'),
    path('api/coinbase/status/<int:transaction_id>/', CoinbaseTransactionStatusView.as_view(), name='coinbase_status'),
    path('api/coinbase/complete/<int:transaction_id>/', CoinbaseOnrampCompleteView.as_view(), name='coinbase_complete'),
    path('api/webhooks/coinbase/', CoinbaseWebhookView.as_view(), name='coinbase_webhook'),

    # Creator Tier System
    path('api/tiers/my-progress/', MyTierProgressView.as_view(), name='tier_my_progress'),
    path('api/tiers/founding-status/', FoundingStatusView.as_view(), name='tier_founding_status'),
    path('api/tiers/creator/<str:username>/', CreatorTierView.as_view(), name='tier_creator'),

    # Direct Crypto Payment
    path('api/direct-crypto/initiate/<int:intent_id>/', InitiateDirectCryptoPaymentView.as_view(), name='direct_crypto_initiate'),
    path('api/direct-crypto/status/<int:payment_id>/', DirectCryptoPaymentStatusView.as_view(), name='direct_crypto_status'),
    path('api/direct-crypto/cancel/<int:payment_id>/', CancelDirectCryptoPaymentView.as_view(), name='direct_crypto_cancel'),

    # Dynamic sitemap
    path('api/sitemap.xml', DynamicSitemapView.as_view(), name='dynamic_sitemap'),
]

# Development-only endpoints (not exposed in production)
from django.conf import settings
if settings.DEBUG:
    urlpatterns += [
        path('api/dev/process-purchase/', DevProcessPurchaseView.as_view(), name='dev_process_purchase'),
    ]
