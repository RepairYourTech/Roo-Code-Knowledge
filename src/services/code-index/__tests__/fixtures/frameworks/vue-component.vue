<template>
	<div class="user-profile" :class="{ 'dark-mode': isDarkMode }">
		<!-- Loading state -->
		<div v-if="userLoading" class="loading">Loading user profile...</div>

		<!-- Error state -->
		<div v-else-if="userError" class="error">Error: {{ userError }}</div>

		<!-- User profile content -->
		<template v-else-if="user">
			<header>
				<h1>{{ user.name }}</h1>
				<button @click="toggleDarkMode">
					{{ isDarkMode ? "☀️" : "🌙" }}
				</button>
			</header>

			<section class="user-info">
				<div class="avatar">
					<img :src="user.avatar" :alt="user.name" />
				</div>

				<div class="details">
					<p><strong>Email:</strong> {{ user.email }}</p>
					<p><strong>Role:</strong> {{ userRole }}</p>
					<p><strong>Member since:</strong> {{ formattedDate }}</p>
				</div>
			</section>

			<section class="user-posts">
				<h2>Recent Posts ({{ filteredPosts.length }})</h2>

				<input v-model="searchQuery" type="text" placeholder="Search posts..." class="search-input" />

				<ul class="post-list">
					<li v-for="post in paginatedPosts" :key="post.id" class="post-item" @click="selectPost(post)">
						<h3>{{ post.title }}</h3>
						<p>{{ post.excerpt }}</p>
						<span class="post-date">{{ formatDate(post.createdAt) }}</span>
					</li>
				</ul>

				<div class="pagination">
					<button @click="previousPage" :disabled="currentPage === 1 || totalPages === 0">Previous</button>
					<span v-if="totalPages > 0">Page {{ currentPage }} of {{ totalPages }}</span>
					<span v-else>No results</span>
					<button @click="nextPage" :disabled="currentPage === totalPages || totalPages === 0">Next</button>
				</div>
			</section>
		</template>

		<!-- No user data state -->
		<div v-else class="no-data">No user data available</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue"

// Props
const props = defineProps({
	userId: {
		type: String,
		required: true,
	},
})

// Interfaces
interface User {
	name: string
	email: string
	avatar: string
	role: string
	createdAt: Date
}

interface Post {
	id: string
	title: string
	excerpt: string
	createdAt: Date
}

// State
const user = ref<User | null>(null)
const posts = ref<Post[]>([])
const searchQuery = ref("")
const currentPage = ref(1)
const postsPerPage = 10
const isDarkMode = ref(false)
const loading = ref(false)
const userLoading = ref(false)
const postsLoading = ref(false)
const userError = ref<string | null>(null)
const postsError = ref<string | null>(null)

// Computed
const userRole = computed(() => {
	return user.value?.role.toUpperCase() || "GUEST"
})

const formattedDate = computed(() => {
	if (!user.value) return ""
	return new Date(user.value.createdAt).toLocaleDateString()
})

const filteredPosts = computed(() => {
	if (!searchQuery.value) return posts.value

	const query = searchQuery.value.toLowerCase()
	return posts.value.filter(
		(post) => post.title.toLowerCase().includes(query) || post.excerpt.toLowerCase().includes(query),
	)
})

const totalPages = computed(() => {
	return Math.ceil(filteredPosts.value.length / postsPerPage)
})

const paginatedPosts = computed(() => {
	const start = (currentPage.value - 1) * postsPerPage
	const end = start + postsPerPage
	return filteredPosts.value.slice(start, end)
})

// Methods
async function fetchUser() {
	userLoading.value = true
	userError.value = null
	try {
		const response = await fetch(`/api/users/${props.userId}`)
		if (!response.ok) {
			throw new Error(`Failed to fetch user: ${response.status} ${response.statusText}`)
		}
		user.value = await response.json()
	} catch (error) {
		console.error("Error fetching user:", error)
		userError.value = error instanceof Error ? error.message : "An unknown error occurred while fetching user"
	} finally {
		userLoading.value = false
	}
}

async function fetchPosts() {
	postsLoading.value = true
	postsError.value = null
	try {
		const response = await fetch(`/api/users/${props.userId}/posts`)
		if (!response.ok) {
			throw new Error(`Failed to fetch posts: ${response.status} ${response.statusText}`)
		}
		posts.value = await response.json()
	} catch (error) {
		console.error("Error fetching posts:", error)
		postsError.value = error instanceof Error ? error.message : "An unknown error occurred while fetching posts"
	} finally {
		postsLoading.value = false
	}
}

function previousPage() {
	if (currentPage.value > 1) {
		currentPage.value--
	}
}

function nextPage() {
	if (currentPage.value < totalPages.value) {
		currentPage.value++
	}
}

function toggleDarkMode() {
	isDarkMode.value = !isDarkMode.value
}

function selectPost(post: Post) {
	// Handle post selection
	console.log("Selected post:", post)
}

function formatDate(date: Date) {
	return new Date(date).toLocaleDateString()
}

// Lifecycle
onMounted(() => {
	fetchUser()
	fetchPosts()
})

// Watchers
watch(
	() => props.userId,
	() => {
		fetchUser()
		fetchPosts()
	},
)

watch(searchQuery, () => {
	currentPage.value = 1
})
</script>

<style scoped>
.user-profile {
	padding: 20px;
	background: white;
	transition: background 0.3s;
}

.user-profile.dark-mode {
	background: #1a1a1a;
	color: white;
}

.loading,
.error,
.no-data {
	padding: 20px;
	text-align: center;
	color: #666;
}

.error {
	color: #d32f2f;
	background-color: #ffebee;
	border-radius: 4px;
}

.no-data {
	color: #9e9e9e;
	font-style: italic;
}

.search-input {
	width: 100%;
	padding: 10px;
	margin: 10px 0;
}

.post-list {
	list-style: none;
	padding: 0;
}

.post-item {
	padding: 15px;
	margin: 10px 0;
	border: 1px solid #ddd;
	cursor: pointer;
}

.post-item:hover {
	background: #f5f5f5;
}

.pagination {
	display: flex;
	justify-content: space-between;
	margin-top: 20px;
}
</style>
