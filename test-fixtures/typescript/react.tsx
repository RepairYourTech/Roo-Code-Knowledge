import React, { useState, useEffect } from "react"

interface Props {
	title: string
}

export const MyComponent: React.FC<Props> = ({ title }) => {
	const [count, setCount] = useState(0)

	useEffect(() => {
		document.title = title
	}, [title])

	return (
		<div>
			<h1>{title}</h1>
			<button onClick={() => setCount(count + 1)}>Count: {count}</button>
		</div>
	)
}
