"""
Dynamic sitemap generation.

Serves an XML sitemap that includes:
- Static marketing pages
- Published content detail pages
- Public creator profiles
"""

from django.http import HttpResponse
from django.utils import timezone
from django.views import View

from rb_core.models import Content, UserProfile

BASE_URL = 'https://renaissblock.com'

# Static marketing pages
STATIC_PAGES = [
    {'path': '/', 'changefreq': 'weekly', 'priority': '1.0'},
    {'path': '/how-it-works', 'changefreq': 'monthly', 'priority': '0.9'},
    {'path': '/pricing', 'changefreq': 'monthly', 'priority': '0.8'},
    {'path': '/about', 'changefreq': 'monthly', 'priority': '0.7'},
    {'path': '/blog', 'changefreq': 'weekly', 'priority': '0.6'},
    {'path': '/search', 'changefreq': 'weekly', 'priority': '0.5'},
]


class DynamicSitemapView(View):
    """Generate a dynamic XML sitemap."""

    def get(self, request):
        today = timezone.now().strftime('%Y-%m-%d')
        urls = []

        # Static pages
        for page in STATIC_PAGES:
            urls.append(
                f'  <url>\n'
                f'    <loc>{BASE_URL}{page["path"]}</loc>\n'
                f'    <lastmod>{today}</lastmod>\n'
                f'    <changefreq>{page["changefreq"]}</changefreq>\n'
                f'    <priority>{page["priority"]}</priority>\n'
                f'  </url>'
            )

        # Published content pages
        published_content = Content.objects.filter(
            inventory_status='minted'
        ).values_list('id', 'created_at').order_by('-created_at')

        for content_id, created_at in published_content:
            lastmod = created_at.strftime('%Y-%m-%d') if created_at else today
            urls.append(
                f'  <url>\n'
                f'    <loc>{BASE_URL}/content/{content_id}</loc>\n'
                f'    <lastmod>{lastmod}</lastmod>\n'
                f'    <changefreq>monthly</changefreq>\n'
                f'    <priority>0.6</priority>\n'
                f'  </url>'
            )

        # Public creator profiles
        profiles = UserProfile.objects.exclude(
            username=''
        ).values_list('username', flat=True)

        for username in profiles:
            urls.append(
                f'  <url>\n'
                f'    <loc>{BASE_URL}/profile/{username}</loc>\n'
                f'    <lastmod>{today}</lastmod>\n'
                f'    <changefreq>weekly</changefreq>\n'
                f'    <priority>0.5</priority>\n'
                f'  </url>'
            )

        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + '\n'.join(urls) + '\n'
            '</urlset>\n'
        )

        return HttpResponse(xml, content_type='application/xml')
