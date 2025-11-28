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
; (function_item
;   (attribute_item
;     (attribute
;       (identifier) @rust.test_attr
;       (#eq? @rust.test_attr "test")))
;   name: (identifier) @rust.test_func_name
;   (#match? @rust.test_func_name "^test_.*$")) ; @definition.rust_test_function

; Test functions with test attribute
; Commented out due to attribute_item issue

; Test functions with custom test names
; Commented out due to attribute_item issue
; (function_item
;   (attribute_item
;     (attribute
;       (identifier) @rust.test_attr
;       (#eq? @rust.test_attr "test")
;       (attribute_item
;         (attribute
;           (token_tree
;             (identifier) @rust.test_name_attr
;             (string_literal) @rust.test_name_value)))))
;   name: (identifier) @rust.test_func_with_name) @definition.rust_named_test

; Ignored tests
; Commented out due to attribute_item issue

; Integration tests in separate modules
; Commented out due to attribute_item issue

; Commented out due to attribute_item issue
; Test modules with cfg(test)
; (attribute_item
;   (attribute
;     (identifier) @rust.cfg_attr
;     (#eq? @rust.cfg_attr "cfg")
;     (attribute_item
;       (attribute
;         (token_tree
;           (identifier) @rust.test_cfg
;           (#eq? @rust.test_cfg "test")))))
;   (mod_item
;     name: (identifier) @rust.cfg_test_mod_name)) @definition.rust_cfg_test_module

; Conditional compilation for tests
; (function_item
;   (attribute_item
;     (attribute
;       (identifier) @rust.cfg_attr
;       (#eq? @rust.cfg_attr "cfg")
;       (token_tree
;         (identifier) @rust.test_cfg
;         (#eq? @rust.test_cfg "test"))))
;   name: (identifier) @rust.cfg_test_func_name) @definition.rust_cfg_test_function

; Test assertions
(macro_invocation
  macro: (identifier) @rust.assert_macro
  (#match? @rust.assert_macro "^(assert|assert_eq|assert_ne|debug_assert|debug_assert_eq|debug_assert_ne)$")
  (token_tree) @rust.assert_args) @definition.rust_assertion

; Custom test assertions
(call_expression
  function: (identifier) @rust.custom_assert
  (#match? @rust.custom_assert ".*(assert|expect|should).*!")) @definition.rust_custom_assertion

; Test result types
(call_expression
  function: (identifier) @rust.result_func
  (#match? @rust.result_func "^(Ok|Err|Some|None)$")
  arguments: (arguments
    (_) @rust.result_args)) @definition.rust_test_result

; Testing imports
; (use_declaration
;   (use_as_clause
;     (scoped_identifier
;       (identifier) @rust.test_crate
;       (#match? @rust.test_crate "^(mock|fake|proptest|quickcheck|criterion|tokio_test|async_test)$"))
;     (identifier) @rust.test_import_name)) ; @definition.rust_test_import

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
; Commented out due to attribute_item issue

; Test trait implementations
(impl_item
  trait: (type_identifier) @rust.test_trait_name
  (#match? @rust.test_trait_name ".*(Test|Mock|Fixture|Helper).*")
  type: (type_identifier) @rust.test_impl_type
  body: (declaration_list
    (function_item
      name: (identifier) @rust.test_trait_method))) @definition.rust_test_trait_impl

; Test; Error handling patterns
(macro_invocation
  macro: (identifier) @rust.error_macro
  (#match? @rust.error_macro "^(panic|unreachable|todo|unimplemented)$")
  (token_tree) @rust.error_args) @definition.rust_error_handling

; Test logging and debugging
(macro_invocation
  macro: (identifier) @rust.debug_macro
  (#match? @rust.debug_macro "^(println|eprintln|dbg|debug|info|warn|error)$")
  (token_tree) @rust.debug_args) @definition.rust_test_logging

; Test file patterns (detect test files)
; (source_file
;   (attribute_item
;     (attribute
;       (identifier) @rust.cfg_test_file_attr
;       (#eq? @rust.cfg_test_file_attr "cfg")
;       (attribute_item
;         (attribute
;           (token_tree
;             (identifier) @rust.test_file_cfg
;             (#eq? @rust.test_file_cfg "test")))))) ; @definition.rust_test_file

`
