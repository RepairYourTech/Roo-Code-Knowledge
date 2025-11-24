import {
	extractNextJSComponentMetadata,
	extractNextJSRouteMetadata,
	extractNextJSServerSideMetadata,
	extractAngularComponentMetadata,
	extractAngularServiceMetadata,
	extractAngularModuleMetadata,
	extractAngularRoutingMetadata,
	extractAngularFormMetadata,
	extractAngularHttpMetadata,
	extractAngularRxJSMetadata,
	extractAngularTestMetadata,
} from "../metadata-extractor"
import { Node } from "web-tree-sitter"

// Mock tree-sitter node for testing
const createMockNode = (type: string, text: string, children: Node[] = []): Node =>
	({
		type,
		text,
		children,
		childForFieldName: (() => null) as any,
		startPosition: { row: 0, column: 0 },
		endPosition: { row: 0, column: 0 },
	}) as any

describe("Next.js Metadata Extractor", () => {
	describe("extractNextJSComponentMetadata", () => {
		it("should extract metadata for pages router component", () => {
			const mockNode = createMockNode(
				"function_declaration",
				"export default function HomePage() { return <div>Home</div> }",
			)
			const filePath = "/pages/index.tsx"
			const text = "export default function HomePage() { return <div>Home</div> }"

			const metadata = extractNextJSComponentMetadata(mockNode, filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("page")
			expect(metadata?.routerType).toBe("pages")
			expect(metadata?.isDynamic).toBe(false)
		})

		it("should extract metadata for dynamic route", () => {
			const mockNode = createMockNode(
				"function_declaration",
				"export default function PostPage({ params }) { return <div>Post</div> }",
			)
			const filePath = "/pages/posts/[slug].tsx"
			const text = "export default function PostPage({ params }) { return <div>Post</div> }"

			const metadata = extractNextJSComponentMetadata(mockNode, filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("page")
			expect(metadata?.routerType).toBe("pages")
			expect(metadata?.isDynamic).toBe(true)
			expect(metadata?.isCatchAll).toBe(false)
		})

		it("should extract metadata for catch-all route", () => {
			const mockNode = createMockNode(
				"function_declaration",
				"export default function CatchAllPage() { return <div>Catch All</div> }",
			)
			const filePath = "/pages/docs/[...slug].tsx"
			const text = "export default function CatchAllPage() { return <div>Catch All</div> }"

			const metadata = extractNextJSComponentMetadata(mockNode, filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("page")
			expect(metadata?.routerType).toBe("pages")
			expect(metadata?.isCatchAll).toBe(true)
			expect(metadata?.isOptionalCatchAll).toBe(false)
		})

		it("should extract metadata for optional catch-all route", () => {
			const mockNode = createMockNode(
				"function_declaration",
				"export default function OptionalCatchAllPage() { return <div>Optional</div> }",
			)
			const filePath = "/pages/blog/[[...slug]].tsx"
			const text = "export default function OptionalCatchAllPage() { return <div>Optional</div> }"

			const metadata = extractNextJSComponentMetadata(mockNode, filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("page")
			expect(metadata?.routerType).toBe("pages")
			expect(metadata?.isCatchAll).toBe(false)
			expect(metadata?.isOptionalCatchAll).toBe(true)
		})

		it("should extract metadata for app router layout", () => {
			const mockNode = createMockNode(
				"function_declaration",
				"export default function Layout({ children }) { return <html><body>{children}</body></html> }",
			)
			const filePath = "/app/layout.tsx"
			const text = "export default function Layout({ children }) { return <html><body>{children}</body></html> }"

			const metadata = extractNextJSComponentMetadata(mockNode, filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("layout")
			expect(metadata?.routerType).toBe("app")
		})

		it("should extract metadata for app router server component", () => {
			const mockNode = createMockNode(
				"function_declaration",
				"export default async function ServerPage() { const data = await fetchData(); return <div>{data}</div> }",
			)
			const filePath = "/app/dashboard/page.tsx"
			const text =
				"export default async function ServerPage() { const data = await fetchData(); return <div>{data}</div> }"

			const metadata = extractNextJSComponentMetadata(mockNode, filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("server")
			expect(metadata?.routerType).toBe("app")
		})

		it("should extract metadata for client component", () => {
			const mockNode = createMockNode(
				"function_declaration",
				'"use client"\nexport default function ClientPage() { const [count, setCount] = useState(0); return <div>{count}</div> }',
			)
			const filePath = "/app/counter/page.tsx"
			const text =
				'"use client"\nexport default function ClientPage() { const [count, setCount] = useState(0); return <div>{count}</div> }'

			const metadata = extractNextJSComponentMetadata(mockNode, filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("client")
			expect(metadata?.routerType).toBe("app")
		})

		it("should extract metadata for API route", () => {
			const mockNode = createMockNode(
				"function_declaration",
				'export default function handler(req, res) { res.status(200).json({ message: "Hello" }) }',
			)
			const filePath = "/pages/api/users.ts"
			const text = 'export default function handler(req, res) { res.status(200).json({ message: "Hello" }) }'

			const metadata = extractNextJSComponentMetadata(mockNode, filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("api")
			expect(metadata?.routerType).toBe("pages")
		})

		it("should extract metadata for app router route handler", () => {
			const mockNode = createMockNode(
				"function_declaration",
				'export async function GET(request) { return NextResponse.json({ message: "Hello" }) }',
			)
			const filePath = "/app/api/users/route.ts"
			const text = 'export async function GET(request) { return NextResponse.json({ message: "Hello" }) }'

			const metadata = extractNextJSComponentMetadata(mockNode, filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("route")
			expect(metadata?.routerType).toBe("app")
		})

		it("should extract metadata for loading component", () => {
			const mockNode = createMockNode(
				"function_declaration",
				"export default function Loading() { return <div>Loading...</div> }",
			)
			const filePath = "/app/dashboard/loading.tsx"
			const text = "export default function Loading() { return <div>Loading...</div> }"

			const metadata = extractNextJSComponentMetadata(mockNode, filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("loading")
			expect(metadata?.routerType).toBe("app")
		})

		it("should extract metadata for error component", () => {
			const mockNode = createMockNode(
				"function_declaration",
				'"use client"\nexport default function Error({ error, reset }) { return <div>Error: {error.message}</div> }',
			)
			const filePath = "/app/dashboard/error.tsx"
			const text =
				'"use client"\nexport default function Error({ error, reset }) { return <div>Error: {error.message}</div> }'

			const metadata = extractNextJSComponentMetadata(mockNode, filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("error")
			expect(metadata?.routerType).toBe("app")
		})

		it("should extract metadata for not found component", () => {
			const mockNode = createMockNode(
				"function_declaration",
				"export default function NotFound() { return <div>Not Found</div> }",
			)
			const filePath = "/app/dashboard/not-found.tsx"
			const text = "export default function NotFound() { return <div>Not Found</div> }"

			const metadata = extractNextJSComponentMetadata(mockNode, filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.componentType).toBe("not_found")
			expect(metadata?.routerType).toBe("app")
		})

		it("should detect Next.js imports", () => {
			const mockNode = createMockNode("import_statement", 'import { GetServerSideProps, useRouter } from "next"')
			const filePath = "/pages/index.tsx"
			const text =
				'import { GetServerSideProps, useRouter } from "next"\nexport default function Home() { return <div>Home</div> }'

			const metadata = extractNextJSComponentMetadata(mockNode, filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.nextjsImports).toContain("GetServerSideProps")
			expect(metadata?.nextjsImports).toContain("useRouter")
		})

		it("should detect Next.js hooks usage", () => {
			const mockNode = createMockNode(
				"function_declaration",
				"export default function Component() { const router = useRouter(); const pathname = usePathname(); return <div>{pathname}</div> }",
			)
			const filePath = "/app/page.tsx"
			const text =
				"export default function Component() { const router = useRouter(); const pathname = usePathname(); return <div>{pathname}</div> }"

			const metadata = extractNextJSComponentMetadata(mockNode, filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.nextjsHooks).toContain("useRouter")
			expect(metadata?.nextjsHooks).toContain("usePathname")
		})

		it("should detect Next.js components usage", () => {
			const mockNode = createMockNode(
				"function_declaration",
				'export default function Component() { return <div><Image src="/logo.png" alt="Logo" /><Link href="/about">About</Link></div> }',
			)
			const filePath = "/app/page.tsx"
			const text =
				'export default function Component() { return <div><Image src="/logo.png" alt="Logo" /><Link href="/about">About</Link></div> }'

			const metadata = extractNextJSComponentMetadata(mockNode, filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.nextjsComponents).toContain("next.Image")
			expect(metadata?.nextjsComponents).toContain("next.Link")
		})
	})

	describe("extractNextJSRouteMetadata", () => {
		it("should extract metadata for static route", () => {
			const filePath = "/pages/about.tsx"
			const text = "export default function About() { return <div>About Us</div> }"

			const metadata = extractNextJSRouteMetadata(filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.routeType).toBe("static")
			expect(metadata?.routePath).toBe("about")
			expect(metadata?.parameters).toEqual([])
		})

		it("should extract metadata for dynamic route", () => {
			const filePath = "/pages/posts/[slug].tsx"
			const text = "export default function Post({ params }) { return <div>Post: {params.slug}</div> }"

			const metadata = extractNextJSRouteMetadata(filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.routeType).toBe("dynamic")
			expect(metadata?.routePath).toBe("posts/[slug]")
			expect(metadata?.parameters).toEqual(["slug"])
		})

		it("should extract metadata for catch-all route", () => {
			const filePath = "/pages/docs/[...slug].tsx"
			const text = "export default function Docs({ params }) { return <div>Docs: {params.slug}</div> }"

			const metadata = extractNextJSRouteMetadata(filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.routeType).toBe("catch_all")
			expect(metadata?.routePath).toBe("docs/[...slug]")
			expect(metadata?.parameters).toEqual(["slug"])
		})

		it("should extract metadata for optional catch-all route", () => {
			const filePath = "/pages/blog/[[...slug]].tsx"
			const text = "export default function Blog({ params }) { return <div>Blog: {params.slug}</div> }"

			const metadata = extractNextJSRouteMetadata(filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.routeType).toBe("optional_catch_all")
			expect(metadata?.routePath).toBe("blog/[[...slug]]")
			expect(metadata?.parameters).toEqual(["slug"])
		})

		it("should extract metadata for API route", () => {
			const filePath = "/pages/api/users.ts"
			const text =
				'export default function handler(req, res) { if (req.method === "GET") { res.status(200).json([]) } }'

			const metadata = extractNextJSRouteMetadata(filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.routeType).toBe("api")
			expect(metadata?.routePath).toBe("api/users")
		})

		it("should extract metadata for app router page", () => {
			const filePath = "/app/dashboard/page.tsx"
			const text = "export default function Dashboard() { return <div>Dashboard</div> }"

			const metadata = extractNextJSRouteMetadata(filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.routeType).toBe("static")
			expect(metadata?.routePath).toBe("dashboard/page")
		})

		it("should extract metadata for app router route handler", () => {
			const filePath = "/app/api/users/route.ts"
			const text =
				"export async function GET(request) { return Response.json([]) }\nexport async function POST(request) { const body = await request.json(); return Response.json(body, { status: 201 }) }"

			const metadata = extractNextJSRouteMetadata(filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.routeType).toBe("api")
			expect(metadata?.routePath).toBe("api/users")
			expect(metadata?.httpMethods).toContain("GET")
			expect(metadata?.httpMethods).toContain("POST")
		})

		it("should detect SSR patterns", () => {
			const filePath = "/pages/posts/[slug].tsx"
			const text =
				"export async function getServerSideProps({ params }) { const post = await getPost(params.slug); return { props: { post } } }\nexport default function Post({ post }) { return <div>{post.title}</div> }"

			const metadata = extractNextJSRouteMetadata(filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.isSSR).toBe(true)
			expect(metadata?.isSSG).toBe(false)
			expect(metadata?.isISR).toBe(false)
		})

		it("should detect SSG patterns", () => {
			const filePath = "/pages/posts/[slug].tsx"
			const text =
				"export async function getStaticProps({ params }) { const post = await getPost(params.slug); return { props: { post } } }\nexport default function Post({ post }) { return <div>{post.title}</div> }"

			const metadata = extractNextJSRouteMetadata(filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.isSSR).toBe(false)
			expect(metadata?.isSSG).toBe(true)
			expect(metadata?.isISR).toBe(false)
		})

		it("should detect ISR patterns", () => {
			const filePath = "/pages/posts/[slug].tsx"
			const text =
				"export async function getStaticProps({ params }) { const post = await getPost(params.slug); return { props: { post }, revalidate: 60 } }\nexport default function Post({ post }) { return <div>{post.title}</div> }"

			const metadata = extractNextJSRouteMetadata(filePath, text)

			expect(metadata).toBeDefined()
			expect(metadata?.isSSR).toBe(false)
			expect(metadata?.isSSG).toBe(false)
			expect(metadata?.isISR).toBe(true)
			expect(metadata?.revalidateTime).toBe(60)
		})
	})

	describe("extractNextJSServerSideMetadata", () => {
		it("should return undefined for client-side only components", () => {
			const text =
				"export default function ClientComponent() { const [count, setCount] = useState(0); return <div>{count}</div> }"

			const metadata = extractNextJSServerSideMetadata(text)

			expect(metadata).toBeUndefined()
		})

		it("should extract SSR metadata", () => {
			const text =
				"export async function getServerSideProps({ params }) { const post = await getPost(params.slug); return { props: { post } } }\nexport default function Post({ post }) { return <div>{post.title}</div> }"

			const metadata = extractNextJSServerSideMetadata(text)

			expect(metadata).toBeDefined()
			expect(metadata?.renderingType).toBe("ssr")
			expect(metadata?.hasDataFetching).toBe(true)
			expect(metadata?.dataFetchingMethod).toBe("getServerSideProps")
		})

		it("should extract SSG metadata", () => {
			const text =
				"export async function getStaticProps({ params }) { const post = await getPost(params.slug); return { props: { post } } }\nexport default function Post({ post }) { return <div>{post.title}</div> }"

			const metadata = extractNextJSServerSideMetadata(text)

			expect(metadata).toBeDefined()
			expect(metadata?.renderingType).toBe("ssg")
			expect(metadata?.hasDataFetching).toBe(true)
			expect(metadata?.dataFetchingMethod).toBe("getStaticProps")
		})

		it("should extract ISR metadata", () => {
			const text =
				"export async function getStaticProps({ params }) { const post = await getPost(params.slug); return { props: { post }, revalidate: 3600 } }\nexport default function Post({ post }) { return <div>{post.title}</div> }"

			const metadata = extractNextJSServerSideMetadata(text)

			expect(metadata).toBeDefined()
			expect(metadata?.renderingType).toBe("isr")
			expect(metadata?.hasDataFetching).toBe(true)
			expect(metadata?.dataFetchingMethod).toBe("getStaticProps")
			expect(metadata?.revalidateInterval).toBe(3600)
		})

		it("should extract cache strategy", () => {
			const text =
				"export async function getStaticProps() { const data = await getData(); return { props: { data }, revalidate: 60 } }\nexport default function Page({ data }) { return <div>{data}</div> }"

			const metadata = extractNextJSServerSideMetadata(text)

			expect(metadata).toBeDefined()
			expect(metadata?.cacheStrategy).toBe("default")
		})

		it("should handle getStaticPaths", () => {
			const text =
				"export async function getStaticPaths() { const paths = await getPaths(); return { paths, fallback: false } }\nexport async function getStaticProps({ params }) { const post = await getPost(params.slug); return { props: { post } } }\nexport default function Post({ post }) { return <div>{post.title}</div> }"

			const metadata = extractNextJSServerSideMetadata(text)

			expect(metadata).toBeDefined()
			expect(metadata?.hasDataFetching).toBe(true)
			expect(metadata?.dataFetchingMethod).toBe("getStaticProps")
		})

		it("should handle mixed data fetching methods", () => {
			const text =
				'export async function getStaticProps() { const data = await getData(); return { props: { data } } }\nexport async function getStaticPaths() { const paths = await getPaths(); return { paths, fallback: "blocking" } }\nexport default function Page({ data }) { return <div>{data}</div> }'

			const metadata = extractNextJSServerSideMetadata(text)

			expect(metadata).toBeDefined()
			expect(metadata?.hasDataFetching).toBe(true)
			expect(metadata?.dataFetchingMethod).toBe("getStaticProps")
		})
	})

	describe("Complex Integration Tests", () => {
		it("should handle complete Next.js app router page with metadata", () => {
			const filePath = "/app/blog/[slug]/page.tsx"
			const text = `
import { Metadata } from 'next'
import { notFound } from 'next/navigation'

interface BlogPostProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: BlogPostProps): Promise<Metadata> {
  const post = await getPost(params.slug)
  return {
    title: post.title,
    description: post.excerpt,
  }
}

export default async function BlogPost({ params }: BlogPostProps) {
  const post = await getPost(params.slug)
  
  if (!post) {
    notFound()
  }
  
  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  )
}
			`.trim()

			const componentMetadata = extractNextJSComponentMetadata(
				createMockNode("function_declaration", text),
				filePath,
				text,
			)
			const routeMetadata = extractNextJSRouteMetadata(filePath, text)
			const serverMetadata = extractNextJSServerSideMetadata(text)

			expect(componentMetadata).toBeDefined()
			expect(componentMetadata?.componentType).toBe("server")
			expect(componentMetadata?.routerType).toBe("app")
			expect(componentMetadata?.isDynamic).toBe(true)
			expect(componentMetadata?.hasGenerateMetadata).toBe(true)

			expect(routeMetadata).toBeDefined()
			expect(routeMetadata?.routeType).toBe("dynamic")
			expect(routeMetadata?.routePath).toBe("blog/[slug]/page")
			expect(routeMetadata?.parameters).toEqual(["slug"])

			expect(serverMetadata).toBeUndefined() // No getStaticProps or getServerSideProps
		})

		it("should handle complete pages router page with data fetching", () => {
			const filePath = "/pages/posts/[id].tsx"
			const text = `
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'

interface PostPageProps {
  post: Post
}

export default function PostPage({ post }: PostPageProps) {
  const router = useRouter()
  
  return (
    <div>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
      <button onClick={() => router.push('/')}>Back</button>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps<PostPageProps> = async ({ params }) => {
  const post = await getPost(params.id as string)
  
  if (!post) {
    return {
      notFound: true,
    }
  }
  
  return {
    props: {
      post,
    },
  }
}
			`.trim()

			const componentMetadata = extractNextJSComponentMetadata(
				createMockNode("function_declaration", text),
				filePath,
				text,
			)
			const routeMetadata = extractNextJSRouteMetadata(filePath, text)
			const serverMetadata = extractNextJSServerSideMetadata(text)

			expect(componentMetadata).toBeDefined()
			expect(componentMetadata?.componentType).toBe("page")
			expect(componentMetadata?.routerType).toBe("pages")
			expect(componentMetadata?.isDynamic).toBe(true)
			expect(componentMetadata?.hasGetServerSideProps).toBe(true)
			expect(componentMetadata?.nextjsHooks).toContain("useRouter")

			expect(routeMetadata).toBeDefined()
			expect(routeMetadata?.routeType).toBe("dynamic")
			expect(routeMetadata?.routePath).toBe("posts/[id]")
			expect(routeMetadata?.parameters).toEqual(["id"])
			expect(routeMetadata?.isSSR).toBe(true)

			expect(serverMetadata).toBeDefined()
			expect(serverMetadata?.renderingType).toBe("ssr")
			expect(serverMetadata?.hasDataFetching).toBe(true)
			expect(serverMetadata?.dataFetchingMethod).toBe("getServerSideProps")
		})
	})

	describe("Angular Pattern Integration Tests", () => {
		it("should extract Angular component metadata alongside Next.js", () => {
			const mockNode = createMockNode(
				"class_declaration",
				`
				@Component({
					selector: 'app-user-profile',
					templateUrl: './user-profile.component.html'
				})
				export class UserProfileComponent {
					@Input() user: User
					ngOnInit() {
						console.log('Angular component initialized')
					}
				}
			`,
			)
			const filePath = "/app/user-profile/page.tsx"
			const text = mockNode.text

			// Should not extract Next.js metadata for Angular component
			const nextjsMetadata = extractNextJSComponentMetadata(mockNode, filePath, text)
			expect(nextjsMetadata).toBeUndefined()

			// Should extract Angular component metadata
			const angularMetadata = extractAngularComponentMetadata(mockNode, text)
			expect(angularMetadata).toBeDefined()
			expect(angularMetadata?.componentType).toBe("component")
			expect(angularMetadata?.selector).toBe("app-user-profile")
			expect(angularMetadata?.inputs).toContain("user")
			expect(angularMetadata?.lifecycleHooks).toContain("ngOnInit")
		})

		it("should extract Angular service metadata", () => {
			const mockNode = createMockNode(
				"class_declaration",
				`
				@Injectable({
					providedIn: 'root'
				})
				export class UserService {
					constructor(private http: HttpClient) {}
					
					getUser(id: string): Observable<User> {
						return this.http.get<User>(\`/api/users/\${id}\`)
					}
				}
			`,
			)
			const text = mockNode.text

			// Should extract Angular service metadata
			const angularMetadata = extractAngularServiceMetadata(mockNode, text)
			expect(angularMetadata).toBeDefined()
			expect(angularMetadata?.serviceType).toBe("service")
			expect(angularMetadata?.providedIn).toBe("root")
			expect(angularMetadata?.constructorDependencies).toContain("HttpClient")
			expect(angularMetadata?.methods).toContain("getUser")
		})

		it("should extract Angular module metadata", () => {
			const mockNode = createMockNode(
				"class_declaration",
				`
				@NgModule({
					declarations: [AppComponent, UserComponent],
					imports: [BrowserModule, HttpClientModule],
					providers: [UserService],
					bootstrap: [AppComponent]
				})
				export class AppModule {}
			`,
			)
			const text = mockNode.text

			// Should extract Angular module metadata
			const angularMetadata = extractAngularModuleMetadata(mockNode, text)
			expect(angularMetadata).toBeDefined()
			expect(angularMetadata?.moduleType).toBe("root")
			expect(angularMetadata?.declarations).toContain("AppComponent")
			expect(angularMetadata?.imports).toContain("BrowserModule")
			expect(angularMetadata?.providers).toContain("UserService")
			expect(angularMetadata?.bootstrap).toContain("AppComponent")
		})

		it("should extract Angular routing metadata", () => {
			const mockNode = createMockNode(
				"assignment_expression",
				`
				const routes: Routes = [
					{
						path: 'users/:id',
						component: UserComponent,
						canActivate: [AuthGuard],
						resolve: {
							user: UserResolver
						},
						data: {
							title: 'User Profile'
						}
					},
					{
						path: 'lazy',
						loadChildren: () => import('./lazy/lazy.module').then(m => m.LazyModule)
					}
				]
			`,
			)
			const text = mockNode.text

			// Should extract Angular routing metadata
			const angularMetadata = extractAngularRoutingMetadata(mockNode, text)
			expect(angularMetadata).toBeDefined()
			expect(angularMetadata?.routeType).toBe("router-configuration")
			expect(angularMetadata?.path).toBe("users/:id")
			expect(angularMetadata?.component).toBe("UserComponent")
			expect(angularMetadata?.canActivate).toContain("AuthGuard")
			expect(angularMetadata?.resolve).toEqual({ user: "UserResolver" })
			expect(angularMetadata?.data).toEqual({ title: "User Profile" })
			expect(angularMetadata?.isDynamic).toBe(true)
			expect(angularMetadata?.parameters).toContain("id")
		})

		it("should extract Angular form metadata", () => {
			const mockNode = createMockNode(
				"class_declaration",
				`
				export class UserFormComponent implements OnInit {
					userForm: FormGroup
					
					constructor(private fb: FormBuilder) {}
					
					ngOnInit() {
						this.userForm = this.fb.group({
							name: ['', Validators.required],
							email: ['', [Validators.required, Validators.email]]
						})
					}
					
					onSubmit() {
						if (this.userForm.valid) {
							console.log('Form submitted', this.userForm.value)
						}
					}
				}
			`,
			)
			const text = mockNode.text + " FormGroup FormBuilder Validators"

			// Should extract Angular form metadata
			const angularMetadata = extractAngularFormMetadata(mockNode, text)
			expect(angularMetadata).toBeDefined()
			expect(angularMetadata?.formType).toBe("reactive")
			expect(angularMetadata?.formGroup).toBe("userForm")
			expect(angularMetadata?.validators).toContain("required")
			expect(angularMetadata?.validators).toContain("email")
			expect(angularMetadata?.submitMethod).toBe("onSubmit")
		})

		it("should extract Angular HTTP metadata", () => {
			const mockNode = createMockNode(
				"class_declaration",
				`
				@Injectable({
					providedIn: 'root'
				})
				export class ApiService {
					constructor(private http: HttpClient) {}
					
					getData(): Observable<any> {
						return this.http.get('/api/data')
					}
					
					postData(data: any): Observable<any> {
						return this.http.post('/api/data', data, {
							headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
							params: new HttpParams({ 'cache': 'true' })
						})
					}
				}
			`,
			)
			const text = mockNode.text

			// Should extract Angular HTTP metadata
			const angularMetadata = extractAngularHttpMetadata(mockNode, text)
			expect(angularMetadata).toBeDefined()
			expect(angularMetadata?.httpType).toBe("service")
			expect(angularMetadata?.methods).toContain("get")
			expect(angularMetadata?.methods).toContain("post")
			expect(angularMetadata?.endpoints).toContain("/api/data")
		})

		it("should extract Angular RxJS metadata", () => {
			const mockNode = createMockNode(
				"class_declaration",
				`
				export class DataService {
					private dataSubject = new BehaviorSubject<any>(null)
					public data$ = this.dataSubject.asObservable()
					
					constructor() {
						this.data$.pipe(
							take(1),
							map(data => data?.value),
							catchError(error => of(null))
						).subscribe()
					}
					
					updateData(newData: any) {
						this.dataSubject.next(newData)
					}
				}
			`,
			)
			const text = mockNode.text

			// Should extract Angular RxJS metadata
			const angularMetadata = extractAngularRxJSMetadata(mockNode, text)
			expect(angularMetadata).toBeDefined()
			expect(angularMetadata?.observableType).toBe("behavior-subject")
			expect(angularMetadata?.operators).toContain("take")
			expect(angularMetadata?.operators).toContain("map")
			expect(angularMetadata?.operators).toContain("catchError")
			expect(angularMetadata?.cold).toBe(true)
		})

		it("should extract Angular test metadata", () => {
			const mockNode = createMockNode(
				"call_expression",
				`
				describe('UserService', () => {
					let service: UserService
					let httpMock: HttpClientTestingModule

					beforeEach(() => {
						TestBed.configureTestingModule({
							providers: [UserService, { provide: HttpClient, useValue: httpMock }]
						})
						service = TestBed.inject(UserService)
					})

					it('should create service', () => {
						expect(service).toBeTruthy()
					})

					it('should get user data', () => {
						spyOn(service, 'getUser').and.returnValue(of(mockUser))
						service.getUser('1').subscribe(user => {
							expect(user).toEqual(mockUser)
						})
					})
				})
			`,
			)
			const text = mockNode.text

			// Should extract Angular test metadata
			const angularMetadata = extractAngularTestMetadata(mockNode, text)
			expect(angularMetadata).toBeDefined()
			expect(angularMetadata?.testType).toBe("unit")
			expect(angularMetadata?.testBed).toBeDefined()
			expect(angularMetadata?.describe).toContain("UserService")
			expect(angularMetadata?.it).toContain("should create service")
			expect(angularMetadata?.it).toContain("should get user data")
			expect(angularMetadata?.spyOn).toContain("service")
			expect(angularMetadata?.beforeEach).toContain("beforeEach")
		})

		it("should handle mixed framework detection correctly", () => {
			// Test with a file that could be either Next.js or Angular
			const mockNode = createMockNode(
				"class_declaration",
				`
				@Component({
					selector: 'app-component'
				})
				export class AppComponent {
					constructor() {}
				}
			`,
			)
			const filePath = "/app/page.tsx"
			const text = mockNode.text

			// Should prioritize Angular detection when @Component is present
			const nextjsMetadata = extractNextJSComponentMetadata(mockNode, filePath, text)
			const angularMetadata = extractAngularComponentMetadata(mockNode, text)

			expect(nextjsMetadata).toBeUndefined()
			expect(angularMetadata).toBeDefined()
			expect(angularMetadata?.componentType).toBe("component")
		})

		it("should handle framework-agnostic code correctly", () => {
			// Test with plain TypeScript code that doesn't belong to either framework
			const mockNode = createMockNode(
				"class_declaration",
				`
				export class PlainClass {
					constructor() {}
					
					doSomething(): void {
						console.log('Doing something')
					}
				}
			`,
			)
			const filePath = "/src/utils/plain-class.ts"
			const text = mockNode.text

			// Should not extract metadata for either framework
			const nextjsMetadata = extractNextJSComponentMetadata(mockNode, filePath, text)
			const angularMetadata = extractAngularComponentMetadata(mockNode, text)
			const angularServiceMetadata = extractAngularServiceMetadata(mockNode, text)

			expect(nextjsMetadata).toBeUndefined()
			expect(angularMetadata).toBeUndefined()
			expect(angularServiceMetadata).toBeUndefined()
		})
	})
})
