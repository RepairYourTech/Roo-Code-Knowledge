/*
Go Tree-Sitter Query Patterns
Updated to capture full declarations instead of just identifiers
*/
export default `
; Function declarations - capture the entire declaration
(function_declaration) @name.definition.function

; Method declarations - capture the entire declaration
(method_declaration) @name.definition.method

; Type declarations (interfaces, structs, type aliases) - capture the entire declaration
(type_declaration) @name.definition.type

; Variable declarations - capture the entire declaration
(var_declaration) @name.definition.var

; Constant declarations - capture the entire declaration  
(const_declaration) @name.definition.const

; Package clause
(package_clause) @name.definition.package

; Import declarations - capture the entire import block
(import_declaration) @name.definition.import

; ===== TESTING FRAMEWORK PATTERNS FOR GO =====

; Test functions - standard Go testing pattern
(function_declaration
  name: (identifier) @go.test_func_name
  parameters: (parameter_list
    (parameter_declaration
      name: (identifier) @go.test_param
      type: (pointer_type
        (qualified_type
          package: (package_identifier) @go.test_package
          name: (type_identifier) @go.test_type
          (#eq? @go.test_package "testing")
          (#eq? @go.test_type "T")))))
  (#match? @go.test_func_name "^Test.*$")) @definition.go_test_function

; Benchmark functions
(function_declaration
  name: (identifier) @go.benchmark_func_name
  parameters: (parameter_list
    (parameter_declaration
      name: (identifier) @go.benchmark_param
      type: (pointer_type
        (qualified_type
          package: (package_identifier) @go.benchmark_package
          name: (type_identifier) @go.benchmark_type
          (#eq? @go.benchmark_package "testing")
          (#eq? @go.benchmark_type "B")))))
  (#match? @go.benchmark_func_name "^Benchmark.*$")) @definition.go_benchmark_function

; Example functions
(function_declaration
  name: (identifier) @go.example_func_name
  (#match? @go.example_func_name "^Example.*$")) @definition.go_example_function

; Fuzz functions (Go 1.18+)
(function_declaration
  name: (identifier) @go.fuzz_func_name
  parameters: (parameter_list
    (parameter_declaration
      name: (identifier) @go.fuzz_param
      type: (pointer_type
        (qualified_type
          package: (package_identifier) @go.fuzz_package
          name: (type_identifier) @go.fuzz_type
          (#eq? @go.fuzz_package "testing")
          (#eq? @go.fuzz_type "F")))))
  (#match? @go.fuzz_func_name "^Fuzz.*$")) @definition.go_fuzz_function

; Test helper functions (removed "init" to avoid matching package init() functions)
(function_declaration
  name: (identifier) @go.test_helper_name
  (#match? @go.test_helper_name "^(setup|teardown|cleanup|prepare|newMock|newFake|newTest).*")) @definition.go_test_helper

; TestMain function
(function_declaration
  name: (identifier) @go.test_main_name
  (#eq? @go.test_main_name "TestMain")
  parameters: (parameter_list
    (parameter_declaration
      name: (identifier) @go.test_main_param
      type: (pointer_type
        (qualified_type
          package: (package_identifier) @go.test_main_package
          name: (type_identifier) @go.test_main_type
          (#eq? @go.test_main_package "testing")
          (#eq? @go.test_main_type "M")))))) @definition.go_test_main

; Testing package imports
(import_declaration
  (import_spec
    path: (interpreted_string_literal) @go.testing_import_path
    (#match? @go.testing_import_path "^\"testing\"$"))) @definition.go_testing_import

; Testing sub-packages
(import_declaration
  (import_spec
    path: (interpreted_string_literal) @go.test_import_path
    (#match? @go.test_import_path ".*/testing$"))) @definition.go_testing_subpackage_import

; Test methods requiring arguments
(call_expression
  function: (selector_expression
    object: (identifier) @go.test_obj
    (#eq? @go.test_obj "t")
    property: (field_identifier) @go.test_method
    (#match? @go.test_method "^(Log|Logf|Error|Errorf|Fatal|Fatalf|Skip|Skipf|Run|TempDir|Setenv|Cleanup)$"))
  arguments: (argument_list)) @definition.go_test_method

; Test methods without required arguments
(call_expression
  function: (selector_expression
    object: (identifier) @go.test_obj
    (#eq? @go.test_obj "t")
    property: (field_identifier) @go.test_method
    (#match? @go.test_method "^(Fail|FailNow|Helper|Parallel)$"))) @definition.go_test_method

; Testing.TB methods (interface methods)
(call_expression
  function: (selector_expression
    object: (identifier) @go.tb_obj
    property: (field_identifier) @go.tb_method
    (#match? @go.tb_method "^(Log|Logf|Error|Errorf|Fatal|Fatalf|Skip|Skipf|Fail|FailNow|Helper|Run|Parallel|TempDir|Setenv|Cleanup)$"))
  arguments: (argument_list)?) @definition.go_testing_interface_method

; Test table-driven tests (simplified and broadened pattern)
(composite_literal
  type: (_) @go.test_data_type
  body: (expression_list
    (composite_literal
      type: (struct_type) @go.test_case_struct))) @definition.go_table_driven_test

; Subtests
(call_expression
  function: (selector_expression
    object: (identifier) @go.subtest_obj
    (#eq? @go.subtest_obj "t")
    property: (field_identifier) @go.subtest_method
    (#eq? @go.subtest_method "Run"))
  arguments: (argument_list
    (interpreted_string_literal) @go.subtest_name
    (func_literal) @go.subtest_func)) @definition.go_subtest

; Mock and fake patterns
(function_declaration
  name: (identifier) @go.mock_func_name
  (#match? @go.mock_func_name "^(mock|Mock|fake|Fake|stub|Stub).*")) @definition.go_mock_function

; Mock and fake struct types
(type_declaration
  (type_spec
    name: (type_identifier) @go.mock_struct_name
    (#match? @go.mock_struct_name "^(Mock|Fake|Stub).*")
    type: (struct_type))) @definition.go_mock_struct

; Interface-based testing
(type_declaration
  (type_spec
    name: (type_identifier) @go.interface_name
    type: (interface_type) @go.interface_def
    (#match? @go.interface_name ".*(?:Interface|Mocker|Faker).*"))) @definition.go_test_interface

; Test data structures
(type_declaration
  (type_spec
    name: (type_identifier) @go.test_data_name
    type: (struct_type)
    (#match? @go.test_data_name ".*(?:TestData|TestCase|TestScenario|TestFixtures).*"))) @definition.go_test_data_struct

; Test constants
(const_declaration
  (const_spec
    name: (identifier) @go.test_const_name
    (#match? @go.test_const_name "^(TEST_|MOCK_|FAKE_|STUB_).*")
    value: (_) @go.test_const_value)) @definition.go_test_constant

; Test variables
(var_declaration
  (var_spec
    name: (identifier) @go.test_var_name
    (#match? @go.test_var_name "^(test|mock|fake|stub).*")
    value: (_) @go.test_var_value)) @definition.go_test_variable

; Testing assertions (third-party libraries)
(call_expression
  function: (selector_expression
    object: (identifier) @go.assert_obj
    property: (field_identifier) @go.assert_method
    (#match? @go.assert_method "^(Equal|NotEqual|True|False|Nil|NotNil|Empty|NotEmpty|Contains|NotContains|Panics|DoesNotPanic|WithinDuration|InDelta|InEpsilon)$"))
  arguments: (argument_list)?) @definition.go_assertion

; Testify assertions
(call_expression
  function: (selector_expression
    object: (identifier) @go.testify_pkg
    (#match? @go.testify_pkg "^(assert|require)$")
    property: (field_identifier) @go.testify_method)
  arguments: (argument_list
    (identifier) @go.testify_param
    (_)*)) @definition.go_testify

; Testify mock patterns
(call_expression
  function: (selector_expression
    object: (identifier) @go.testify_mock_obj
    property: (field_identifier) @go.testify_mock_method
    (#match? @go.testify_mock_method "^(On|Return|Run|Once|Twice|Times|Maybe|Unset)$"))
  arguments: (argument_list)?) @definition.go_testify_mock

; Ginkgo testing framework
(call_expression
  function: (identifier) @go.ginkgo_func
  (#match? @go.ginkgo_func "^(Describe|Context|It|BeforeEach|AfterEach|BeforeSuite|AfterSuite|JustBeforeEach|Specify)$"))
  arguments: (argument_list
    (interpreted_string_literal) @go.ginkgo_description
    (func_literal) @go.ginkgo_func_body)) @definition.go_ginkgo_test

; Gomega assertions
(call_expression
  function: (identifier) @go.gomega_func
  (#match? @go.gomega_func "^(Expect|Ω|Eventually|Consistently)$"))
  arguments: (argument_list
    (_) @go.gomega_actual
    (selector_expression
      object: (identifier) @go.gomega_matcher_obj
      property: (field_identifier) @go.gomega_matcher
      (#match? @go.gomega_matcher "^(To|ToNot|ToEqual|ToNotEqual|BeNil|BeFalse|BeTrue|BeEmpty|HaveLen|ContainElement|ContainElements|BeEquivalentTo|MatchError|BeIdenticalTo|BeNumerically|BeTemporally|And|WithTransform)$")))) @definition.go_gomega_assertion

; Test configuration
(function_declaration
  name: (identifier) @go.test_config_name
  (#match? @go.test_config_name "^(setup|configure|initTest|setupTest)$")) @definition.go_test_configuration

; Test environment variables
(call_expression
  function: (selector_expression
    object: (identifier) @go.env_obj
    property: (field_identifier) @go.env_method
    (#match? @go.env_method "^(Setenv|Unsetenv|Getenv|LookupEnv)$"))
  arguments: (argument_list)?) @definition.go_test_environment

; Test file patterns (detect test files)

`
