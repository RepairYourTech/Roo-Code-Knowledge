# Tree-sitter Query Validation Report

## Summary

| Language   | Status  | Test Files    | Parse Time (ms) | Query Time (ms) |
| ---------- | ------- | ------------- | --------------- | --------------- |
| typescript | ✅ PASS | 2 (2 failing) | 11.25           | 5.66            |
| javascript | ✅ PASS | 1 (1 failing) | 3.04            | 0.22            |
| python     | ❌ FAIL | 0 (0 failing) | 0.00            | 0.00            |
| rust       | ✅ PASS | 1 (1 failing) | 2.14            | 0.69            |
| java       | ✅ PASS | 1 (1 failing) | 1.45            | 1.30            |
| go         | ✅ PASS | 1 (1 failing) | 2.52            | 2.03            |
| cpp        | ✅ PASS | 1 (1 failing) | 26.52           | 0.13            |

## TYPESCRIPT

**Status:** ✅ PASS

### Performance Summary

- **Total Parse Time:** 11.25 ms
- **Total Query Time:** 5.66 ms
- **Average Parse Time per File:** 5.62 ms
- **Average Query Time per File:** 2.83 ms

### ❌ Failing Test Cases

#### basic.ts

- **Captures Found:** 42
- **Missing Patterns:**
    - `name.definition.module`
    - `definition.module`
    - `definition.arrow_function`
    - `name.definition.export`
    - `definition.export`
    - `test.func_name`
    - `test.description`
    - `test.callback`
    - `definition.test_suite`
    - `test.nested_func`
    - `test.nested_description`
    - `test.nested_callback`
    - `definition.nested_test_suite`
    - `test.hook_func`
    - `test.hook_callback`
    - `definition.test_hook`
    - `test.expect_func`
    - `test.expect_value`
    - `definition.test_expect`
    - `test.mock_func`
    - `definition.test_mock`
    - `test.mock_obj`
    - `test.mock_method`
    - `definition.test_mock_method`
    - `jest.import`
    - `source`
    - `definition.jest_import`
    - `vitest.import`
    - `definition.vitest_import`
    - `vitest.global.import`
    - `definition.vitest_global_import`
    - `chai.import`
    - `definition.chai_import`
    - `sinon.import`
    - `definition.sinon_import`
    - `test.exports_obj`
    - `test.exports_prop`
    - `test.exports_func`
    - `definition.commonjs_test_export`
    - `test.file_func`
    - `definition.test_file_indicator`
    - `test.async_func`
    - `test.async_description`
    - `test.async_callback`
    - `definition.async_test`
    - `test.promise_func`
    - `test.promise_description`
    - `test.done_param`
    - `definition.promise_test`
    - `test.timeout_obj`
    - `test.timeout_method`
    - `test.timeout_value`
    - `definition.test_timeout`
    - `test.skip_obj`
    - `test.skip_method`
    - `test.skip_description`
    - `test.skip_callback`
    - `definition.test_modifier`
    - `test.env_obj`
    - `test.env_prop`
    - `definition.test_environment`
    - `test.config_name`
    - `test.config_value`
    - `definition.test_config`
    - `test.custom_matcher_obj`
    - `test.custom_matcher`
    - `test.custom_matcher_value`
    - `definition.custom_matcher`
    - `test.util_func`
    - `definition.test_utility`
    - `definition.switch`
    - `definition.case`
    - `definition.default`
    - `name.definition.enum`
    - `definition.enum`
    - `name.definition.decorator`
    - `name.definition.decorated_class`
    - `definition.decorated_class`
    - `name.definition.namespace`
    - `definition.namespace`
    - `name.definition.async_arrow`
    - `definition.async_arrow`
    - `react.hook.name`
    - `definition.react_hook`
    - `react.custom_hook.name`
    - `definition.react_custom_hook`
    - `react.props.name`
    - `definition.react_props`
    - `react.component_type.name`
    - `definition.react_component_type`
    - `angular.import`
    - `definition.angular_import`
    - `tsconfig.export.name`
    - `tsconfig.export.type`
    - `definition.tsconfig_export`
    - `tsconfig.interface.name`
    - `definition.tsconfig_interface`
    - `tsconfig.type.name`
    - `definition.tsconfig_type`
    - `webpack.ts.export.name`
    - `webpack.ts.export.type`
    - `definition.webpack_ts_config`
    - `webpack.ts.interface.name`
    - `definition.webpack_ts_interface`
    - `vite.ts.export.name`
    - `vite.ts.export.type`
    - `definition.vite_ts_config`
    - `vite.ts.interface.name`
    - `definition.vite_ts_interface`
    - `rollup.ts.export.name`
    - `rollup.ts.export.type`
    - `definition.rollup_ts_config`
    - `rollup.ts.interface.name`
    - `definition.rollup_ts_interface`
    - `babel.ts.export.name`
    - `babel.ts.export.type`
    - `definition.babel_ts_config`
    - `babel.ts.interface.name`
    - `definition.babel_ts_interface`
    - `eslint.ts.export.name`
    - `eslint.ts.export.type`
    - `definition.eslint_ts_config`
    - `eslint.ts.interface.name`
    - `definition.eslint_ts_interface`
    - `jest.ts.export.name`
    - `jest.ts.export.type`
    - `definition.jest_ts_config`
    - `jest.ts.interface.name`
    - `definition.jest_ts_interface`
    - `postcss.ts.export.name`
    - `postcss.ts.export.type`
    - `definition.postcss_ts_config`
    - `postcss.ts.interface.name`
    - `definition.postcss_ts_interface`
    - `tailwind.ts.export.name`
    - `tailwind.ts.export.type`
    - `definition.tailwind_ts_config`
    - `tailwind.ts.interface.name`
    - `definition.tailwind_ts_interface`
    - `build.ts.import.name`
    - `build.ts.import.source`
    - `definition.build_tool_type_import`
    - `build.ts.plugin.object`
    - `build.ts.plugin.method`
    - `build.ts.plugin.config`
    - `definition.build_tool_plugin_config`
    - `build.ts.env.object`
    - `build.ts.env.property`
    - `build.ts.env.key`
    - `definition.build_ts_environment_variable`
    - `build.ts.path.object`
    - `build.ts.path.method`
    - `build.ts.path.argument`
    - `definition.build_ts_path_resolution`
    - `build.ts.fs.object`
    - `build.ts.fs.method`
    - `build.ts.fs.argument`
    - `definition.build_ts_fs_operation`
    - `build.ts.config.name`
    - `build.ts.config.type`
    - `build.ts.config.value`
    - `definition.build_ts_config_object`
    - `angular.decorator.component`
    - `component.config.key`
    - `component.config.value`
    - `definition.angular_component_decorator`
    - `angular.decorator.injectable`
    - `injectable.config.key`
    - `injectable.config.value`
    - `definition.angular_injectable_decorator`
    - `angular.decorator.ngmodule`
    - `ngmodule.config.key`
    - `ngmodule.config.value`
    - `definition.angular_ngmodule_decorator`
    - `angular.lifecycle.hook`
    - `definition.angular_lifecycle_hook`
    - `angular.constructor.name`
    - `angular.inject.param.name`
    - `angular.inject.param.type`
    - `definition.angular_constructor_injection`
    - `angular.routes.name`
    - `angular.route.config.key`
    - `angular.route.config.value`
    - `definition.angular_routes_config`
    - `angular.router.object`
    - `angular.router.method`
    - `definition.angular_router_method`
    - `angular.activatedRoute.object`
    - `angular.activatedRoute.property`
    - `definition.angular_activatedRoute_usage`
    - `angular.http.object`
    - `angular.http.method`
    - `definition.angular_http_method`
    - `angular.eventemitter.object`
    - `angular.eventemitter.method`
    - `definition.angular_eventemitter_usage`
    - `angular.form.builder`
    - `definition.angular_reactive_forms`
    - `angular.rxjs.observable`
    - `angular.rxjs.operator`
    - `definition.angular_rxjs_operator`
    - `angular.async.object`
    - `angular.async.property`
    - `definition.angular_async_usage`
    - `express.app.function`
    - `definition.express_app`
    - `express.app.object`
    - `express.route.method`
    - `express.route.path`
    - `express.route.handler`
    - `definition.express_route`
    - `express.router.object`
    - `definition.express_router_route`
    - `express.middleware.method`
    - `express.middleware.path`
    - `express.middleware.handler`
    - `definition.express_middleware`
    - `definition.express_router_middleware`
    - `express.server.object`
    - `express.server.method`
    - `express.server.port`
    - `express.server.callback`
    - `definition.express_server`
    - `express.chain.object`
    - `express.chain.method`
    - `express.chain.next`
    - `definition.express_route_chain`
    - `express.router.function`
    - `definition.express_router_creation`
    - `express.static.object`
    - `express.static.method`
    - `express.static.path`
    - `definition.express_static`
    - `express.export.name`
    - `definition.express_route_export`
    - `nextjs.prop_func`
    - `express.middleware.export.name`
    - `express.middleware.req`
    - `express.middleware.res`
    - `express.middleware.next`
    - `definition.express_middleware_export`
    - `express.params.object`
    - `express.params.property`
    - `definition.express_route_params`
    - `express.query.object`
    - `express.query.property`
    - `definition.express_route_query`
    - `express.response.object`
    - `express.response.method`
    - `definition.express_response`
    - `express.request.object`
    - `express.request.property`
    - `definition.express_request`
    - `express.cors.function`
    - `definition.express_cors`
    - `express.bodyparser.function`
    - `definition.express_body_parser`
    - `express.auth.object`
    - `express.auth.method`
    - `definition.express_auth`
    - `express.env.object`
    - `express.env.property`
    - `definition.express_env`
- **Node Types Found:** program, comment, interface_declaration, interface, type_identifier, interface_body, {, property_signature, property_identifier, type_annotation...

#### react.tsx

- **Captures Found:** 19
- **Missing Patterns:**
    - `name.definition.function`
    - `definition.function`
    - `name.definition.method`
    - `definition.method`
    - `name.definition.class`
    - `definition.class`
    - `name.definition.module`
    - `definition.module`
    - `definition.arrow_function`
    - `name.definition.type`
    - `definition.type`
    - `test.func_name`
    - `test.description`
    - `test.callback`
    - `definition.test_suite`
    - `test.nested_func`
    - `test.nested_description`
    - `test.nested_callback`
    - `definition.nested_test_suite`
    - `test.hook_func`
    - `test.hook_callback`
    - `definition.test_hook`
    - `test.expect_func`
    - `test.expect_value`
    - `definition.test_expect`
    - `test.mock_func`
    - `definition.test_mock`
    - `test.mock_obj`
    - `test.mock_method`
    - `definition.test_mock_method`
    - `jest.import`
    - `source`
    - `definition.jest_import`
    - `vitest.import`
    - `definition.vitest_import`
    - `vitest.global.import`
    - `definition.vitest_global_import`
    - `chai.import`
    - `definition.chai_import`
    - `sinon.import`
    - `definition.sinon_import`
    - `test.exports_obj`
    - `test.exports_prop`
    - `test.exports_func`
    - `definition.commonjs_test_export`
    - `test.file_func`
    - `definition.test_file_indicator`
    - `test.async_func`
    - `test.async_description`
    - `test.async_callback`
    - `definition.async_test`
    - `test.promise_func`
    - `test.promise_description`
    - `test.done_param`
    - `definition.promise_test`
    - `test.timeout_obj`
    - `test.timeout_method`
    - `test.timeout_value`
    - `definition.test_timeout`
    - `test.skip_obj`
    - `test.skip_method`
    - `test.skip_description`
    - `test.skip_callback`
    - `definition.test_modifier`
    - `test.env_obj`
    - `test.env_prop`
    - `definition.test_environment`
    - `test.config_name`
    - `test.config_value`
    - `definition.test_config`
    - `test.custom_matcher_obj`
    - `test.custom_matcher`
    - `test.custom_matcher_value`
    - `definition.custom_matcher`
    - `test.util_func`
    - `definition.test_utility`
    - `definition.switch`
    - `definition.case`
    - `definition.default`
    - `name.definition.enum`
    - `definition.enum`
    - `name.definition.decorator`
    - `name.definition.decorated_class`
    - `definition.decorated_class`
    - `name.definition.namespace`
    - `definition.namespace`
    - `name.definition.utility_type`
    - `definition.utility_type`
    - `name.definition.property`
    - `definition.property`
    - `name.definition.constructor`
    - `definition.constructor`
    - `name.definition.accessor`
    - `definition.accessor`
    - `name.definition.async_function`
    - `definition.async_function`
    - `name.definition.async_arrow`
    - `definition.async_arrow`
    - `react.custom_hook.name`
    - `definition.react_custom_hook`
    - `react.component_type.name`
    - `definition.react_component_type`
    - `angular.import`
    - `definition.angular_import`
    - `tsconfig.export.name`
    - `tsconfig.export.type`
    - `definition.tsconfig_export`
    - `tsconfig.interface.name`
    - `definition.tsconfig_interface`
    - `tsconfig.type.name`
    - `definition.tsconfig_type`
    - `webpack.ts.export.name`
    - `webpack.ts.export.type`
    - `definition.webpack_ts_config`
    - `webpack.ts.interface.name`
    - `definition.webpack_ts_interface`
    - `vite.ts.export.name`
    - `vite.ts.export.type`
    - `definition.vite_ts_config`
    - `vite.ts.interface.name`
    - `definition.vite_ts_interface`
    - `rollup.ts.export.name`
    - `rollup.ts.export.type`
    - `definition.rollup_ts_config`
    - `rollup.ts.interface.name`
    - `definition.rollup_ts_interface`
    - `babel.ts.export.name`
    - `babel.ts.export.type`
    - `definition.babel_ts_config`
    - `babel.ts.interface.name`
    - `definition.babel_ts_interface`
    - `eslint.ts.export.name`
    - `eslint.ts.export.type`
    - `definition.eslint_ts_config`
    - `eslint.ts.interface.name`
    - `definition.eslint_ts_interface`
    - `jest.ts.export.name`
    - `jest.ts.export.type`
    - `definition.jest_ts_config`
    - `jest.ts.interface.name`
    - `definition.jest_ts_interface`
    - `postcss.ts.export.name`
    - `postcss.ts.export.type`
    - `definition.postcss_ts_config`
    - `postcss.ts.interface.name`
    - `definition.postcss_ts_interface`
    - `tailwind.ts.export.name`
    - `tailwind.ts.export.type`
    - `definition.tailwind_ts_config`
    - `tailwind.ts.interface.name`
    - `definition.tailwind_ts_interface`
    - `build.ts.import.name`
    - `build.ts.import.source`
    - `definition.build_tool_type_import`
    - `build.ts.plugin.object`
    - `build.ts.plugin.method`
    - `build.ts.plugin.config`
    - `definition.build_tool_plugin_config`
    - `build.ts.env.object`
    - `build.ts.env.property`
    - `build.ts.env.key`
    - `definition.build_ts_environment_variable`
    - `build.ts.path.object`
    - `build.ts.path.method`
    - `build.ts.path.argument`
    - `definition.build_ts_path_resolution`
    - `build.ts.fs.object`
    - `build.ts.fs.method`
    - `build.ts.fs.argument`
    - `definition.build_ts_fs_operation`
    - `build.ts.config.name`
    - `build.ts.config.type`
    - `build.ts.config.value`
    - `definition.build_ts_config_object`
    - `angular.decorator.component`
    - `component.config.key`
    - `component.config.value`
    - `definition.angular_component_decorator`
    - `angular.decorator.injectable`
    - `injectable.config.key`
    - `injectable.config.value`
    - `definition.angular_injectable_decorator`
    - `angular.decorator.ngmodule`
    - `ngmodule.config.key`
    - `ngmodule.config.value`
    - `definition.angular_ngmodule_decorator`
    - `angular.lifecycle.hook`
    - `definition.angular_lifecycle_hook`
    - `angular.constructor.name`
    - `angular.inject.param.name`
    - `angular.inject.param.type`
    - `definition.angular_constructor_injection`
    - `angular.routes.name`
    - `angular.route.config.key`
    - `angular.route.config.value`
    - `definition.angular_routes_config`
    - `angular.router.object`
    - `angular.router.method`
    - `definition.angular_router_method`
    - `angular.activatedRoute.object`
    - `angular.activatedRoute.property`
    - `definition.angular_activatedRoute_usage`
    - `angular.http.object`
    - `angular.http.method`
    - `definition.angular_http_method`
    - `angular.eventemitter.object`
    - `angular.eventemitter.method`
    - `definition.angular_eventemitter_usage`
    - `angular.form.builder`
    - `definition.angular_reactive_forms`
    - `angular.rxjs.observable`
    - `angular.rxjs.operator`
    - `definition.angular_rxjs_operator`
    - `angular.async.object`
    - `angular.async.property`
    - `definition.angular_async_usage`
    - `express.app.function`
    - `definition.express_app`
    - `express.app.object`
    - `express.route.method`
    - `express.route.path`
    - `express.route.handler`
    - `definition.express_route`
    - `express.router.object`
    - `definition.express_router_route`
    - `express.middleware.method`
    - `express.middleware.path`
    - `express.middleware.handler`
    - `definition.express_middleware`
    - `definition.express_router_middleware`
    - `express.server.object`
    - `express.server.method`
    - `express.server.port`
    - `express.server.callback`
    - `definition.express_server`
    - `express.chain.object`
    - `express.chain.method`
    - `express.chain.next`
    - `definition.express_route_chain`
    - `express.router.function`
    - `definition.express_router_creation`
    - `express.static.object`
    - `express.static.method`
    - `express.static.path`
    - `definition.express_static`
    - `express.export.name`
    - `definition.express_route_export`
    - `nextjs.prop_func`
    - `express.middleware.export.name`
    - `express.middleware.req`
    - `express.middleware.res`
    - `express.middleware.next`
    - `definition.express_middleware_export`
    - `express.params.object`
    - `express.params.property`
    - `definition.express_route_params`
    - `express.query.object`
    - `express.query.property`
    - `definition.express_route_query`
    - `express.response.object`
    - `express.response.method`
    - `definition.express_response`
    - `express.request.object`
    - `express.request.property`
    - `definition.express_request`
    - `express.cors.function`
    - `definition.express_cors`
    - `express.bodyparser.function`
    - `definition.express_body_parser`
    - `express.auth.object`
    - `express.auth.method`
    - `definition.express_auth`
    - `express.env.object`
    - `express.env.property`
    - `definition.express_env`
- **Node Types Found:** program, import_statement, import, import_clause, identifier, ,, named_imports, {, import_specifier, }...

### All Test Cases Summary

| Test File | Status  | Captures | Missing Patterns                                                         |
| --------- | ------- | -------- | ------------------------------------------------------------------------ |
| basic.ts  | ❌ FAIL | 42       | name.definition.module, definition.module, definition.arrow_function...  |
| react.tsx | ❌ FAIL | 19       | name.definition.function, definition.function, name.definition.method... |

---

## JAVASCRIPT

**Status:** ✅ PASS

### Performance Summary

- **Total Parse Time:** 3.04 ms
- **Total Query Time:** 0.22 ms
- **Average Parse Time per File:** 3.04 ms
- **Average Query Time per File:** 0.22 ms

### ❌ Failing Test Cases

#### basic.js

- **Captures Found:** 19
- **Missing Patterns:**
    - `property.name.definition`
    - `object.value`
    - `array.value`
    - `string.value`
    - `number.value`
    - `boolean.value`
    - `null.value`
    - `property.definition`
    - `array.definition`
    - `decorator_name`
    - `test.func_name`
    - `test.suite_name`
    - `test.suite_body`
    - `definition.test_suite`
    - `test.nested_func`
    - `test.nested_name`
    - `test.nested_body`
    - `definition.nested_test_suite`
    - `test.hook_func`
    - `test.hook_body`
    - `definition.test_hook`
    - `test.case_func`
    - `test.case_name`
    - `test.case_body`
    - `definition.test_case`
    - `test.expect_obj`
    - `test.matcher`
    - `test.matcher_value`
    - `definition.test_matcher`
    - `test.mock_obj`
    - `test.mock_func`
    - `definition.test_mock`
    - `test.mock_method`
    - `definition.test_mock_method`
    - `test.mock_impl_obj`
    - `test.mock_impl_method`
    - `test.mock_impl_ret`
    - `test.mock_impl_value`
    - `definition.test_mock_implementation`
    - `jest.require.name`
    - `jest.require.func`
    - `jest.require.source`
    - `definition.jest_require`
    - `jest.import.source`
    - `definition.jest_import`
    - `test.file_name`
    - `definition.test_file_import`
    - `test.spec_file_name`
    - `definition.test_spec_file_import`
    - `test.util_obj`
    - `test.util_method`
    - `definition.test_utility`
    - `test.spy_obj`
    - `test.spy_method`
    - `definition.test_spy`
    - `test.async_obj`
    - `test.async_method`
    - `definition.test_async`
    - `test.promise_func`
    - `test.promise_value`
    - `test.promise_method`
    - `test.promise_matcher`
    - `definition.test_promise_assertion`
    - `express.app.name`
    - `express.app.func`
    - `definition.express_app`
    - `express.app.object`
    - `express.route.method`
    - `express.route.path`
    - `express.route.handler`
    - `definition.express_route`
    - `express.middleware.method`
    - `express.middleware.path`
    - `express.middleware.handler`
    - `definition.express_middleware`
    - `express.chain.object`
    - `express.chain.method`
    - `express.chain.next`
    - `definition.express_route_chain`
    - `express.error.method`
    - `express.error.handler`
    - `definition.express_error_handler`
    - `express.router.function`
    - `definition.express_router_creation`
    - `express.static.object`
    - `express.static.method`
    - `express.static.path`
    - `definition.express_static`
    - `express.export.name`
    - `definition.express_route_export`
    - `express.middleware.export.name`
    - `express.middleware.req`
    - `express.middleware.res`
    - `express.middleware.next`
    - `definition.express_middleware_export`
    - `express.params.object`
    - `express.params.property`
    - `definition.express_route_params`
    - `express.query.object`
    - `express.query.property`
    - `definition.express_route_query`
    - `express.response.object`
    - `express.response.method`
    - `definition.express_response`
    - `express.request.object`
    - `express.request.property`
    - `definition.express_request`
    - `express.cors.function`
    - `definition.express_cors`
    - `express.bodyparser.function`
    - `definition.express_body_parser`
    - `express.auth.object`
    - `express.auth.method`
    - `definition.express_auth`
    - `express.env.object`
    - `express.env.property`
    - `definition.express_environment`
    - `npm.config.name`
    - `npm.config.value`
    - `definition.npm_config`
    - `webpack.config.name`
    - `webpack.config.object`
    - `definition.webpack_config_object`
    - `webpack.key`
    - `webpack.value`
    - `definition.webpack_properties`
    - `webpack.module.key`
    - `webpack.rules.key`
    - `webpack.rule.object`
    - `definition.webpack_module_rules`
    - `webpack.rule.key`
    - `webpack.rule.value`
    - `definition.webpack_rule`
    - `vite.key`
    - `vite.value`
    - `definition.vite_properties`
    - `rollup.key`
    - `rollup.value`
    - `definition.rollup_properties`
    - `babel.key`
    - `babel.value`
    - `definition.babel_properties`
- **Node Types Found:** program, comment, function_declaration, function, identifier, formal_parameters, (, ,, ), statement_block...

### All Test Cases Summary

| Test File | Status  | Captures | Missing Patterns                                       |
| --------- | ------- | -------- | ------------------------------------------------------ |
| basic.js  | ❌ FAIL | 19       | property.name.definition, object.value, array.value... |

---

## PYTHON

**Status:** ❌ FAIL

### Performance Summary

- **Total Parse Time:** 0.00 ms
- **Total Query Time:** 0.00 ms
- **Average Parse Time per File:** NaN ms
- **Average Query Time per File:** NaN ms

### All Test Cases Summary

| Test File | Status | Captures | Missing Patterns |
| --------- | ------ | -------- | ---------------- |

---

## RUST

**Status:** ✅ PASS

### Performance Summary

- **Total Parse Time:** 2.14 ms
- **Total Query Time:** 0.69 ms
- **Average Parse Time per File:** 2.14 ms
- **Average Query Time per File:** 0.69 ms

### ❌ Failing Test Cases

#### basic.rs

- **Captures Found:** 31
- **Missing Patterns:**
    - `name.definition.enum`
    - `definition.enum`
    - `name.definition.impl_trait`
    - `name.definition.impl_for`
    - `definition.impl_trait`
    - `name.definition.macro`
    - `definition.macro`
    - `name.definition.type_alias`
    - `definition.type_alias`
    - `name.definition.constant`
    - `definition.constant`
    - `name.definition.static`
    - `definition.static`
    - `punctuation.lifetime`
    - `name.definition.lifetime`
    - `definition.lifetime`
    - `definition.where_clause`
    - `match.value`
    - `definition.match`
    - `definition.unsafe_block`
    - `rust.custom_assert`
    - `definition.rust_custom_assertion`
    - `rust.result_func`
    - `rust.result_args`
    - `definition.rust_test_result`
    - `rust.std_test_crate`
    - `rust.std_test_module`
    - `definition.rust_std_test_import`
    - `rust.mock_struct_name`
    - `definition.rust_mock_struct`
    - `rust.mock_impl_type`
    - `rust.mock_method_name`
    - `definition.rust_mock_implementation`
    - `rust.fixture_func_name`
    - `definition.rust_test_fixture`
    - `rust.test_data_name`
    - `definition.rust_test_data`
    - `rust.test_const_name`
    - `rust.test_const_value`
    - `definition.rust_test_constant`
    - `rust.test_trait_name`
    - `rust.test_impl_type`
    - `rust.test_trait_method`
    - `definition.rust_test_trait_impl`
    - `rust.error_macro`
    - `rust.error_args`
    - `definition.rust_error_handling`
- **Node Types Found:** source_file, struct_item, struct, type_identifier, field_declaration_list, {, field_declaration, field_identifier, :, primitive_type...

### All Test Cases Summary

| Test File | Status  | Captures | Missing Patterns                                                     |
| --------- | ------- | -------- | -------------------------------------------------------------------- |
| basic.rs  | ❌ FAIL | 31       | name.definition.enum, definition.enum, name.definition.impl_trait... |

---

## JAVA

**Status:** ✅ PASS

### Performance Summary

- **Total Parse Time:** 1.45 ms
- **Total Query Time:** 1.30 ms
- **Average Parse Time per File:** 1.45 ms
- **Average Query Time per File:** 1.30 ms

### ❌ Failing Test Cases

#### UserManager.java

- **Captures Found:** 18
- **Missing Patterns:**
    - `name.definition.module`
    - `definition.module`
    - `definition.comment`
    - `name.definition.interface`
    - `definition.interface`
    - `name.definition.enum`
    - `definition.enum`
    - `name.definition.record`
    - `definition.record`
    - `name.definition.annotation`
    - `definition.annotation`
    - `name.definition.inner_class`
    - `definition.inner_class`
    - `name.definition.static_nested_class`
    - `definition.static_nested_class`
    - `definition.lambda`
    - `name.definition.type_parameter`
    - `definition.type_parameter`
    - `junit.assertion_method`
    - `definition.junit_assertion`
    - `junit.assumption_method`
    - `definition.junit_assumption`
    - `mockito.mock_method`
    - `definition.mockito_mock_method`
    - `mockito.verify_method`
    - `mockito.verify_target`
    - `mockito.verify_mode`
    - `mockito.verify_times`
    - `definition.mockito_verification`
    - `hamcrest.matcher_method`
    - `definition.hamcrest_matcher`
    - `assertj.assert_method`
    - `definition.assertj_assertion`
    - `assertj.fluent_method`
    - `definition.assertj_fluent_assertion`
    - `junit.import_name`
    - `definition.junit_import`
    - `testng.import_name`
    - `definition.testng_import`
    - `mockito.import_name`
    - `definition.mockito_import`
    - `hamcrest.import_name`
    - `definition.hamcrest_import`
    - `assertj.import_name`
    - `definition.assertj_import`
    - `test.config_class_name`
    - `definition.test_configuration_class`
    - `test.data_class_name`
    - `definition.test_data_class`
    - `test.util_class_name`
    - `definition.test_utility_class`
- **Node Types Found:** program, package_declaration, package, scoped_identifier, identifier, ., ;, import_declaration, import, class_declaration...

### All Test Cases Summary

| Test File        | Status  | Captures | Missing Patterns                                                 |
| ---------------- | ------- | -------- | ---------------------------------------------------------------- |
| UserManager.java | ❌ FAIL | 18       | name.definition.module, definition.module, definition.comment... |

---

## GO

**Status:** ✅ PASS

### Performance Summary

- **Total Parse Time:** 2.52 ms
- **Total Query Time:** 2.03 ms
- **Average Parse Time per File:** 2.52 ms
- **Average Query Time per File:** 2.03 ms

### ❌ Failing Test Cases

#### basic.go

- **Captures Found:** 13
- **Missing Patterns:**
    - `name.definition.var`
    - `name.definition.const`
    - `go.test_func_name`
    - `go.test_param`
    - `go.test_package`
    - `go.test_type`
    - `definition.go_test_function`
    - `go.benchmark_func_name`
    - `go.benchmark_param`
    - `go.benchmark_package`
    - `go.benchmark_type`
    - `definition.go_benchmark_function`
    - `go.example_func_name`
    - `definition.go_example_function`
    - `go.fuzz_func_name`
    - `go.fuzz_param`
    - `go.fuzz_package`
    - `go.fuzz_type`
    - `definition.go_fuzz_function`
    - `go.test_helper_name`
    - `definition.go_test_helper`
    - `go.test_main_name`
    - `go.test_main_param`
    - `go.test_main_package`
    - `go.test_main_type`
    - `definition.go_test_main`
    - `go.testing_import_path`
    - `definition.go_testing_import`
    - `go.test_import_path`
    - `definition.go_testing_subpackage_import`
    - `go.test_obj`
    - `go.test_method`
    - `definition.go_test_method`
    - `go.tb_obj`
    - `go.tb_method`
    - `definition.go_testing_interface_method`
    - `go.subtest_obj`
    - `go.subtest_method`
    - `go.subtest_name`
    - `go.subtest_func`
    - `definition.go_subtest`
    - `go.mock_func_name`
    - `definition.go_mock_function`
    - `go.mock_struct_name`
    - `definition.go_mock_struct`
    - `go.interface_name`
    - `go.interface_def`
    - `definition.go_test_interface`
    - `go.test_data_name`
    - `definition.go_test_data_struct`
    - `go.test_const_name`
    - `go.test_const_value`
    - `definition.go_test_constant`
    - `go.test_var_name`
    - `go.test_var_value`
    - `definition.go_test_variable`
    - `go.assert_obj`
    - `go.assert_method`
    - `definition.go_assertion`
    - `go.testify_pkg`
    - `go.testify_method`
    - `go.testify_param`
    - `definition.go_testify`
    - `go.testify_mock_obj`
    - `go.testify_mock_method`
    - `definition.go_testify_mock`
    - `go.ginkgo_func`
    - `go.ginkgo_description`
    - `go.ginkgo_func_body`
    - `definition.go_ginkgo_test`
    - `go.gomega_func`
    - `go.gomega_actual`
    - `go.gomega_matcher_obj`
    - `go.gomega_matcher`
    - `definition.go_gomega_assertion`
    - `go.test_config_name`
    - `definition.go_test_configuration`
    - `go.env_obj`
    - `go.env_method`
    - `definition.go_test_environment`
- **Node Types Found:** source_file, package_clause, package, package_identifier,
  , import_declaration, import, import_spec, interpreted_string_literal, "...

### All Test Cases Summary

| Test File | Status  | Captures | Missing Patterns                                                 |
| --------- | ------- | -------- | ---------------------------------------------------------------- |
| basic.go  | ❌ FAIL | 13       | name.definition.var, name.definition.const, go.test_func_name... |

---

## CPP

**Status:** ✅ PASS

### Performance Summary

- **Total Parse Time:** 26.52 ms
- **Total Query Time:** 0.13 ms
- **Average Parse Time per File:** 26.52 ms
- **Average Query Time per File:** 0.13 ms

### ❌ Failing Test Cases

#### basic.cpp

- **Captures Found:** 18
- **Missing Patterns:**
    - `name.definition.type`
    - `definition.type`
    - `name.definition.enum`
    - `definition.enum`
    - `name.definition.namespace`
    - `definition.namespace`
    - `name.definition.template.class`
    - `definition.template`
    - `name.definition.macro`
    - `definition.macro`
    - `name.definition.destructor`
    - `definition.destructor`
    - `name.definition.operator`
    - `definition.operator`
    - `definition.friend`
    - `definition.using`
- **Node Types Found:** translation_unit, preproc_include, #include, system_lib_string, class_specifier, class, type_identifier, field_declaration_list, {, access_specifier...

### All Test Cases Summary

| Test File | Status  | Captures | Missing Patterns                                               |
| --------- | ------- | -------- | -------------------------------------------------------------- |
| basic.cpp | ❌ FAIL | 18       | name.definition.type, definition.type, name.definition.enum... |

---
