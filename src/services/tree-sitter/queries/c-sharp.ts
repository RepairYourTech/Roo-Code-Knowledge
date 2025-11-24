/*
C# Tree-Sitter Query Patterns
*/
export default `
; Using directives
(using_directive) @definition.using
 
; Namespace declarations (including file-scoped)
; Support both simple names (TestNamespace) and qualified names (My.Company.Module)
(namespace_declaration
  name: (qualified_name) @name) @definition.namespace
(namespace_declaration
  name: (identifier) @name) @definition.namespace
(file_scoped_namespace_declaration
  name: (qualified_name) @name) @definition.namespace
(file_scoped_namespace_declaration
  name: (identifier) @name) @definition.namespace
 
; Class declarations (including generic, static, abstract, partial, nested)
(class_declaration
  name: (identifier) @name) @definition.class
 
; Interface declarations
(interface_declaration
  name: (identifier) @name) @definition.interface
 
; Struct declarations
(struct_declaration
  name: (identifier) @name) @definition.struct
 
; Enum declarations
(enum_declaration
  name: (identifier) @name) @definition.enum
 
; Record declarations
(record_declaration
  name: (identifier) @name) @definition.record
 
; Method declarations (including async, static, generic)
(method_declaration
  name: (identifier) @name) @definition.method
 
; Property declarations
(property_declaration
  name: (identifier) @name) @definition.property
 
; Event declarations
(event_declaration
  name: (identifier) @name) @definition.event
 
; Delegate declarations
(delegate_declaration
  name: (identifier) @name) @definition.delegate
 
; Attribute declarations
(attribute
  name: (identifier) @name) @definition.attribute
 
; Generic type parameters
(type_parameter
  name: (identifier) @name) @definition.type_parameter
 
; LINQ expressions
(query_expression) @definition.linq_expression

; ===== TESTING FRAMEWORK PATTERNS FOR C#/.NET =====

; xUnit - Test methods
(method_declaration
  name: (identifier) @xunit.test_method_name
  attributes: (attribute_list
    (attribute
      name: (identifier) @xunit.test_attribute
      (#eq? @xunit.test_attribute "Fact")))) @definition.xunit_test_method

; xUnit - Test methods with display name
(method_declaration
  name: (identifier) @xunit.test_display_name
  attributes: (attribute_list
    (attribute
      name: (identifier) @xunit.test_attribute
      (#eq? @xunit.test_attribute "Fact")
      (attribute_argument_list
        (attribute_argument
          (name_equals) @xunit.display_name_key
          (#eq? @xunit.display_name_key "DisplayName")
          (string_literal) @xunit.display_name_value))))) @definition.xunit_test_with_display_name

; xUnit - Theory methods
(method_declaration
  name: (identifier) @xunit.theory_method_name
  attributes: (attribute_list
    (attribute
      name: (identifier) @xunit.theory_attribute
      (#eq? @xunit.theory_attribute "Theory")))) @definition.xunit_theory_method

; xUnit - Inline data
(method_declaration
  name: (identifier) @xunit.inline_data_method
  attributes: (attribute_list
    (attribute
      name: (identifier) @xunit.inline_data_attribute
      (#match? @xunit.inline_data_attribute "^(InlineData|MemberData|ClassData)$")))) @definition.xunit_data_driven_test

; xUnit - Test lifecycle methods
(method_declaration
  name: (identifier) @xunit.lifecycle_method_name
  attributes: (attribute_list
    (attribute
      name: (identifier) @xunit.lifecycle_attribute
      (#match? @xunit.lifecycle_attribute "^(BeforeConstructor|AfterConstructor|BeforeAfterTestAttribute|BeforeTest|AfterTest|CollectionDefinition|Collection|Trait|Skip|Fact|Theory)$")))) @definition.xunit_lifecycle_method

; xUnit - Test classes
(class_declaration
  name: (identifier) @xunit.test_class_name
  (#match? @xunit.test_class_name ".*Test.*$")) @definition.xunit_test_class

; xUnit - Collection fixtures
(class_declaration
  name: (identifier) @xunit.fixture_class_name
  attributes: (attribute_list
    (attribute
      name: (identifier) @xunit.fixture_attribute
      (#eq? @xunit.fixture_attribute "CollectionDefinition")))) @definition.xunit_collection_fixture

; NUnit - Test methods
(method_declaration
  name: (identifier) @nunit.test_method_name
  attributes: (attribute_list
    (attribute
      name: (identifier) @nunit.test_attribute
      (#eq? @nunit.test_attribute "Test")))) @definition.nunit_test_method

; NUnit - Test methods with description
(method_declaration
  name: (identifier) @nunit.test_description_name
  attributes: (attribute_list
    (attribute
      name: (identifier) @nunit.test_attribute
      (#eq? @nunit.test_attribute "Test")
      (attribute_argument_list
        (attribute_argument
          (name_equals) @nunit.description_key
          (#eq? @nunit.description_key "Description")
          (string_literal) @nunit.description_value))))) @definition.nunit_test_with_description

; NUnit - Setup/Teardown methods
(method_declaration
  name: (identifier) @nunit.setup_method_name
  attributes: (attribute_list
    (attribute
      name: (identifier) @nunit.setup_attribute
      (#match? @nunit.setup_attribute "^(SetUp|TearDown|OneTimeSetUp|OneTimeTearDown|SetUpFixture)$")))) @definition.nunit_setup_method

; NUnit - Test cases
(method_declaration
  name: (identifier) @nunit.test_case_method_name
  attributes: (attribute_list
    (attribute
      name: (identifier) @nunit.test_case_attribute
      (#match? @nunit.test_case_attribute "^(TestCase|TestCaseSource|Values|Range|Random|Sequential)$")))) @definition.nunit_test_case

; NUnit - Test fixtures
(class_declaration
  name: (identifier) @nunit.test_class_name
  attributes: (attribute_list
    (attribute
      name: (identifier) @nunit.fixture_attribute
      (#eq? @nunit.fixture_attribute "TestFixture")))) @definition.nunit_test_fixture

; MSTest - Test methods
(method_declaration
  name: (identifier) @mstest.test_method_name
  attributes: (attribute_list
    (attribute
      name: (identifier) @mstest.test_attribute
      (#eq? @mstest.test_attribute "TestMethod")))) @definition.mstest_test_method

; MSTest - Test methods with description
(method_declaration
  name: (identifier) @mstest.test_description_name
  attributes: (attribute_list
    (attribute
      name: (identifier) @mstest.test_attribute
      (#eq? @mstest.test_attribute "TestMethod")
      (attribute_argument_list
        (attribute_argument
          (name_equals) @mstest.description_key
          (#eq? @mstest.description_key "Description")
          (string_literal) @mstest.description_value))))) @definition.mstest_test_with_description

; MSTest - Class initialization methods
(method_declaration
  name: (identifier) @mstest.class_init_method_name
  attributes: (attribute_list
    (attribute
      name: (identifier) @mstest.class_init_attribute
      (#match? @mstest.class_init_attribute "^(ClassInitialize|ClassCleanup|TestInitialize|TestCleanup|AssemblyInitialize|AssemblyCleanup)$")))) @definition.mstest_class_init_method

; MSTest - Test classes
(class_declaration
  name: (identifier) @mstest.test_class_name
  attributes: (attribute_list
    (attribute
      name: (identifier) @mstest.test_class_attribute
      (#eq? @mstest.test_class_attribute "TestClass")))) @definition.mstest_test_class

; MSTest - Data driven tests
(method_declaration
  name: (identifier) @mstest.data_driven_method_name
  attributes: (attribute_list
    (attribute
      name: (identifier) @mstest.data_attribute
      (#match? @mstest.data_attribute "^(DataSource|DataRow|DataTestMethod)$")))) @definition.mstest_data_driven_test

; FluentAssertions - Assert patterns
(invocation_expression
  member: (member_access_expression
    name: (identifier) @fluent.assert_method
    (#match? @fluent.assert_method "^(Should|Be|NotBe|Contain|NotContain|Have|NotHave|BeEquivalentTo|BeNull|NotBeNull|BeEmpty|NotBeEmpty|BeTrue|BeFalse|BeOfType|BeAssignableTo|BePositive|BeNegative|BeGreaterThan|BeLessThan|BeGreaterThanOrEqualTo|BeLessThanOrEqualTo|BeCloseTo|BeApproximately|Match|NotMatch|StartWith|EndWith|ContainSingle|ContainSingleEquivalentTo|HaveCount|HaveSameCount|HaveElementAt|HaveElementMatching|HaveElementSatisfying|AllSatisfy|OnlyContain|OnlyHaveUniqueItems|BeInAscendingOrder|BeInDescendingOrder|BeSubsetOf|NotBeSubsetOf|BeSupersetOf|NotBeSupersetOf|IntersectWith|NotIntersectWith|BeEquivalentTo|NotBeEquivalentTo|BeSameAs|NotBeSameAs|BeOfType|NotBeOfType|BeAssignableTo|NotBeAssignableTo)$"))
  arguments: (argument_list)?) @definition.fluent_assertion

; Shouldly - Assert patterns
(invocation_expression
  member: (member_access_expression
    name: (identifier) @shouldly.assert_method
    (#match? @shouldly.assert_method "^(Should|ShouldBe|ShouldNotBe|ShouldContain|ShouldNotContain|ShouldHave|ShouldNotHave|ShouldBeNull|ShouldNotBeNull|ShouldBeEmpty|ShouldNotBeEmpty|ShouldBeTrue|ShouldBeFalse|ShouldBeOfType|ShouldBeAssignableTo|ShouldBePositive|ShouldBeNegative|ShouldBeGreaterThan|ShouldBeLessThan|ShouldBeGreaterThanOrEqualTo|ShouldBeLessThanOrEqualTo|ShouldBeCloseTo|ShouldMatch|ShouldNotMatch|ShouldStartWith|ShouldEndWith|ShouldContainSingle|ShouldContainSingleEquivalentTo|ShouldHaveCount|ShouldHaveSameCount|ShouldHaveElementAt|ShouldHaveElementMatching|ShouldHaveElementSatisfying|ShouldAllSatisfy|ShouldOnlyContain|ShouldOnlyHaveUniqueItems|ShouldBeInAscendingOrder|ShouldBeInDescendingOrder|ShouldBeSubsetOf|ShouldNotBeSubsetOf|ShouldBeSupersetOf|ShouldNotBeSupersetOf|ShouldIntersectWith|ShouldNotIntersectWith|ShouldBeEquivalentTo|ShouldNotBeEquivalentTo|ShouldBeSameAs|ShouldNotBeSameAs|ShouldBeOfType|ShouldNotBeOfType|ShouldBeAssignableTo|ShouldNotBeAssignableTo)$"))
  arguments: (argument_list)?) @definition.shouldly_assertion

; Moq - Mock setup
(invocation_expression
  member: (member_access_expression
    name: (identifier) @moq.setup_method
    (#match? @moq.setup_method "^(Setup|SetupGet|SetupSet|SetupSequence|SetupProperty|SetupAllProperties)$"))
  arguments: (argument_list
    (lambda_expression) @moq.setup_expression)) @definition.moq_setup

; Moq - Mock returns
(invocation_expression
  member: (member_access_expression
    name: (identifier) @moq.return_method
    (#match? @moq.return_method "^(Returns|ReturnsAsync|ReturnsValue|ReturnsAsyncValue)$"))
  arguments: (argument_list
    (_) @moq.return_value)) @definition.moq_return

; Moq - Mock verification
(invocation_expression
  member: (member_access_expression
    name: (identifier) @moq.verify_method
    (#match? @moq.verify_method "^(Verify|VerifyGet|VerifySet|VerifyNoOtherCalls|VerifyAll)$"))
  arguments: (argument_list
    (_) @moq.verify_target
    (identifier)? @moq.verify_times)) @definition.moq_verification

; NSubstitute - Mock setup
(invocation_expression
  member: (member_access_expression
    name: (identifier) @nsubstitute.setup_method
    (#match? @nsubstitute.setup_method "^(Returns|ReturnsForAnyArgs|Throws|ThrowsForAnyArgs|When|WhenForAnyArgs)$"))
  arguments: (argument_list
    (_) @nsubstitute.setup_value)) @definition.nsubstitute_setup

; NSubstitute - Mock verification
(invocation_expression
  member: (member_access_expression
    name: (identifier) @nsubstitute.verify_method
    (#match! @nsubstitute.verify_method "^(Received|ReceivedWithAnyArgs|DidNotReceive|DidNotReceiveWithAnyArgs|ReceivedCalls)$"))
  arguments: (argument_list
    (_) @nsubstitute.verify_target)) @definition.nsubstitute_verification

; Test imports - xUnit
(using_directive
  name: (qualified_name) @xunit.import_name
  (#match? @xunit.import_name "^(Xunit|Xunit\\.Runner|Xunit\\.Abstractions|Xunit\\.Extensions)$")) @definition.xunit_import

; Test imports - NUnit
(using_directive
  name: (qualified_name) @nunit.import_name
  (#match? @nunit.import_name "^(NUnit|NUnit\\.Framework|NUnit\\.Framework\\.Interfaces|NUnit\\.Framework\\.Internal)$")) @definition.nunit_import

; Test imports - MSTest
(using_directive
  name: (qualified_name) @mstest.import_name
  (#match? @mstest.import_name "^(Microsoft\\.VisualStudio\\.TestTools|Microsoft\\.VisualStudio\\.TestTools\\.UnitTesting|Microsoft\\.VisualStudio\\.TestTools\\.Data)$")) @definition.mstest_import

; Test imports - FluentAssertions
(using_directive
  name: (qualified_name) @fluent.import_name
  (#match? @fluent.import_name "^(FluentAssertions|FluentAssertions\\.Extensions|FluentAssertions\\.Execution)$")) @definition.fluent_import

; Test imports - Shouldly
(using_directive
  name: (qualified_name) @shouldly.import_name
  (#match? @shouldly.import_name "^(Shouldly|Shouldly\\.Assertions)$")) @definition.shouldly_import

; Test imports - Moq
(using_directive
  name: (qualified_name) @moq.import_name
  (#match? @moq.import_name "^(Moq|Moq\\.Mock)$")) @definition.moq_import

; Test imports - NSubstitute
(using_directive
  name: (qualified_name) @nsubstitute.import_name
  (#match? @nsubstitute.import_name "^(NSubstitute|NSubstitute\\.Extensions)$")) @definition.nsubstitute_import

; Test configuration classes
(class_declaration
  name: (identifier) @test.config_class_name
  (#match? @test.config_class_name ".*(Config|Configuration|Setup|Fixture).*$")) @definition.test_configuration_class

; Test data classes
(class_declaration
  name: (identifier) @test.data_class_name
  (#match? @test.data_class_name ".*(TestData|TestCase|TestFixtures|TestDataBuilder).*$")) @definition.test_data_class

; Test helper classes
(class_declaration
  name: (identifier) @test.helper_class_name
  (#match? @test.helper_class_name ".*(TestUtil|TestHelper|TestUtils|TestBase).*$")) @definition.test_helper_class

; Test interfaces
(interface_declaration
  name: (identifier) @test.interface_name
  (#match? @test.interface_name ".*(ITest|ITestFixture|ITestHelper).*$")) @definition.test_interface

; Test base classes
(class_declaration
  name: (identifier) @test.base_class_name
  (#match? @test.base_class_name ".*(TestBase|BaseTest|TestFixtureBase).*$")) @definition.test_base_class

; Test attributes
(attribute
  name: (identifier) @test.attribute_name
  (#match? @test.attribute_name ".*(Test|Fact|Theory|TestCase|TestFixture|TestClass|Setup|TearDown|Initialize|Cleanup|Data|Ignore|Skip|Category|Trait|Property|DataSource|DataRow|Collection|Before|After).*$")) @definition.test_attribute

; Test enums
(enum_declaration
  name: (identifier) @test.enum_name
  (#match? @test.enum_name ".*(Test|TestData|TestCase|TestState|TestStatus).*$")) @definition.test_enum

; Test constants
(field_declaration
  declaration: (variable_declaration
    declarators: (variable_declarator
      identifier: (identifier) @test.constant_name
      (#match? @test.constant_name "^(TEST_|MOCK_|FAKE_|STUB_|EXPECTED_|ACTUAL_).*")))) @definition.test_constant

; Test async methods
(method_declaration
  name: (identifier) @test.async_method_name
  return_type: (generic_name
    name: (identifier) @test.async_return
    (#eq? @test.async_return "Task")
    type_arguments: (type_argument_list))) @definition.test_async_method

; Test exception handling
(try_statement) @definition.test_try_statement
(catch_clause) @definition.test_catch_clause
(finally_clause) @definition.test_finally_clause

`
