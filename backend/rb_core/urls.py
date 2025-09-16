from django.urls import path
from . import views  # Import views for routing

urlpatterns = [
    path('', views.home, name='home'),  # Placeholder home view
    # Future placeholders for FRs
]
