/*
Python Tree-sitter Query Patterns
*/
export default `
; Class definitions (including decorated)
(class_definition
  name: (identifier) @name.definition.class) @definition.class

(decorated_definition
  definition: (class_definition
    name: (identifier) @name.definition.class)) @definition.class

; Function and method definitions (including async and decorated)
(function_definition
  name: (identifier) @name.definition.function) @definition.function

(decorated_definition
  definition: (function_definition
    name: (identifier) @name.definition.function)) @definition.function

; Lambda expressions
(expression_statement
  (assignment
    left: (identifier) @name.definition.lambda
    right: (parenthesized_expression
      (lambda)))) @definition.lambda

; Generator functions (functions containing yield)
(function_definition
  name: (identifier) @name.definition.generator
  body: (block
    (expression_statement
      (yield)))) @definition.generator

; Comprehensions
(expression_statement
  (assignment
    left: (identifier) @name.definition.comprehension
    right: [
      (list_comprehension)
      (dictionary_comprehension)
      (set_comprehension)
    ])) @definition.comprehension

; With statements
(with_statement) @definition.with_statement

; Try statements
(try_statement) @definition.try_statement

; Import statements
(import_from_statement) @definition.import
(import_statement) @definition.import

; Global/Nonlocal statements
(function_definition
  body: (block
    [(global_statement) (nonlocal_statement)])) @definition.scope

; Match case statements
(function_definition
  body: (block
    (match_statement))) @definition.match_case

; Type annotations
(typed_parameter
  type: (type)) @definition.type_annotation

(expression_statement
  (assignment
    left: (identifier) @name.definition.type
    type: (type))) @definition.type_annotation

; FastAPI Application Creation
(call_expression
  function: (identifier) @fastapi.app
  (#eq? @fastapi.app "FastAPI")) @definition.fastapi_app

; FastAPI Route Decorators
(decorated_definition
  (decorator
    (call_expression
      function: (member_expression
        object: (identifier) @fastapi.app_or_router
        property: (property_identifier) @fastapi.method
        (#match? @fastapi.method "^(get|post|put|delete|patch|head|options|trace)$"))
      arguments: (arguments
        (string) @fastapi.path))) @definition.fastapi_route

; FastAPI Router Creation
(call_expression
  function: (identifier) @fastapi.router
  (#eq? @fastapi.router "APIRouter")) @definition.fastapi_router

; FastAPI Dependencies
(call_expression
  function: (identifier) @fastapi.depends
  (#eq? @fastapi.depends "Depends")
  arguments: (arguments
    [(identifier) @fastapi.dependency
     (call_expression) @fastapi.dependency
     (attribute) @fastapi.dependency])) @definition.fastapi_dependency

; FastAPI Annotated Dependencies
(call_expression
  function: (identifier) @fastapi.annotated
  (#eq? @fastapi.annotated "Annotated")
  arguments: (arguments
    (type) @fastapi.param_type
    (call_expression
      function: (identifier) @fastapi.depends_inner
      (#eq? @fastapi.depends_inner "Depends")
      arguments: (arguments
        [(identifier) @fastapi.dependency
         (call_expression) @fastapi.dependency
         (attribute) @fastapi.dependency])))) @definition.fastapi_annotated_dependency

; FastAPI Path and Query Parameters
(typed_parameter
  (call_expression
    function: (identifier) @fastapi.param_type
    (#match? @fastapi.param_type "^(Path|Query|Header|Cookie|Body|Form|File|UploadFile)$")
    arguments: (arguments
      [(string)? @fastapi.param_description
       (keyword_argument
         name: (identifier) @fastapi.param_kw_name
         value: (_) @fastapi.param_kw_value)]*))) @definition.fastapi_parameter

; FastAPI Response Model
(call_expression
  function: (member_expression
    object: (identifier) @fastapi.app_or_router_resp
    property: (property_identifier) @fastapi.method_resp
    (#match? @fastapi.method_resp "^(get|post|put|delete|patch|head|options|trace)$"))
  arguments: (arguments
    (string) @fastapi.path_resp
    (keyword_argument
      name: (identifier) @fastapi.response_model_kw
      (#eq? @fastapi.response_model_kw "response_model")
      value: (type) @fastapi.response_model))) @definition.fastapi_response_model

; FastAPI Middleware
(call_expression
  function: (member_expression
    object: (identifier) @fastapi.app_middleware
    property: (property_identifier) @fastapi.middleware_method
    (#eq? @fastapi.middleware_method "middleware"))
  arguments: (arguments
    (string) @fastapi.middleware_name
    (call_expression
      function: (identifier) @fastapi.middleware_func))) @definition.fastapi_middleware

; FastAPI Exception Handlers
(decorated_definition
  (decorator
    (call_expression
      function: (member_expression
        object: (identifier) @fastapi.app_exception
        property: (property_identifier) @fastapi.exception_method
        (#eq? @fastapi.exception_method "exception_handler"))
      arguments: (arguments
        (identifier) @fastapi.exception_class))) @definition.fastapi_exception_handler

; FastAPI CORS
(call_expression
  function: (identifier) @fastapi.cors
  (#eq? @fastapi.cors "CORSMiddleware")) @definition.fastapi_cors

; Pydantic BaseModel Classes
(class_definition
  name: (identifier) @pydantic.model_name
  superclass: (argument_list
    (type (identifier) @pydantic.basemodel
      (#eq? @pydantic.basemodel "BaseModel")))) @definition.pydantic_model

; Pydantic Field Definitions
(expression_statement
  (assignment
    left: (identifier) @pydantic.field_name
    right: (call_expression
      function: (identifier) @pydantic.field_func
      (#eq? @pydantic.field_func "Field")
      arguments: (arguments
        [(string)? @pydantic.field_description
         (keyword_argument
           name: (identifier) @pydantic.field_kw_name
           value: (_) @pydantic.field_kw_value)]*)))) @definition.pydantic_field

; Pydantic Validators
(decorated_definition
  (decorator
    (call_expression
      function: (identifier) @pydantic.validator_func
      (#eq? @pydantic.validator_func "validator")
      arguments: (arguments
        (string) @pydantic.validator_field))) @definition.pydantic_validator

; Pydantic Config Classes
(class_definition
  name: (identifier) @pydantic.config_name
  superclass: (argument_list
    (type (identifier) @pydantic.config_class
      (#match? @pydantic.config_class "^(BaseSettings|SettingsConfigDict)$")))) @definition.pydantic_config
; Django View Detection
; Function-based views
(function_definition
  name: (identifier) @django.view_name
  parameters: (parameters
    (typed_parameter
      name: (identifier) @django.request_param
      type: (type) @django.request_type)))
  @definition.django_function_view

; Class-based views
(class_definition
  name: (identifier) @django.view_class_name
  superclass: (argument_list
    (type (identifier) @django.base_view_class
      (#match? @django.base_view_class "^(View|TemplateView|ListView|DetailView|CreateView|UpdateView|DeleteView|FormView|RedirectView)$"))))
  @definition.django_class_view

; Template response detection
(call_expression
  function: (identifier) @django.render_func
  (#match? @django.render_func "^(render|render_to_response)$")
  arguments: (arguments
    (string) @django.template_path)) @definition.django_render

; JSON response detection
(call_expression
  function: (identifier) @django.json_response_func
  (#match? @django.json_response_func "^(JsonResponse|HttpResponse)$")
  arguments: (arguments
    (_))) @definition.django_json_response

; Form handling
(member_expression
  object: (identifier) @django.request_obj
  property: (property_identifier) @django.request_property
  (#match? @django.request_property "^(POST|GET|FILES|COOKIES)$")) @definition.django_form_handling

; Authentication decorators
(decorator
  (call_expression
    function: (identifier) @django.auth_decorator
    (#match? @django.auth_decorator "^(login_required|permission_required|user_passes_test)$"))) @definition.django_auth_decorator

; Django Model Detection
; Model class inheritance
(class_definition
  name: (identifier) @django.model_name
  superclass: (argument_list
    (type (identifier) @django.base_model
      (#eq? @django.base_model "Model")))) @definition.django_model

; Field definitions
(expression_statement
  (assignment
    left: (identifier) @django.field_name
    right: (call_expression
      function: (identifier) @django.field_type
      (#match? @django.field_type "^(CharField|IntegerField|TextField|BooleanField|DateField|DateTimeField|EmailField|URLField|SlugField|FileField|ImageField|ForeignKey|ManyToManyField|OneToOneField)$")))) @definition.django_field

; Foreign key relationships
(call_expression
  function: (identifier) @django.foreign_key
  (#eq? @django.foreign_key "ForeignKey")
  arguments: (arguments
    (identifier) @django.related_model)) @definition.django_foreign_key

; Many-to-many relationships
(call_expression
  function: (identifier) @django.many_to_many
  (#eq? @django.many_to_many "ManyToManyField")
  arguments: (arguments
    (identifier) @django.related_model)) @definition.django_many_to_many

; Model methods
(function_definition
  name: (identifier) @django.method_name
  (#match? @django.method_name "^(save|delete|get_absolute_url|clean)$")) @definition.django_model_method

; Django URL/Route Detection
; path() function patterns
(call_expression
  function: (identifier) @django.url_func
  (#match? @django.url_func "^(path|re_path)$")
  arguments: (arguments
    (string) @django.url_path
    (identifier) @django.view_function)) @definition.django_url_pattern

; urlpatterns lists
(assignment
  left: (identifier) @django.urlpatterns_name
  (#eq? @django.urlpatterns_name "urlpatterns")
  right: (list) @django.urlpatterns_list) @definition.django_urlpatterns

; URL parameter extraction
(string) @django.url_param
(#match? @django.url_param "<[a-zA-Z_:]+>")

; Flask View Detection
; Route decorators
(decorated_definition
  (decorator
    (call_expression
      function: (identifier) @flask.route_decorator
      (#eq? @flask.route_decorator "route")
      arguments: (arguments
        (string) @flask.route_path))) @definition.flask_route)

; Template rendering
(call_expression
  function: (identifier) @flask.render_func
  (#eq? @flask.render_func "render_template")
  arguments: (arguments
    (string) @flask.template_path)) @definition.flask_render

; JSON responses
(call_expression
  function: (identifier) @flask.jsonify_func
  (#eq? @flask.jsonify_func "jsonify")
  arguments: (arguments
    (_))) @definition.flask_json_response

; Request object access
(member_expression
  object: (identifier) @flask.request_obj
  property: (property_identifier) @flask.request_property
  (#match? @flask.request_property "^(form|args|json|files|cookies)$")) @definition.flask_request_access

; Django ORM Patterns
; QuerySet operations
(call_expression
  function: (member_expression
    property: (property_identifier) @django.orm_method
    (#match? @django.orm_method "^(filter|get|all|exclude|order_by|values|values_list|count|first|last|create|update|delete)$"))) @definition.django_orm_operation

; Model manager access
(member_expression
  object: (identifier) @django.model_name
  property: (property_identifier) @django.manager
  (#eq? @django.manager "objects")) @definition.django_model_manager

; Database migrations detection
(call_expression
  function: (identifier) @django.migration_command
  (#match? @django.migration_command "^(migrate|makemigrations|sqlmigrate)$")) @definition.django_migration
; ===== TESTING FRAMEWORK PATTERNS FOR PYTHON =====

; Pytest - Test function patterns
(function_definition
  name: (identifier) @pytest.test_name
  (#match? @pytest.test_name "^test_.*$")) @definition.pytest_test

; Pytest - Test class patterns
(class_definition
  name: (identifier) @pytest.class_name
  (#match? @pytest.class_name "^Test.*$")) @definition.pytest_test_class

; Pytest - Test method patterns
(class_definition
  name: (identifier) @pytest.test_class_name
  (#match? @pytest.test_class_name "^Test.*$")
  body: (block
    (function_definition
      name: (identifier) @pytest.test_method_name
      (#match? @pytest.test_method_name "^test_.*$")))) @definition.pytest_test_method

; Pytest - Fixture patterns
(decorated_definition
  (decorator
    (call_expression
      function: (identifier) @pytest.fixture_decorator
      (#eq? @pytest.fixture_decorator "pytest.fixture")))
  definition: (function_definition
    name: (identifier) @pytest.fixture_name)) @definition.pytest_fixture

; Pytest - Parametrized tests
(decorated_definition
  (decorator
    (call_expression
      function: (identifier) @pytest.parametrize_decorator
      (#eq? @pytest.parametrize_decorator "pytest.mark.parametrize")
      arguments: (arguments
        (string) @pytest.parametrize_args
        (list) @pytest.parametrize_values)))
  definition: (function_definition
    name: (identifier) @pytest.parametrize_test_name
    (#match? @pytest.parametrize_test_name "^test_.*$"))) @definition.pytest_parametrized_test

; Pytest - Skip and xfail markers
(decorated_definition
  (decorator
    (call_expression
      function: (member_expression
        object: (identifier) @pytest.mark_obj
        (#eq? @pytest.mark_obj "pytest")
        property: (property_identifier) @pytest.mark_method
        (#match? @pytest.mark_method "^(skip|skipif|xfail|slow|integration|unit)$"))))
  definition: (function_definition
    name: (identifier) @pytest.marked_test_name
    (#match? @pytest.marked_test_name "^test_.*$"))) @definition.pytest_marked_test

; Pytest - Raises context manager
(with_statement
  (with_clause
    (with_item
      expression: (call_expression
        function: (identifier) @pytest.raises_func
        (#eq? @pytest.raises_func "pytest.raises")
        arguments: (arguments
          (identifier) @pytest.raises_exception))))) @definition.pytest_raises

; Pytest - Capsys and capfd fixtures
(function_definition
  parameters: (parameters
    (typed_parameter
      name: (identifier) @pytest.fixture_param
      (#match? @pytest.fixture_param "^(capsys|capfd|tmp_path|monkeypatch)$"))))
  name: (identifier) @pytest.fixture_test_name
  (#match? @pytest.fixture_test_name "^test_.*$")) @definition.pytest_fixture_test

; Pytest - Assert patterns
(expression_statement
  (call_expression
    function: (identifier) @pytest.assert_func
    (#match? @pytest.assert_func "^(assert|assertEqual|assertTrue|assertFalse|assertIn|assertNotIn|assertRaises|assertIsInstance|assertIsNone|assertIsNotNone)$"))) @definition.pytest_assert

; Pytest - Import patterns
(import_statement
  name: (dotted_name) @pytest.import_name
  (#match? @pytest.import_name "^(pytest|unittest|mock)$")) @definition.pytest_import

(import_from_statement
  module_name: (dotted_name) @pytest.import_module
  name: (dotted_name) @pytest.import_name
  (#match? @pytest.import_module "^(pytest|unittest|mock)$")) @definition.pytest_from_import

; unittest - TestCase class patterns
(class_definition
  name: (identifier) @unittest.class_name
  superclass: (argument_list
    (type
      (identifier) @unittest.base_class
      (#eq? @unittest.base_class "TestCase")))) @definition.unittest_testcase

; unittest - Test method patterns
(class_definition
  name: (identifier) @unittest.test_class_name
  superclass: (argument_list
    (type
      (identifier) @unittest.base_class
      (#eq? @unittest.base_class "TestCase")))
  body: (block
    (function_definition
      name: (identifier) @unittest.test_method_name
      (#match? @unittest.test_method_name "^test_.*$")))) @definition.unittest_test_method

; unittest - setUp and tearDown methods
(class_definition
  name: (identifier) @unittest.setup_class_name
  superclass: (argument_list
    (type
      (identifier) @unittest.base_class
      (#eq? @unittest.base_class "TestCase")))
  body: (block
    (function_definition
      name: (identifier) @unittest.setup_method_name
      (#match? @unittest.setup_method_name "^(setUp|tearDown|setUpClass|tearDownClass)$")))) @definition.unittest_setup_method

; unittest - Assert methods
(call_expression
  function: (member_expression
    object: (identifier) @unittest.assert_obj
    (#eq? @unittest.assert_obj "self")
    property: (property_identifier) @unittest.assert_method
    (#match? @unittest.assert_method "^(assertEqual|assertNotEqual|assertTrue|assertFalse|assertIn|assertNotIn|assertRaises|assertIsInstance|assertIsNone|assertIsNotNone|assertAlmostEqual|assertNotAlmostEqual|assertGreater|assertLess|assertGreaterEqual|assertLessEqual|assertRegex|assertNotRegex|assertCountEqual|assertMultiLineEqual|assertSequenceEqual|assertSetEqual|assertDictEqual|assertListEqual|assertTupleEqual)$"))) @definition.unittest_assert

; unittest - Mock patterns
(call_expression
  function: (identifier) @unittest.mock_func
  (#match? @unittest.mock_func "^(Mock|MagicMock|patch|MockOpen|sentinel)$"))
  arguments: (arguments)?) @definition.unittest_mock

; unittest - Patch decorators
(decorated_definition
  (decorator
    (call_expression
      function: (identifier) @unittest.patch_func
      (#match? @unittest.patch_func "^(patch|patch\\.object)$")
      arguments: (arguments
        (string) @unittest.patch_target)))
  definition: (function_definition
    name: (identifier) @unittest.patched_test_name
    (#match? @unittest.patched_test_name "^test_.*$"))) @definition.unittest_patched_test

; unittest - Test suite creation
(call_expression
  function: (identifier) @unittest.suite_func
  (#eq? @unittest.suite_func "TestSuite")
  arguments: (arguments)?) @definition.unittest_test_suite

; unittest - Test runner patterns
(call_expression
  function: (identifier) @unittest.runner_func
  (#match? @unittest.runner_func "^(main|makeSuite|TextTestRunner)$"))
  arguments: (arguments)?) @definition.unittest_test_runner

; unittest - Test discovery patterns
(expression_statement
  (call_expression
    function: (member_expression
      object: (identifier) @unittest.discovery_obj
      (#eq? @unittest.discovery_obj "unittest")
      property: (property_identifier) @unittest.discovery_method
      (#match? @unittest.discovery_method "^(main|findTests|TestLoader)$")))) @definition.unittest_test_discovery

; Mock patterns - General mock usage
(call_expression
  function: (identifier) @mock.func
  (#match? @mock.func "^(Mock|MagicMock|NonCallableMock|PropertyMock|MockSideEffect|MockReturnValue)$"))
  arguments: (arguments)?) @definition.mock_creation

; Mock - patch patterns
(call_expression
  function: (identifier) @mock.patch_func
  (#match? @mock.patch_func "^(patch|patch\\.object)$")
  arguments: (arguments
    (string) @mock.patch_target
    (identifier)? @mock.patch_new
    (identifier)? @mock.patch_autospec)) @definition.mock_patch

; Mock - Mock assertions
(call_expression
  function: (member_expression
    object: (identifier) @mock.assert_obj
    property: (property_identifier) @mock.assert_method
    (#match? @mock.assert_method "^(assert_called_with|assert_called_once_with|assert_any_call|assert_has_calls|assert_not_called|assert_called|assert_called_once)$"))
  arguments: (arguments)?) @definition.mock_assertion

; Test configuration patterns
(assignment
  left: (identifier) @test.config_name
  (#match? @test.config_name "^(pytest_config|test_config|conftest)$")
  right: (_)) @definition.test_configuration

; Test data and fixtures
(call_expression
  function: (identifier) @test.data_func
  (#match? @test.data_func "^(fixture|param|idata|fixture_id)$"))
  arguments: (arguments)?) @definition.test_data

; Test environment detection
(call_expression
  function: (member_expression
    object: (identifier) @test.env_obj
    property: (property_identifier) @test.env_prop
    (#match? @test.env_prop "^(env|getenv|environ)$"))) @definition.test_environment

; Async test patterns (pytest-asyncio)
(function_definition
  name: (identifier) @async_test.name
  (#match? @async_test.name "^test_.*$")
  async: "async") @definition.async_test

(decorated_definition
  (decorator
    (call_expression
      function: (identifier) @async_test.decorator
      (#match? @async_test.decorator "^(pytest\\.mark\\.asyncio|asyncio_test)$")))
  definition: (function_definition
    name: (identifier) @async_test.decorated_name
    (#match? @async_test.decorated_name "^test_.*$"))) @definition.async_decorated_test

; ===== PYTHON BUILD TOOL CONFIGURATION PATTERNS =====

; Poetry configuration (pyproject.toml in Python context)
(call_expression
  function: (identifier) @poetry.function
  (#match? @poetry.function "^(poetry|Poetry)$")
  arguments: (arguments
    (keyword_argument
      name: (identifier) @poetry.kwarg
      (#match? @poetry.kwarg "^(name|version|description|authors|maintainers|license|readme|homepage|repository|documentation|keywords|classifiers|packages|include|exclude)$")
      value: (_) @poetry.value))) @definition.poetry_config

; Poetry dependency management
(call_expression
  function: (member_expression
    object: (identifier) @poetry.object
    (#eq? @poetry.object "poetry")
    property: (property_identifier) @poetry.method
    (#match? @poetry.method "^(add|remove|update|install|build|publish|show|config|run|shell|env|version|self)$"))
  arguments: (arguments
    (_) @poetry.argument*)) @definition.poetry_command

; Poetry pyproject.toml configuration
(call_expression
  function: (identifier) @pyproject.function
  (#eq? @pyproject.function "Poetry")
  arguments: (arguments
    (keyword_argument
      name: (identifier) @pyproject.kwarg
      (#match? @pyproject.kwarg "^(name|version|description|authors|maintainers|license|readme|homepage|repository|documentation|keywords|classifiers|packages|include|exclude|dependencies|dev-dependencies|group|source|extras|scripts|build-system|requires|build-backend)$")
      value: (_) @pyproject.value))) @definition.pyproject_config

; Setuptools configuration
(call_expression
  function: (identifier) @setuptools.function
  (#match? @setuptools.function "^(setup|setuptools)$")
  arguments: (arguments
    (keyword_argument
      name: (identifier) @setuptools.kwarg
      (#match? @setuptools.kwarg "^(name|version|author|author_email|maintainer|maintainer_email|url|license|description|long_description|long_description_content_type|url|project_urls|classifiers|keywords|platforms|requires_python|python_requires|install_requires|extras_require|entry_points|console_scripts|gui_scripts|packages|py_modules|include_package_data|package_data|exclude_package_data|data_files|package_dir|zip_safe|obsoletes|provides|requires)$")
      value: (_) @setuptools.value))) @definition.setuptools_config

; Setuptools extension modules
(call_expression
  function: (identifier) @setuptools.extension.function
  (#match? @setuptools.extension.function "^(Extension|setup_extension)$")
  arguments: (arguments
    (keyword_argument
      name: (identifier) @setuptools.extension.kwarg
      (#match? @setuptools.extension.kwarg "^(name|sources|include_dirs|libraries|library_dirs|runtime_library_dirs|extra_compile_args|extra_link_args|export_symbols|swig_opts|depends|language|optional|define_macros|undef_macros)$")
      value: (_) @setuptools.extension.value))) @definition.setuptools_extension

; Pip requirements parsing
(call_expression
  function: (identifier) @pip.function
  (#match? @pip.function "^(pip|install|uninstall|freeze|list|show|check|config|search|wheel|hash|completion|debug|download|cache)$"))
  arguments: (arguments
    (_) @pip.argument*)) @definition.pip_command

; Pip requirements.txt parsing
(expression_statement
  (string) @pip.requirement
  (#match? @pip.requirement "^[a-zA-Z0-9\\-_\\.]+[><=!~]*[0-9\\._a-zA-Z-]*$")) @definition.pip_requirement

; Pip requirements with extras
(expression_statement
  (string) @pip.requirement.extras
  (#match? @pip.requirement.extras "^[a-zA-Z0-9\\-_\\.]+\\[[a-zA-Z0-9\\-_\\s,]+\\][><=!~]*[0-9\\._a-zA-Z-]*$")) @definition.pip_requirement_extras

; Pip requirements with Git
(expression_statement
  (string) @pip.requirement.git
  (#match? @pip.requirement.git "^(git\\+|hg\\+|svn\\+|bzr\\+).*#egg=[a-zA-Z0-9\\-_\\.]+$")) @definition.pip_requirement_git

; Pip requirements with URLs
(expression_statement
  (string) @pip.requirement.url
  (#match? @pip.requirement.url "^(http|https|ftp)://.*")) @definition.pip_requirement_url

; Pip requirements with local paths
(expression_statement
  (string) @pip.requirement.local
  (#match? @pip.requirement.local "^[/\\.]|^[a-zA-Z]:[/\\]")) @definition.pip_requirement_local

; Pip requirements with environment markers
(expression_statement
  (string) @pip.requirement.env
  (#match? @pip.requirement.env ".*;\\s*[a-zA-Z0-9\\-_]+\\s*[><=!~]*\\s*[\"']?[a-zA-Z0-9\\._-]+[\"']?")) @definition.pip_requirement_env

; Virtual environment creation
(call_expression
  function: (identifier) @venv.function
  (#match? @venv.function "^(venv|virtualenv|conda)$"))
  arguments: (arguments
    (keyword_argument
      name: (identifier) @venv.kwarg
      (#match? @venv.kwarg "^(name|python|system_site_packages|clear|symlinks|copies|prompt|upgrade|with_pip)$")
      value: (_) @venv.value))) @definition.virtualenv_config

; Build system configuration (PEP 517/518)
(call_expression
  function: (identifier) @buildsys.function
  (#match? @buildsys.function "^(build|build_backend|get_requires_for_build_wheel|get_requires_for_build_sdist|build_wheel|build_sdist|prepare_metadata_for_build_wheel)$"))
  arguments: (arguments
    (keyword_argument
      name: (identifier) @buildsys.kwarg
      (#match? @buildsys.kwarg "^(wheel_directory|config_settings|metadata_directory|emulated_requirements|build_requires)$")
      value: (_) @buildsys.value))) @definition.build_system_config

; Hatch build system
(call_expression
  function: (identifier) @hatch.function
  (#match? @hatch.function "^(hatch|build|version|env|project|metadata)$"))
  arguments: (arguments
    (keyword_argument
      name: (identifier) @hatch.kwarg
      (#match? @hatch.kwarg "^(name|version|description|authors|maintainers|license|readme|homepage|repository|documentation|keywords|classifiers|dependencies|dev-dependencies|optional-dependencies|build-backend|requires|build-system|project|build|env|metadata|version|scripts|source|packages|include|exclude)$")
      value: (_) @hatch.value))) @definition.hatch_config

; PDM build system
(call_expression
  function: (identifier) @pdm.function
  (#match? @pdm.function "^(pdm|build|add|remove|update|install|list|show|lock|sync|run|venv|config|init|import|export)$"))
  arguments: (arguments
    (keyword_argument
      name: (identifier) @pdm.kwarg
      (#match? @pdm.kwarg "^(name|version|description|authors|maintainers|license|readme|homepage|repository|documentation|keywords|classifiers|dependencies|dev-dependencies|optional-dependencies|build-backend|requires|build-system|project|build|source|packages|include|exclude|group)$")
      value: (_) @pdm.value))) @definition.pdm_config

; Flit build system
(call_expression
  function: (identifier) @flit.function
  (#match? @flit.function "^(flit|build|publish|install|init)$"))
  arguments: (arguments
    (keyword_argument
      name: (identifier) @flit.kwarg
      (#match? @flit.kwarg "^(name|version|description|author|author_email|maintainer|maintainer_email|url|license|requires_python|requires_dist|provides_extra|requires_external|home_page|download_url|project_urls|classifiers|keywords|platforms|requires_python|requires_dist|provides_extra|requires_external|home_page|download_url|project_urls|classifiers|keywords|platforms)$")
      value: (_) @flit.value))) @definition.flit_config

; Build tool imports
(import_statement
  name: (dotted_name) @build.import.name
  (#match? @build.import.name "^(setuptools|distutils|poetry|pip|venv|virtualenv|conda|build|wheel|packaging|pyproject|toml|cfg|configparser|argparse|json|yaml|xml|subprocess|os|sys|pathlib|shutil|tempfile|glob|fnmatch|re|datetime|time|hashlib|uuid|base64|urllib|http|ftplib|smtplib|poplib|imaplib|telnetlib|socket|ssl|asyncio|concurrent|threading|multiprocessing|queue|logging|unittest|pytest|doctest|coverage|tox|nox|invoke|fabric|paramiko)$"))) @definition.build_tool_import

; Build tool from imports
(import_from_statement
  module_name: (dotted_name) @build.from.module
  (#match? @build.from.module "^(setuptools|distutils|poetry|pip|venv|virtualenv|conda|build|wheel|packaging|pyproject|toml|cfg|configparser|argparse|json|yaml|xml|subprocess|os|sys|pathlib|shutil|tempfile|glob|fnmatch|re|datetime|time|hashlib|uuid|base64|urllib|http|ftplib|smtplib|poplib|imaplib|telnetlib|socket|ssl|asyncio|concurrent|threading|multiprocessing|queue|logging|unittest|pytest|doctest|coverage|tox|nox|invoke|fabric|paramiko)$"))
  name: (dotted_name) @build.from.name
  (#match? @build.from.name "^(setup|Extension|find_packages|Distribution|Command|install|build|sdist|bdist_wheel|bdist_egg|bdist_wininst|bdist_msi|bdist_rpm|bdist_deb|bdist_dumb|check|clean|test|upload|register|upload_docs|build_sphinx|build_ext|build_py|build_clib|build_scripts|install_lib|install_headers|install_scripts|install_data|egg_info|develop|bdist_egg|bdist_wheel|bdist_wininst|bdist_msi|bdist_rpm|bdist_deb|bdist_dumb|check|clean|test|upload|register|upload_docs|build_sphinx|build_ext|build_py|build_clib|build_scripts|install_lib|install_headers|install_scripts|install_data|egg_info|develop)$"))) @definition.build_tool_from_import

; Build tool configuration files
(call_expression
  function: (identifier) @config.function
  (#match? @config.function "^(config|configure|setup_config)$")) @definition.config_file
`
