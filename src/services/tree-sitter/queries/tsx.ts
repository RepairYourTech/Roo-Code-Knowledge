import typescriptQuery from "./typescript"

/**
 * Tree-sitter Query for TSX Files
 *
 * This query captures React component definitions in TSX files:
 * - Function Components
 * - Class Components
 * - Higher Order Components
 * - Type Definitions
 * - Props Interfaces
 * - State Definitions
 * - Generic Components
 * - React Hooks
 * - JSX Patterns
 * - React Imports
 */

export default `${typescriptQuery}

; ===== TSX FALLBACK PATTERNS =====
; Emergency fallback for JSX elements - last resort pattern
; This pattern may be overly broad and impact index size in high-volume projects
; Consider tuning or disabling for large codebases
(jsx_element) @definition.emergency.jsx_any_element

; Emergency fallback for JSX self-closing elements - last resort pattern
; This pattern may be overly broad and impact index size in high-volume projects
; Consider tuning or disabling for large codebases
(jsx_self_closing_element) @definition.emergency.jsx_any_self_closing

; Any Function Returning JSX (critical for React components)
(arrow_function
  body: (jsx_element)) @definition.jsx_arrow_component

(arrow_function
  body: (parenthesized_expression
    (jsx_element))) @definition.jsx_arrow_component_parens

; ===== REACT IMPORTS =====
; React import detection
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @react.import
        (#match? @react.import "^(React|Component|PureComponent|Fragment|StrictMode|Suspense|lazy|memo|forwardRef|useContext|useEffect|useState|useReducer|useCallback|useMemo|useRef|useImperativeHandle|useLayoutEffect|useDebugValue)$"))))
  source: (string
    (#match? @source "^['\"]react['\"]$"))) @definition.react_import

; Default React import
(import_statement
  (import_clause
    (identifier) @react.default_import)
  source: (string
    (#match? @source "^['\"]react['\"]$"))) @definition.react_default_import

; React library imports (react-dom, @testing-library/react, etc.)
(import_statement
  source: (string
    (#match? @source "^['\"](@react.*|react-.*|@testing-library/.*)['\""]$"))) @definition.react_library_import

; ===== FUNCTION COMPONENTS =====
; Function Components - Basic detection
(function_declaration
  name: (identifier) @component.name
  body: (statement_block
    (return_statement
      (jsx_element)))) @definition.functional_component

; Arrow Function Components - Basic detection
(variable_declaration
  (variable_declarator
    name: (identifier) @component.name
    value: (arrow_function
      body: (jsx_element)))) @definition.functional_component

; Arrow Function Components with return statement
(variable_declaration
  (variable_declarator
    name: (identifier) @component.name
    value: (arrow_function
      body: (statement_block
        (return_statement
          (jsx_element)))))) @definition.functional_component

; Export Statement Components
(export_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @component.name
      value: (arrow_function
        body: (jsx_element))))) @definition.exported_functional_component

; Export Statement Components with return
(export_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @component.name
      value: (arrow_function
        body: (statement_block
          (return_statement
            (jsx_element))))))) @definition.exported_functional_component

; Function Components with hooks detection
(function_declaration
  name: (identifier) @component.name
  body: (statement_block
    (expression_statement
      (call_expression
        function: (identifier) @react.hook
        (#match? @react.hook "^(use[A-Z])"))))) @definition.hook_component

; ===== CLASS COMPONENTS =====
; Class Components extending React.Component
(class_declaration
  name: (type_identifier) @component.name
  heritage: (class_heritage
    (extends_clause
      type: (type_identifier) @react.component
      (#match? @react.component "^(Component|PureComponent)$"))))) @definition.react_class_component

; Class Components extending React.PureComponent
(class_declaration
  name: (type_identifier) @component.name
  heritage: (class_heritage
    (extends_clause
      type: (member_expression
        object: (identifier) @react.library
        property: (property_identifier) @react.component
        (#match? @react.library "React")
        (#match? @react.component "^(Component|PureComponent)$"))))) @definition.react_class_component_full

; Class Components with render method returning JSX
(class_declaration
  name: (type_identifier) @component.name
  body: (class_body
    (method_definition
      name: (property_identifier) @render.method
      (#match? @render.method "^render$")
      body: (statement_block
        (return_statement
          (jsx_element)))))) @definition.class_component_with_render

; ===== REACT HOOKS =====
; useState hook with array destructuring
(variable_declaration
  (variable_declarator
    pattern: (array_pattern
      (identifier) @state.name
      (identifier) @state.setter)
    value: (call_expression
      function: (identifier) @react.hook
      (#match? @react.hook "useState")))) @definition.use_state_hook

; useEffect hook with dependency array
(expression_statement
  (call_expression
    function: (identifier) @react.hook
    (#match? @react.hook "useEffect")
    arguments: (arguments
      (arrow_function) @use.effect
      (array) @use.dependencies))) @definition.use_effect_hook

; useContext hook
(variable_declaration
  (variable_declarator
    name: (identifier) @context.value
    value: (call_expression
      function: (identifier) @react.hook
      (#match? @react.hook "useContext")
      arguments: (arguments
        (identifier) @context.name)))) @definition.use_context_hook

; useReducer hook
(variable_declaration
  (variable_declarator
    pattern: (array_pattern
      (identifier) @reducer.state
      (identifier) @reducer.dispatch)
    value: (call_expression
      function: (identifier) @react.hook
      (#match? @react.hook "useReducer")))) @definition.use_reducer_hook

; useCallback hook
(variable_declaration
  (variable_declarator
    name: (identifier) @callback.name
    value: (call_expression
      function: (identifier) @react.hook
      (#match? @react.hook "useCallback")))) @definition.use_callback_hook

; useMemo hook
(variable_declaration
  (variable_declarator
    name: (identifier) @memo.name
    value: (call_expression
      function: (identifier) @react.hook
      (#match? @react.hook "useMemo")))) @definition.use_memo_hook

; useRef hook
(variable_declaration
  (variable_declarator
    name: (identifier) @ref.name
    value: (call_expression
      function: (identifier) @react.hook
      (#match? @react.hook "useRef")))) @definition.use_ref_hook

; ===== CUSTOM HOOKS =====
; Custom hook detection (functions starting with "use")
(function_declaration
  name: (identifier) @custom.hook
  (#match? @custom.hook "^use[A-Z]")) @definition.custom_hook

; Custom arrow hook
(variable_declaration
  (variable_declarator
    name: (identifier) @custom.hook
    value: (arrow_function)
    (#match? @custom.hook "^use[A-Z]"))) @definition.custom_arrow_hook

; ===== JSX PATTERNS =====
; JSX Component Usage - Capture all components in JSX
(jsx_element
  open_tag: (jsx_opening_element
    name: [(identifier) @jsx.component (member_expression) @jsx.component])) @definition.jsx_element

; Self-closing JSX elements
(jsx_self_closing_element
  name: [(identifier) @jsx.component (member_expression) @jsx.component]) @definition.jsx_self_closing_element

; JSX Fragment detection
(jsx_fragment) @definition.jsx_fragment
(jsx_opening_fragment) @definition.jsx_opening_fragment
(jsx_closing_fragment) @definition.jsx_closing_fragment

; React.Fragment detection
(jsx_element
  open_tag: (jsx_opening_element
    name: (member_expression
      object: (identifier) @react.library
      property: (property_identifier) @react.fragment
      (#match? @react.library "React")
      (#match? @react.fragment "Fragment")))) @definition.react_fragment

; JSX Props detection
(jsx_attribute
  property_name: (property_identifier) @jsx.prop
  value: (jsx_expression)) @definition.jsx_prop_expression

; JSX Props with string values
(jsx_attribute
  property_name: (property_identifier) @jsx.prop
  value: (string) @jsx.prop.value) @definition.jsx_prop_string

; JSX Props with boolean values
(jsx_attribute
  property_name: (property_identifier) @jsx.prop) @definition.jsx_prop_boolean

; JSX Spread attributes
(jsx_attribute
  (jsx_expression
    (object) @jsx.spread)) @definition.jsx_spread_props

; JSX Event handlers (onClick, onChange, etc.)
(jsx_attribute
  property_name: (property_identifier) @jsx.event
  (#match? @jsx.event "^(on)[A-Z].*")
  value: (jsx_expression
    (identifier) @event.handler)) @definition.jsx_event_handler

; JSX Event handlers with arrow functions
(jsx_attribute
  property_name: (property_identifier) @jsx.event
  (#match? @jsx.event "^(on)[A-Z].*")
  value: (jsx_expression
    (arrow_function) @event.arrow_handler)) @definition.jsx_event_arrow_handler

; JSX Children detection
(jsx_element
  (jsx_text) @jsx.child.text) @definition.jsx_child_text

; JSX Expression children
(jsx_element
  (jsx_expression
    (identifier) @jsx.child.expression)) @definition.jsx_child_expression

; ===== HIGHER ORDER COMPONENTS =====
; HOC Components - function wrapping
(variable_declaration
  (variable_declarator
    name: (identifier) @hoc.name
    value: (call_expression
      function: (identifier) @hoc.wrapper
      arguments: (arguments
        (arrow_function
          body: (jsx_element)))))) @definition.hoc_component

; HOC with React.memo
(variable_declaration
  (variable_declarator
    name: (identifier) @hoc.name
    value: (call_expression
      function: (member_expression
        object: (identifier) @react.library
        property: (property_identifier) @hoc.function
        (#match? @react.library "React")
        (#match? @hoc.function "memo"))))) @definition.react_memo_hoc

; HOC with React.forwardRef
(variable_declaration
  (variable_declarator
    name: (identifier) @hoc.name
    value: (call_expression
      function: (member_expression
        object: (identifier) @react.library
        property: (property_identifier) @hoc.function
        (#match? @react.library "React")
        (#match? @hoc.function "forwardRef"))))) @definition.react_forward_ref_hoc

; ===== CONDITIONAL RENDERING =====
; Ternary conditional rendering
(ternary_expression
  consequence: (jsx_element
    open_tag: (jsx_opening_element
      name: (identifier) @conditional.component))) @definition.conditional_ternary

; Logical AND conditional rendering
(binary_expression
  operator: "&&"
  right: (jsx_element
    open_tag: (jsx_opening_element
      name: (identifier) @conditional.component))) @definition.conditional_logical_and

; ===== TYPE DEFINITIONS =====
; Props Interface Declarations
(interface_declaration
  name: (type_identifier) @props.interface
  (#match? @props.interface ".*Props$")) @definition.props_interface

; Component Props type alias
(type_alias_declaration
  name: (type_identifier) @props.type
  (#match? @props.type ".*Props$")) @definition.props_type

; State type definitions
(type_alias_declaration
  name: (type_identifier) @state.type
  (#match? @state.type ".*State$")) @definition.state_type

; Component return type (JSX.Element)
(function_declaration
  return_type: (type_annotation
    (type_identifier) @return.type
    (#match? @return.type "JSX\\.Element"))) @definition.jsx_return_type

; ===== MISC PATTERNS =====
; Capture all identifiers in JSX expressions that start with capital letters
(jsx_expression
  (identifier) @jsx_component) @definition.jsx_component

; Capture all member expressions in JSX
(member_expression
  object: (identifier) @object
  property: (property_identifier) @property) @definition.member_component

; Generic Components
(function_declaration
  name: (identifier) @name
  type_parameters: (type_parameters)) @definition.generic_component

; ===== NEXT.JS PATTERNS =====

; Next.js Imports
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @nextjs.import
        (#match? @nextjs.import "^(GetServerSideProps|GetStaticProps|GetStaticPaths|GetInitialProps|NextApiRequest|NextApiResponse|NextPage|NextApp|NextLayout|Metadata|ResolvingMetadata)$"))))
  source: (string
    (#match? @source "^['\"]next['\"]$"))) @definition.nextjs_import

; Next.js library imports (next/navigation, next/image, etc.)
(import_statement
  source: (string
    (#match? @source "^['\"]next/.*['\"]"))) @definition.nextjs_library_import

; Next.js Page Components - Pages Router
(export_statement
  (function_declaration
    name: (identifier) @nextjs.page.name
    body: (statement_block
      (return_statement
        (jsx_element))))) @definition.nextjs_page_component

; Next.js Page Components - Arrow Function
(export_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @nextjs.page.name
      value: (arrow_function
        body: (jsx_element))))) @definition.nextjs_page_component

; Next.js Page Components - Default Export


; Next.js getServerSideProps
(export_statement
  (function_declaration
    name: (identifier) @nextjs.gssp.name
    (#match? @nextjs.gssp.name "getServerSideProps")
    return_type: (type_annotation
      (type_identifier) @nextjs.gssp.type
      (#match? @nextjs.gssp.type "GetServerSideProps")))) @definition.nextjs_get_server_side_props

; Next.js getStaticProps
(export_statement
  (function_declaration
    name: (identifier) @nextjs.gssp.name
    (#match? @nextjs.gssp.name "getStaticProps")
    return_type: (type_annotation
      (type_identifier) @nextjs.gssp.type
      (#match? @nextjs.gssp.type "GetStaticProps")))) @definition.nextjs_get_static_props

; Next.js getStaticPaths
(export_statement
  (function_declaration
    name: (identifier) @nextjs.gssp.name
    (#match? @nextjs.gssp.name "getStaticPaths")
    return_type: (type_annotation
      (type_identifier) @nextjs.gssp.type
      (#match? @nextjs.gssp.type "GetStaticPaths")))) @definition.nextjs_get_static_paths

; Next.js API Routes - Pages Router
(export_statement
  (function_declaration
    name: (identifier) @nextjs.api.name
    (#match? @nextjs.api.name "^(handler|default)$")
    parameters: (formal_parameters
      (required_parameter
        pattern: (identifier) @nextjs.api.req
        type: (type_annotation
          (type_identifier) @nextjs.api.req.type
          (#match? @nextjs.api.req.type "NextApiRequest")))
      (required_parameter
        pattern: (identifier) @nextjs.api.res
        type: (type_annotation
          (type_identifier) @nextjs.api.res.type
          (#match? @nextjs.api.res.type "NextApiResponse")))))) @definition.nextjs_api_route

; Next.js API Routes - Arrow Function
(export_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @nextjs.api.name
      (#match? @nextjs.api.name "^(handler|default)$")
      value: (arrow_function
        parameters: (formal_parameters
          (required_parameter
            pattern: (identifier) @nextjs.api.req
            type: (type_annotation
              (type_identifier) @nextjs.api.req.type
              (#match? @nextjs.api.req.type "NextApiRequest")))
          (required_parameter
            pattern: (identifier) @nextjs.api.res
            type: (type_annotation
              (type_identifier) @nextjs.api.res.type
              (#match? @nextjs.api.res.type "NextApiResponse")))))))) @definition.nextjs_api_route_arrow

; Next.js Layout Components - App Router
(export_statement
  (function_declaration
    name: (identifier) @nextjs.layout.name
    (#match? @nextjs.layout.name "^(default|layout)$")
    parameters: (formal_parameters
      (required_parameter
        pattern: (object_pattern
          (object_pattern_property
            property: (shorthand_property_identifier_pattern) @nextjs.layout.children
            (#match? @nextjs.layout.children "children"))))))) @definition.nextjs_layout_component

; Next.js Layout Components - Arrow Function
(export_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @nextjs.layout.name
      (#match? @nextjs.layout.name "^(default|layout)$")
      value: (arrow_function
        parameters: (formal_parameters
          (required_parameter
            pattern: (object_pattern
              (object_pattern_property
                property: (shorthand_property_identifier_pattern) @nextjs.layout.children
                (#match? @nextjs.layout.children "children"))))))))) @definition.nextjs_layout_component_arrow

; Next.js Server Components - async function
(export_statement
  (function_declaration
    name: (identifier) @nextjs.server.name
    async: "async"
    body: (statement_block
      (return_statement
        (jsx_element))))) @definition.nextjs_server_component

; Next.js Server Components - async arrow function
(export_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @nextjs.server.name
      value: (arrow_function
        async: "async"
        body: (jsx_element))))) @definition.nextjs_server_component_arrow

; Next.js Client Components - "use client" directive
(expression_statement
  (string
    (string_fragment) @nextjs.client.directive
    (#match? @nextjs.client.directive "^use client$"))) @definition.nextjs_client_component

; Next.js Metadata Export - App Router
(export_statement
  (variable_declaration
    (variable_declarator
      name: (identifier) @nextjs.metadata.name
      (#match? @nextjs.metadata.name "metadata")
      value: (object_expression)))) @definition.nextjs_metadata_export

; Next.js generateMetadata Function
(export_statement
  (function_declaration
    name: (identifier) @nextjs.metadata.function
    (#match? @nextjs.metadata.function "generateMetadata")
    return_type: (type_annotation
      (type_identifier) @nextjs.metadata.type
      (#match? @nextjs.metadata.type "Metadata"))))) @definition.nextjs_generate_metadata

; Next.js Loading Components - App Router
(export_statement
  (function_declaration
    name: (identifier) @nextjs.loading.name
    (#match? @nextjs.loading.name "^(default|Loading)$")
    body: (statement_block
      (return_statement
        (jsx_element))))) @definition.nextjs_loading_component

; Next.js Error Components - App Router
(export_statement
  (function_declaration
    name: (identifier) @nextjs.error.name
    (#match? @nextjs.error.name "^(default|Error)$")
    parameters: (formal_parameters
      (required_parameter
        pattern: (object_pattern)
        type: (type_annotation)))))) @definition.nextjs_error_component

; Next.js Not Found Components - App Router
(export_statement
  (function_declaration
    name: (identifier) @nextjs.notfound.name
    (#match? @nextjs.notfound.name "^(default|NotFound)$")
    body: (statement_block
      (return_statement
        (jsx_element))))) @definition.nextjs_not_found_component

; Next.js Route Handlers - App Router
(export_statement
  (function_declaration
    name: (identifier) @nextjs.route.name
    (#match? @nextjs.route.name "^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$")
    parameters: (formal_parameters
      (required_parameter
        pattern: (identifier) @nextjs.route.req)
      (required_parameter
        pattern: (identifier) @nextjs.route.ctx)))) @definition.nextjs_route_handler

; Next.js Middleware
(export_statement
  (function_declaration
    name: (identifier) @nextjs.middleware.name
    (#match? @nextjs.middleware.name "middleware")
    parameters: (formal_parameters
      (required_parameter
        pattern: (identifier) @nextjs.middleware.req)
      (required_parameter
        pattern: (identifier) @nextjs.middleware.res)))) @definition.nextjs_middleware


; Next.js Image Component Usage
(jsx_element
  open_tag: (jsx_opening_element
    name: (member_expression
      object: (identifier) @nextjs.library
      property: (property_identifier) @nextjs.component
      (#match? @nextjs.library "next")
      (#match? @nextjs.component "Image")))) @definition.nextjs_image_usage

; Next.js Link Component Usage
(jsx_element
  open_tag: (jsx_opening_element
    name: (member_expression
      object: (identifier) @nextjs.library
      property: (property_identifier) @nextjs.component
      (#match? @nextjs.library "next")
      (#match? @nextjs.component "Link")))) @definition.nextjs_link_usage

; Next.js Script Component Usage
(jsx_element
  open_tag: (jsx_opening_element
    name: (member_expression
      object: (identifier) @nextjs.library
      property: (property_identifier) @nextjs.component
      (#match? @nextjs.library "next")
      (#match? @nextjs.component "Script")))) @definition.nextjs_script_usage

; Next.js Head Component Usage
(jsx_element
  open_tag: (jsx_opening_element
    name: (member_expression
      object: (identifier) @nextjs.library
      property: (property_identifier) @nextjs.component
      (#match? @nextjs.library "next")
      (#match? @nextjs.component "Head")))) @definition.nextjs_head_usage

; Next.js useRouter Hook Usage
(call_expression
  function: (identifier) @nextjs.hook
  (#match? @nextjs.hook "useRouter"))) @definition.nextjs_use_router

; Next.js usePathname Hook Usage
(call_expression
  function: (identifier) @nextjs.hook
  (#match? @nextjs.hook "usePathname"))) @definition.nextjs_use_pathname

; Next.js useSearchParams Hook Usage
(call_expression
  function: (identifier) @nextjs.hook
  (#match? @nextjs.hook "useSearchParams"))) @definition.nextjs_use_search_params

; Next.js redirect Function Usage
(call_expression
  function: (identifier) @nextjs.function
  (#match? @nextjs.function "redirect"))) @definition.nextjs_redirect

; Next.js notFound Function Usage
(call_expression
  function: (identifier) @nextjs.function
  (#match? @nextjs.function "notFound"))) @definition.nextjs_not_found

; Next.js revalidatePath Function Usage
(call_expression
  function: (identifier) @nextjs.function
  (#match? @nextjs.function "revalidatePath"))) @definition.nextjs_revalidate_path

; Next.js revalidateTag Function Usage
(call_expression
  function: (identifier) @nextjs.function
  (#match? @nextjs.function "revalidateTag"))) @definition.nextjs_revalidate_tag

; Next.js cookies Function Usage
(call_expression
  function: (identifier) @nextjs.function
  (#match? @nextjs.function "cookies"))) @definition.nextjs_cookies

; Next.js headers Function Usage
(call_expression
  function: (identifier) @nextjs.function
  (#match? @nextjs.function "headers"))) @definition.nextjs_headers

; Next.js Static Site Generation (SSG) Patterns
(export_statement
  (function_declaration
    name: (identifier) @nextjs.ssg.name
    (#match? @nextjs.ssg.name "getStaticProps")
    body: (statement_block
      (return_statement
        (object_expression
          (pair
            key: (property_identifier) @nextjs.ssg.props
            (#match? @nextjs.ssg.props "props")
            value: (object_expression))))))) @definition.nextjs_ssg_pattern

; Next.js Server-Side Rendering (SSR) Patterns
(export_statement
  (function_declaration
    name: (identifier) @nextjs.ssr.name
    (#match? @nextjs.ssr.name "getServerSideProps")
    body: (statement_block
      (return_statement
        (object_expression
          (pair
            key: (property_identifier) @nextjs.ssr.props
            (#match? @nextjs.ssr.props "props")
            value: (object_expression))))))) @definition.nextjs_ssr_pattern

; Next.js Incremental Static Regeneration (ISR) Patterns
(export_statement
  (function_declaration
    name: (identifier) @nextjs.isr.name
    (#match? @nextjs.isr.name "getStaticProps")
    body: (statement_block
      (return_statement
        (object_expression
          (pair
            key: (property_identifier) @nextjs.isr.revalidate
            (#match? @nextjs.isr.revalidate "revalidate")
            value: (number))))))) @definition.nextjs_isr_pattern
`
