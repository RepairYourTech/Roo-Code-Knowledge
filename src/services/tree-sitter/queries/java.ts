/*
Query patterns for Java language structures
*/
export default `
; Module declarations
(module_declaration
  name: (scoped_identifier) @name.definition.module) @definition.module

; Package declarations
((package_declaration
  (scoped_identifier)) @name.definition.package) @definition.package

; Line comments
(line_comment) @definition.comment

; Class declarations
(class_declaration
  name: (identifier) @name.definition.class) @definition.class

; Interface declarations
(interface_declaration
  name: (identifier) @name.definition.interface) @definition.interface

; Enum declarations
(enum_declaration
  name: (identifier) @name.definition.enum) @definition.enum

; Record declarations
(record_declaration
  name: (identifier) @name.definition.record) @definition.record

; Annotation declarations
(annotation_type_declaration
  name: (identifier) @name.definition.annotation) @definition.annotation

; Constructor declarations
(constructor_declaration
  name: (identifier) @name.definition.constructor) @definition.constructor

; Method declarations
(method_declaration
  name: (identifier) @name.definition.method) @definition.method

; Inner class declarations
(class_declaration
  (class_body
    (class_declaration
      name: (identifier) @name.definition.inner_class))) @definition.inner_class

; Static nested class declarations
(class_declaration
  (class_body
    (class_declaration
      name: (identifier) @name.definition.static_nested_class))) @definition.static_nested_class

; Lambda expressions
(lambda_expression) @definition.lambda

; Field declarations
(field_declaration
  type: (_)
  declarator: (variable_declarator
    name: (identifier) @name.definition.field)) @definition.field

; Import declarations
(import_declaration
  (scoped_identifier) @name.definition.import) @definition.import

; Type parameters
(type_parameters
  (type_parameter) @name.definition.type_parameter) @definition.type_parameter

; ===== TESTING FRAMEWORK PATTERNS FOR JAVA =====

; JUnit 5 - Test method patterns
; (method_declaration
;   name: (identifier) @junit.test_method_name
;   (modifiers
;     (annotation
;       name: (identifier) @junit.test_annotation
;       (#eq? @junit.test_annotation "Test")))) ; @definition.junit_test_method

; JUnit 5 - Test method with display name
; (method_declaration
;   name: (identifier) @junit.test_display_name
;   (modifiers
;     (annotation
;       name: (identifier) @junit.test_annotation
;       (#eq? @junit.test_annotation "Test")
;       arguments: (annotation_argument_list
;         (element_value_pair
;           key: (identifier) @junit.display_name_key
;           (#eq? @junit.display_name_key "name")
;           value: (string_literal) @junit.display_name_value))))) ; @definition.junit_test_with_display_name

; JUnit 5 queries commented out due to modifiers issue

; JUnit 5 - Parameterized tests
; (method_declaration
;   name: (identifier) @junit.param_test_name
;   (modifiers
;     (annotation
;       name: (identifier) @junit.param_annotation
;       (#eq? @junit.param_annotation "ParameterizedTest")))) @definition.junit_parameterized_test

; JUnit 5 - Test source annotations
; (method_declaration
;   name: (identifier) @junit.source_test_name
;   (modifiers
;     (annotation
;       name: (identifier) @junit.source_annotation
;       (#match? @junit.source_annotation "^(CsvSource|MethodSource|EnumSource|ValueSource)$")))) @definition.junit_test_source

; JUnit 5 - Before/After annotations
; (method_declaration
;   name: (identifier) @junit.lifecycle_method_name
;   (modifiers
;     (annotation
;       name: (identifier) @junit.lifecycle_annotation
;       (#match? @junit.lifecycle_annotation "^(BeforeAll|BeforeEach|AfterAll|AfterEach)$")))) @definition.junit_lifecycle_method

; JUnit 5 - Test class patterns
; (class_declaration
;   name: (identifier) @junit.test_class_name
;   (#match? @junit.test_class_name "^.*Tests?$")) @definition.junit_test_class

; JUnit 5 - Test class with annotations
; (class_declaration
;   name: (identifier) @junit.annotated_test_class
;   (modifiers
;     (annotation
;       name: (identifier) @junit.class_annotation
;       (#match? @junit.class_annotation "^(TestInstance|TestMethodOrder|ExtendWith|Nested|DisplayNameGeneration)$")))) @definition.junit_annotated_test_class

; JUnit 5 - Assertions
(method_invocation
  name: (identifier) @junit.assertion_method
  (#match? @junit.assertion_method "^(assertEquals|assertNotEquals|assertTrue|assertFalse|assertNull|assertNotNull|assertSame|assertNotSame|assertArrayEquals|assertIterableEquals|assertLinesMatch|assertThrows|assertDoesNotThrow|assertTimeout|assertTimeoutPreemptively|fail|assumeTrue|assumeFalse)$")
  arguments: (argument_list)?) @definition.junit_assertion

; JUnit 5 - Assumptions
(method_invocation
  name: (identifier) @junit.assumption_method
  (#match? @junit.assumption_method "^(assumeTrue|assumeFalse|assumingThat)$")
  arguments: (argument_list)?) @definition.junit_assumption

; Commented out due to modifiers issue

; JUnit 4 - Test method patterns (backward compatibility)
;(method_declaration
;  name: (identifier) @junit4.test_method_name
;  (modifiers
;    (annotation
;      name: (identifier) @junit4.test_annotation
;      (#match? @junit4.test_annotation "^(Test|org\\\\.junit\\\\.Test)$")))) @definition.junit4_test_method

; JUnit 4 - Before/After annotations
;(method_declaration
;  name: (identifier) @junit4.lifecycle_method_name
;  (modifiers
;    (annotation
;      name: (identifier) @junit4.lifecycle_annotation
;      (#match? @junit4.lifecycle_annotation "^(Before|After|BeforeClass|AfterClass|org\\\\.junit\\\\.Before|org\\\\.junit\\\\.After|org\\\\.junit\\\\.BeforeClass|org\\\\.junit\\\\.AfterClass)$")))) @definition.junit4_lifecycle_method

; JUnit 4 - Test class patterns
;(class_declaration
;  name: (identifier) @junit4.test_class_name
;  (#match? @junit4.test_class_name "^.*Tests?$")) @definition.junit4_test_class

; TestNG - Test method patterns
;(method_declaration
;  name: (identifier) @testng.test_method_name
;  (modifiers
;    (annotation
;      name: (identifier) @testng.test_annotation
;      (#eq? @testng.test_annotation "Test")))) @definition.testng_test_method

; TestNG - Test method with parameters
;(method_declaration
;  name: (identifier) @testng.param_test_name
;  (modifiers
;    (annotation
;      name: (identifier) @testng.test_annotation
;      (#eq? @testng.test_annotation "Test")
;      arguments: (annotation_argument_list
;        (element_value_pair
;          key: (identifier) @testng.data_provider_key
;          (#eq? @testng.data_provider_key "dataProvider")
;          value: (string_literal) @testng.data_provider_value))))) @definition.testng_test_with_data_provider

; TestNG - Before/After annotations
;(method_declaration
;  name: (identifier) @testng.lifecycle_method_name
;  (modifiers
;    (annotation
;      name: (identifier) @testng.lifecycle_annotation
;      (#match? @testng.lifecycle_annotation "^(BeforeMethod|AfterMethod|BeforeClass|AfterClass|BeforeSuite|AfterSuite|BeforeGroups|AfterGroups|BeforeTest|AfterTest)$")))) @definition.testng_lifecycle_method

; TestNG - Data provider methods
;(method_declaration
;  name: (identifier) @testng.data_provider_method_name
;  (modifiers
;    (annotation
;      name: (identifier) @testng.data_provider_annotation
;      (#eq? @testng.data_provider_annotation "DataProvider")))) @definition.testng_data_provider

; TestNG - Test class patterns
;(class_declaration
;  name: (identifier) @testng.test_class_name
;  (#match? @testng.test_class_name "^.*Tests?$")) @definition.testng_test_class

; TestNG - Configuration annotations
;(class_declaration
;  name: (identifier) @testng.config_class_name
;  (modifiers
;    (annotation
;      name: (identifier) @testng.config_annotation
;      (#match? @testng.config_annotation "^(Listeners|Guice|Parameters|Test)$")))) @definition.testng_configured_class

; Mockito - Mock annotations
;(field_declaration
;  declarator: (variable_declarator
;    name: (identifier) @mockito.mock_field_name)
;  (modifiers
;    (annotation
;      name: (identifier) @mockito.mock_annotation
;      (#match? @mockito.mock_annotation "^(Mock|Spy|InjectMocks|Captor|MockBean|SpyBean)$")))) @definition.mockito_mock_field

; Mockito - Mock creation
(method_invocation
  name: (identifier) @mockito.mock_method
  (#match? @mockito.mock_method "^(mock|spy|when|verify|times|never|atLeastOnce|atMost|atLeast|doReturn|doThrow|doAnswer|doNothing|doCallRealMethod)$")
  arguments: (argument_list)?) @definition.mockito_mock_method

; Mockito - Verification patterns
(method_invocation
  name: (identifier) @mockito.verify_method
  (#eq? @mockito.verify_method "verify")
  arguments: (argument_list
    (_) @mockito.verify_target
    (method_invocation
      name: (identifier) @mockito.verify_mode
      (#match? @mockito.verify_mode "^(times|never|atLeastOnce|atMost|atLeast|only)$")
      arguments: (argument_list
        (decimal_integer_literal) @mockito.verify_times))?)) @definition.mockito_verification

; Hamcrest - Matcher patterns
(method_invocation
  name: (identifier) @hamcrest.matcher_method
  (#match? @hamcrest.matcher_method "^(equalTo|is|not|anyOf|allOf|hasItem|hasItems|containsInAnyOrder|containsInRelativeOrder|containsString|startsWithString|endsWithString|instanceOf|sameInstance|anything|nullValue|notNullValue|greaterThan|greaterThanOrEqualTo|lessThan|lessThanOrEqualTo|closeTo)$")
  arguments: (argument_list)?) @definition.hamcrest_matcher

; AssertJ - Assertion patterns
(method_invocation
  name: (identifier) @assertj.assert_method
  (#match? @assertj.assert_method "^(assertThat|assertThatThrownBy|assertThatCode|assertThatExceptionOfType|assertThatIOException|assertThatIllegalStateException)$")
  arguments: (argument_list)?) @definition.assertj_assertion

; AssertJ - Fluent assertions
(method_invocation
  object: (method_invocation
    name: (identifier) @assertj.assert_method
    (#match? @assertj.assert_method "^(assertThat|assertThatThrownBy|assertThatCode|assertThatExceptionOfType|assertThatIOException|assertThatIllegalStateException)$"))
  name: (identifier) @assertj.fluent_method
  (#match? @assertj.fluent_method "^(isEqualTo|isNotEqualTo|isSameAs|isNotSameAs|isNull|isNotNull|isTrue|isFalse|isEqualToIgnoringCase|contains|doesNotContain|startsWith|endsWith|hasSize|isEmpty|isNotEmpty|containsExactly|containsExactlyInAnyOrder|containsOnlyOnce|doesNotContainAnyElementsOf|containsAll|doesNotContainNull|doesNotHaveDuplicates|hasOnlyOneElementSatisfying|hasSameSizeAs|hasSizeBetween|hasSizeGreaterThan|hasSizeGreaterThanOrEqualTo|hasSizeLessThan|hasSizeLessThanOrEqualTo|allMatch|anyMatch|noneMatch|satisfies|anyOf|noneOf)$")
  arguments: (argument_list)?) @definition.assertj_fluent_assertion

; Test imports - JUnit
(import_declaration
  (scoped_identifier) @junit.import_name
  (#match? @junit.import_name "^(org\\\\.junit\\\\.jupiter\\\\.api|org\\\\.junit\\\\.jupiter\\\\.params|org\\\\.junit\\\\.jupiter\\\\.engine|org\\\\.junit\\\\.Test|org\\\\.junit\\\\.Before|org\\\\.junit\\\\.After|org\\\\.junit\\\\.BeforeClass|org\\\\.junit\\\\.AfterClass)$")) @definition.junit_import

; Test imports - TestNG
(import_declaration
  (scoped_identifier) @testng.import_name
  (#match? @testng.import_name "^(org\\\\.testng\\\\.annotations|org\\\\.testng\\\\.asserts|org\\\\.testng\\\\.DataProvider)$")) @definition.testng_import

; Test imports - Mockito
(import_declaration
  (scoped_identifier) @mockito.import_name
  (#match? @mockito.import_name "^(org\\\\.mockito|org\\\\.mockito\\\\.Mockito|org\\\\.mockito\\\\.Captor|org\\\\.mockito\\\\.InjectMocks|org\\\\.mockito\\\\.Mock|org\\\\.mockito\\\\.Spy)$")) @definition.mockito_import

; Test imports - Hamcrest
(import_declaration
  (scoped_identifier) @hamcrest.import_name
  (#match? @hamcrest.import_name "^(org\\\\.hamcrest|org\\\\.hamcrest\\\\.core|org\\\\.hamcrest\\\\.text|org\\\\.hamcrest\\\\.collection|org\\\\.hamcrest\\\\.number)$")) @definition.hamcrest_import

; Test imports - AssertJ
(import_declaration
  (scoped_identifier) @assertj.import_name
  (#match? @assertj.import_name "^(org\\\\.assertj\\\\.core|org\\\\.assertj\\\\.core\\\\.api)$")) @definition.assertj_import

; Test runner patterns - JUnit Platform
; Commented out due to modifiers issue

; Test configuration classes
(class_declaration
  name: (identifier) @test.config_class_name
  (#match? @test.config_class_name "^(?:Config|Configuration|TestConfig).*$")) @definition.test_configuration_class

; Test data classes
(class_declaration
  name: (identifier) @test.data_class_name
  (#match? @test.data_class_name "^(?:TestData|TestFixtures|TestDataBuilder).*$")) @definition.test_data_class

; Test utility classes
(class_declaration
  name: (identifier) @test.util_class_name
  (#match? @test.util_class_name "^(?:TestUtil|TestHelper|TestUtils).*$")) @definition.test_utility_class

`
