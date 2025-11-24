/*
- method definitions (including singleton methods and aliases, with associated comments)
- class definitions (including singleton classes, with associated comments)
- module definitions
- constants
- global variables
- instance variables
- class variables
- symbols
- blocks, procs, and lambdas
- mixins (include, extend, prepend)
- metaprogramming constructs (define_method, method_missing)
- attribute accessors (attr_reader, attr_writer, attr_accessor)
- class macros (has_many, belongs_to, etc. in Rails-like code)
- exception handling (begin/rescue/ensure)
- keyword arguments
- splat operators
- hash rocket and JSON-style hashes
- string interpolation
- regular expressions
- Ruby 2.7+ pattern matching
- Ruby 3.0+ endless methods
- Ruby 3.1+ pin operator and shorthand hash syntax
*/
export default `
; Method definitions
(method
  name: (identifier) @name.definition.method) @definition.method

; Singleton methods
(singleton_method
  object: (_)
  name: (identifier) @name.definition.method) @definition.method

; Method aliases
(alias
  name: (_) @name.definition.method) @definition.method

; Class definitions
(class
  name: [
    (constant) @name.definition.class
    (scope_resolution
      name: (_) @name.definition.class)
  ]) @definition.class

; Singleton classes
(singleton_class
  value: [
    (constant) @name.definition.class
    (scope_resolution
      name: (_) @name.definition.class)
  ]) @definition.class

; Module definitions
(module
  name: [
    (constant) @name.definition.module
    (scope_resolution
      name: (_) @name.definition.module)
  ]) @definition.module

; Constants
(assignment
  left: (constant) @name.definition.constant) @definition.constant

; Global variables
(global_variable) @definition.global_variable

; Instance variables
(instance_variable) @definition.instance_variable

; Class variables
(class_variable) @definition.class_variable

; Symbols
(simple_symbol) @definition.symbol
(hash_key_symbol) @definition.symbol

; Blocks
(block) @definition.block
(do_block) @definition.block

; Basic mixin statements - capture all include/extend/prepend calls
(call
  method: (identifier) @_mixin_method
  arguments: (argument_list
    (constant) @name.definition.mixin)
  (#match? @_mixin_method "^(include|extend|prepend)$")) @definition.mixin

; Mixin module definition
(module
  name: (constant) @name.definition.mixin_module
  (#match? @name.definition.mixin_module ".*Module$")) @definition.mixin_module

; Mixin-related methods
(method
  name: (identifier) @name.definition.mixin_method
  (#match? @name.definition.mixin_method "(included|extended|prepended)_method")) @definition.mixin_method

; Singleton class blocks
(singleton_class) @definition.singleton_class

; Class methods in singleton context
(singleton_method
  object: (self)
  name: (identifier) @name.definition.singleton_method) @definition.singleton_method

; Attribute accessors
(call
  method: (identifier) @_attr_accessor
  arguments: (argument_list
    (_) @name.definition.attr_accessor)
  (#eq? @_attr_accessor "attr_accessor")) @definition.attr_accessor

(call
  method: (identifier) @_attr_reader
  arguments: (argument_list
    (_) @name.definition.attr_reader)
  (#eq? @_attr_reader "attr_reader")) @definition.attr_reader

(call
  method: (identifier) @_attr_writer
  arguments: (argument_list
    (_) @name.definition.attr_writer)
  (#eq? @_attr_writer "attr_writer")) @definition.attr_writer

; Class macros (Rails-like)
(call
  method: (identifier) @_macro_name
  arguments: (argument_list
    (_) @name.definition.class_macro)
  (#match? @_macro_name "^(has_many|belongs_to|has_one|validates|scope|before_action|after_action)$")) @definition.class_macro

; Exception handling
(begin) @definition.begin
(rescue) @definition.rescue
(ensure) @definition.ensure

; Keyword arguments
(keyword_parameter
  name: (identifier) @name.definition.keyword_parameter) @definition.keyword_parameter

; Splat operators
(splat_parameter) @definition.splat_parameter
(splat_argument) @definition.splat_argument

; Hash syntax variants
(pair
  key: (_) @name.definition.hash_key) @definition.hash_pair

; String interpolation - capture the string with interpolation and surrounding context
(assignment
  left: (identifier) @name.definition.string_var
  right: (string
    (interpolation))) @definition.string_interpolation

; Regular expressions - capture the regex pattern and assignment
(assignment
  left: (identifier) @name.definition.regex_var
  right: (regex)) @definition.regex_assignment

; Pattern matching - capture the entire case_match structure
(case_match) @definition.case_match

; Pattern matching - capture in_clause with hash pattern
(in_clause
  pattern: (hash_pattern)) @definition.hash_pattern_clause

; Endless methods - capture the method definition with name and surrounding context
(comment) @_endless_method_comment
(#match? @_endless_method_comment "Ruby 3.0\\+ endless method")
(method
  name: (identifier) @name.definition.endless_method
  body: (binary
    operator: "=")) @definition.endless_method

; Pin operator - capture the entire in_clause with variable_reference_pattern
(in_clause
  pattern: (variable_reference_pattern)) @definition.pin_pattern_clause

; Shorthand hash syntax - capture the method containing shorthand hash
(comment) @_shorthand_hash_comment
(#match? @_shorthand_hash_comment "Ruby 3.1\\+ shorthand hash syntax")
(method
  name: (identifier) @name.definition.shorthand_method) @definition.shorthand_method

; Shorthand hash syntax - capture the hash with shorthand syntax
(hash
  (pair
    (hash_key_symbol)
    ":")) @definition.shorthand_hash

; Capture larger contexts for features that need at least 4 lines

; Capture the entire program to include all comments and code
(program) @definition.program

; Capture all comments
(comment) @definition.comment

; Capture all method definitions
(method) @definition.method_all
; Capture all method definitions
(method) @definition.method_all

; ===== TESTING FRAMEWORK PATTERNS FOR RUBY =====

; RSpec - describe blocks
(call
  method: (identifier) @rspec.describe_method
  (#match? @rspec.describe_method "^(describe|context|feature)$")
  arguments: (argument_list
    (_) @rspec.describe_subject
    (block) @rspec.describe_block)) @definition.rspec_describe

; RSpec - it blocks
(call
  method: (identifier) @rspec.it_method
  (#match? @rspec.it_method "^(it|example|scenario)$")
  arguments: (argument_list
    (string) @rspec.it_description
    (block) @rspec.it_block)) @definition.rspec_it

; RSpec - before/after hooks
(call
  method: (identifier) @rspec.hook_method
  (#match? @rspec.hook_method "^(before|after|around)$")
  arguments: (argument_list
    (symbol) @rspec.hook_scope?
    (block) @rspec.hook_block)) @definition.rspec_hook

; RSpec - let definitions
(call
  method: (identifier) @rspec.let_method
  (#match? @rspec.let_method "^(let|let!|subject)$")
  arguments: (argument_list
    (symbol) @rspec.let_name
    (block) @rspec.let_block)) @definition.rspec_let

; RSpec - expect statements
(call
  method: (identifier) @rspec.expect_method
  (#eq? @rspec.expect_method "expect")
  arguments: (argument_list
    (_) @rspec.expect_target)) @definition.rspec_expect

; RSpec - matchers
(call
  method: (identifier) @rspec.matcher_method
  (#match? @rspec.matcher_method "^(to|to_not|not_to|eq|eql|equal|be|be_a|be_an|be_instance_of|be_kind_of|respond_to|include|match|raise_error|throw_error|have_attributes|have_http_status|redirect_to|render_template|change|by)$")
  arguments: (argument_list
    (_) @rspec.matcher_value)) @definition.rspec_matcher

; RSpec - should syntax (legacy)
(call
  method: (identifier) @rspec.should_method
  (#eq? @rspec.should_method "should")
  receiver: (_) @rspec.should_target
  arguments: (argument_list
    (call
      method: (identifier) @rspec.should_matcher
      arguments: (argument_list
        (_) @rspec.should_matcher_value)))) @definition.rspec_should

; RSpec - shared examples
(call
  method: (identifier) @rspec.shared_examples_method
  (#match? @rspec.shared_examples_method "^(shared_examples_for|shared_context)$")
  arguments: (argument_list
    (string) @rspec.shared_name
    (block) @rspec.shared_block)) @definition.rspec_shared_examples

; RSpec - include shared examples
(call
  method: (identifier) @rspec.include_shared_method
  (#match! @rspec.include_shared_method "^(include_examples|include_context|it_behaves_like)$")
  arguments: (argument_list
    (_) @rspec.include_shared_target)) @definition.rspec_include_shared

; RSpec - test doubles
(call
  method: (identifier) @rspec.double_method
  (#match? @rspec.double_method "^(double|instance_double|class_double|object_double|spy|instance_spy)$")
  arguments: (argument_list
    (_) @rspec.double_target)) @definition.rspec_double

; RSpec - allow/expect message chains
(call
  method: (identifier) @rspec.allow_method
  (#match? @rspec.allow_method "^(allow|expect)$")
  arguments: (argument_list
    (_) @rspec.allow_target)
  (call
    method: (identifier) @rspec.receive_method
    (#eq? @rspec.receive_method "to")
    arguments: (argument_list
      (call
        method: (identifier) @rspec.receive_message
        (#eq? @rspec.receive_message "receive")
        arguments: (argument_list
          (symbol) @rspec.message_name
          (hash) @rspec.message_options)))))) @definition.rspec_message_expectation

; RSpec - stub return values
(call
  method: (identifier) @rspec.and_return_method
  (#match? @rspec.and_return_method "^(and_return|and_returning)$")
  arguments: (argument_list
    (_) @rspec.return_value)) @definition.rspec_stub_return

; Minitest - test methods
(method
  name: (identifier) @minitest.test_method_name
  (#match? @minitest.test_method_name "^test_.*$")) @definition.minitest_test_method

; Minitest - setup/teardown methods
(method
  name: (identifier) @minitest.setup_method_name
  (#match? @minitest.setup_method_name "^(setup|teardown|before_setup|after_teardown)$")) @definition.minitest_setup_method

; Minitest - assertions
(call
  method: (identifier) @minitest.assert_method
  (#match? @minitest.assert_method "^(assert|assert_equal|assert_not_equal|assert_same|assert_not_same|assert_nil|assert_not_nil|assert_empty|assert_not_empty|assert_includes|assert_match|assert_no_match|assert_raises|assert_nothing_raised|assert_respond_to|assert_operator|assert_instance_of|assert_kind_of|flunk|skip|pass)$")
  arguments: (argument_list)?) @definition.minitest_assertion

; Minitest - expect syntax
(call
  method: (identifier) @minitest.expect_method
  (#eq? @minitest.expect_method "expect")
  arguments: (argument_list
    (_) @minitest.expect_target)) @definition.minitest_expect

; Test::Unit - test methods
(method
  name: (identifier) @testunit.test_method_name
  (#match? @testunit.test_method_name "^test_.*$")
  (superclass
    (constant) @testunit.base_class
    (#match? @testunit.base_class "TestCase"))) @definition.testunit_test_method

; Test::Unit - setup/teardown methods
(method
  name: (identifier) @testunit.setup_method_name
  (#match? @testunit.setup_method_name "^(setup|teardown)$")
  (superclass
    (constant) @testunit.base_class
    (#match? @testunit.base_class "TestCase"))) @definition.testunit_setup_method

; Test::Unit - assertions
(call
  method: (identifier) @testunit.assert_method
  (#match? @testunit.assert_method "^(assert|assert_equal|assert_not_equal|assert_same|assert_not_same|assert_nil|assert_not_nil|assert_empty|assert_not_empty|assert_includes|assert_match|assert_no_match|assert_raises|assert_nothing_raised|assert_respond_to|assert_operator|assert_instance_of|assert_kind_of|flunk|skip|pass)$")
  arguments: (argument_list)?) @definition.testunit_assertion

; Testing framework requires
(call
  method: (identifier) @test.require_method
  (#eq? @test.require_method "require")
  arguments: (argument_list
    (string) @test.require_path
    (#match? @test.require_path "['\"](rspec|minitest|test/unit|test/unit/assertions|test_helper|spec_helper)['\"]$"))) @definition.test_require

; Testing framework includes
(call
  method: (identifier) @test.include_method
  (#eq? @test.include_method "include")
  arguments: (argument_list
    (constant) @test.include_module
    (#match? @test.include_module "(RSpec|Minitest|Test::Unit|TestHelper|SpecHelper)$"))) @definition.test_include

; Test classes
(class
  name: (constant) @test.class_name
  (#match? @test.class_name ".*(Test|Spec).*$")) @definition.test_class

; Test modules
(module
  name: (constant) @test.module_name
  (#match? @test.module_name ".*(Test|Spec|Helper).*$")) @definition.test_module

; Test files detection
(call
  method: (identifier) @test.file_indicator
  (#match? @test.file_indicator "^(describe|it|test_.*|RSpec|describe|context|feature)$")) @definition.test_file_indicator

; Mock and stub patterns
(call
  method: (identifier) @test.mock_method
  (#match? @test.mock_method "^(mock|stub|double|spy|fake|dummy)$")
  arguments: (argument_list)?) @definition.test_mock

; Test data factories
(call
  method: (identifier) @test.factory_method
  (#match? @test.factory_method "^(create|build|build_stubbed|attributes_for|generate)$")
  arguments: (argument_list
    (symbol) @test.factory_name
    (hash) @test.factory_traits?)) @definition.test_factory

; Test configuration
(call
  method: (identifier) @test.config_method
  (#match? @test.config_method "^(configure|RSpec\\.configure|Minitest\\.run)$")
  arguments: (argument_list
    (block) @test.config_block)) @definition.test_configuration

; Test environment setup
(call
  method: (identifier) @test.env_method
  (#match? @test.env_method "^(ENV|env|environment)$")
  arguments: (argument_list
    (string) @test.env_key
    (_) @test.env_value)) @definition.test_environment

; Test database transactions
(call
  method: (identifier) @test.transaction_method
  (#match? @test.transaction_method "^(transaction|rollback_transaction|use_transactional_fixtures)$")
  arguments: (argument_list)?) @definition.test_transaction

; Test time helpers
(call
  method: (identifier) @test.time_method
  (#match! @test.time_method "^(travel_to|travel_back|freeze_time|Timecop\\.travel|Timecop\\.freeze|Timecop\\.return)$")
  arguments: (argument_list
    (_) @test.time_value)) @definition.test_time_helper

; Capybara patterns
(call
  method: (identifier) @test.capybara_method
  (#match! @test.capybara_method "^(visit|page|click_on|fill_in|choose|check|uncheck|select|attach_file|have_content|have_text|have_title|have_current_path|have_selector|have_css|have_xpath|wait_for_ajax|wait_for_turbo|save_and_open_page|save_screenshot)$"))
  arguments: (argument_list)?) @definition.test_capybara

; Factory Bot patterns
(call
  method: (identifier) @test.factory_bot_method
  (#match! @test.factory_bot_method "^(FactoryBot\\.define|factory|create|build|build_stubbed|attributes_for|generate|trait|sequence|association)$"))
  arguments: (argument_list)?) @definition.test_factory_bot

; WebMock patterns
(call
  method: (identifier) @test.webmock_method
  (#match! @test.webmock_method "^(stub_request|stub_http_request|a_request|a_get|a_post|a_put|a_delete|a_patch|a_head|a_options|to_return|to_raise|with|with_headers|with_body|with_query|times|once|twice|at_least_once|at_most_once)$"))
  arguments: (argument_list)?) @definition.test_webmock

`
