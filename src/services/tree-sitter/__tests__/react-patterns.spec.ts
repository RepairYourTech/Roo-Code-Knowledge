import { initializeTreeSitter } from "./helpers"
import { testParseSourceCodeDefinitions } from "./helpers"

describe("React Pattern Detection", () => {
	const testOptions = {
		language: "tsx",
		wasmFile: "tree-sitter-tsx.wasm",
	}

	beforeAll(async () => {
		await initializeTreeSitter()
	})

	describe("Functional Components", () => {
		it("should detect basic functional component", async () => {
			const code = `
function MyComponent() {
  return <div>Hello World</div>
}
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.functional_component")
			expect(result).toContain("MyComponent")
		})

		it("should detect arrow function component", async () => {
			const code = `
const MyComponent = () => {
  return <div>Hello World</div>
}
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.functional_component")
			expect(result).toContain("MyComponent")
		})

		it("should detect exported functional component", async () => {
			const code = `
export const MyComponent = () => {
  return <div>Hello World</div>
}
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.exported_functional_component")
			expect(result).toContain("MyComponent")
		})

		it("should detect functional component with return statement", async () => {
			const code = `
const MyComponent = () => {
  if (true) {
    return <div>True</div>
  }
  return <div>False</div>
}
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.functional_component")
			expect(result).toContain("MyComponent")
		})

		it("should detect component with hooks", async () => {
			const code = `
function MyComponent() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    console.log(count)
  }, [count])
  return <div>{count}</div>
}
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.hook_component")
			expect(result).toContain("definition.use_state_hook")
			expect(result).toContain("definition.use_effect_hook")
		})
	})

	describe("Class Components", () => {
		it("should detect class component extending Component", async () => {
			const code = `
import React, { Component } from 'react'

class MyClassComponent extends Component {
  render() {
    return <div>Hello World</div>
  }
}
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.react_class_component")
			expect(result).toContain("MyClassComponent")
		})

		it("should detect class component extending React.Component", async () => {
			const code = `
class MyClassComponent extends React.Component {
  render() {
    return <div>Hello World</div>
  }
}
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.react_class_component_full")
			expect(result).toContain("MyClassComponent")
		})

		it("should detect class component with render method", async () => {
			const code = `
class MyClassComponent extends React.Component {
  render() {
    return <div>Hello World</div>
  }
}
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.class_component_with_render")
			expect(result).toContain("render")
		})
	})

	describe("React Hooks", () => {
		it("should detect useState hook", async () => {
			const code = `
const [count, setCount] = useState(0)
const [name, setName] = useState<string>('')
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.use_state_hook")
			expect(result).toContain("count")
			expect(result).toContain("setCount")
			expect(result).toContain("name")
			expect(result).toContain("setName")
		})

		it("should detect useEffect hook", async () => {
			const code = `
useEffect(() => {
  console.log('mounted')
}, [])

useEffect(() => {
  console.log(count)
}, [count])
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.use_effect_hook")
		})

		it("should detect useContext hook", async () => {
			const code = `
const user = useContext(UserContext)
const theme = useContext(ThemeContext)
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.use_context_hook")
			expect(result).toContain("user")
			expect(result).toContain("theme")
		})

		it("should detect useReducer hook", async () => {
			const code = `
const [state, dispatch] = useReducer(reducer, initialState)
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.use_reducer_hook")
			expect(result).toContain("state")
			expect(result).toContain("dispatch")
		})

		it("should detect useCallback hook", async () => {
			const code = `
const memoizedCallback = useCallback(() => {
  doSomething(a, b)
}, [a, b])
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.use_callback_hook")
			expect(result).toContain("memoizedCallback")
		})

		it("should detect useMemo hook", async () => {
			const code = `
const memoizedValue = useMemo(() => computeExpensiveValue(a, b), [a, b])
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.use_memo_hook")
			expect(result).toContain("memoizedValue")
		})

		it("should detect useRef hook", async () => {
			const code = `
const inputRef = useRef(null)
const countRef = useRef(0)
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.use_ref_hook")
			expect(result).toContain("inputRef")
			expect(result).toContain("countRef")
		})

		it("should detect custom hooks", async () => {
			const code = `
function useCustomHook(initialValue) {
  const [value, setValue] = useState(initialValue)
  return [value, setValue]
}

const useCustomHook = () => {
  const [data, setData] = useState(null)
  return { data, setData }
}
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.custom_hook")
			expect(result).toContain("definition.custom_arrow_hook")
			expect(result).toContain("useCustomHook")
		})
	})

	describe("JSX Patterns", () => {
		it("should detect JSX elements", async () => {
			const code = `
<div>
  <Header />
  <Main />
  <Footer />
</div>
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.jsx_element")
			expect(result).toContain("definition.jsx_self_closing_element")
			expect(result).toContain("Header")
			expect(result).toContain("Main")
			expect(result).toContain("Footer")
		})

		it("should detect JSX fragments", async () => {
			const code = `
<>
  <div>First</div>
  <div>Second</div>
</>

<React.Fragment>
  <div>First</div>
  <div>Second</div>
</React.Fragment>
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.jsx_fragment")
			expect(result).toContain("definition.react_fragment")
		})

		it("should detect JSX props", async () => {
			const code = `
<Button 
  onClick={handleClick}
  variant="primary"
  disabled={false}
  {...spreadProps}
>
  Click me
</Button>
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.jsx_prop_expression")
			expect(result).toContain("definition.jsx_prop_string")
			expect(result).toContain("definition.jsx_prop_boolean")
			expect(result).toContain("definition.jsx_spread_props")
			expect(result).toContain("onClick")
			expect(result).toContain("variant")
		})

		it("should detect JSX event handlers", async () => {
			const code = `
<input 
  onChange={handleChange}
  onClick={handleClick}
  onFocus={handleFocus}
  onBlur={handleBlur}
/>
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.jsx_event_handler")
			expect(result).toContain("onChange")
			expect(result).toContain("onClick")
			expect(result).toContain("onFocus")
			expect(result).toContain("onBlur")
		})

		it("should detect JSX event handlers with arrow functions", async () => {
			const code = `
<button onClick={() => console.log('clicked')}>
  Click me
</button>
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.jsx_event_arrow_handler")
			expect(result).toContain("onClick")
		})
	})

	describe("Higher Order Components", () => {
		it("should detect React.memo HOC", async () => {
			const code = `
const MemoizedComponent = React.memo(MyComponent)
const MemoizedComponent = memo(MyComponent)
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.react_memo_hoc")
			expect(result).toContain("MemoizedComponent")
		})

		it("should detect React.forwardRef HOC", async () => {
			const code = `
const ForwardedComponent = React.forwardRef((props, ref) => {
  return <div ref={ref}>Forwarded</div>
})
const ForwardedComponent = forwardRef((props, ref) => {
  return <div ref={ref}>Forwarded</div>
})
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.react_forward_ref_hoc")
			expect(result).toContain("ForwardedComponent")
		})

		it("should detect generic HOC pattern", async () => {
			const code = `
const withAuth = (Component) => {
  return (props) => {
    if (!isAuthenticated()) {
      return <Login />
    }
    return <Component {...props} />
  }
}

const ProtectedComponent = withAuth(MyComponent)
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.hoc_component")
			expect(result).toContain("ProtectedComponent")
		})
	})

	describe("Conditional Rendering", () => {
		it("should detect ternary conditional rendering", async () => {
			const code = `
return isLoggedIn ? <UserProfile /> : <LoginForm />
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.conditional_ternary")
			expect(result).toContain("UserProfile")
			expect(result).toContain("LoginForm")
		})

		it("should detect logical AND conditional rendering", async () => {
			const code = `
return isLoggedIn && <UserProfile />
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.conditional_logical_and")
			expect(result).toContain("UserProfile")
		})
	})

	describe("Type Definitions", () => {
		it("should detect Props interfaces", async () => {
			const code = `
interface ButtonProps {
  variant: 'primary' | 'secondary'
  size: 'small' | 'medium' | 'large'
  disabled?: boolean
  onClick?: () => void
}

interface UserCardProps {
  user: User
  onEdit?: (user: User) => void
}
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.props_interface")
			expect(result).toContain("ButtonProps")
			expect(result).toContain("UserCardProps")
		})

		it("should detect Props type aliases", async () => {
			const code = `
type ButtonProps = {
  variant: 'primary' | 'secondary'
  size: 'small' | 'medium' | 'large'
  disabled?: boolean
}

type InputProps = {
  value: string
  onChange: (value: string) => void
}
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.props_type")
			expect(result).toContain("ButtonProps")
			expect(result).toContain("InputProps")
		})

		it("should detect State type definitions", async () => {
			const code = `
type CounterState = {
  count: number
  isIncrementing: boolean
}

type UserState = {
  user: User | null
  isLoading: boolean
  error: string | null
}
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.state_type")
			expect(result).toContain("CounterState")
			expect(result).toContain("UserState")
		})

		it("should detect JSX.Element return type", async () => {
			const code = `
const MyComponent = (): JSX.Element => {
  return <div>Hello</div>
}

function AnotherComponent(): JSX.Element {
  return <div>World</div>
}
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.jsx_return_type")
		})
	})

	describe("React Imports", () => {
		it("should detect React named imports", async () => {
			const code = `
import React, { useState, useEffect, Component } from 'react'
import { Fragment, memo, forwardRef } from 'react'
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.react_import")
			expect(result).toContain("useState")
			expect(result).toContain("useEffect")
			expect(result).toContain("Component")
			expect(result).toContain("Fragment")
			expect(result).toContain("memo")
			expect(result).toContain("forwardRef")
		})

		it("should detect React default import", async () => {
			const code = `
import React from 'react'
import React, { useState } from 'react'
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.react_default_import")
		})

		it("should detect React library imports", async () => {
			const code = `
import ReactDOM from 'react-dom'
import { render } from 'react-dom'
import { screen, fireEvent } from '@testing-library/react'
import { createRoot } from 'react-dom/client'
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.react_library_import")
		})
	})

	describe("Complex Component Patterns", () => {
		it("should detect component with multiple hooks and props", async () => {
			const code = `
import React, { useState, useEffect, useCallback } from 'react'

interface TodoListProps {
  items: Todo[]
  onToggle: (id: number) => void
}

const TodoList: React.FC<TodoListProps> = ({ items, onToggle }) => {
  const [filter, setFilter] = useState('all')
  const [filteredItems, setFilteredItems] = useState(items)

  useEffect(() => {
    setFilteredItems(
      filter === 'completed' 
        ? items.filter(item => item.completed)
        : items
    )
  }, [items, filter])

  const handleToggle = useCallback((id: number) => {
    onToggle(id)
  }, [onToggle])

  return (
    <div>
      {filteredItems.map(item => (
        <div key={item.id}>
          <span>{item.text}</span>
          <button onClick={() => handleToggle(item.id)}>
            {item.completed ? 'Undo' : 'Complete'}
          </button>
        </div>
      ))}
    </div>
  )
}
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.functional_component")
			expect(result).toContain("definition.use_state_hook")
			expect(result).toContain("definition.use_effect_hook")
			expect(result).toContain("definition.use_callback_hook")
			expect(result).toContain("definition.props_interface")
			expect(result).toContain("definition.jsx_element")
			expect(result).toContain("definition.jsx_event_handler")
			expect(result).toContain("TodoList")
		})

		it("should detect class component with lifecycle methods", async () => {
			const code = `
import React, { Component } from 'react'

class LifecycleComponent extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { count: 0 }
  }

  componentDidMount() {
    console.log('mounted')
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.count !== this.props.count) {
      this.setState({ count: this.props.count })
    }
  }

  componentWillUnmount() {
    console.log('unmounted')
  }

  render() {
    return (
      <div>
        <p>Count: {this.state.count}</p>
        <button onClick={() => this.setState({ count: this.state.count + 1 })}>
          Increment
        </button>
      </div>
    )
  }
}
			`
			const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
			expect(result).toBeDefined()
			expect(result).toContain("definition.react_class_component")
			expect(result).toContain("definition.class_component_with_render")
			expect(result).toContain("LifecycleComponent")
		})
	})

	describe("Next.js Patterns", () => {
		describe("Next.js Imports", () => {
			it("should detect Next.js core imports", async () => {
				const code = `
import { GetServerSideProps, GetStaticProps, GetStaticPaths } from 'next'
import type { NextApiRequest, NextApiResponse } from 'next'
import { NextPage, NextApp, NextLayout, Metadata } from 'next'
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_import")
				expect(result).toContain("GetServerSideProps")
				expect(result).toContain("GetStaticProps")
				expect(result).toContain("GetStaticPaths")
				expect(result).toContain("NextApiRequest")
				expect(result).toContain("NextApiResponse")
			})

			it("should detect Next.js library imports", async () => {
				const code = `
import Image from 'next/image'
import Link from 'next/link'
import Script from 'next/script'
import Head from 'next/head'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_library_import")
			})
		})

		describe("Next.js Pages Router", () => {
			it("should detect Next.js page components", async () => {
				const code = `
export default function HomePage() {
		return <div>Welcome to Next.js!</div>
}

export function AboutPage() {
		return <div>About Us</div>
}

const ContactPage = () => {
		return <div>Contact</div>
}
export default ContactPage
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_page_component")
				expect(result).toContain("definition.nextjs_default_page")
				expect(result).toContain("HomePage")
				expect(result).toContain("AboutPage")
				expect(result).toContain("ContactPage")
			})

			it("should detect getServerSideProps", async () => {
				const code = `
export async function getServerSideProps(context) {
		const data = await fetchData()
		return {
		  props: {
		    data
		  }
		}
}

export default function MyPage({ data }) {
		return <div>{data}</div>
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_get_server_side_props")
				expect(result).toContain("getServerSideProps")
			})

			it("should detect getStaticProps", async () => {
				const code = `
export async function getStaticProps() {
		const posts = await getPosts()
		return {
		  props: {
		    posts
		  }
		}
}

export default function BlogPage({ posts }) {
		return <div>{posts.length} posts</div>
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_get_static_props")
				expect(result).toContain("getStaticProps")
			})

			it("should detect getStaticPaths", async () => {
				const code = `
export async function getStaticPaths() {
		const paths = await getPostPaths()
		return {
		  paths,
		  fallback: false
		}
}

export async function getStaticProps({ params }) {
		const post = await getPost(params.slug)
		return {
		  props: {
		    post
		  }
		}
}

export default function PostPage({ post }) {
		return <div>{post.title}</div>
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_get_static_paths")
				expect(result).toContain("getStaticPaths")
			})
		})

		describe("Next.js API Routes", () => {
			it("should detect API route handlers", async () => {
				const code = `
import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
		if (req.method === 'GET') {
		  res.status(200).json({ message: 'Hello API' })
		} else {
		  res.status(405).json({ error: 'Method not allowed' })
		}
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_api_route")
				expect(result).toContain("handler")
			})

			it("should detect API route arrow functions", async () => {
				const code = `
import type { NextApiRequest, NextApiResponse } from 'next'

export default async (req: NextApiRequest, res: NextApiResponse) => {
		const data = await getData()
		res.status(200).json(data)
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_api_route_arrow")
				expect(result).toContain("default")
			})
		})

		describe("Next.js App Router", () => {
			it("should detect layout components", async () => {
				const code = `
export default function Layout({ children }: { children: React.ReactNode }) {
		return (
		  <html>
		    <body>
		      <header>My App</header>
		      <main>{children}</main>
		      <footer>Footer</footer>
		    </body>
		  </html>
		)
}

export function RootLayout({ children }: { children: React.ReactNode }) {
		return (
		  <html lang="en">
		    <body>{children}</body>
		  </html>
		)
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_layout_component")
				expect(result).toContain("definition.nextjs_layout_component_arrow")
				expect(result).toContain("children")
			})

			it("should detect server components", async () => {
				const code = `
export default async function ServerComponent() {
		const data = await fetchData()
		return <div>{data.message}</div>
}

export const ServerComponent2 = async () => {
		const posts = await getPosts()
		return (
		  <ul>
		    {posts.map(post => (
		      <li key={post.id}>{post.title}</li>
		    ))}
		  </ul>
		)
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_server_component")
				expect(result).toContain("definition.nextjs_server_component_arrow")
			})

			it("should detect client components", async () => {
				const code = `
'use client'

import { useState } from 'react'

export default function ClientComponent() {
		const [count, setCount] = useState(0)
		return (
		  <button onClick={() => setCount(count + 1)}>
		    Count: {count}
		  </button>
		)
}

"use client"

export function InteractiveComponent() {
		const [open, setOpen] = useState(false)
		return <div>Interactive</div>
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_client_component")
			})

			it("should detect metadata exports", async () => {
				const code = `
export const metadata = {
		title: 'My Page Title',
		description: 'Page description',
		openGraph: {
		  title: 'OG Title',
		  description: 'OG Description',
		},
}

export async function generateMetadata({ params }) {
		return {
		  title: \`Post: \${params.slug}\`,
		}
}

export default function Page() {
		return <div>Page content</div>
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_metadata_export")
				expect(result).toContain("definition.nextjs_generate_metadata")
				expect(result).toContain("metadata")
				expect(result).toContain("generateMetadata")
			})

			it("should detect loading components", async () => {
				const code = `
export default function Loading() {
		return <div>Loading...</div>
}

export function LoadingSpinner() {
		return <div className="spinner">Loading...</div>
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_loading_component")
				expect(result).toContain("Loading")
				expect(result).toContain("LoadingSpinner")
			})

			it("should detect error components", async () => {
				const code = `
'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
		return (
		  <div>
		    <h2>Something went wrong!</h2>
		    <button onClick={() => reset()}>Try again</button>
		  </div>
		)
}

export function ErrorBoundary({ error }: { error: Error }) {
		return <div>Error: {error.message}</div>
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_error_component")
				expect(result).toContain("Error")
				expect(result).toContain("ErrorBoundary")
			})

			it("should detect not found components", async () => {
				const code = `
export default function NotFound() {
		return <div>Page not found</div>
}

export function Custom404() {
		return <div>404 - Page not found</div>
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_not_found_component")
				expect(result).toContain("NotFound")
				expect(result).toContain("Custom404")
			})

			it("should detect route handlers", async () => {
				const code = `
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
		const data = await getData()
		return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
		const body = await request.json()
		const result = await createData(body)
		return NextResponse.json(result, { status: 201 })
}

export async function PUT(request: NextRequest) {
		const body = await request.json()
		const result = await updateData(body)
		return NextResponse.json(result)
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_route_handler")
				expect(result).toContain("GET")
				expect(result).toContain("POST")
				expect(result).toContain("PUT")
			})
		})

		describe("Next.js Middleware", () => {
			it("should detect middleware function", async () => {
				const code = `
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
		if (request.nextUrl.pathname.startsWith('/admin')) {
		  return new Response('Access denied', { status: 403 })
		}
		
		return NextResponse.next()
}

export const config = {
		matcher: ['/admin/:path*']
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_middleware")
				expect(result).toContain("middleware")
			})
		})

		describe("Next.js Components Usage", () => {
			it("should detect Next.js Image component", async () => {
				const code = `
import Image from 'next/image'

function Avatar() {
		return (
		  <Image
		    src="/avatar.jpg"
		    alt="User Avatar"
		    width={64}
		    height={64}
		    priority
		  />
		)
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_image_usage")
			})

			it("should detect Next.js Link component", async () => {
				const code = `
import Link from 'next/link'

function Navigation() {
		return (
		  <nav>
		    <Link href="/">Home</Link>
		    <Link href="/about">About</Link>
		    <Link href="/contact">Contact</Link>
		  </nav>
		)
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_link_usage")
			})

			it("should detect Next.js Script component", async () => {
				const code = `
import Script from 'next/script'

function Analytics() {
		return (
		  <Script
		    src="https://analytics.google.com/ga.js"
		    strategy="afterInteractive"
		  />
		)
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_script_usage")
			})

			it("should detect Next.js Head component", async () => {
				const code = `
import Head from 'next/head'

function MetaTags() {
		return (
		  <Head>
		    <title>Page Title</title>
		    <meta name="description" content="Page description" />
		  </Head>
		)
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_head_usage")
			})
		})

		describe("Next.js Hooks and Functions", () => {
			it("should detect Next.js router hooks", async () => {
				const code = `
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

function NavigationComponent() {
		const router = useRouter()
		const pathname = usePathname()
		const searchParams = useSearchParams()
		
		const handleClick = () => {
		  router.push('/about')
		}
		
		return (
		  <div>
		    <p>Current path: {pathname}</p>
		    <p>Search params: {searchParams.toString()}</p>
		    <button onClick={handleClick}>Go to About</button>
		  </div>
		)
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_use_router")
				expect(result).toContain("definition.nextjs_use_pathname")
				expect(result).toContain("definition.nextjs_use_search_params")
			})

			it("should detect Next.js utility functions", async () => {
				const code = `
import { redirect, notFound, revalidatePath, revalidateTag, cookies, headers } from 'next/server'

async function serverAction() {
		const cookieStore = cookies()
		const headersList = headers()
		
		if (!user) {
		  redirect('/login')
		}
		
		if (!post) {
		  notFound()
		}
		
		revalidatePath('/posts')
		revalidateTag('posts')
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_redirect")
				expect(result).toContain("definition.nextjs_not_found")
				expect(result).toContain("definition.nextjs_revalidate_path")
				expect(result).toContain("definition.nextjs_revalidate_tag")
				expect(result).toContain("definition.nextjs_cookies")
				expect(result).toContain("definition.nextjs_headers")
			})
		})

		describe("Next.js Rendering Patterns", () => {
			it("should detect SSG patterns", async () => {
				const code = `
export async function getStaticProps() {
		const posts = await getPosts()
		return {
		  props: {
		    posts
		  }
		}
}

export default function BlogPage({ posts }) {
		return (
		  <div>
		    {posts.map(post => (
		      <article key={post.id}>
		        <h2>{post.title}</h2>
		        <p>{post.excerpt}</p>
		      </article>
		    ))}
		  </div>
		)
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_ssg_pattern")
			})

			it("should detect SSR patterns", async () => {
				const code = `
export async function getServerSideProps(context) {
		const user = await getUser(context.req.headers.cookie)
		return {
		  props: {
		    user
		  }
		}
}

export default function ProfilePage({ user }) {
		return <div>Welcome, {user.name}!</div>
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_ssr_pattern")
			})

			it("should detect ISR patterns", async () => {
				const code = `
export async function getStaticProps() {
		const data = await getData()
		return {
		  props: {
		    data
		  },
		  revalidate: 60 // Revalidate every 60 seconds
		}
}

export default function DataPage({ data }) {
		return <div>Data: {JSON.stringify(data)}</div>
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_isr_pattern")
			})
		})

		describe("Complex Next.js Patterns", () => {
			it("should detect full Next.js page with data fetching", async () => {
				const code = `
import { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import Image from 'next/image'
import Link from 'next/link'

interface PostPageProps {
		post: Post
		relatedPosts: Post[]
}

export default function PostPage({ post, relatedPosts }: PostPageProps) {
		const router = useRouter()
		
		return (
		  <div>
		    <head>
		      <title>{post.title}</title>
		    </head>
		    
		    <main>
		      <Image src={post.image} alt={post.title} width={800} height={400} />
		      <h1>{post.title}</h1>
		      <p>{post.content}</p>
		      
		      <section>
		        <h2>Related Posts</h2>
		        {relatedPosts.map(related => (
		          <Link key={related.id} href={\`/posts/\${related.slug}\`}>
		            {related.title}
		          </Link>
		        ))}
		      </section>
		    </main>
		  </div>
		)
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
		const post = await getPost(params.slug as string)
		const relatedPosts = await getRelatedPosts(post.id)
		
		return {
		  props: {
		    post,
		    relatedPosts
		  }
		}
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_get_server_side_props")
				expect(result).toContain("definition.nextjs_use_router")
				expect(result).toContain("definition.nextjs_image_usage")
				expect(result).toContain("definition.nextjs_link_usage")
				expect(result).toContain("definition.nextjs_head_usage")
			})

			it("should detect Next.js App Router layout with metadata", async () => {
				const code = `
import { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
		title: 'My App',
		description: 'Built with Next.js',
}

export default function RootLayout({
		children,
}: {
		children: React.ReactNode
}) {
		return (
		  <html lang="en">
		    <body>
		      <header>
		        <nav>
		          <a href="/">Home</a>
		          <a href="/about">About</a>
		        </nav>
		      </header>
		      <main>{children}</main>
		      <footer>
		        <p>&copy; 2023 My App</p>
		      </footer>
		    </body>
		  </html>
		)
}
				`
				const result = await testParseSourceCodeDefinitions("test.tsx", code, testOptions)
				expect(result).toBeDefined()
				expect(result).toContain("definition.nextjs_layout_component")
				expect(result).toContain("definition.nextjs_metadata_export")
				expect(result).toContain("metadata")
			})
		})
	})
})
