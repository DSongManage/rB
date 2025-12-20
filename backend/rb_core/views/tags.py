from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.utils.text import slugify
from ..models import Tag
from ..serializers import TagSerializer


class TagListView(generics.ListCreateAPIView):
    """
    List all tags or create custom tags.

    GET /api/tags/
        - Returns all tags, sorted by usage_count desc
        - Query params:
            - category: filter by category (genre, theme, mood, custom)
            - predefined: if 'true', only return predefined platform tags

    POST /api/tags/
        - Creates a custom tag (requires authentication)
        - Request body: { "name": "tag name" }
        - Auto-generates slug from name
        - Sets category='custom', is_predefined=False
    """

    serializer_class = TagSerializer
    pagination_class = None  # Always return full list (tags are a small set)

    def get_queryset(self):
        qs = Tag.objects.all()

        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)

        # Filter predefined only
        predefined = self.request.query_params.get('predefined')
        if predefined == 'true':
            qs = qs.filter(is_predefined=True)

        return qs

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        name = serializer.validated_data['name']
        slug = slugify(name)

        # Check if slug already exists
        if Tag.objects.filter(slug=slug).exists():
            # Return existing tag instead of creating duplicate
            existing = Tag.objects.get(slug=slug)
            return existing

        serializer.save(
            slug=slug,
            category='custom',
            is_predefined=False,
            usage_count=0,
        )

    def create(self, request, *args, **kwargs):
        name = request.data.get('name', '').strip()
        if not name:
            return Response(
                {'error': 'Tag name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if tag with this slug already exists
        slug = slugify(name)
        if Tag.objects.filter(slug=slug).exists():
            # Return existing tag
            existing = Tag.objects.get(slug=slug)
            serializer = self.get_serializer(existing)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # Create new tag
        serializer = self.get_serializer(data={'name': name})
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
