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
(call
  function: (identifier) @fastapi.app
  (#eq? @fastapi.app "FastAPI")) @definition.fastapi_app

; FastAPI Route Decorators
;       arguments: (argument_list
;         (string) @fastapi.path))) @definition.fastapi_route

; FastAPI Router Creation
(call
  function: (identifier) @fastapi.router
  (#eq? @fastapi.router "APIRouter")) @definition.fastapi_router

; FastAPI Dependencies
(call
  function: (identifier) @fastapi.depends
  (#eq? @fastapi.depends "Depends")
  arguments: (argument_list
    [(identifier) @fastapi.dependency
     (call) @fastapi.dependency
     (attribute) @fastapi.dependency])) @definition.fastapi_dependency

; FastAPI Annotated Dependencies
; Commented out due to syntax issues

; FastAPI Path and Query Parameters
; Commented out due to syntax issues

; FastAPI Response Model
; FastAPI Response Model
(call
  function: (attribute
    object: (identifier) @fastapi.app_or_router_resp
    attribute: (identifier) @fastapi.method_resp
    (#match? @fastapi.method_resp "^(get|post|put|delete|patch|head|options|trace)$"))
  arguments: (argument_list
    (string) @fastapi.path_resp
    (keyword_argument
      name: (identifier) @fastapi.response_model_kw
      (#eq? @fastapi.response_model_kw "response_model")
      value: (_) @fastapi.response_model))) @definition.fastapi_response_model

; FastAPI Middleware
;(call
;  function: (attribute
;    object: (identifier) @fastapi.app_middleware
;    attribute: (identifier) @fastapi.middleware_method
;    (#eq? @fastapi.middleware_method "middleware"))
;  arguments: (argument_list
;    (string) @fastapi.middleware_name
;    (call
;      function: (identifier) @fastapi.middleware_func))) @definition.fastapi_middleware

; FastAPI Exception Handlers
; FastAPI Exception Handlers
(decorated_definition
  (decorator
    (call
      function: (attribute
        object: (identifier) @fastapi.app_exception
        attribute: (identifier) @fastapi.exception_method
        (#eq? @fastapi.exception_method "exception_handler"))
      arguments: (argument_list
        (identifier) @fastapi.exception_class)))
  definition: (function_definition
    name: (identifier) @fastapi.handler)) @definition.fastapi_exception_handler

; FastAPI CORS
(call
  function: (identifier) @fastapi.cors
  (#eq? @fastapi.cors "CORSMiddleware")) @definition.fastapi_cors

; Pydantic BaseModel Classes
(class_definition
  name: (identifier) @pydantic.model_name
  superclasses: (argument_list
    (identifier) @pydantic.basemodel
    (#eq? @pydantic.basemodel "BaseModel"))) @definition.pydantic_model

; Pydantic Field Definitions
(expression_statement
  (assignment
    left: (identifier) @pydantic.field_name
    right: (call
      function: (identifier) @pydantic.field_func
      (#eq? @pydantic.field_func "Field")
      arguments: (argument_list
        [(string)? @pydantic.field_description
         (keyword_argument
           name: (identifier) @pydantic.field_kw_name
           value: (_) @pydantic.field_kw_value)]*)))) @definition.pydantic_field

; Pydantic Validators
(decorated_definition
  (decorator
    (call
      function: (identifier) @pydantic.validator_func
      (#eq? @pydantic.validator_func "validator")
      arguments: (argument_list
        (string) @pydantic.validator_field)))
  definition: (function_definition
    name: (identifier) @pydantic.validator_name)) @definition.pydantic_validator

; Pydantic Config Classes
(class_definition
  name: (identifier) @pydantic.config_name
  superclasses: (argument_list
    (identifier) @pydantic.config_class
    (#match? @pydantic.config_class "^(BaseSettings|SettingsConfigDict)$"))) @definition.pydantic_config
; Commented out to isolate error
; Django View Detection
; Function-based views
; (function_definition
;   name: (identifier) @django.view_name
;   parameters: (parameters
;     (typed_parameter
;       name: (identifier) @django.request_param
;       type: (type) @django.request_type)))
;   @definition.django_function_view

; Class-based views
; (class_definition
;   name: (identifier) @django.view_name
;   superclasses: (argument_list
;     (identifier) @django.view_class
;     (#match? @django.view_class "^(View|TemplateView|ListView|DetailView|CreateView|UpdateView|DeleteView|FormView|RedirectView)$"))) @definition.django_class_view

; Template response detection
; (call
;   function: (identifier) @django.render_func
;   (#eq? @django.render_func "render")
;   arguments: (argument_list
;     (identifier) @django.request_arg
;     (string) @django.template_name)) @definition.django_render

; JSON response detection
; (call
;   function: (identifier) @django.json_response
;   (#eq? @django.json_response "JsonResponse")
;   arguments: (argument_list
;     (_))) @definition.django_json_response

; Form handling
; (class_definition
;   name: (identifier) @django.form_name
;   superclasses: (argument_list
;     (identifier) @django.form_class
;     (#match? @django.form_class "^(Form|ModelForm)$"))) @definition.django_form

; (call
;   function: (attribute
;     object: (identifier) @django.form_obj
;     attribute: (identifier) @django.form_method
;     (#match? @django.form_method "^(is_valid|save|clean)$"))) @definition.django_form_method

; Django Model Detection
; Model class inheritance
; (class_definition
;   name: (identifier) @django.model_name
;   superclasses: (argument_list
;     (identifier) @django.base_model
;     (#eq? @django.base_model "Model"))) @definition.django_model

; Field definitions
; (expression_statement
;   (assignment
;     left: (identifier) @django.field_name
;     right: (call
;       function: (identifier) @django.field_type
;       (#match? @django.field_type "^(CharField|IntegerField|TextField|BooleanField|DateField|DateTimeField|EmailField|URLField|SlugField|FileField|ImageField|ForeignKey|ManyToManyField|OneToOneField)$")))) @definition.django_field

; Foreign key relationships
; (call
;   function: (identifier) @django.foreign_key
;   (#eq? @django.foreign_key "ForeignKey")
;   arguments: (argument_list
;     (identifier) @django.related_model)) @definition.django_foreign_key

; Many-to-many relationships
; (call
;   function: (identifier) @django.many_to_many
;   (#eq? @django.many_to_many "ManyToManyField")
;   arguments: (argument_list
;     (identifier) @django.related_model)) @definition.django_many_to_many

; Model methods
; (function_definition
;   name: (identifier) @django.method_name
;   parameters: (parameters
;     (identifier) @django.self_param
;     (#eq? @django.self_param "self"))) @definition.django_model_method

; Django URL/Route Detection
; path() function patterns
; (call
;   function: (identifier) @django.path_func
;   (#match? @django.path_func "^(path|re_path)$")
;   arguments: (argument_list
;     (string) @django.url_pattern
;     (identifier) @django.view_func)) @definition.django_url_pattern

; urlpatterns lists
; (assignment
;   left: (identifier) @django.urlpatterns
;   (#eq? @django.urlpatterns "urlpatterns")
;   right: (list)) @definition.django_urlpatterns

; URL parameter extraction
; (call
;   function: (identifier) @django.path_func
;   (#match? @django.path_func "^(path|re_path)$")
;   arguments: (argument_list
;     (string) @django.url_pattern
;     (#match? @django.url_pattern "<.*>"))) @definition.django_url_param

; Flask View Detection
; Route decorators
; (decorated_definition
;   (decorator
;     (call
;       function: (attribute
;         object: (identifier) @flask.app_obj
;         attribute: (identifier) @flask.route_method
;         (#eq? @flask.route_method "route"))
;       arguments: (argument_list
;         (string) @flask.route_path)))
;   definition: (function_definition
;     name: (identifier) @flask.view_name)) @definition.flask_view

; Template rendering
; (call
;   function: (identifier) @flask.render_func
;   (#eq? @flask.render_func "render_template")
;   arguments: (argument_list
;     (string) @flask.template_path)) @definition.flask_render

; JSON responses
; (call
;   function: (identifier) @flask.jsonify_func
;   (#eq? @flask.jsonify_func "jsonify")
;   arguments: (argument_list
;     (_))) @definition.flask_json_response

; Request object access
; (attribute
;   object: (identifier) @flask.request_obj
;   attribute: (identifier) @flask.request_property
;   (#match? @flask.request_property "^(form|args|json|files|cookies)$")) @definition.flask_request_access

; Commented out to isolate error
; Django ORM Patterns
; QuerySet operations
; (call
;   function: (attribute
;     object: (identifier) @django.queryset
;     attribute: (identifier) @django.queryset_method
;     (#match? @django.queryset_method "^(filter|exclude|annotate|order_by|reverse|distinct|values|values_list|dates|datetimes|none|all|union|intersection|difference|select_related|prefetch_related|defer|only|using|select_for_update|raw|get|create|get_or_create|update_or_create|bulk_create|bulk_update|count|in_bulk|iterator|latest|earliest|first|last|aggregate|exists|update|delete|as_manager|explain)$"))) @definition.django_queryset

; Model manager access
; (attribute
;   object: (identifier) @django.model_name
;   attribute: (identifier) @django.manager
;   (#eq? @django.manager "objects")) @definition.django_model_manager

; Commented out due to syntax issues
; ===== TESTING FRAMEWORK PATTERNS FOR PYTHON =====

; Pytest - Test function patterns
; (function_definition
;   name: (identifier) @pytest.test_function_name
;   (#match? @pytest.test_function_name "^test_.*$")) @definition.pytest_test_function

; Pytest - Test class patterns
; (class_definition
;   name: (identifier) @pytest.class_name
;   (#match? @pytest.class_name "^Test.*$")) @definition.pytest_test_class

; Pytest - Test method patterns
; (class_definition
;   name: (identifier) @pytest.test_class_name
;   (#match? @pytest.test_class_name "^Test.*$")
;   body: (block
;     (function_definition
;       name: (identifier) @pytest.test_method_name
;       (#match? @pytest.test_method_name "^test_.*$")))) @definition.pytest_test_method

; Pytest - Fixture patterns
; Pytest - Fixture patterns
; (decorated_definition
;   (decorator
;     (call
;       function: (identifier) @pytest.fixture_decorator
;       (#eq? @pytest.fixture_decorator "pytest.fixture")))
;   definition: (function_definition
;     name: (identifier) @pytest.fixture_name)) @definition.pytest_fixture

; Pytest - Parametrized tests
; (decorated_definition
;   (decorator
;     (call
;       function: (identifier) @pytest.parametrize_decorator
;       (#eq? @pytest.parametrize_decorator "pytest.mark.parametrize")
;       arguments: (argument_list
;         (string) @pytest.parametrize_args
;         (list) @pytest.parametrize_values)))
;   definition: (function_definition
;     name: (identifier) @pytest.parametrize_test_name
;     (#match? @pytest.parametrize_test_name "^test_.*$"))) @definition.pytest_parametrized_test

; Pytest - Import patterns
; (import_statement
;   name: (dotted_name) @pytest.import_name
;   (#match? @pytest.import_name "^(pytest|unittest|mock)$")) @definition.pytest_import

; (import_from_statement
;   module_name: (dotted_name) @pytest.import_module
;   name: (dotted_name) @pytest.import_name
;   (#match? @pytest.import_module "^(pytest|unittest|mock)$")) @definition.pytest_from_import

; unittest - TestCase class patterns
; (class_definition
;   name: (identifier) @unittest.class_name
;   superclasses: (argument_list
;     (type
;       (identifier) @unittest.base_class
;       (#eq? @unittest.base_class "TestCase")))) @definition.unittest_testcase

; unittest - Test method patterns
; (class_definition
;   name: (identifier) @unittest.test_class_name
;   superclasses: (argument_list
;     (type
;       (identifier) @unittest.base_class
;       (#eq? @unittest.base_class "TestCase")))
;   body: (block
;     (function_definition
;       name: (identifier) @unittest.test_method_name
;       (#match? @unittest.test_method_name "^test_.*$")))) @definition.unittest_test_method

; unittest - setUp and tearDown methods
; (class_definition
;   name: (identifier) @unittest.setup_class_name
;   superclasses: (argument_list
;     (type
;       (identifier) @unittest.base_class
;       (#eq? @unittest.base_class "TestCase")))
;   body: (block
;     (function_definition
;       name: (identifier) @unittest.setup_method_name
;       (#match? @unittest.setup_method_name "^(setUp|tearDown|setUpClass|tearDownClass)$")))) @definition.unittest_setup_method

; unittest - Assert methods
; (call
;   function: (attribute
;     object: (identifier) @unittest.assert_obj
;     (#eq? @unittest.assert_obj "self")
;     attribute: (identifier) @unittest.assert_method
;     (#match? @unittest.assert_method "^(assertEqual|assertNotEqual|assertTrue|assertFalse|assertIn|assertNotIn|assertRaises|assertIsInstance|assertIsNone|assertIsNotNone|assertAlmostEqual|assertNotAlmostEqual|assertGreater|assertLess|assertGreaterEqual|assertLessEqual|assertRegex|assertNotRegex|assertCountEqual|assertMultiLineEqual|assertSequenceEqual|assertSetEqual|assertDictEqual|assertListEqual|assertTupleEqual)$"))) @definition.unittest_assert

; unittest - Mock patterns
; (call
;   function: (identifier) @unittest.mock_func
;   (#match? @unittest.mock_func "^(Mock|MagicMock|patch|MockOpen|sentinel)$")
;   arguments: (argument_list)?) @definition.unittest_mock

; unittest - Patch decorators
; (decorated_definition
;   (decorator
;     (call
;       function: (identifier) @unittest.patch_func
;       (#match? @unittest.patch_func "^(patch|patch\\.object)$")
;       arguments: (argument_list
;         (string) @unittest.patch_target)))
;   definition: (function_definition
;     name: (identifier) @unittest.patched_test_name
;     (#match? @unittest.patched_test_name "^test_.*$"))) @definition.unittest_patched_test

; unittest - Test suite creation
; (call
;   function: (identifier) @unittest.suite_func
;   (#eq? @unittest.suite_func "TestSuite")
;   arguments: (argument_list)?) @definition.unittest_test_suite

; unittest - Test runner patterns
; (call
;   function: (identifier) @unittest.runner_func
;   (#match? @unittest.runner_func "^(main|makeSuite|TextTestRunner)$")
;   arguments: (argument_list)?) @definition.unittest_test_runner

; unittest - Test discovery patterns
; (expression_statement
;   (call
;     function: (attribute
;       object: (identifier) @unittest.discovery_obj
;       (#eq? @unittest.discovery_obj "unittest")
;       attribute: (identifier) @unittest.discovery_method
;       (#match? @unittest.discovery_method "^(main|findTests|TestLoader)$")))) @definition.unittest_test_discovery

; Mock patterns - General mock usage
; (call
;   function: (identifier) @mock.func
;   (#match? @mock.func "^(Mock|MagicMock|NonCallableMock|PropertyMock|MockSideEffect|MockReturnValue)$")
;   arguments: (argument_list)?) @definition.mock_creation

; Mock - patch patterns
; (call
;   function: (identifier) @mock.patch_func
;   (#match? @mock.patch_func "^(patch|patch\\.object)$")
;   arguments: (argument_list
;     (string) @mock.patch_target
;     (identifier)? @mock.patch_new
;     (identifier)? @mock.patch_autospec)) @definition.mock_patch

; Mock - Mock assertions
; (call
;   function: (attribute
;     object: (identifier) @mock.assert_obj
;     attribute: (identifier) @mock.assert_method
;     (#match? @mock.assert_method "^(assert_called_with|assert_called_once_with|assert_any_call|assert_has_calls|assert_not_called|assert_called|assert_called_once)$"))
;   arguments: (argument_list)?) @definition.mock_assertion

; Test configuration patterns
; (assignment
;   left: (identifier) @test.config_name
;   (#match? @test.config_name "^(pytest_config|test_config|conftest)$")
;   right: (_)) @definition.test_configuration

; Test data and fixtures
; (call
;   function: (identifier) @test.data_func
;   (#match? @test.data_func "^(fixture|param|idata|fixture_id)$")
;   arguments: (argument_list)?) @definition.test_data

; Test environment detection
; (call
;   function: (attribute
;     object: (identifier) @test.env_obj
;     attribute: (identifier) @test.env_prop
;     (#match? @test.env_prop "^(env|getenv|environ)$"))) @definition.test_environment

; Async test patterns (pytest-asyncio)
; (function_definition
;   name: (identifier) @async_test.name
;   (#match? @async_test.name "^test_.*$")) @definition.async_test

; (decorated_definition
;   (decorator
;     (call
;       function: (identifier) @async_test.decorator
;       (#match? @async_test.decorator "^(pytest\\.mark\\.asyncio|asyncio_test)$")))
;   definition: (function_definition
;     name: (identifier) @async_test.decorated_name
;     (#match? @async_test.decorated_name "^test_.*$"))) @definition.async_decorated_test

; ===== PYTHON BUILD TOOL CONFIGURATION PATTERNS =====

; Poetry configuration (pyproject.toml in Python context)
; (call
;   function: (identifier) @poetry.function
;   (#match? @poetry.function "^(poetry|Poetry)$")
;   arguments: (argument_list
;     (keyword_argument
;       name: (identifier) @poetry.kwarg
;       (#match? @poetry.kwarg "^(name|version|description|authors|maintainers|license|readme|homepage|repository|documentation|keywords|classifiers|packages|include|exclude)$")
;       value: (_) @poetry.value))) @definition.poetry_config

; Poetry dependency management
; (call
;   function: (attribute
;     object: (identifier) @poetry.object
;     (#eq? @poetry.object "poetry")
;     attribute: (identifier) @poetry.method
;     (#match? @poetry.method "^(add|remove|update|install|build|publish|show|config|run|shell|env|version|self)$"))
;   arguments: (argument_list
;     (_) @poetry.argument*)) @definition.poetry_command

; Poetry pyproject.toml configuration
; (call
;   function: (identifier) @pyproject.function
;   (#eq? @pyproject.function "Poetry")
;   arguments: (argument_list
;     (keyword_argument
;       name: (identifier) @pyproject.kwarg
;       (#match? @pyproject.kwarg "^(name|version|description|authors|maintainers|license|readme|homepage|repository|documentation|keywords|classifiers|packages|include|exclude|dependencies|dev-dependencies|group|source|extras|scripts|build-system|requires|build-backend)$")
;       value: (_) @pyproject.value))) @definition.pyproject_config

; Setuptools configuration
; (call
;   function: (identifier) @setuptools.function
;   (#match? @setuptools.function "^(setup|setuptools)$")
;   arguments: (argument_list
;     (keyword_argument
;       name: (identifier) @setuptools.kwarg
;       (#match? @setuptools.kwarg "^(name|version|author|author_email|maintainer|maintainer_email|url|license|description|long_description|long_description_content_type|url|project_urls|classifiers|keywords|platforms|requires_python|python_requires|install_requires|extras_require|entry_points|console_scripts|gui_scripts|packages|py_modules|include_package_data|package_data|exclude_package_data|data_files|package_dir|zip_safe|obsoletes|provides|requires)$")
;       value: (_) @setuptools.value))) @definition.setuptools_config

; Setuptools extension modules
; (call
;   function: (identifier) @setuptools.extension.function
;   (#match? @setuptools.extension.function "^(Extension|setup_extension)$")
;   arguments: (argument_list
;     (keyword_argument
;       name: (identifier) @setuptools.extension.kwarg
;       (#match? @setuptools.extension.kwarg "^(name|sources|include_dirs|libraries|library_dirs|runtime_library_dirs|extra_compile_args|extra_link_args|export_symbols|swig_opts|depends|language|optional|define_macros|undef_macros)$")
;       value: (_) @setuptools.extension.value))) @definition.setuptools_extension

; Pip requirements; Commented out due to syntax issues
; (call
;   function: (identifier) @pip.function
;   (#match? @pip.function "^(pip|install|uninstall|freeze|list|show|check|config|search|wheel|hash|completion|debug|download|cache)$"))
;   arguments: (argument_list
;     (_) @pip.argument*)) @definition.pip_command

; Pip requirements.txt parsing
; (expression_statement
;   (string) @pip.requirement
;   (#match? @pip.requirement "^[a-zA-Z0-9\\-_\\.]+[><=!~]*[0-9\\._a-zA-Z-]*$")) @definition.pip_requirement

; Pip requirements with extras
; (expression_statement
;   (string) @pip.requirement.extras
;   (#match? @pip.requirement.extras "^[a-zA-Z0-9\\-_\\.]+\\[[a-zA-Z0-9\\-_\\s,]+\\][><=!~]*[0-9\\._a-zA-Z-]*$")) @definition.pip_requirement_extras

; Pip requirements with Git
; (expression_statement
;   (string) @pip.requirement.git
;   (#match? @pip.requirement.git "^(git\\+|hg\\+|svn\\+|bzr\\+).*#egg=[a-zA-Z0-9\\-_\\.]+$")) @definition.pip_requirement_git

; Pip requirements with URLs
; (expression_statement
;   (string) @pip.requirement.url
;   (#match? @pip.requirement.url "^(http|https|ftp)://.*")) @definition.pip_requirement_url

; Pip requirements with local paths
; (expression_statement
;   (string) @pip.requirement.local
;   (#match? @pip.requirement.local "^[/\\.]|^[a-zA-Z]:[/\\]")) @definition.pip_requirement_local

; Pip requirements with environment markers
; (expression_statement
;   (string) @pip.requirement.env
;   (#match? @pip.requirement.env ".*;.*")) @definition.pip_requirement_env

; Virtual environment creation
; (call
;   function: (identifier) @venv.function
;   (#match? @venv.function "^(venv|virtualenv|conda)$"))
;   arguments: (argument_list
;     (keyword_argument
;       name: (identifier) @venv.kwarg
;       (#match? @venv.kwarg "^(name|python|system_site_packages|clear|symlinks|copies|prompt|upgrade|with_pip)$")
;       value: (_) @venv.value))) ; @definition.virtualenv_config

; Build system queries commented out due to syntax issues

; Build tool imports
; (import_statement
;   name: (dotted_name
;     (identifier) @build.tool.name
;     (#match? @build.tool.name "^(setuptools|distutils|wheel|pip|hatch|pdm|flit|poetry)$"))) @definition.build_tool_import

; Build tool from imports
; (import_from_statement
;   module_name: (dotted_name) @build.from.module
;   (#match? @build.from.module "^(setuptools|distutils|poetry|pip|venv|virtualenv|conda|build|wheel|packaging|pyproject|toml|cfg|configparser|argparse|json|yaml|xml|subprocess|os|sys|pathlib|shutil|tempfile|glob|fnmatch|re|datetime|time|hashlib|uuid|base64|urllib|http|ftplib|smtplib|poplib|imaplib|telnetlib|socket|ssl|asyncio|concurrent|threading|multiprocessing|queue|logging|unittest|pytest|doctest|coverage|tox|nox|invoke|fabric|paramiko)$")
;   name: (dotted_name) @build.from.name
;   (#match? @build.from.name "^(setup|Extension|find_packages|Distribution|Command|install|build|sdist|bdist_wheel|bdist_egg|bdist_wininst|bdist_msi|bdist_rpm|bdist_deb|bdist_dumb|check|clean|test|upload|register|upload_docs|build_sphinx|build_ext|build_py|build_clib|build_scripts|install_lib|install_headers|install_scripts|install_data|egg_info|develop|bdist_egg|bdist_wheel|bdist_wininst|bdist_msi|bdist_rpm|bdist_deb|bdist_dumb|check|clean|test|upload|register|upload_docs|build_sphinx|build_ext|build_py|build_clib|build_scripts|install_lib|install_headers|install_scripts|install_data|egg_info|develop)$")) @definition.build_tool_from_import

; Build tool configuration files
; (call
;   function: (identifier) @config.function
;   (#match? @config.function "^(config|configure|setup_config)$")) @definition.config_file

(assignment
  left: (identifier) @test.config_name
  (#match? @test.config_name "^(pytest_config|test_config|conftest)$")
  right: (_)) @definition.test_configuration

; Test data and fixtures
(call
  function: (identifier) @test.data_func
  (#match? @test.data_func "^(fixture|param|idata|fixture_id)$")
  arguments: (argument_list)?) @definition.test_data

; Test environment detection
(call
  function: (attribute
    object: (identifier) @test.env_obj
    attribute: (identifier) @test.env_prop
    (#match? @test.env_prop "^(env|getenv|environ)$"))) @definition.test_environment

; Async test patterns (pytest-asyncio)
(function_definition
  name: (identifier) @async_test.name
  (#match? @async_test.name "^test_.*$")) @definition.async_test

(decorated_definition
  (decorator
    (call
      function: (identifier) @async_test.decorator
      (#match? @async_test.decorator "^(pytest\\.mark\\.asyncio|asyncio_test)$")))
  definition: (function_definition
    name: (identifier) @async_test.decorated_name
    (#match? @async_test.decorated_name "^test_.*$"))) @definition.async_decorated_test

; ===== PYTHON BUILD TOOL CONFIGURATION PATTERNS =====

; Poetry configuration (pyproject.toml in Python context)
(call
  function: (identifier) @poetry.function
  (#match? @poetry.function "^(poetry|Poetry)$")
  arguments: (argument_list
    (keyword_argument
      name: (identifier) @poetry.kwarg
      (#match? @poetry.kwarg "^(name|version|description|authors|maintainers|license|readme|homepage|repository|documentation|keywords|classifiers|packages|include|exclude)$")
      value: (_) @poetry.value))) @definition.poetry_config

; Poetry dependency management
(call
  function: (attribute
    object: (identifier) @poetry.object
    (#eq? @poetry.object "poetry")
    attribute: (identifier) @poetry.method
    (#match? @poetry.method "^(add|remove|update|install|build|publish|show|config|run|shell|env|version|self)$"))
  arguments: (argument_list
    (_) @poetry.argument*)) @definition.poetry_command

; Poetry pyproject.toml configuration
(call
  function: (identifier) @pyproject.function
  (#eq? @pyproject.function "Poetry")
  arguments: (argument_list
    (keyword_argument
      name: (identifier) @pyproject.kwarg
      (#match? @pyproject.kwarg "^(name|version|description|authors|maintainers|license|readme|homepage|repository|documentation|keywords|classifiers|packages|include|exclude|dependencies|dev-dependencies|group|source|extras|scripts|build-system|requires|build-backend)$")
      value: (_) @pyproject.value))) @definition.pyproject_config

; Setuptools configuration
(call
  function: (identifier) @setuptools.function
  (#match? @setuptools.function "^(setup|setuptools)$")
  arguments: (argument_list
    (keyword_argument
      name: (identifier) @setuptools.kwarg
      (#match? @setuptools.kwarg "^(name|version|author|author_email|maintainer|maintainer_email|url|license|description|long_description|long_description_content_type|url|project_urls|classifiers|keywords|platforms|requires_python|python_requires|install_requires|extras_require|entry_points|console_scripts|gui_scripts|packages|py_modules|include_package_data|package_data|exclude_package_data|data_files|package_dir|zip_safe|obsoletes|provides|requires)$")
      value: (_) @setuptools.value))) @definition.setuptools_config

; Setuptools extension modules
(call
  function: (identifier) @setuptools.extension.function
  (#match? @setuptools.extension.function "^(Extension|setup_extension)$")
  arguments: (argument_list
    (keyword_argument
      name: (identifier) @setuptools.extension.kwarg
      (#match? @setuptools.extension.kwarg "^(name|sources|include_dirs|libraries|library_dirs|runtime_library_dirs|extra_compile_args|extra_link_args|export_symbols|swig_opts|depends|language|optional|define_macros|undef_macros)$")
      value: (_) @setuptools.extension.value))) @definition.setuptools_extension

; Pip requirements; Commented out due to syntax issues
; (call
;   function: (identifier) @pip.function
;   (#match? @pip.function "^(pip|install|uninstall|freeze|list|show|check|config|search|wheel|hash|completion|debug|download|cache)$"))
;   arguments: (argument_list
;     (_) @pip.argument*)) @definition.pip_command

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
  (#match? @pip.requirement.env ".*;.*")) @definition.pip_requirement_env

; Virtual environment creation
; (call
;   function: (identifier) @venv.function
;   (#match? @venv.function "^(venv|virtualenv|conda)$"))
;   arguments: (argument_list
;     (keyword_argument
;       name: (identifier) @venv.kwarg
;       (#match? @venv.kwarg "^(name|python|system_site_packages|clear|symlinks|copies|prompt|upgrade|with_pip)$")
;       value: (_) @venv.value))) ; @definition.virtualenv_config

; Build system queries commented out due to syntax issues

; Build tool imports
(import_statement
  name: (dotted_name
    (identifier) @build.tool.name
    (#match? @build.tool.name "^(setuptools|distutils|wheel|pip|hatch|pdm|flit|poetry)$"))) @definition.build_tool_import

; Build tool from imports
(import_from_statement
  module_name: (dotted_name) @build.from.module
  (#match? @build.from.module "^(setuptools|distutils|poetry|pip|venv|virtualenv|conda|build|wheel|packaging|pyproject|toml|cfg|configparser|argparse|json|yaml|xml|subprocess|os|sys|pathlib|shutil|tempfile|glob|fnmatch|re|datetime|time|hashlib|uuid|base64|urllib|http|ftplib|smtplib|poplib|imaplib|telnetlib|socket|ssl|asyncio|concurrent|threading|multiprocessing|queue|logging|unittest|pytest|doctest|coverage|tox|nox|invoke|fabric|paramiko)$")
  name: (dotted_name) @build.from.name
  (#match? @build.from.name "^(setup|Extension|find_packages|Distribution|Command|install|build|sdist|bdist_wheel|bdist_egg|bdist_wininst|bdist_msi|bdist_rpm|bdist_deb|bdist_dumb|check|clean|test|upload|register|upload_docs|build_sphinx|build_ext|build_py|build_clib|build_scripts|install_lib|install_headers|install_scripts|install_data|egg_info|develop|bdist_egg|bdist_wheel|bdist_wininst|bdist_msi|bdist_rpm|bdist_deb|bdist_dumb|check|clean|test|upload|register|upload_docs|build_sphinx|build_ext|build_py|build_clib|build_scripts|install_lib|install_headers|install_scripts|install_data|egg_info|develop)$")) @definition.build_tool_from_import

; Build tool configuration files
(call
  function: (identifier) @config.function
  (#match? @config.function "^(config|configure|setup_config)$")) @definition.config_file
`
