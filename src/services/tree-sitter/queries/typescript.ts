/*
- function signatures and declarations
- method signatures and definitions
- abstract method signatures
- class declarations (including abstract classes)
- module declarations
- arrow functions (lambda functions)
- switch/case statements with complex case blocks
- enum declarations with members
- namespace declarations
- utility types
- class members and properties
- constructor methods
- getter/setter methods
- async functions and arrow functions
*/
export default `
(function_signature
  name: (identifier) @name.definition.function) @definition.function

(method_signature
  name: (property_identifier) @name.definition.method) @definition.method

(abstract_method_signature
  name: (property_identifier) @name.definition.method) @definition.method

(abstract_class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

(module
  name: (identifier) @name.definition.module) @definition.module

(function_declaration
  name: (identifier) @name.definition.function) @definition.function

(method_definition
  name: (property_identifier) @name.definition.method) @definition.method

(class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

; ===== COMMON TYPESCRIPT PATTERNS =====

; Variable Declarations with Arrow Functions (critical for React components)
(variable_declaration
  (variable_declarator
    name: (identifier) @name.definition.function
    value: (arrow_function))) @definition.arrow_function

; Exported Variable Declarations
(export_statement
  (lexical_declaration
    (variable_declarator
      name: (identifier) @name.definition.export))) @definition.export

; Const Declarations (catch-all for any const)
(lexical_declaration
  (variable_declarator
    name: (identifier) @name.definition.const)) @definition.const

; Interface Declarations
(interface_declaration
  name: (type_identifier) @name.definition.interface) @definition.interface

; Type Alias Declarations
(type_alias_declaration
  name: (type_identifier) @name.definition.type) @definition.type

; Emergency fallback for statement blocks - last resort pattern
; This pattern may be overly broad and impact index size in high-volume projects
; Consider tuning or disabling for large codebases
(statement_block) @definition.emergency.statement_block

; ===== TESTING FRAMEWORK PATTERNS FOR TYPESCRIPT =====

; Jest/Vitest/Mocha - Test suite and test case patterns
(call_expression
  function: (identifier) @test.func_name
  arguments: (arguments
    (string) @test.description
    [(arrow_function) (function_expression)] @test.callback)
  (#match? @test.func_name "^(describe|describe\\.only|describe\\.skip|test|it|it\\.only|it\\.skip|test\\.only|test\\.skip)$")) @definition.test_suite

; Nested test suites
(call_expression
  function: (identifier) @test.nested_func
  arguments: (arguments
    (string) @test.nested_description
    [(arrow_function) (function_expression)] @test.nested_callback)
  (#match? @test.nested_func "^(describe|context|suite)$")) @definition.nested_test_suite

; Test hooks - before/after patterns
(call_expression
  function: (identifier) @test.hook_func
  arguments: (arguments
    [(arrow_function) (function_expression)] @test.hook_callback)
  (#match? @test.hook_func "^(beforeAll|beforeEach|afterAll|afterEach|setup|teardown)$")) @definition.test_hook

; Jest/Vitest - expect patterns
(call_expression
  function: (identifier) @test.expect_func
  (#eq? @test.expect_func "expect")
  arguments: (arguments
    (_) @test.expect_value)) @definition.test_expect

; Jest/Vitest - matcher patterns
(call_expression
  function: (member_expression
    object: (call_expression
      function: (identifier) @test.matcher_expect
      (#eq? @test.matcher_expect "expect"))
    property: (property_identifier) @test.matcher)
  arguments: (arguments
    (_) @test.matcher_value)
  (#match? @test.matcher "^(toBe|toEqual|toStrictEqual|toMatch|toMatchObject|toContain|toHaveLength|toBeGreaterThan|toBeLessThan|toBeGreaterThanOrEqual|toBeLessThanOrEqual|toBeDefined|toBeUndefined|toBeNull|toBeTruthy|toBeFalsy|toThrow|toThrowError|resolves|rejects|not)$")) @definition.test_matcher

; Jest/Vitest - mock patterns
(call_expression
  function: (identifier) @test.mock_func
  (#match? @test.mock_func "^(jest|vi)\\.fn$")
  arguments: (arguments)?) @definition.test_mock

(call_expression
  function: (member_expression
    object: (identifier) @test.mock_obj
    (#match? @test.mock_obj "^(jest|vi)$")
    property: (property_identifier) @test.mock_method)
  (#match? @test.mock_method "^(spyOn|mock|clearAllMocks|resetAllMocks|restoreAllMocks)$")) @definition.test_mock_method

; Jest/Vitest - mock implementation
(call_expression
  function: (member_expression
    object: (call_expression
      function: (identifier) @test.mock_impl_obj
      (#match? @test.mock_impl_obj "^(jest|vi)\\.fn$")
      arguments: (arguments))
    property: (property_identifier) @test.mock_impl_method
    (#match? @test.mock_impl_method "^(mockReturnValue|mockResolvedValue|mockImplementation|mockResolvedValueOnce|mockReturnValueOnce)$"))
  arguments: (arguments
    (_) @test.mock_impl_value)) @definition.test_mock_implementation

; Testing library imports - Jest
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @jest.import
        (#match? @jest.import "^(describe|test|it|expect|beforeAll|beforeEach|afterAll|afterEach|jest|jest\\.fn)$"))))
  source: (string
    (#match? @source "^['\"]@jest/globals['\"]$"))) @definition.jest_import

; Testing library imports - Vitest
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @vitest.import
        (#match? @vitest.import "^(describe|test|it|expect|beforeAll|beforeEach|afterAll|afterEach|vi|vi\\.fn)$"))))
  source: (string
    (#match? @source "^['\"]vitest['\"]$"))) @definition.vitest_import

; Testing library imports - Vitest globals
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @vitest.global.import
        (#match? @vitest.global.import "^(describe|test|it|expect|beforeAll|beforeEach|afterAll|afterEach)$"))))
  source: (string
    (#match? @source "^['\"]vitest/globals['\"]$"))) @definition.vitest_global_import

; Testing library imports - Chai
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @chai.import
        (#match? @chai.import "^(expect|assert|should)$"))))
  source: (string
    (#match? @source "^['\"]chai['\"]$"))) @definition.chai_import

; Testing library imports - Sinon
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @sinon.import
        (#match? @sinon.import "^(sinon|spy|stub|mock|fake|createSandbox)$"))))
  source: (string
    (#match? @source "^['\"]sinon['\"]$"))) @definition.sinon_import

; CommonJS test exports
(assignment_expression
  left: (member_expression
    object: (identifier) @test.exports_obj
    property: (property_identifier) @test.exports_prop)
  right: [(arrow_function) (function_expression)] @test.exports_func
  (#eq? @test.exports_obj "exports")
  (#match? @test.exports_prop "^(test|tests)$")) @definition.commonjs_test_export

; Test file patterns - detect test files by naming conventions
(call_expression
  function: (identifier) @test.file_func
  (#match? @test.file_func "^(describe|test|it|suite)$")) @definition.test_file_indicator

; Async test patterns
(call_expression
  function: (identifier) @test.async_func
  arguments: (arguments
    (string) @test.async_description
    (arrow_function
      async: "async") @test.async_callback)
  (#match? @test.async_func "^(test|it|describe)$")) @definition.async_test

; Promise-based test patterns
(call_expression
  function: (identifier) @test.promise_func
  arguments: (arguments
    (string) @test.promise_description
    (arrow_function
      parameters: (formal_parameters
        (required_parameter
          pattern: (identifier) @test.done_param)))
  (#match? @test.promise_func "^(test|it)$")
  (#eq? @test.done_param "done")) @definition.promise_test

; Test timeout patterns
(call_expression
  function: (member_expression
    object: (call_expression
      function: (identifier) @test.timeout_obj
      (#match? @test.timeout_obj "^(test|it|describe)$"))
    property: (property_identifier) @test.timeout_method
    (#eq? @test.timeout_method "timeout"))
  arguments: (arguments
    (number) @test.timeout_value)) @definition.test_timeout

; Test skip/only patterns
(call_expression
  function: (member_expression
    object: (identifier) @test.skip_obj
    (#match? @test.skip_obj "^(test|it|describe)$")
    property: (property_identifier) @test.skip_method
    (#match? @test.skip_method "^(skip|only)$"))
  arguments: (arguments
    (string) @test.skip_description
    [(arrow_function) (function_expression)] @test.skip_callback)) @definition.test_modifier

; Test environment detection
(call_expression
  function: (member_expression
    object: (identifier) @test.env_obj
    (#eq? @test.env_obj "process")
    property: (property_identifier) @test.env_prop
    (#eq? @test.env_prop "env"))) @definition.test_environment

; Test configuration patterns
(assignment_expression
  left: (identifier) @test.config_name
  (#match? @test.config_name "^(jestConfig|vitestConfig|testConfig)$")
  right: (object) @test.config_value) @definition.test_config

; Custom matchers
(call_expression
  function: (member_expression
    object: (identifier) @test.custom_matcher_obj
    (#match? @test.custom_matcher_obj "^(expect|assert)$")
    property: (property_identifier) @test.custom_matcher)
  arguments: (arguments
    (_) @test.custom_matcher_value)) @definition.custom_matcher

; Test utilities and helpers
(call_expression
  function: (identifier) @test.util_func
  (#match? @test.util_func "^(render|screen|fireEvent|userEvent|waitFor|act)$")) @definition.test_utility
; Emergency fallback for arrow functions - last resort pattern
; This pattern may be overly broad and impact index size in high-volume projects
; Consider tuning or disabling for large codebases
(arrow_function) @definition.emergency.lambda

; Switch statements and case clauses
(switch_statement) @definition.switch

; Individual case clauses with their blocks
(switch_case) @definition.case

; Default clause
(switch_default) @definition.default

; Enum declarations
(enum_declaration
  name: (identifier) @name.definition.enum) @definition.enum

; Decorator definitions with decorated class
(export_statement
  decorator: (decorator
    (call_expression
      function: (identifier) @name.definition.decorator))
  declaration: (class_declaration
    name: (type_identifier) @name.definition.decorated_class)) @definition.decorated_class

; Explicitly capture class name in decorated class
(class_declaration
  name: (type_identifier) @name.definition.class) @definition.class

; Namespace declarations
(internal_module
  name: (identifier) @name.definition.namespace) @definition.namespace

; Interface declarations with generic type parameters and constraints
(interface_declaration
  name: (type_identifier) @name.definition.interface
  type_parameters: (type_parameters)?) @definition.interface

; Type alias declarations with generic type parameters and constraints
(type_alias_declaration
  name: (type_identifier) @name.definition.type
  type_parameters: (type_parameters)?) @definition.type

; Utility Types
(type_alias_declaration
  name: (type_identifier) @name.definition.utility_type) @definition.utility_type

; Class Members and Properties
(public_field_definition
  name: (property_identifier) @name.definition.property) @definition.property

; Constructor
(method_definition
  name: (property_identifier) @name.definition.constructor
  (#eq? @name.definition.constructor "constructor")) @definition.constructor

; Getter/Setter Methods
(method_definition
  name: (property_identifier) @name.definition.accessor) @definition.accessor

; Async Functions
(function_declaration
  name: (identifier) @name.definition.async_function) @definition.async_function

; Async Arrow Functions
(variable_declaration
  (variable_declarator
    name: (identifier) @name.definition.async_arrow
    value: (arrow_function))) @definition.async_arrow

; ===== REACT PATTERNS FOR TYPESCRIPT =====

; React imports in .ts files
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @react.import
        (#match? @react.import "^(React|Component|PureComponent|Fragment|StrictMode|Suspense|lazy|memo|forwardRef|useContext|useEffect|useState|useReducer|useCallback|useMemo|useRef|useImperativeHandle|useLayoutEffect|useDebugValue)$"))))
  source: (string
    (#match? @source "^['\"]react['\"]$"))) @definition.react_import

; React hooks in .ts files
(variable_declaration
  (variable_declarator
    pattern: (array_pattern
      (identifier) @state.name
      (identifier) @state.setter)
    value: (call_expression
      function: (identifier) @react.hook
      (#match? @react.hook "useState")))) @definition.use_state_hook

; Custom hooks in .ts files
(function_declaration
  name: (identifier) @custom.hook
  (#match? @custom.hook "^use[A-Z]")) @definition.custom_hook

; Props interfaces in .ts files
(interface_declaration
  name: (type_identifier) @props.interface
  (#match? @props.interface ".*Props$")) @definition.props_interface

; Component types in .ts files
(type_alias_declaration
  name: (type_identifier) @component.type
  (#match? @component.type ".*Component$")) @definition.component_type

; React.FC type declarations
(type_alias_declaration
  name: (type_identifier) @fc.name
  type: (type_annotation
    (generic_type
      name: (type_identifier) @react.fc
      (#match? @react.fc "FC")))) @definition.react_fc_type

; ===== NEXT.JS PATTERNS FOR TYPESCRIPT =====

; Next.js imports in .ts files
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @nextjs.import
        (#match? @nextjs.import "^(GetServerSideProps|GetStaticProps|GetStaticPaths|GetInitialProps|NextApiRequest|NextApiResponse|NextPage|NextApp|NextLayout|Metadata|ResolvingMetadata)$"))))
  source: (string
    (#match? @source "^['\"]next['\"]$"))) @definition.nextjs_import

; Next.js library imports in .ts files
(import_statement
  source: (string
    (#match? @source "^['\"]next/['\"]"))) @definition.nextjs_library_import

; Next.js page type declarations in .ts files
(type_alias_declaration
  name: (type_identifier) @nextjs.page.type
  (#match? @nextjs.page.type ".*Page$")) @definition.nextjs_page_type

; Next.js layout type declarations in .ts files
(type_alias_declaration
  name: (type_identifier) @nextjs.layout.type
  (#match? @nextjs.layout.type ".*Layout$")) @definition.nextjs_layout_type

; Next.js API route types in .ts files
(type_alias_declaration
  name: (type_identifier) @nextjs.api.type
  (#match? @nextjs.api.type ".*Api.*$")) @definition.nextjs_api_type

; Next.js metadata type declarations in .ts files
(type_alias_declaration
  name: (type_identifier) @nextjs.metadata.type
  (#match? @nextjs.metadata.type ".*Metadata$")) @definition.nextjs_metadata_type
; Next.js getServerSideProps function declarations in .ts files
(function_declaration
  name: (identifier) @nextjs.gssp.name
  (#match? @nextjs.gssp.name "getServerSideProps")
  return_type: (type_annotation
    (type_identifier) @nextjs.gssp.type
    (#match? @nextjs.gssp.type "GetServerSideProps")))) @definition.nextjs_get_server_side_props

; Next.js getStaticProps function declarations in .ts files
(function_declaration
  name: (identifier) @nextjs.gssp.name
  (#match? @nextjs.gssp.name "getStaticProps")
  return_type: (type_annotation
    (type_identifier) @nextjs.gssp.type
    (#match? @nextjs.gssp.type "GetStaticProps")))) @definition.nextjs_get_static_props

; Next.js getStaticPaths function declarations in .ts files
(function_declaration
  name: (identifier) @nextjs.gssp.name
  (#match? @nextjs.gssp.name "getStaticPaths")
  return_type: (type_annotation
    (type_identifier) @nextjs.gssp.type
    (#match? @nextjs.gssp.type "GetStaticPaths")))) @definition.nextjs_get_static_paths

; Next.js API route handlers in .ts files
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

; Next.js middleware function in .ts files
(function_declaration
  name: (identifier) @nextjs.middleware.name
  (#match? @nextjs.middleware.name "middleware")
  parameters: (formal_parameters
    (required_parameter
      pattern: (identifier) @nextjs.middleware.req)
    (required_parameter
      pattern: (identifier) @nextjs.middleware.res)))) @definition.nextjs_middleware

; Next.js route handlers in .ts files
(function_declaration
  name: (identifier) @nextjs.route.name
  (#match? @nextjs.route.name "^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$")
  parameters: (formal_parameters
    (required_parameter
      pattern: (identifier) @nextjs.route.req)
    (required_parameter
      pattern: (identifier) @nextjs.route.ctx)))) @definition.nextjs_route_handler

; Next.js generateMetadata function in .ts files
(function_declaration
  name: (identifier) @nextjs.metadata.function
  (#match? @nextjs.metadata.function "generateMetadata")
  return_type: (type_annotation
    (type_identifier) @nextjs.metadata.type
    (#match? @nextjs.metadata.type "Metadata")))) @definition.nextjs_generate_metadata

; Next.js config function in .ts files
(function_declaration
  name: (identifier) @nextjs.config.name
  (#match? @nextjs.config.name "^(config|nextConfig)$"))) @definition.nextjs_config_function

; Next.js hooks in .ts files
(call_expression
  function: (identifier) @nextjs.hook
  (#match? @nextjs.hook "^(useRouter|usePathname|useSearchParams|useParams)$"))) @definition.nextjs_hook

; Next.js functions in .ts files
(call_expression
  function: (identifier) @nextjs.function
  (#match? @nextjs.function "^(redirect|notFound|revalidatePath|revalidateTag|cookies|headers)$"))) @definition.nextjs_function

; Next.js server component detection in .ts files
(function_declaration
  name: (identifier) @nextjs.server.name
  async: "async") @definition.nextjs_server_component

; Next.js client component directive in .ts files
(expression_statement
  (string
    (string_fragment) @nextjs.client.directive
    (#match? @nextjs.client.directive "^['\"]use client['\"]$"))) @definition.nextjs_client_component

; ===== ANGULAR PATTERNS FOR TYPESCRIPT =====

; Angular imports in .ts files
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @angular.import
        (#match? @angular.import "^(Component|Injectable|NgModule|Input|Output|EventEmitter|ViewChild|ContentChild|ViewChildren|ContentChildren|HostListener|HostBinding|Directive|Pipe|CanActivate|CanDeactivate|Resolve|Guard|Interceptor|HttpClient|HttpHeaders|HttpParams|HttpRequest|HttpResponse|HttpErrorResponse|Router|ActivatedRoute|Routes|RouterModule|CommonModule|FormsModule|ReactiveFormsModule|BrowserModule|platformBrowser|BrowserAnimationsModule|NoopAnimationsModule)$"))))
  source: (string
    (#match? @source "^['\"]@angular/.+['\"]$"))) @definition.angular_import

; Angular Component decorators
; ===== TYPESCRIPT BUILD TOOL CONFIGURATION PATTERNS =====

; TypeScript configuration exports
(export_statement
  declaration: (variable_declaration
    (variable_declarator
      name: (identifier) @tsconfig.export.name
      (#match? @tsconfig.export.name "^(tsConfig|config|compilerOptions)$")
      type: (type_annotation
        (type_identifier) @tsconfig.export.type
        (#match? @tsconfig.export.type "^(TsConfigJson|CompilerOptions|Config)$"))))) @definition.tsconfig_export

; TypeScript configuration interfaces
(interface_declaration
  name: (type_identifier) @tsconfig.interface.name
  (#match? @tsconfig.interface.name "^(TsConfigJson|CompilerOptions|WatchOptions|TypeAcquisition|BuildOptions)$")) @definition.tsconfig_interface

; TypeScript configuration type aliases
(type_alias_declaration
  name: (type_identifier) @tsconfig.type.name
  (#match? @tsconfig.type.name "^(TsConfigJson|CompilerOptions|WatchOptions|TypeAcquisition|BuildOptions)$")) @definition.tsconfig_type

; Webpack TypeScript configuration exports
(export_statement
  declaration: (variable_declaration
    (variable_declarator
      name: (identifier) @webpack.ts.export.name
      (#match? @webpack.ts.export.name "^(webpackConfig|config|configuration)$")
      type: (type_annotation
        (type_identifier) @webpack.ts.export.type
        (#match? @webpack.ts.export.type "^(Configuration|WebpackConfiguration)$"))))) @definition.webpack_ts_config

; Webpack TypeScript configuration interfaces
(interface_declaration
  name: (type_identifier) @webpack.ts.interface.name
  (#match? @webpack.ts.interface.name "^(Configuration|WebpackConfiguration|RuleSetRule|RuleSetUse|Plugin|Options)$")) @definition.webpack_ts_interface

; Vite TypeScript configuration exports
(export_statement
  declaration: (variable_declaration
    (variable_declarator
      name: (identifier) @vite.ts.export.name
      (#match? @vite.ts.export.name "^(viteConfig|config|defineConfig)$")
      type: (type_annotation
        (type_identifier) @vite.ts.export.type
        (#match? @vite.ts.export.type "^(UserConfig|ConfigEnv|UserConfigExport)$"))))) @definition.vite_ts_config

; Vite TypeScript configuration interfaces
(interface_declaration
  name: (type_identifier) @vite.ts.interface.name
  (#match? @vite.ts.interface.name "^(UserConfig|ConfigEnv|UserConfigExport|ServerOptions|BuildOptions|ResolveOptions|CSSOptions|DepOptimizationOptions)$")) @definition.vite_ts_interface

; Rollup TypeScript configuration exports
(export_statement
  declaration: (variable_declaration
    (variable_declarator
      name: (identifier) @rollup.ts.export.name
      (#match? @rollup.ts.export.name "^(rollupConfig|config|options)$")
      type: (type_annotation
        (type_identifier) @rollup.ts.export.type
        (#match? @rollup.ts.export.type "^(RollupOptions|InputOptions|OutputOptions|WatchOptions)$"))))) @definition.rollup_ts_config

; Rollup TypeScript configuration interfaces
(interface_declaration
  name: (type_identifier) @rollup.ts.interface.name
  (#match? @rollup.ts.interface.name "^(RollupOptions|InputOptions|OutputOptions|WatchOptions|Plugin|OutputBundle|OutputChunk|OutputAsset)$")) @definition.rollup_ts_interface

; Babel TypeScript configuration exports
(export_statement
  declaration: (variable_declaration
    (variable_declarator
      name: (identifier) @babel.ts.export.name
      (#match? @babel.ts.export.name "^(babelConfig|config|babel)$")
      type: (type_annotation
        (type_identifier) @babel.ts.export.type
        (#match? @babel.ts.export.type "^(TransformOptions|BabelOptions|ConfigAPI)$"))))) @definition.babel_ts_config

; Babel TypeScript configuration interfaces
(interface_declaration
  name: (type_identifier) @babel.ts.interface.name
  (#match? @babel.ts.interface.name "^(TransformOptions|BabelOptions|ConfigAPI|PluginObj|PluginPass|File)$")) @definition.babel_ts_interface

; ESLint TypeScript configuration exports
(export_statement
  declaration: (variable_declaration
    (variable_declarator
      name: (identifier) @eslint.ts.export.name
      (#match? @eslint.ts.export.name "^(eslintConfig|config|flatConfig)$")
      type: (type_annotation
        (type_identifier) @eslint.ts.export.type
        (#match? @eslint.ts.export.type "^(ESLint|Linter|ConfigData|FlatConfig)$"))))) @definition.eslint_ts_config

; ESLint TypeScript configuration interfaces
(interface_declaration
  name: (type_identifier) @eslint.ts.interface.name
  (#match? @eslint.ts.interface.name "^(ESLint|Linter|ConfigData|FlatConfig|Rule|RuleMetaData|LinterOptions)$")) @definition.eslint_ts_interface

; Jest TypeScript configuration exports
(export_statement
  declaration: (variable_declaration
    (variable_declarator
      name: (identifier) @jest.ts.export.name
      (#match? @jest.ts.export.name "^(jestConfig|config|jest)$")
      type: (type_annotation
        (type_identifier) @jest.ts.export.type
        (#match? @jest.ts.export.type "^(ConfigOptions|InitialOptions|DefaultOptions)$"))))) @definition.jest_ts_config

; Jest TypeScript configuration interfaces
(interface_declaration
  name: (type_identifier) @jest.ts.interface.name
  (#match? @jest.ts.interface.name "^(ConfigOptions|InitialOptions|DefaultOptions|Transformer|Reporter|TestEnvironment|HasteConfig)$")) @definition.jest_ts_interface

; PostCSS TypeScript configuration exports
(export_statement
  declaration: (variable_declaration
    (variable_declarator
      name: (identifier) @postcss.ts.export.name
      (#match? @postcss.ts.export.name "^(postcssConfig|config)$")
      type: (type_annotation
        (type_identifier) @postcss.ts.export.type
        (#match? @postcss.ts.export.type "^(ProcessOptions|Plugin|Transformer)$"))))) @definition.postcss_ts_config

; PostCSS TypeScript configuration interfaces
(interface_declaration
  name: (type_identifier) @postcss.ts.interface.name
  (#match? @postcss.ts.interface.name "^(ProcessOptions|Plugin|Transformer|Result|Warning)$")) @definition.postcss_ts_interface

; Tailwind CSS TypeScript configuration exports
(export_statement
  declaration: (variable_declaration
    (variable_declarator
      name: (identifier) @tailwind.ts.export.name
      (#match? @tailwind.ts.export.name "^(tailwindConfig|config)$")
      type: (type_annotation
        (type_identifier) @tailwind.ts.export.type
        (#match? @tailwind.ts.export.type "^(Config|ThemeConfig|PluginOptions)$"))))) @definition.tailwind_ts_config

; Tailwind CSS TypeScript configuration interfaces
(interface_declaration
  name: (type_identifier) @tailwind.ts.interface.name
  (#match? @tailwind.ts.interface.name "^(Config|ThemeConfig|PluginOptions|Colors|Screens|Spacing|BorderRadius|FontFamily|FontSize|FontWeight|LetterSpacing|LineHeight|ListStyleType|TextDecoration|TextIndent|TextDecorationColor|TextDecorationStyle|TextDecorationLine|TextDecorationThickness|TextUnderlineOffset|FontVariationSettings|FontFeatureSettings)$")) @definition.tailwind_ts_interface

; Build tool type imports
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (type_identifier) @build.ts.import.name
        (#match? @build.ts.import.name "^(Configuration|WebpackConfiguration|UserConfig|RollupOptions|TransformOptions|BabelOptions|ConfigData|FlatConfig|ConfigOptions|InitialOptions|ProcessOptions|Plugin|Transformer|Config|ThemeConfig|CompilerOptions|TsConfigJson)$"))))
  source: (string) @build.ts.import.source
  (#match? @build.ts.import.source "^(webpack|vite|rollup|@babel/core|eslint|prettier|jest|postcss|tailwindcss|typescript|ts-node)$"))) @definition.build_tool_type_import

; Build tool value imports
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @build.ts.import.value
        (#match? @build.ts.import.value "^(defineConfig|Configuration|webpack|vite|rollup|babel|eslint|prettier|jest|postcss|tailwindcss|typescript|ts-node)$"))))
  source: (string) @build.ts.import.value.source
  (#match? @build.ts.import.value.source "^(webpack|vite|rollup|@babel/core|eslint|prettier|jest|postcss|tailwindcss|typescript|ts-node)$"))) @definition.build_tool_value_import

; Build tool configuration functions
(call_expression
  function: (identifier) @build.ts.config.function
  (#match? @build.ts.config.function "^(defineConfig|webpack|vite|rollup|babel|eslint|prettier|jest|postcss|tailwindcss|typescript)$")
  arguments: (arguments
    (object) @build.ts.config.object))) @definition.build_tool_config_function

; Build tool plugin configurations
(call_expression
  function: (member_expression
    object: (identifier) @build.ts.plugin.object
    property: (property_identifier) @build.ts.plugin.method
    (#match? @build.ts.plugin.method "^(plugin|loader|rule|use|resolve|module|optimization|plugins|presets|extends|rules|env|globals|parser|parserOptions)$"))
  arguments: (arguments
    (object) @build.ts.plugin.config))) @definition.build_tool_plugin_config

; Build tool environment variable usage
(member_expression
  object: (member_expression
    object: (identifier) @build.ts.env.object
    (#eq? @build.ts.env.object "process")
    property: (property_identifier) @build.ts.env.property
    (#eq? @build.ts.env.property "env"))
  property: (property_identifier) @build.ts.env.key
  (#match? @build.ts.env.key "^(NODE_ENV|NODE_PATH|PORT|HOST|DEBUG|BABEL_ENV|ESLINT_ENV|CI|production|development|test)$"))) @definition.build_ts_environment_variable

; Build tool path resolution
(call_expression
  function: (member_expression
    object: (identifier) @build.ts.path.object
    (#eq? @build.ts.path.object "path")
    property: (property_identifier) @build.ts.path.method
    (#match? @build.ts.path.method "^(resolve|join|dirname|basename|extname|parse|format)$"))
  arguments: (arguments
    (_) @build.ts.path.argument*)) @definition.build_ts_path_resolution

; Build tool file system operations
(call_expression
  function: (member_expression
    object: (identifier) @build.ts.fs.object
    (#eq? @build.ts.fs.object "fs")
    property: (property_identifier) @build.ts.fs.method
    (#match? @build.ts.fs.method "^(readFileSync|writeFileSync|existsSync|mkdirSync|readdirSync|statSync|readFile|writeFile|exists|mkdir|readdir|stat)$"))
  arguments: (arguments
    (_) @build.ts.fs.argument*)) @definition.build_ts_fs_operation

; Build tool configuration objects with type annotations
(variable_declaration
  (variable_declarator
    name: (identifier) @build.ts.config.name
    type: (type_annotation
      (type_identifier) @build.ts.config.type
      (#match? @build.ts.config.type "^(Configuration|WebpackConfiguration|UserConfig|RollupOptions|TransformOptions|BabelOptions|ConfigData|FlatConfig|ConfigOptions|InitialOptions|ProcessOptions|Plugin|Transformer|Config|ThemeConfig|CompilerOptions|TsConfigJson)$"))
    value: (object) @build.ts.config.object))) @definition.build_tool_typed_config

; Build tool plugin classes
(class_declaration
  name: (type_identifier) @build.ts.plugin.class.name
  (#match? @build.ts.plugin.class.name "^(Plugin|WebpackPlugin|VitePlugin|RollupPlugin|BabelPlugin|ESLintPlugin|JestTransformer|PostCSSPlugin|TailwindPlugin)$"))
  heritage: (class_heritage
    (extends_clause
      (type_identifier) @build.ts.plugin.extends
      (#match? @build.ts.plugin.extends "^(Plugin|WebpackPlugin|VitePlugin|RollupPlugin|BabelPlugin|ESLintPlugin|JestTransformer|PostCSSPlugin|TailwindPlugin)$")))?)) @definition.build_tool_plugin_class

; Build tool configuration methods
(method_declaration
  name: (property_identifier) @build.ts.method.name
  (#match? @build.ts.method.name "^(apply|configure|loader|transform|resolve|process|generate|build|watch|serve|dev|start|test|lint|format)$"))
  parameters: (formal_parameters
    (required_parameter
      pattern: (identifier) @build.ts.method.param
      type: (type_annotation
        (type_identifier) @build.ts.param.type
        (#match? @build.ts.param.type "^(Compiler|Compilation|Context|Options|Config|TransformContext|ProcessOptions|Result)$")))?)) @definition.build_tool_config_method

(decorator
  (call_expression
    function: (identifier) @angular.decorator.component
    (#eq? @angular.decorator.component "Component")
    arguments: (arguments
      (object
        (pair
          key: (property_identifier) @component.config.key
          value: (_) @component.config.value))))) @definition.angular_component_decorator

; Angular Injectable decorators
(decorator
  (call_expression
    function: (identifier) @angular.decorator.injectable
    (#eq? @angular.decorator.injectable "Injectable")
    arguments: (arguments
      (object
        (pair
          key: (property_identifier) @injectable.config.key
          value: (_) @injectable.config.value))))) @definition.angular_injectable_decorator

; Angular NgModule decorators
(decorator
  (call_expression
    function: (identifier) @angular.decorator.ngmodule
    (#eq? @angular.decorator.ngmodule "NgModule")
    arguments: (arguments
      (object
        (pair
          key: (property_identifier) @ngmodule.config.key
          value: (_) @ngmodule.config.value))))) @definition.angular_ngmodule_decorator

; Angular Directive decorators
(decorator
  (call_expression
    function: (identifier) @angular.decorator.directive
    (#eq? @angular.decorator.directive "Directive")
    arguments: (arguments
      (object
        (pair
          key: (property_identifier) @directive.config.key
          value: (_) @directive.config.value))))) @definition.angular_directive_decorator

; Angular Pipe decorators
(decorator
  (call_expression
    function: (identifier) @angular.decorator.pipe
    (#eq? @angular.decorator.pipe "Pipe")
    arguments: (arguments
      (object
        (pair
          key: (property_identifier) @pipe.config.key
          value: (_) @pipe.config.value))))) @definition.angular_pipe_decorator

; Angular Input/Output decorators
(decorator
  (call_expression
    function: (identifier) @angular.decorator.io
    (#match? @angular.decorator.io "^(Input|Output)$")
    arguments: (arguments
      (_)? @io.alias))) @definition.angular_io_decorator

; Angular ViewChild/ContentChild decorators
(decorator
  (call_expression
    function: (identifier) @angular.decorator.view_child
    (#match? @angular.decorator.view_child "^(ViewChild|ContentChild|ViewChildren|ContentChildren)$")
    arguments: (arguments
      (_)? @child.selector))) @definition.angular_child_decorator

; Angular HostListener/HostBinding decorators
(decorator
  (call_expression
    function: (identifier) @angular.decorator.host
    (#match? @angular.decorator.host "^(HostListener|HostBinding)$")
    arguments: (arguments
      (_)? @host.value))) @definition.angular_host_decorator

; Angular Component classes with decorators
(class_declaration
  name: (type_identifier) @angular.component.name
  decorator: (decorator
    (call_expression
      function: (identifier) @angular.decorator
      (#eq? @angular.decorator "Component")))) @definition.angular_component_class

; Angular Service classes with decorators
(class_declaration
  name: (type_identifier) @angular.service.name
  decorator: (decorator
    (call_expression
      function: (identifier) @angular.decorator
      (#eq? @angular.decorator "Injectable")))) @definition.angular_service_class

; Angular Module classes with decorators
(class_declaration
  name: (type_identifier) @angular.module.name
  decorator: (decorator
    (call_expression
      function: (identifier) @angular.decorator
      (#eq? @angular.decorator "NgModule")))) @definition.angular_module_class

; Angular Directive classes with decorators
(class_declaration
  name: (type_identifier) @angular.directive.name
  decorator: (decorator
    (call_expression
      function: (identifier) @angular.decorator
      (#eq? @angular.decorator "Directive")))) @definition.angular_directive_class

; Angular Pipe classes with decorators
(class_declaration
  name: (type_identifier) @angular.pipe.name
  decorator: (decorator
    (call_expression
      function: (identifier) @angular.decorator
      (#eq? @angular.decorator "Pipe")))) @definition.angular_pipe_class

; Angular lifecycle hooks
(method_definition
  name: (property_identifier) @angular.lifecycle.hook
  (#match? @angular.lifecycle.hook "^(ngOnInit|ngOnChanges|ngDoCheck|ngAfterContentInit|ngAfterContentChecked|ngAfterViewInit|ngAfterViewChecked|ngOnDestroy)$")) @definition.angular_lifecycle_hook

; Angular constructor injection
(method_definition
  name: (property_identifier) @angular.constructor.name
  (#eq? @angular.constructor.name "constructor")
  parameters: (formal_parameters
    (required_parameter
      pattern: (identifier) @angular.inject.param.name
      type: (type_annotation
        (type_identifier) @angular.inject.param.type)))) @definition.angular_constructor_injection

; Angular Route configurations
(assignment_expression
  left: (identifier) @angular.routes.name
  right: (array
    (object
      (pair
        key: (property_identifier) @angular.route.config.key
        value: (_) @angular.route.config.value)))) @definition.angular_routes_config

; Angular Router outlet detection
(call_expression
  function: (member_expression
    object: (identifier) @angular.router.object
    property: (property_identifier) @angular.router.method
    (#eq? @angular.router.object "router")
    (#match? @angular.router.method "^(navigate|navigateByUrl|getCurrentNavigation|createUrlTree)$"))) @definition.angular_router_method

; Angular ActivatedRoute usage
(call_expression
  function: (member_expression
    object: (identifier) @angular.activatedRoute.object
    property: (property_identifier) @angular.activatedRoute.property
    (#eq? @angular.activatedRoute.object "route")
    (#match? @angular.activatedRoute.property "^(params|queryParams|url|data|snapshot|paramMap|queryParamMap)$"))) @definition.angular_activatedRoute_usage

; Angular HTTP client usage
(call_expression
  function: (member_expression
    object: (identifier) @angular.http.object
    property: (property_identifier) @angular.http.method
    (#eq? @angular.http.object "http")
    (#match? @angular.http.method "^(get|post|put|delete|patch|head|options|request)$"))) @definition.angular_http_method

; Angular EventEmitter usage
(call_expression
  function: (member_expression
    object: (identifier) @angular.eventemitter.object
    property: (property_identifier) @angular.eventemitter.method
    (#match? @angular.eventemitter.method "^(emit|next|complete|error)$"))) @definition.angular_eventemitter_usage

; Angular Forms (Reactive Forms)
(call_expression
  function: (identifier) @angular.form.builder
  (#match? @angular.form.builder "^(FormGroup|FormControl|FormArray|FormBuilder|Validators)$"))) @definition.angular_reactive_forms

; Angular Component inheritance
(class_declaration
  name: (type_identifier) @angular.child.class
  heritage: (class_heritage
    (extends_clause
      type: (type_identifier) @angular.parent.class))) @definition.angular_component_inheritance

; Angular RxJS operators
(call_expression
  function: (member_expression
    object: (identifier) @angular.rxjs.observable
    property: (property_identifier) @angular.rxjs.operator
    (#match? @angular.rxjs.operator "^(pipe|subscribe|map|filter|tap|switchMap|mergeMap|concatMap|exhaustMap|take|takeWhile|skip|first|last|debounceTime|throttleTime|distinctUntilChanged|catchError)$"))) @definition.angular_rxjs_operator

; Angular async pipe usage
(call_expression
  function: (member_expression
    object: (identifier) @angular.async.object
    property: (property_identifier) @angular.async.property
    (#match? @angular.async.property "^(async|promise|observable)$"))) @definition.angular_async_usage
; ===== EXPRESS.JS PATTERNS FOR TYPESCRIPT =====

; Express.js imports in .ts files
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @express.import
        (#match? @express.import "^(express|Request|Response|NextFunction|Application|Router|RequestHandler|ErrorRequestHandler)$"))))
  source: (string
    (#match? @source "^['\"]express['\"]$"))) @definition.express_import

; Express.js application creation
(call_expression
  function: (identifier) @express.app.function
  (#eq? @express.app.function "express")) @definition.express_app

; Express.js route handlers - app.get(), app.post(), etc.
(call_expression
  function: (member_expression
    object: (identifier) @express.app.object
    property: (property_identifier) @express.route.method
    (#eq? @express.app.object "app")
    (#match? @express.route.method "^(get|post|put|delete|patch|head|options|all|use)$"))
  arguments: (arguments
    (string) @express.route.path
    [(arrow_function) (function_expression) (identifier)] @express.route.handler)) @definition.express_route

; Express.js router route handlers - router.get(), router.post(), etc.
(call_expression
  function: (member_expression
    object: (identifier) @express.router.object
    property: (property_identifier) @express.route.method
    (#eq? @express.router.object "router")
    (#match? @express.route.method "^(get|post|put|delete|patch|head|options|all|use)$"))
  arguments: (arguments
    (string) @express.route.path
    [(arrow_function) (function_expression) (identifier)] @express.route.handler)) @definition.express_router_route

; Express.js middleware - app.use()
(call_expression
  function: (member_expression
    object: (identifier) @express.app.object
    property: (property_identifier) @express.middleware.method
    (#eq? @express.app.object "app")
    (#eq? @express.middleware.method "use"))
  arguments: (arguments
    [(string) @express.middleware.path
     (identifier) @express.middleware.handler
     (member_expression) @express.middleware.handler
     (arrow_function) @express.middleware.handler
     (function_expression) @express.middleware.handler])) @definition.express_middleware

; Express.js router middleware - router.use()
(call_expression
  function: (member_expression
    object: (identifier) @express.router.object
    property: (property_identifier) @express.middleware.method
    (#eq? @express.router.object "router")
    (#eq? @express.middleware.method "use"))
  arguments: (arguments
    [(string) @express.middleware.path
     (identifier) @express.middleware.handler
     (member_expression) @express.middleware.handler
     (arrow_function) @express.middleware.handler
     (function_expression) @express.middleware.handler])) @definition.express_router_middleware

; Express.js server startup - listen()
(call_expression
  function: (member_expression
    object: (identifier) @express.server.object
    property: (property_identifier) @express.server.method
    (#eq? @express.server.method "listen"))
  arguments: (arguments
    [(number) (string) (identifier)] @express.server.port
    [(identifier) (arrow_function) (function_expression)]? @express.server.callback)) @definition.express_server

; Express.js route chaining
(call_expression
  function: (member_expression
    object: (call_expression
      function: (member_expression
        object: (identifier) @express.chain.object
        property: (property_identifier) @express.chain.method))
    property: (property_identifier) @express.chain.next)
  (#match? @express.chain.method "^(get|post|put|delete|patch|head|options|all|use)$")
  (#match? @express.chain.next "^(get|post|put|delete|patch|head|options|all|use)$")) @definition.express_route_chain

; Express.js error handling middleware
(call_expression
  function: (member_expression
    object: (identifier) @express.app.object
    property: (property_identifier) @express.error.method
    (#eq? @express.app.object "app")
    (#eq? @express.error.method "use"))
  arguments: (arguments
    (arrow_function) @express.error.handler
    (function_expression) @express.error.handler)
  (#match? @express.error.handler "err.*req.*res.*next")) @definition.express_error_handler

; Express.js Router() creation
(call_expression
  function: (identifier) @express.router.function
  (#eq? @express.router.function "Router")) @definition.express_router_creation

; Express.js static file serving
(call_expression
  function: (member_expression
    object: (identifier) @express.static.object
    property: (property_identifier) @express.static.method
    (#eq? @express.static.method "static"))
  arguments: (arguments
    (string) @express.static.path)) @definition.express_static

; Express.js route handler exports
(export_statement
  declaration: (function_declaration
    name: (identifier) @express.export.name)) @definition.express_route_export

(export_statement
  declaration: (variable_declaration
    (variable_declarator
      name: (identifier) @express.export.name
      value: [(arrow_function) (function_expression)]))) @definition.express_route_export

; Express.js middleware function exports
(export_statement
  declaration: (function_declaration
    name: (identifier) @express.middleware.export.name
    parameters: (formal_parameters
      (required_parameter
        pattern: (identifier) @express.middleware.req)
      (required_parameter
        pattern: (identifier) @express.middleware.res)
      (required_parameter
        pattern: (identifier) @express.middleware.next)))) @definition.express_middleware_export

; Express.js route parameter extraction
(call_expression
  function: (member_expression
    object: (identifier) @express.params.object
    property: (property_identifier) @express.params.property
    (#eq? @express.params.object "req")
    (#eq? @express.params.property "params"))) @definition.express_route_params

; Express.js query parameter extraction
(call_expression
  function: (member_expression
    object: (identifier) @express.query.object
    property: (property_identifier) @express.query.property
    (#eq? @express.query.object "req")
    (#eq? @express.query.property "query"))) @definition.express_route_query

; Express.js response patterns
(call_expression
  function: (member_expression
    object: (identifier) @express.response.object
    property: (property_identifier) @express.response.method
    (#eq? @express.response.object "res")
    (#match? @express.response.method "^(send|json|status|end|redirect|render|sendFile|download|cookie|clearCookie)$"))) @definition.express_response

; Express.js request patterns
(call_expression
  function: (member_expression
    object: (identifier) @express.request.object
    property: (property_identifier) @express.request.property
    (#eq? @express.request.object "req")
    (#match? @express.request.property "^(body|headers|method|url|path|protocol|secure|ip|ips|subdomains|fresh|stale|xhr|accepts|is|get|header)$"))) @definition.express_request

; Express.js CORS middleware
(call_expression
  function: (identifier) @express.cors.function
  (#eq? @express.cors.function "cors")) @definition.express_cors

; Express.js body-parser middleware
(call_expression
  function: (identifier) @express.bodyparser.function
  (#match? @express.bodyparser.function "^(urlencoded|json|raw|text)$")) @definition.express_body_parser

; Express.js authentication middleware patterns
(call_expression
  function: (member_expression
    object: (identifier) @express.auth.object
    property: (property_identifier) @express.auth.method
    (#match? @express.auth.method "^(authenticate|authorize|login|logout|requireAuth|ensureAuthenticated)$"))) @definition.express_auth

; Express.js environment-based configuration
(call_expression
  function: (member_expression
    object: (identifier) @express.env.object
    property: (property_identifier) @express.env.property
    (#eq? @express.env.object "process")
    (#eq? @express.env.property "env"))) @definition.express_env

; Express.js async route handlers
(function_declaration
  name: (identifier) @express.async.name
  async: "async") @definition.express_async_handler

(arrow_function
  async: "async") @definition.express_async_arrow

`
