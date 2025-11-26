/*
PHP Tree-sitter Query - Standardized Version

This query file captures PHP language constructs for code navigation and analysis.
Each query pattern is organized by construct type and includes clear comments.

SUPPORTED LANGUAGE CONSTRUCTS:
------------------------------
1. CLASS DEFINITIONS
   - Regular classes
   - Abstract classes
   - Final classes
   - Readonly classes (PHP 8.2+)

2. INTERFACE & TRAIT DEFINITIONS
   - Interfaces
   - Traits
   - Enums (PHP 8.1+)

3. FUNCTION & METHOD DEFINITIONS
   - Global functions
   - Class methods
   - Static methods
   - Abstract methods
   - Final methods
   - Arrow functions (PHP 7.4+)

4. PROPERTY DEFINITIONS
   - Regular properties
   - Static properties
   - Readonly properties (PHP 8.1+)
   - Constructor property promotion (PHP 8.0+)

5. OTHER LANGUAGE CONSTRUCTS
   - Constants
   - Namespaces
   - Use statements (imports)
   - Anonymous classes
   - Attributes (PHP 8.0+)
   - Match expressions (PHP 8.0+)
   - Heredoc and nowdoc syntax
*/
export default `
;--------------------------
; 1. CLASS DEFINITIONS
;--------------------------
; Regular classes
(class_declaration
  name: (name) @name.definition.class) @definition.class

; Abstract classes
(class_declaration
  (abstract_modifier)
  name: (name) @name.definition.abstract_class) @definition.abstract_class

; Final classes
(class_declaration
  (final_modifier)
  name: (name) @name.definition.final_class) @definition.final_class

; Readonly classes (PHP 8.2+)
(class_declaration
  (readonly_modifier)
  name: (name) @name.definition.readonly_class) @definition.readonly_class

;--------------------------
; 2. INTERFACE & TRAIT DEFINITIONS
;--------------------------
; Interfaces
(interface_declaration
  name: (name) @name.definition.interface) @definition.interface

; Traits
(trait_declaration
  name: (name) @name.definition.trait) @definition.trait

; Enums (PHP 8.1+)
(enum_declaration
  name: (name) @name.definition.enum) @definition.enum

;--------------------------
; 3. FUNCTION & METHOD DEFINITIONS
;--------------------------
; Global functions
(function_definition
  name: (name) @name.definition.function) @definition.function

; Regular methods
(method_declaration
  name: (name) @name.definition.method) @definition.method

; Static methods
(method_declaration
  (static_modifier)
  name: (name) @name.definition.static_method) @definition.static_method

; Abstract methods
(method_declaration
  (abstract_modifier)
  name: (name) @name.definition.abstract_method) @definition.abstract_method

; Final methods
(method_declaration
  (final_modifier)
  name: (name) @name.definition.final_method) @definition.final_method

; Arrow functions (PHP 7.4+)
(arrow_function) @definition.arrow_function

;--------------------------
; 4. PROPERTY DEFINITIONS
;--------------------------
; Regular properties
(property_declaration
  (property_element
    (variable_name
      (name) @name.definition.property))) @definition.property

; Static properties
(property_declaration
  (static_modifier)
  (property_element
    (variable_name
      (name) @name.definition.static_property))) @definition.static_property

; Readonly properties (PHP 8.1+)
(property_declaration
  (readonly_modifier)
  (property_element
    (variable_name
      (name) @name.definition.readonly_property))) @definition.readonly_property

; Constructor property promotion (PHP 8.0+)
(property_promotion_parameter
  name: (variable_name
    (name) @name.definition.promoted_property)) @definition.promoted_property

;--------------------------
; 5. OTHER LANGUAGE CONSTRUCTS
;--------------------------
; Constants
(const_declaration
  (const_element
    (name) @name.definition.constant)) @definition.constant

; Namespaces
(namespace_definition
  name: (namespace_name) @name.definition.namespace) @definition.namespace

; Use statements (imports)
(namespace_use_declaration
  (namespace_use_clause
    (qualified_name) @name.definition.use)) @definition.use

; Anonymous classes
(object_creation_expression
  (declaration_list)) @definition.anonymous_class

; Attributes (PHP 8.0+)
(attribute_group
  (attribute
    (name) @name.definition.attribute)) @definition.attribute

; Match expressions (PHP 8.0+)
(match_expression) @definition.match_expression

; Heredoc syntax
(heredoc) @definition.heredoc


(nowdoc) @definition.nowdoc

; ===== TESTING FRAMEWORK PATTERNS FOR PHP =====

; PHPUnit - Test methods
(method_declaration
  name: (name) @phpunit.test_method_name
  (#match? @phpunit.test_method_name "^test.*$")) @definition.phpunit_test_method


; PHPUnit - setUp and tearDown methods
(method_declaration
  name: (name) @phpunit.setup_method_name
  (#match? @phpunit.setup_method_name "^(setUp|tearDown|setUpBeforeClass|tearDownAfterClass)$")) @definition.phpunit_setup_method

; PHPUnit - Test class patterns
(class_declaration
  name: (name) @phpunit.test_class_name
  (#match? @phpunit.test_class_name ".*Test.*$")) @definition.phpunit_test_class

; PHPUnit - Test class inheritance
(class_declaration
  name: (name) @phpunit.inherited_test_class
  superclass: (name) @phpunit.base_class
  (#match? @phpunit.base_class "TestCase")) @definition.phpunit_inherited_test_class

; PHPUnit - Assertions
(call_expression
  function: (name) @phpunit.assertion_method
  (#match? @phpunit.assertion_method "^(assertEquals|assertNotEquals|assertTrue|assertFalse|assertNull|assertNotNull|assertSame|assertNotSame|assertArrayHasKey|assertArrayNotHasKey|assertContains|assertNotContains|assertCount|assertEmpty|assertNotEmpty|assertInstanceOf|assertNotInstanceOf|assertStringContainsString|assertStringContainsStringIgnoringCase|assertStringNotContainsString|assertStringStartsWith|assertStringEndsWith|assertMatchesRegularExpression|assertDoesNotMatchRegularExpression|assertSameSize|assertNotSameSize|assertJson|assertJsonStringEqualsJsonString|assertJsonStringNotEqualsJsonString|assertDirectoryExists|assertDirectoryDoesNotExist|assertFileExists|assertFileDoesNotExist|assertIsReadable|assertIsWritable|assertDirectoryIsReadable|assertDirectoryIsWritable|assertFileIsReadable|assertFileIsWritable|assertIsBool|assertIsInt|assertIsFloat|assertIsString|assertIsArray|assertIsObject|assertIsResource|assertIsScalar|assertIsCallable|assertIsNotBool|assertIsNotInt|assertIsNotFloat|assertIsNotString|assertIsNotArray|assertIsNotObject|assertIsNotResource|assertIsNotScalar|assertIsNotCallable|assertContainsOnly|assertContainsOnlyInstancesOf|assertNotContainsOnly|assertContainsOnlyStrings|assertContainsOnlyIntegers|assertContainsOnlyFloats|assertContainsOnlyBool|assertContainsOnlyNull|assertContainsOnlyArray|assertContainsOnlyCallable|assertNotContainsOnlyStrings|assertNotContainsOnlyIntegers|assertNotContainsOnlyFloats|assertNotContainsOnlyBool|assertNotContainsOnlyNull|assertNotContainsOnlyArray|assertNotContainsOnlyCallable|fail|markTestIncomplete|markTestSkipped)$"))
  arguments: (arguments)?) @definition.phpunit_assertion

; PHPUnit - Mock objects
(call_expression
  function: (name) @phpunit.mock_method
  (#match? @phpunit.mock_method "^(createMock|createPartialMock|createConfiguredMock|createTestProxy|getMockBuilder|getMockForAbstractClass|getMockForTrait)$"))
  arguments: (arguments
    (name) @phpunit.mock_class_name)) @definition.phpunit_mock_creation

; PHPUnit - Mock configuration
(call_expression
  function: (member_expression
    object: (call_expression) @phpunit.mock_builder
    property: (name) @phpunit.mock_config_method
    (#match? @phpunit.mock_config_method "^(onlyMethods|setConstructorArgs|setMockClassName|disableOriginalConstructor|disableOriginalClone|disableArgumentCloning|disallowMockingUnknownTypes|enableAutoload|enableOriginalConstructor|enableOriginalClone|setProxyTarget|addMethods|onlyMethods|setMethods)$"))
  arguments: (arguments)?) @definition.phpunit_mock_configuration

; PHPUnit - Mock expectations
(call_expression
  function: (member_expression
    object: (call_expression) @phpunit.mock_expectation
    property: (name) @phpunit.expect_method
    (#eq? @phpunit.expect_method "expects"))
  arguments: (arguments
    (name) @phpunit.expectation)) @definition.phpunit_mock_expectation

; PHPUnit - Mock method configuration
(call_expression
  function: (member_expression
    object: (call_expression) @phpunit.mock_method_config
    property: (name) @phpunit.mock_config
    (#match? @phpunit.mock_config "^(method|willReturn|willReturnArgument|willReturnCallback|willReturnSelf|willThrowException|willReturnOnConsecutiveCalls|with|withConsecutive|withAnyArguments|once|twice|never|exactly)$"))
  arguments: (arguments)?) @definition.phpunit_mock_method_configuration


; Pest - Test functions
(expression_statement
  (call_expression
    function: (name) @pest.test_function
    (#match? @pest.test_function "^(test|it)$")
    arguments: (arguments
      (string) @pest.test_description
      (closure_expression) @pest.test_closure))) @definition.pest_test

; Pest - Test with closure only
(expression_statement
  (call_expression
    function: (name) @pest.test_function_simple
    (#match? @pest.test_function_simple "^(test|it)$")
    arguments: (arguments
      (closure_expression) @pest.test_closure_simple))) @definition.pest_test_simple

; Pest - Test groups
(expression_statement
  (call_expression
    function: (name) @pest.group_function
    (#match? @pest.group_function "^(group|todo|skip|only)$")
    arguments: (arguments
      (string) @pest.group_name
      (closure_expression) @pest.group_closure))) @definition.pest_test_group

; Pest - Before/After hooks
(expression_statement
  (call_expression
    function: (name) @pest.hook_function
    (#match? @pest.hook_function "^(beforeEach|afterEach|beforeAll|afterAll)$")
    arguments: (arguments
      (closure_expression) @pest.hook_closure))) @definition.pest_hook

; Pest - Expectations
(expression_statement
  (call_expression
    function: (name) @pest.expect_function
    (#eq? @pest.expect_function "expect")
    arguments: (arguments
      (_) @pest.expect_value))) @definition.pest_expectation

; Pest - Expectation chains
(call_expression
  function: (member_expression
    object: (call_expression
      function: (name) @pest.expect_chain
      (#eq? @pest.expect_chain "expect"))
    property: (name) @pest.matcher
    (#match? @pest.matcher "^(toBe|toEqual|toBeTrue|toBeFalse|toBeNull|toBeInstanceOf|toBeArray|toBeString|toBeInt|toBeFloat|toBeObject|toContain|toHaveCount|toHaveLength|toBeEmpty|toBeGreaterThan|toBeLessThan|toBeGreaterThanOrEqual|toBeLessThanOrEqual|toMatch|toThrow|toHaveProperty|toHaveKey|toHaveMethod|toBeCallable|toBeResource|toBeScalar|toBeBool|toBeNull|toBeWritable|toBeReadable|toBeDirectory|toBeFile|toThrow|not)$"))
  arguments: (arguments
    (_) @pest.matcher_value)) @definition.pest_matcher

; Pest - Datasets
(expression_statement
  (call_expression
    function: (name) @pest.dataset_function
    (#eq? @pest.dataset_function "dataset")
    arguments: (arguments
      (string) @pest.dataset_name
      (closure_expression) @pest.dataset_closure))) @definition.pest_dataset

; Pest - Test with dataset
(expression_statement
  (call_expression
    function: (name) @pest.test_with_data_function
    (#match? @pest.test_with_data_function "^(test|it)$")
    arguments: (arguments
      (string) @pest.test_data_description
      (closure_expression) @pest.test_data_closure))) @definition.pest_test_with_data

; Testing imports - PHPUnit
(namespace_use_declaration
  (namespace_use_clause
    (qualified_name) @phpunit.import_name
    (#match? @phpunit.import_name "^(PHPUnit\\\\Framework\\\\TestCase|PHPUnit\\\\Framework\\\\MockObject\\\\MockObject|PHPUnit\\\\Framework\\\\MockObject\\\\MockBuilder|PHPUnit\\\\Framework\\\\MockObject\\\\Stub|PHPUnit\\\\Framework\\\\Assert|PHPUnit\\\\Framework\\\\Exception|PHPUnit\\\\Framework\\\\ExpectationFailedException)$"))) @definition.phpunit_import

; Testing imports - Pest
(namespace_use_declaration
  (namespace_use_clause
    (qualified_name) @pest.import_name
    (#match? @pest.import_name "^(Pest\\\\Pest|Pest\\\\Expectation|Pest\\\\Support\\\\HigherOrderExpectation|Pest\\\\Support\\\\Arr|Pest\\\\Support\\\\Str)$"))) @definition.pest_import

; Mockery patterns
(call_expression
  function: (name) @mockery.mock_function
  (#match? @mockery.mock_function "^(mock|spy|instanceMock|namedMock|mockery)$"))
  arguments: (arguments
    (name) @mockery.mock_class)) @definition.mockery_mock

; Mockery expectations
(call_expression
  function: (member_expression
    object: (call_expression) @mockery.mock_expectation
    property: (name) @mockery.should_receive
    (#eq? @mockery.should_receive "shouldReceive"))
  arguments: (arguments
    (string) @mockery.method_name))) @definition.mockery_expectation

; Mockery return values
(call_expression
  function: (member_expression
    object: (call_expression) @mockery.mock_return
    property: (name) @mockery.return_method
    (#match? @mockery.return_method "^(andReturn|andReturnValues|andThrow|andThrowExceptions|andSet|andSetNew|andSetProperties|andSetDefaultProperties)$"))
  arguments: (arguments
    (_) @mockery.return_value)) @definition.mockery_return

; Test classes with testing traits
(class_declaration
  name: (name) @php.test_trait_class
  (declaration_list
    (trait_use_clause
      (name) @php.trait_name))) @definition.php_test_with_traits

; Test configuration files
(class_declaration
  name: (name) @php.test_config_class
  (#match? @php.test_config_class ".*(Config|Configuration|TestCase|TestHelper|TestUtil).*$")) @definition.php_test_configuration

; Test data classes
(class_declaration
  name: (name) @php.test_data_class
  (#match? @php.test_data_class ".*(TestData|TestCase|TestFixtures|TestFactory|TestBuilder).*$")) @definition.php_test_data

; Test helper classes
(class_declaration
  name: (name) @php.test_helper_class
  (#match? @php.test_helper_class ".*(TestHelper|TestUtil|TestSupport|TestBase).*$")) @definition.php_test_helper

; Test file patterns (detect test files)
(program
  (namespace_definition) @php.test_file_namespace
  (#match? @php.test_file_namespace ".*Test.*$")) @definition.php_test_file

`
