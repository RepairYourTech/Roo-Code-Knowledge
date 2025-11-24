/*
- class definitions
- method definitions (including decorated methods)
- named function declarations
- arrow functions and function expressions assigned to variables
- JSON object and array definitions (for JSON files)
- decorators and decorated elements
*/
export default `
(
  (comment)* @doc
  .
  (method_definition
    name: (property_identifier) @name) @definition.method
  (#not-eq? @name "constructor")
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.method)
)

(
  (comment)* @doc
  .
  [
    (class
      name: (_) @name)
    (class_declaration
      name: (_) @name)
  ] @definition.class
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.class)
)

(
  (comment)* @doc
  .
  [
    (function_declaration
      name: (identifier) @name)
    (generator_function_declaration
      name: (identifier) @name)
  ] @definition.function
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.function)
)

(
  (comment)* @doc
  .
  (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: [(arrow_function) (function_expression)]) @definition.function)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.function)
)

(
  (comment)* @doc
  .
  (variable_declaration
    (variable_declarator
      name: (identifier) @name
      value: [(arrow_function) (function_expression)]) @definition.function)
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.function)
)

; JSON object definitions
(object) @object.definition

; JSON object key-value pairs
(pair
  key: (string) @property.name.definition
  value: [
    (object) @object.value
    (array) @array.value
    (string) @string.value
    (number) @number.value
    (true) @boolean.value
    (false) @boolean.value
    (null) @null.value
  ]
) @property.definition

; JSON array definitions
(array) @array.definition
; Decorated method definitions
(
  [
    (method_definition
      decorator: (decorator)
      name: (property_identifier) @name) @definition.method
    (method_definition
      decorator: (decorator
        (call_expression
          function: (identifier) @decorator_name))
      name: (property_identifier) @name) @definition.method
  ]
  (#not-eq? @name "constructor")
)

; ===== TESTING FRAMEWORK PATTERNS FOR JAVASCRIPT =====

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

; Testing library requires - Jest
(variable_declaration
  (variable_declarator
    name: (identifier) @jest.require.name
    value: (call_expression
      function: (identifier) @jest.require.func
      (#eq? @jest.require.func "require")
      arguments: (arguments
        (string
          (#match? @jest.require.source "^['\"](@jest/globals|jest)['\"]$")))))) @definition.jest_require

; Testing library requires - Vitest
(variable_declaration
  (variable_declarator
    name: (identifier) @vitest.require.name
    value: (call_expression
      function: (identifier) @vitest.require.func
      (#eq? @vitest.require.func "require")
      arguments: (arguments
        (string
          (#match? @vitest.require.source "^['\"]vitest['\"]$")))))) @definition.vitest_require

; Testing library requires - Chai
(variable_declaration
  (variable_declarator
    name: (identifier) @chai.require.name
    value: (call_expression
      function: (identifier) @chai.require.func
      (#eq? @chai.require.func "require")
      arguments: (arguments
        (string
          (#match? @chai.require.source "^['\"]chai['\"]$")))))) @definition.chai_require

; Testing library requires - Sinon
(variable_declaration
  (variable_declarator
    name: (identifier) @sinon.require.name
    value: (call_expression
      function: (identifier) @sinon.require.func
      (#eq? @sinon.require.func "require")
      arguments: (arguments
        (string
          (#match? @sinon.require.source "^['\"]sinon['\"]$")))))) @definition.sinon_require

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

; ===== EXPRESS.JS PATTERNS FOR JAVASCRIPT =====

; Express.js imports in .js files
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @express.import
        (#match? @express.import "^(express|Request|Response|NextFunction|Application|Router|RequestHandler|ErrorRequestHandler)$"))))
  source: (string
    (#match? @source "^['\"]express['\"]$"))) @definition.express_import

; Express.js require statements
(variable_declaration
  (variable_declarator
    name: (identifier) @express.require.name
    value: (call_expression
      function: (identifier) @express.require.function
      (#eq? @express.require.function "require")
      arguments: (arguments
        (string
          (#match? @express.require.source "^['\"]express['\"]$")))))) @definition.express_require

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
    (#match? @express.env.property "^(NODE_ENV|PORT|HOST|DEBUG)$"))) @definition.express_environment

; ===== JAVASCRIPT BUILD TOOL CONFIGURATION PATTERNS =====

; npm package.json configuration (when parsed as JavaScript)
(assignment_expression
  left: (identifier) @npm.config.name
  (#match? @npm.config.name "^(package|module|exports)$")
  right: (object) @npm.config.value) @definition.npm_config

; Webpack configuration exports
(assignment_expression
  left: (member_expression
    object: (identifier) @webpack.exports.object
    property: (property_identifier) @webpack.exports.property
    (#eq? @webpack.exports.object "module")
    (#eq? @webpack.exports.property "exports"))
  right: (object) @webpack.config) @definition.webpack_config

; Webpack configuration object
(assignment_expression
  left: (identifier) @webpack.config.name
  (#match? @webpack.config.name "^(webpackConfig|config)$")
  right: (object) @webpack.config.object)) @definition.webpack_config_object

; Webpack configuration properties
(object
  (pair
    key: (property_identifier) @webpack.key
    (#match? @webpack.key "^(entry|output|module|resolve|plugins|optimization|devtool|devServer|mode|target|watch|watchOptions|externals|stats|performance|context|node|cache|bail|profile|parallel|infrastructureLogging)$")
    value: (_) @webpack.value)) @definition.webpack_properties

; Webpack module rules
(object
  (pair
    key: (property_identifier) @webpack.module.key
    (#eq? @webpack.module.key "module")
    value: (object
      (pair
        key: (property_identifier) @webpack.rules.key
        (#eq? @webpack.rules.key "rules")
        value: (array
          (object) @webpack.rule.object))))) @definition.webpack_module_rules

; Webpack rule configuration
(object
  (pair
    key: (property_identifier) @webpack.rule.key
    (#match? @webpack.rule.key "^(test|use|loader|loaders|include|exclude|resource|issuer|type|parser|generator|oneOf|resourceQuery|issuer|compiler|options|enforce|sideEffects)$")
    value: (_) @webpack.rule.value)) @definition.webpack_rule

; Vite configuration exports
(assignment_expression
  left: (identifier) @vite.config.name
  (#match? @vite.config.name "^(viteConfig|config|defineConfig)$")
  right: (call_expression
    function: (identifier) @vite.define.func
    (#eq? @vite.define.func "defineConfig")
    arguments: (arguments
      (object) @vite.config.object)))) @definition.vite_config

; Vite configuration properties
(object
  (pair
    key: (property_identifier) @vite.key
    (#match? @vite.key "^(base|mode|plugins|server|build|preview|optimizeDeps|resolve|css|json|worker|assetsInclude|logLevel|clearScreen|env|envPrefix|define|css|server|build|preview|experimental|configFile)$")
    value: (_) @vite.value)) @definition.vite_properties

; Vite server configuration
(object
  (pair
    key: (property_identifier) @vite.server.key
    (#eq? @vite.server.key "server")
    value: (object
      (pair
        key: (property_identifier) @vite.server.prop
        (#match? @vite.server.prop "^(host|port|strictPort|https|open|cors|proxy|headers|watch|fs|origin|hmr|middleware)$")
        value: (_) @vite.server.value))))) @definition.vite_server_config

; Vite build configuration
(object
  (pair
    key: (property_identifier) @vite.build.key
    (#eq? @vite.build.key "build")
    value: (object
      (pair
        key: (property_identifier) @vite.build.prop
        (#match? @vite.build.prop "^(target|outDir|assetsDir|assetsInlineLimit|cssCodeSplit|sourcemap|rollupOptions|minify|manifest|ssrManifest|ssr|emptyOutDir|write|emptyOutDir|copyPublicDir|reportCompressedSize|chunkSizeWarningLimit|rollupOptions|commonjsOptions|dynamicImportVarsOptions|lib|lib|formats|modulePreload)$")
        value: (_) @vite.build.value))))) @definition.vite_build_config

; Rollup configuration exports
(assignment_expression
  left: (identifier) @rollup.config.name
  (#match? @rollup.config.name "^(rollupConfig|config)$")
  right: (object) @rollup.config.object)) @definition.rollup_config

; Rollup configuration properties
(object
  (pair
    key: (property_identifier) @rollup.key
    (#match? @rollup.key "^(input|output|plugins|external|treeshake|acorn|context|moduleContext|watch|cache|onwarn|perf|maxParallelFileOps|strict|inlineDynamicImports|manualChunks|preserveEntrySignatures|preserveModules|preserveSymlinks|shimMissingExports|experimental|experimentalCacheExpiry|chunkGroupingSize|chunkFileNames|entryFileNames|assetFileNames|format|name|file|dir|extend|exports|globals|interop|freeze|namespaceToString|namespaceToStringTag|indent|compact|dynamicImportFunction|assetFileNames|chunkFileNames|entryFileNames|sourcemap|sourcemapExcludeSources|sourcemapFile|sourcemapPathTransform)$")
    value: (_) @rollup.value)) @definition.rollup_properties

; Babel configuration exports
(assignment_expression
  left: (identifier) @babel.config.name
  (#match? @babel.config.name "^(babelConfig|config|api)$")
  right: (object) @babel.config.object)) @definition.babel_config

; Babel configuration properties
(object
  (pair
    key: (property_identifier) @babel.key
    (#match? @babel.key "^(presets|plugins|env|assumptions|targets|browserslist|browsers|configFile|envName|root|sourceMaps|sourceType|inputSourceMap|retainLines|highlightCode|suppressDeprecationMessages|compact|minified|comments|shouldPrintComment|overrides|ignore|only|test|include|exclude|cache|cacheDirectory|filename)$")
    value: (_) @babel.value)) @definition.babel_properties

; ESLint configuration exports
(assignment_expression
  left: (identifier) @eslint.config.name
  (#match? @eslint.config.name "^(eslintConfig|config)$")
  right: (object) @eslint.config.object)) @definition.eslint_config

; ESLint flat configuration (new format)
(call_expression
  function: (member_expression
    object: (identifier) @eslint.config.object
    (#eq? @eslint.config.object "eslint")
    property: (property_identifier) @eslint.config.method
    (#eq? @eslint.config.method "config"))
  arguments: (arguments
    (object) @eslint.config.rules))) @definition.eslint_flat_config

; ESLint configuration properties
(object
  (pair
    key: (property_identifier) @eslint.key
    (#match? @eslint.key "^(env|extends|globals|parser|parserOptions|plugins|rules|overrides|root|ignorePatterns|noInlineConfig|reportUnusedDisableDirectives|processor|settings)$")
    value: (_) @eslint.value)) @definition.eslint_properties

; Prettier configuration exports
(assignment_expression
  left: (identifier) @prettier.config.name
  (#match? @prettier.config.name "^(prettierConfig|config)$")
  right: (object) @prettier.config.object)) @definition.prettier_config

; Prettier configuration properties
(object
  (pair
    key: (property_identifier) @prettier.key
    (#match? @prettier.key "^(printWidth|tabWidth|useTabs|semi|singleQuote|quoteProps|trailingComma|bracketSpacing|bracketSameLine|arrowParens|range|parser|filepath|requirePragma|insertPragma|proseWrap|htmlWhitespaceSensitivity|vueIndentScriptAndStyle|endOfLine|embeddedLanguageFormatting|singleAttributePerLine)$")
    value: (_) @prettier.value)) @definition.prettier_properties

; TypeScript configuration exports
(assignment_expression
  left: (identifier) @tsconfig.config.name
  (#match? @tsconfig.config.name "^(tsConfig|config|compilerOptions)$")
  right: (object) @tsconfig.config.object)) @definition.tsconfig_config

; TypeScript compiler options
(object
  (pair
    key: (property_identifier) @tsconfig.key
    (#match? @tsconfig.key "^(target|module|lib|allowJs|checkJs|jsx|declaration|declarationMap|sourceMap|outFile|outDir|rootDir|composite|tsBuildInfoFile|removeComments|noEmit|importHelpers|downlevelIteration|isolatedModules|strict|noImplicitAny|strictNullChecks|strictFunctionTypes|strictBindCallApply|strictPropertyInitialization|noImplicitThis|alwaysStrict|noUnusedLocals|noUnusedParameters|exactOptionalPropertyTypes|noImplicitReturns|noFallthroughCasesInSwitch|noUncheckedIndexedAccess|noImplicitOverride|noPropertyAccessFromIndexSignature|noUncheckedIndexedAccess|allowUnusedLabels|allowUnreachableCode|moduleResolution|baseUrl|paths|rootDirs|typeRoots|types|allowSyntheticDefaultImports|esModuleInterop|preserveSymlinks|allowUmdGlobalAccess|moduleSuffixes|resolveJsonModule|isolatedModules|skipLibCheck|forceConsistentCasingInFileNames|emitDecoratorMetadata|experimentalDecorators|emitDecoratorMetadata|experimentalDecorators|jsxFactory|jsxFragmentFactory|jsxImportSource|reactNamespace|useDefineForClassFields|newLine|noEmitHelpers|importHelpers|downlevelIteration|isolatedModules|strict|noImplicitAny|strictNullChecks|strictFunctionTypes|strictBindCallApply|strictPropertyInitialization|noImplicitThis|alwaysStrict|noUnusedLocals|noUnusedParameters|exactOptionalPropertyTypes|noImplicitReturns|noFallthroughCasesInSwitch|noUncheckedIndexedAccess|noImplicitOverride|noPropertyAccessFromIndexSignature|noUncheckedIndexedAccess|allowUnusedLabels|allowUnreachableCode|moduleResolution|baseUrl|paths|rootDirs|typeRoots|types|allowSyntheticDefaultImports|esModuleInterop|preserveSymlinks|allowUmdGlobalAccess|moduleSuffixes|resolveJsonModule|isolatedModules|skipLibCheck|forceConsistentCasingInFileNames)$")
    value: (_) @tsconfig.value)) @definition.tsconfig_properties

; Jest configuration exports
(assignment_expression
  left: (identifier) @jest.config.name
  (#match? @jest.config.name "^(jestConfig|config)$")
  right: (object) @jest.config.object)) @definition.jest_config

; Jest configuration properties
(object
  (pair
    key: (property_identifier) @jest.key
    (#match? @jest.key "^(automock|bail|cache|cacheDirectory|clearMocks|collectCoverage|collectCoverageFrom|coverageDirectory|coveragePathIgnorePatterns|coverageReporters|coverageThreshold|dependencyExtractor|errorOnDeprecated|forceCoverageMatch|forceExit|globals|globalSetup|globalTeardown|maxConcurrency|maxWorkers|moduleDirectories|moduleFileExtensions|modulePathIgnorePatterns|moduleNameMapper|modulePaths|notify|notifyMode|preset|projects|reporters|resetMocks|resetModules|resolver|restoreMocks|rootDir|roots|runner|setupFiles|setupFilesAfterEnv|snapshotSerializers|testEnvironment|testEnvironmentOptions|testFailureExitCode|testMatch|testPathIgnorePatterns|testRegex|testResultsProcessor|testRunner|testURL|timers|transform|transformIgnorePatterns|unmockedModulePathPatterns|verbose|watch|watchIgnorePatterns|watchPathIgnorePatterns|watchPlugins)$")
    value: (_) @jest.value)) @definition.jest_properties

; PostCSS configuration exports
(assignment_expression
  left: (identifier) @postcss.config.name
  (#match? @postcss.config.name "^(postcssConfig|config)$")
  right: (object) @postcss.config.object)) @definition.postcss_config

; PostCSS configuration properties
(object
  (pair
    key: (property_identifier) @postcss.key
    (#match? @postcss.key "^(plugins|parser|syntax|stringifier|map|from|to|output|input|options|env)$")
    value: (_) @postcss.value)) @definition.postcss_properties

; Tailwind CSS configuration exports
(assignment_expression
  left: (identifier) @tailwind.config.name
  (#match? @tailwind.config.name "^(tailwindConfig|config)$")
  right: (object) @tailwind.config.object)) @definition.tailwind_config

; Tailwind CSS configuration properties
(object
  (pair
    key: (property_identifier) @tailwind.key
    (#match? @tailwind.key "^(content|theme|plugins|presets|darkMode|variantOrder|separator|prefix|important|corePlugins|future)$")
    value: (_) @tailwind.value)) @definition.tailwind_properties

; Build tool plugin configurations
(call_expression
  function: (identifier) @plugin.function
  arguments: (arguments
    (object) @plugin.config)) @definition.build_plugin

; Common build tool require statements
(variable_declaration
  (variable_declarator
    name: (identifier) @build.require.name
    value: (call_expression
      function: (identifier) @build.require.func
      (#eq? @build.require.func "require")
      arguments: (arguments
        (string) @build.require.source
        (#match? @build.require.source "^(webpack|vite|rollup|babel|eslint|prettier|jest|postcss|tailwindcss|typescript|ts-loader|babel-loader|css-loader|style-loader|file-loader|url-loader|html-webpack-plugin|mini-css-extract-plugin|clean-webpack-plugin|copy-webpack-plugin|dotenv-webpack|webpack-dev-server|webpack-merge|webpack-bundle-analyzer|@babel/core|@babel/preset-env|@babel/preset-react|@babel/preset-typescript|eslint|prettier|jest|postcss|tailwindcss)$")))))) @definition.build_tool_require

; Build tool imports
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (identifier) @build.import.name
        (#match? @build.import.name "^(webpack|vite|rollup|babel|eslint|prettier|jest|postcss|tailwindcss|typescript|defineConfig|Configuration|WebpackPlugin|Loader|Plugin|Rule|Transform|Generator|Parser)$"))))
  source: (string) @build.import.source
  (#match? @build.import.source "^(webpack|vite|rollup|@babel/core|@babel/preset-env|@babel/preset-react|@babel/preset-typescript|eslint|prettier|jest|postcss|tailwindcss|typescript)$"))) @definition.build_tool_import

; Environment variable usage in build configs
(member_expression
  object: (member_expression
    object: (identifier) @env.object
    (#eq? @env.object "process")
    property: (property_identifier) @env.property
    (#eq? @env.property "env"))
  property: (property_identifier) @env.key
  (#match? @env.key "^(NODE_ENV|NODE_PATH|PORT|HOST|DEBUG|BABEL_ENV|ESLINT_ENV|CI|production|development|test)$")) @definition.build_environment_variable

; Path resolution in build configs
(call_expression
  function: (identifier) @path.function
  (#match? @path.function "^(resolve|join|dirname|basename|extname|parse|format)$")
  arguments: (arguments
    (_) @path.argument*)) @definition.build_path_resolution

; File system operations in build configs
(call_expression
  function: (identifier) @fs.function
  (#match? @fs.function "^(readFileSync|writeFileSync|existsSync|mkdirSync|readdirSync|statSync)$")
  arguments: (arguments
    (_) @fs.argument*)) @definition.build_fs_operation

    (#eq? @express.env.object "process")
    (#eq? @express.env.property "env"))) @definition.express_env

; Express.js async route handlers
(function_declaration
  name: (identifier) @express.async.name
  async: "async") @definition.express_async_handler

(arrow_function
  async: "async") @definition.express_async_arrow

; Decorated class definitions
(
  [
    (class
      decorator: (decorator)
      name: (_) @name) @definition.class
    (class_declaration
      decorator: (decorator)
      name: (_) @name) @definition.class
  ]
)

; Capture method names in decorated classes
(
  (class_declaration
    decorator: (decorator)
    body: (class_body
      (method_definition
        name: (property_identifier) @name) @definition.method))
  (#not-eq? @name "constructor")
)
`
