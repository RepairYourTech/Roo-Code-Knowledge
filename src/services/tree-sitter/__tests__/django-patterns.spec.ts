import { describe, it, expect } from "vitest"
import {
	extractDjangoViewMetadata,
	extractDjangoModelMetadata,
	extractDjangoUrlMetadata,
	extractDjangoOrmMetadata,
} from "../../code-index/processors/metadata-extractor"
import { Node } from "web-tree-sitter"

// Mock Node class for testing
class MockNode {
	type: string
	text: string
	children: (Node | null)[] = []
	parent?: Node | null

	constructor(type: string, text: string, children?: (Node | null)[]) {
		this.type = type
		this.text = text
		if (children) {
			this.children = children
			children.forEach((child) => {
				if (child && "parent" in child) {
					;(child as any).parent = this
				}
			})
		}
	}

	childForFieldName(name: string): Node | null {
		// Simplified implementation for testing
		return null
	}
}

describe("Django Pattern Extraction", () => {
	describe("Django View Detection", () => {
		it("should detect function-based view", () => {
			const code = `
def user_detail(request, user_id):
	user = get_object_or_404(User, pk=user_id)
	return render(request, 'users/detail.html', {'user': user})
`

			const node = new MockNode("function_definition", code)
			const metadata = extractDjangoViewMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.viewType).toBe("function_based")
			expect(metadata?.viewName).toBe("user_detail")
			expect(metadata?.requestParam).toBe("request")
			expect(metadata?.responseType).toBe("render")
		})

		it("should detect class-based view", () => {
			const code = `
from django.views.generic import DetailView
from .models import User

class UserDetailView(DetailView):
	model = User
	template_name = 'users/detail.html'
	pk_url_kwarg = 'user_id'
`

			const node = new MockNode("class_definition", code)
			const metadata = extractDjangoViewMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.viewType).toBe("class_based")
			expect(metadata?.className).toBe("UserDetailView")
			expect(metadata?.baseClass).toBe("DetailView")
			expect(metadata?.templatePath).toBe("users/detail.html")
		})

		it("should detect view with JSON response", () => {
			const code = `
from django.http import JsonResponse

def api_users(request):
	users = User.objects.all().values()
	return JsonResponse(list(users), safe=False)
`

			const node = new MockNode("function_definition", code)
			const metadata = extractDjangoViewMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.viewType).toBe("function_based")
			expect(metadata?.responseType).toBe("json")
		})

		it("should detect view with form handling", () => {
			const code = `
from django.shortcuts import render, redirect
from .forms import UserForm

def user_create(request):
	if request.method == 'POST':
		form = UserForm(request.POST)
		if form.is_valid():
			form.save()
			return redirect('user-list')
	else:
		form = UserForm()
	return render(request, 'users/create.html', {'form': form})
`

			const node = new MockNode("function_definition", code)
			const metadata = extractDjangoViewMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.viewType).toBe("function_based")
			expect(metadata?.formHandling).toBe(true)
		})

		it("should detect view with authentication decorator", () => {
			const code = `
from django.contrib.auth.decorators import login_required

@login_required
def profile_view(request):
	return render(request, 'users/profile.html')
`

			const node = new MockNode("decorated_definition", code)
			const metadata = extractDjangoViewMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.viewType).toBe("function_based")
			expect(metadata?.authDecorators).toContain("login_required")
		})
	})

	describe("Django Model Detection", () => {
		it("should detect basic model", () => {
			const code = `
from django.db import models

class User(models.Model):
	username = models.CharField(max_length=150)
	email = models.EmailField(unique=True)
	created_at = models.DateTimeField(auto_now_add=True)
`

			const node = new MockNode("class_definition", code)
			const metadata = extractDjangoModelMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.modelName).toBe("User")
			expect(metadata?.baseClass).toBe("models.Model")
			expect(metadata?.fields).toBeDefined()
			expect(metadata?.fields?.length).toBe(3)
		})

		it("should detect model with foreign key", () => {
			const code = `
from django.db import models

class Post(models.Model):
	title = models.CharField(max_length=200)
	content = models.TextField()
	author = models.ForeignKey(User, on_delete=models.CASCADE)
	created_at = models.DateTimeField(auto_now_add=True)
`

			const node = new MockNode("class_definition", code)
			const metadata = extractDjangoModelMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.modelName).toBe("Post")
			expect(metadata?.foreignKeys).toBeDefined()
			expect(metadata?.foreignKeys?.length).toBe(1)
			expect(metadata?.foreignKeys?.[0].fieldName).toBe("author")
			expect(metadata?.foreignKeys?.[0].relatedModel).toBe("User")
		})

		it("should detect model with many-to-many field", () => {
			const code = `
from django.db import models

class Post(models.Model):
	title = models.CharField(max_length=200)
	tags = models.ManyToManyField('Tag')
`

			const node = new MockNode("class_definition", code)
			const metadata = extractDjangoModelMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.modelName).toBe("Post")
			expect(metadata?.manyToManyFields).toBeDefined()
			expect(metadata?.manyToManyFields?.length).toBe(1)
			expect(metadata?.manyToManyFields?.[0].fieldName).toBe("tags")
			expect(metadata?.manyToManyFields?.[0].relatedModel).toBe("Tag")
		})

		it("should detect model with Meta class", () => {
			const code = `
from django.db import models

class User(models.Model):
	username = models.CharField(max_length=150)
	email = models.EmailField(unique=True)
	
	class Meta:
		db_table = 'app_users'
		verbose_name = 'User'
		ordering = ['username']
`

			const node = new MockNode("class_definition", code)
			const metadata = extractDjangoModelMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.modelName).toBe("User")
			expect(metadata?.dbTable).toBe("app_users")
			expect(metadata?.verboseName).toBe("User")
		})
	})

	describe("Django URL Detection", () => {
		it("should detect basic path", () => {
			const code = `
from django.urls import path
from . import views

urlpatterns = [
	path('users/', views.user_list, name='user-list'),
	path('users/<int:user_id>/', views.user_detail, name='user-detail'),
]
`

			const node = new MockNode("assignment", code)
			const metadata = extractDjangoUrlMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.urlType).toBe("path")
			expect(metadata?.urlPattern).toBe("users/<int:user_id>/")
			expect(metadata?.viewFunction).toBe("views.user_detail")
			expect(metadata?.parameters).toContain("user_id")
		})

		it("should detect URL with name", () => {
			const code = `
from django.urls import path
from . import views

urlpatterns = [
	path('users/<int:user_id>/', views.user_detail, name='user-detail'),
]
`

			const node = new MockNode("assignment", code)
			const metadata = extractDjangoUrlMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.name).toBe("user-detail")
		})

		it("should detect URL include", () => {
			const code = `
from django.urls import path, include

urlpatterns = [
	path('api/', include('api.urls')),
]
`

			const node = new MockNode("assignment", code)
			const metadata = extractDjangoUrlMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.include).toBe("api.urls")
		})
	})

	describe("Django ORM Detection", () => {
		it("should detect filter operation", () => {
			const code = `
def active_users():
	return User.objects.filter(is_active=True)
`

			const node = new MockNode("call_expression", code)
			const metadata = extractDjangoOrmMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.modelName).toBe("User")
			expect(metadata?.operation).toBe("filter")
			expect(metadata?.filters).toEqual({ is_active: true })
		})

		it("should detect get operation", () => {
			const code = `
def get_user(user_id):
	return User.objects.get(id=user_id)
`

			const node = new MockNode("call_expression", code)
			const metadata = extractDjangoOrmMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.modelName).toBe("User")
			expect(metadata?.operation).toBe("get")
			expect(metadata?.filters).toEqual({ id: "user_id" })
		})

		it("should detect all operation", () => {
			const code = `
def all_users():
	return User.objects.all()
`

			const node = new MockNode("call_expression", code)
			const metadata = extractDjangoOrmMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.modelName).toBe("User")
			expect(metadata?.operation).toBe("all")
		})

		it("should detect complex ORM query", () => {
			const code = `
def user_posts(user):
	return Post.objects.filter(author=user).select_related('author').order_by('-created_at')
`

			const node = new MockNode("call_expression", code)
			const metadata = extractDjangoOrmMetadata(node as unknown as Node, code)

			expect(metadata).toBeDefined()
			expect(metadata?.modelName).toBe("Post")
			expect(metadata?.operation).toBe("filter")
			expect(metadata?.selectRelated).toContain("author")
			expect(metadata?.orderBy).toContain("-created_at")
		})
	})

	describe("Complex Django Patterns", () => {
		it("should detect complete Django app structure", () => {
			const viewsCode = `
from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import User, Post

@login_required
def user_profile(request, user_id):
	user = get_object_or_404(User, pk=user_id)
	posts = Post.objects.filter(author=user).order_by('-created_at')[:5]
	return render(request, 'users/profile.html', {
		'user': user,
		'posts': posts
	})
`

			const modelsCode = `
from django.db import models

class User(models.Model):
	username = models.CharField(max_length=150)
	email = models.EmailField(unique=True)
	created_at = models.DateTimeField(auto_now_add=True)
	
	class Meta:
		db_table = 'auth_users'

class Post(models.Model):
	title = models.CharField(max_length=200)
	content = models.TextField()
	author = models.ForeignKey(User, on_delete=models.CASCADE)
	created_at = models.DateTimeField(auto_now_add=True)
`

			const urlsCode = `
from django.urls import path
from . import views

urlpatterns = [
	path('users/<int:user_id>/', views.user_profile, name='user-profile'),
]
`

			// Test view metadata
			const viewNode = new MockNode("decorated_definition", viewsCode)
			const viewMetadata = extractDjangoViewMetadata(viewNode as Node, viewsCode)

			expect(viewMetadata).toBeDefined()
			expect(viewMetadata?.viewType).toBe("function_based")
			expect(viewMetadata?.authDecorators).toContain("login_required")

			// Test model metadata
			const userNode = new MockNode("class_definition", modelsCode.split("class Post")[0])
			const userMetadata = extractDjangoModelMetadata(userNode as Node, modelsCode)

			expect(userMetadata).toBeDefined()
			expect(userMetadata?.modelName).toBe("User")
			expect(userMetadata?.dbTable).toBe("auth_users")

			// Test URL metadata
			const urlNode = new MockNode("assignment", urlsCode)
			const urlMetadata = extractDjangoUrlMetadata(urlNode as Node, urlsCode)

			expect(urlMetadata).toBeDefined()
			expect(urlMetadata?.urlPattern).toBe("users/<int:user_id>/")
		})
	})
})
