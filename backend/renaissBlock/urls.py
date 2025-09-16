"""
URL configuration for renaissBlock project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include  # For app URL inclusion (PEP 8)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('rb_core.urls')),  # Include core app URLs for main functionality
    path('accounts/', include('allauth.urls')),  # Allauth auth routes (FR3)
    # Placeholder: path('api/auth/', ... )  # Web3Auth integration (FR3)
    # Placeholder: path('api/fiat/', ... )  # Ramp/MoonPay for conversions (FR2)
    # Placeholder: path('api/content/', ... )  # Upload/mint (FR4, FR5) with IPFS
    # Future: Add search/collaboration routes (FR8)
]
# Ensure all routes have input validation (GUIDELINES.md Security)
