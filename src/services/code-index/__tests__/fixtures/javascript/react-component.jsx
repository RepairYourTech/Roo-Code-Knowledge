/**
 * Test fixture: React components (class and functional)
 *
 * Tests:
 * - Class components
 * - Functional components
 * - Hooks (useState, useEffect, useContext, custom hooks)
 * - Props and PropTypes
 * - Component composition
 */

import React, { useState, useEffect, useContext, createContext, useCallback, useMemo } from "react"
import PropTypes from "prop-types"

// Context
const ThemeContext = createContext("light")

// Class component
export class UserCard extends React.Component {
	constructor(props) {
		super(props)
		this.state = {
			isExpanded: false,
			loading: false,
			user: null,
			error: null,
		}
	}

	componentDidMount() {
		console.log("UserCard mounted")
		this.fetchUserData()
	}

	componentDidUpdate(prevProps) {
		if (prevProps.userId !== this.props.userId) {
			this.fetchUserData()
		}
	}

	componentWillUnmount() {
		console.log("UserCard unmounting")
		if (this._fetchController) {
			this._fetchController.abort()
		}
	}

	fetchUserData = async () => {
		this.setState({ loading: true, error: null })
		this._fetchController = new AbortController()
		try {
			const response = await fetch(`/api/users/${this.props.userId}`, {
				signal: this._fetchController.signal,
			})
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`)
			}
			const data = await response.json()
			this.setState({ user: data, loading: false })
		} catch (error) {
			if (!this._fetchController.signal.aborted) {
				this.setState({ error, loading: false })
			}
		}
	}

	toggleExpanded = () => {
		this.setState((prevState) => ({ isExpanded: !prevState.isExpanded }))
	}

	render() {
		const { user, isExpanded, loading, error } = this.state
		const { className } = this.props

		if (loading) return <div>Loading...</div>
		if (error) return <div>Error: {error.message}</div>
		if (!user) return null

		return (
			<div className={`user-card ${className}`}>
				<h3>{user.name}</h3>
				<button onClick={this.toggleExpanded}>{isExpanded ? "Collapse" : "Expand"}</button>
				{isExpanded && (
					<div className="user-details">
						<p>Email: {user.email}</p>
						<p>Role: {user.role}</p>
					</div>
				)}
			</div>
		)
	}
}

UserCard.propTypes = {
	userId: PropTypes.string.isRequired,
	className: PropTypes.string,
}

UserCard.defaultProps = {
	className: "",
}

// Functional component with hooks
export function UserList({ users, onUserSelect }) {
	const [searchTerm, setSearchTerm] = useState("")
	const [sortBy, setSortBy] = useState("name")
	const theme = useContext(ThemeContext)

	useEffect(() => {
		console.log("UserList rendered with", users.length, "users")
	}, [users])

	const filteredUsers = useMemo(() => {
		return users
			.filter(
				(user) =>
					user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
					user.email.toLowerCase().includes(searchTerm.toLowerCase()),
			)
			.sort((a, b) => (a[sortBy] ?? "").toString().localeCompare((b[sortBy] ?? "").toString()))
	}, [users, searchTerm, sortBy])

	const handleSearch = useCallback((e) => {
		setSearchTerm(e.target.value)
	}, [])

	return (
		<div className={`user-list theme-${theme}`}>
			<input type="text" placeholder="Search users..." value={searchTerm} onChange={handleSearch} />
			<select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
				<option value="name">Name</option>
				<option value="email">Email</option>
			</select>
			<ul>
				{filteredUsers.map((user) => (
					<li key={user.id} onClick={() => onUserSelect(user)}>
						{user.name} - {user.email}
					</li>
				))}
			</ul>
		</div>
	)
}

UserList.propTypes = {
	users: PropTypes.arrayOf(
		PropTypes.shape({
			id: PropTypes.string.isRequired,
			name: PropTypes.string.isRequired,
			email: PropTypes.string.isRequired,
		}),
	).isRequired,
	onUserSelect: PropTypes.func.isRequired,
}

// Custom hook
export function useLocalStorage(key, initialValue) {
	const [storedValue, setStoredValue] = useState(() => {
		try {
			const item = window.localStorage.getItem(key)
			return item ? JSON.parse(item) : initialValue
		} catch (error) {
			console.error(error)
			return initialValue
		}
	})

	const setValue = useCallback(
		(value) => {
			setStoredValue((prev) => {
				const valueToStore = typeof value === "function" ? value(prev) : value
				window.localStorage.setItem(key, JSON.stringify(valueToStore))
				return valueToStore
			})
		},
		[key],
	)

	return [storedValue, setValue]
}
