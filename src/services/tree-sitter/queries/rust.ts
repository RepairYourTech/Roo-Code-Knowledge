/*
Rust language structures for tree-sitter parsing
Captures all required constructs for tests
*/
export default `
; Function definitions (all types)
(function_item
    name: (identifier) @name.definition.function) @definition.function

; Struct definitions (all types - standard, tuple, unit)
(struct_item
    name: (type_identifier) @name.definition.struct) @definition.struct

; Enum definitions with variants
(enum_item
    name: (type_identifier) @name.definition.enum) @definition.enum

; Trait definitions
(trait_item
    name: (type_identifier) @name.definition.trait) @definition.trait

; Impl blocks (inherent implementation)
(impl_item
    type: (type_identifier) @name.definition.impl) @definition.impl

; Trait implementations
(impl_item
    trait: (type_identifier) @name.definition.impl_trait
    type: (type_identifier) @name.definition.impl_for) @definition.impl_trait

; Module definitions
(mod_item
    name: (identifier) @name.definition.module) @definition.module

; Macro definitions
(macro_definition
    name: (identifier) @name.definition.macro) @definition.macro

; Attribute macros (for #[derive(...)] etc.)
(attribute_item
    (attribute) @name.definition.attribute) @definition.attribute

; Type aliases
(type_item
    name: (type_identifier) @name.definition.type_alias) @definition.type_alias

; Constants
(const_item
    name: (identifier) @name.definition.constant) @definition.constant

; Static items
(static_item
    name: (identifier) @name.definition.static) @definition.static

; Methods inside impl blocks
(impl_item
    body: (declaration_list
        (function_item
            name: (identifier) @name.definition.method))) @definition.method_container

; Use declarations
(use_declaration) @definition.use_declaration

; Lifetime definitions
(lifetime
    "'" @punctuation.lifetime
    (identifier) @name.definition.lifetime) @definition.lifetime

; Where clauses
(where_clause
    (where_predicate)*) @definition.where_clause

; Match expressions
(match_expression
    value: (_) @match.value
    body: (match_block)) @definition.match

; Unsafe blocks
(unsafe_block) @definition.unsafe_block

; ===== TESTING FRAMEWORK PATTERNS FOR RUST =====

; Test functions - standard Rust testing
(function_item
  (attribute_item
    (attribute
      (identifier) @rust.test_attr
      (#eq? @rust.test_attr "test")))
  name: (identifier) @rust.test_func_name
  (#match? @rust.test_func_name "^test_.*$")) @definition.rust_test_function

; Test functions with test attribute
(function_item
  (attribute_item
    (attribute
      (identifier) @rust.test_attr
      (#eq? @rust.test_attr "test")))
  name: (identifier) @rust.test_name) @definition.rust_standard_test

; Test functions with custom test names
(function_item
  (attribute_item
    (attribute
      (identifier) @rust.test_attr
      (#eq? @rust.test_attr "test")
      (tree_sitter::tree_sitter::attribute_item
        (attribute
          (token_tree
            (identifier) @rust.test_name_attr
            (string_literal) @rust.test_name_value)))))
  name: (identifier) @rust.test_func_with_name) @definition.rust_named_test

; Ignored tests
(function_item
  (attribute_item
    (attribute
      (identifier) @rust.ignore_attr
      (#eq? @rust.ignore_attr "ignore")))
  name: (identifier) @rust.ignored_test_name) @definition.rust_ignored_test

; Tests with should_panic
(function_item
  (attribute_item
    (attribute
      (identifier) @rust.panic_attr
      (#eq? @rust.panic_attr "should_panic")
      (tree_sitter::tree_sitter::attribute_item
        (attribute
          (token_tree
            (identifier) @rust.expected_attr
            (string_literal) @rust.expected_value)?))))
  name: (identifier) @rust.panic_test_name) @definition.rust_panic_test

; Benchmark tests (unstable)
(function_item
  (attribute_item
    (attribute
      (identifier) @rust.bench_attr
      (#eq? @rust.bench_attr "bench")))
  name: (identifier) @rust.bench_func_name) @definition.rust_benchmark_test

; Integration tests in separate modules
(mod_item
  name: (identifier) @rust.test_mod_name
  (#match? @rust.test_mod_name "^(tests|integration_tests|test_).*")
  body: (declaration_list
    (function_item
      (attribute_item
        (attribute
          (identifier) @rust.mod_test_attr
          (#eq? @rust.mod_test_attr "test"))))) @rust.test_mod_content) @definition.rust_test_module

; Test modules with cfg(test)
(attribute_item
  (attribute
    (identifier) @rust.cfg_attr
    (#eq? @rust.cfg_attr "cfg")
    (tree_sitter::tree_sitter::attribute_item
      (attribute
        (token_tree
          (identifier) @rust.test_cfg
          (#eq? @rust.test_cfg "test")))))
  (mod_item
    name: (identifier) @rust.cfg_test_mod_name)) @definition.rust_cfg_test_module

; Conditional compilation for tests
(attribute_item
  (attribute
    (identifier) @rust.cfg_attr
    (#eq? @rust.cfg_attr "cfg")
    (tree_sitter::tree_sitter::attribute_item
      (attribute
        (token_tree
          (identifier) @rust.test_cfg
          (#eq? @rust.test_cfg "test")))))
  (function_item
    name: (identifier) @rust.cfg_test_func_name)) @definition.rust_cfg_test_function

; Test assertions
(call_expression
  function: (identifier) @rust.assert_macro
  (#match? @rust.assert_macro "^(assert!|assert_eq!|assert_ne!|debug_assert!|debug_assert_eq!|debug_assert_ne!)$")
  (tree_sitter::tree_sitter::token_tree) @rust.assert_args) @definition.rust_assertion

; Custom test assertions
(call_expression
  function: (identifier) @rust.custom_assert
  (#match? @rust.custom_assert ".*(assert|expect|should).*!")) @definition.rust_custom_assertion

; Test result types
(call_expression
  function: (identifier) @rust.result_func
  (#match? @rust.result_func "^(Ok|Err|Some|None)$")
  arguments: (argument_list
    (_) @rust.result_args)) @definition.rust_test_result

; Testing imports
(use_declaration
  (use_as_clause
    path: (scoped_identifier
      (identifier) @rust.test_crate
      (#match? @rust.test_crate "^(mock|fake|proptest|quickcheck|criterion|tokio_test|async_test)$"))
    name: (identifier) @rust.test_import_name))) @definition.rust_test_import

; Standard testing imports
(use_declaration
  (scoped_identifier
    (identifier) @rust.std_test_crate
    (#eq? @rust.std_test_crate "std")
    (identifier) @rust.std_test_module
    (#eq? @rust.std_test_module "test"))) @definition.rust_std_test_import

; Mock structures
(struct_item
  name: (type_identifier) @rust.mock_struct_name
  (#match? @rust.mock_struct_name ".*(Mock|Fake|Stub|Dummy).*")) @definition.rust_mock_struct

; Mock implementations
(impl_item
  type: (type_identifier) @rust.mock_impl_type
  (#match? @rust.mock_impl_type ".*(Mock|Fake|Stub|Dummy).*")
  body: (declaration_list
    (function_item
      name: (identifier) @rust.mock_method_name))) @definition.rust_mock_implementation

; Test fixtures and helpers
(function_item
  name: (identifier) @rust.fixture_func_name
  (#match? @rust.fixture_func_name ".*(setup|teardown|fixture|helper|util).*")) @definition.rust_test_fixture

; Test data structures
(struct_item
  name: (type_identifier) @rust.test_data_name
  (#match? @rust.test_data_name ".*(TestData|TestCase|TestFixtures|TestScenario).*")) @definition.rust_test_data

; Test constants
(const_item
  name: (identifier) @rust.test_const_name
  (#match? @rust.test_const_name "^(TEST_|MOCK_|FAKE_|STUB_).*")
  value: (_) @rust.test_const_value) @definition.rust_test_constant

; Async test functions
(function_item
  name: (identifier) @rust.async_test_name
  (#match? @rust.async_test_name "^test_.*$")
  (attribute_item
    (attribute
      (identifier) @rust.test_attr
      (#eq? @rust.test_attr "test")))
  (attribute_item
    (attribute
      (identifier) @rust.tokio_attr
      (#eq? @rust.tokio_attr "tokio::test")))) @definition.rust_async_test

; Tokio test patterns
(function_item
  (attribute_item
    (attribute
      (identifier) @rust.tokio_test_attr
      (#eq? @rust.tokio_test_attr "tokio::test")))
  name: (identifier) @rust.tokio_test_name) @definition.rust_tokio_test

; Property-based testing
(function_item
  (attribute_item
    (attribute
      (identifier) @rust.prop_test_attr
      (#match? @rust.prop_test_attr "^(proptest|quickcheck)$")))
  name: (identifier) @rust.prop_test_name) @definition.rust_property_test

; Criterion benchmarks
(function_item
  (attribute_item
    (attribute
      (identifier) @rust.criterion_attr
      (#eq? @rust.criterion_attr "criterion")))
  name: (identifier) @rust.criterion_func_name) @definition.rust_criterion_benchmark

; Test macros and attributes
(attribute_item
  (attribute
    (identifier) @rust.test_derive
    (#match? @rust.test_derive "^(derive|cfg|test|ignore|should_panic|bench)$"))
  (token_tree) @rust.test_derive_args)) @definition.rust_test_attribute

; Test trait implementations
(impl_item
  trait: (type_identifier) @rust.test_trait_name
  (#match? @rust.test_trait_name ".*(Test|Mock|Fixture|Helper).*")
  type: (type_identifier) @rust.test_impl_type
  body: (declaration_list
    (function_item
      name: (identifier) @rust.test_trait_method))) @definition.rust_test_trait_impl

; Test error handling
(call_expression
  function: (identifier) @rust.error_macro
  (#match? @rust.error_macro "^(panic!|unreachable!|todo!|unimplemented!)$")
  (tree_sitter::tree_sitter::token_tree) @rust.error_args) @definition.rust_test_error_handling

; Test logging and debugging
(call_expression
  function: (identifier) @rust.debug_macro
  (#match? @rust.debug_macro "^(println!|eprintln!|dbg!|debug!|info!|warn!|error!)$")
  (tree_sitter::tree_sitter::token_tree) @rust.debug_args) @definition.rust_test_debugging

; Test file patterns (detect test files)
(source_file
  shebang: (_)?
  (attribute_item
    (attribute
      (identifier) @rust.cfg_test_file_attr
      (#eq? @rust.cfg_test_file_attr "cfg")
      (tree_sitter::tree_sitter::attribute_item
        (attribute
          (token_tree
            (identifier) @rust.test_file_cfg
            (#eq? @rust.test_file_cfg "test")))))) @definition.rust_test_file

`
