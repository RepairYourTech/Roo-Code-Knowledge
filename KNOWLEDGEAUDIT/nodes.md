# Comprehensive Tree-sitter Node Types for Neo4j Indexing

## Universal Node Categories (All Languages)

### 1. FILE & MODULE STRUCTURE

- `source_file` / `program` / `module` - Root node
- `package_declaration` - Package/namespace declaration
- `import_statement` / `import_declaration` / `import_from_statement`
- `include_statement` / `require_statement` / `use_declaration`
- `export_statement` / `export_declaration`
- `namespace_definition` / `namespace_declaration`
- `module_definition` / `module_declaration`

### 2. CLASS & TYPE DEFINITIONS

- `class_declaration` / `class_definition`
- `interface_declaration` / `interface_definition`
- `struct_declaration` / `struct_definition`
- `enum_declaration` / `enum_definition`
- `union_declaration` / `union_definition`
- `trait_declaration` / `trait_definition`
- `protocol_declaration` / `protocol_definition`
- `type_alias` / `type_definition`
- `typedef_declaration`
- `abstract_class_declaration`
- `data_class_declaration`
- `object_declaration` (Kotlin/Scala)
- `record_declaration` (Java 14+, C#)
- `sealed_class` / `sealed_interface`

### 3. FUNCTION & METHOD DEFINITIONS

- `function_declaration` / `function_definition`
- `method_declaration` / `method_definition`
- `constructor_declaration` / `constructor_definition`
- `destructor_declaration` (C++, C#)
- `arrow_function` / `lambda_expression`
- `anonymous_function`
- `function_expression`
- `generator_function` / `async_function`
- `operator_overload` (C++, C#, Python)
- `property_declaration` / `getter` / `setter`
- `accessor_declaration`
- `static_method`
- `abstract_method`
- `virtual_method`
- `extension_function` (Kotlin, Swift)

### 4. VARIABLE & FIELD DECLARATIONS

- `variable_declaration` / `variable_declarator`
- `field_declaration` / `field_definition`
- `property_declaration`
- `constant_declaration` / `const_declaration`
- `lexical_declaration` (`let`, `const` in JS/TS)
- `parameter_declaration` / `formal_parameter`
- `variadic_parameter`
- `default_parameter`
- `named_parameter` / `keyword_argument`
- `destructuring_pattern`
- `array_pattern` / `object_pattern`
- `static_field`
- `instance_field`
- `global_variable`

### 5. TYPE ANNOTATIONS

- `type_annotation` / `type_descriptor`
- `generic_type` / `type_arguments`
- `type_parameter` / `type_parameter_declaration`
- `union_type` / `intersection_type`
- `optional_type` / `nullable_type`
- `array_type` / `list_type`
- `tuple_type`
- `function_type` / `callable_type`
- `pointer_type` / `reference_type`
- `constrained_type` / `type_constraint`
- `wildcard_type`

### 6. CONTROL FLOW

- `if_statement` / `else_clause`
- `switch_statement` / `match_statement`
- `case_statement` / `pattern_match`
- `for_statement` / `for_in_statement` / `foreach_statement`
- `while_statement` / `do_while_statement`
- `break_statement` / `continue_statement`
- `return_statement`
- `throw_statement` / `raise_statement`
- `yield_statement` / `yield_expression`
- `goto_statement` / `label_statement`
- `with_statement` (Python, JS)

### 7. ERROR HANDLING

- `try_statement` / `try_catch`
- `catch_clause` / `except_clause`
- `finally_clause`
- `throw_expression` / `raise_expression`
- `assert_statement`
- `error_declaration` (Swift, Go)
- `result_type` (Rust, Swift)
- `panic_statement` (Go, Rust)

### 8. ASYNC/CONCURRENCY

- `async_function` / `async_method`
- `await_expression`
- `promise_declaration`
- `future_declaration`
- `coroutine_declaration`
- `thread_declaration`
- `lock_statement` / `synchronized_statement`
- `channel_declaration` (Go)
- `actor_declaration` (Swift, Erlang)

### 9. DECORATORS & ANNOTATIONS

- `decorator` / `decorator_list` (Python)
- `annotation` / `annotation_list` (Java, C#)
- `attribute` / `attribute_list` (C#, Rust)
- `pragma_directive`
- `macro_invocation` / `macro_definition`
- `preprocessor_directive`

### 10. EXPRESSIONS & CALLS

- `call_expression` / `invocation_expression`
- `method_invocation`
- `assignment_expression` / `assignment_statement`
- `binary_expression` / `binary_operator`
- `unary_expression` / `unary_operator`
- `member_access_expression` / `field_access`
- `subscript_expression` / `index_expression`
- `slice_expression`
- `new_expression` / `object_creation_expression`
- `spread_element` / `splat_operator`
- `ternary_expression` / `conditional_expression`
- `pipe_expression` (Elixir, F#)
- `range_expression`

### 11. LITERALS & CONSTANTS

- `string_literal` / `template_string`
- `number_literal` / `integer_literal` / `float_literal`
- `boolean_literal` / `true` / `false`
- `null_literal` / `nil` / `none`
- `array_literal` / `list_literal`
- `object_literal` / `dictionary_literal` / `map_literal`
- `set_literal`
- `tuple_literal`
- `regex_literal` / `regexp`
- `raw_string_literal`
- `character_literal`

### 12. COMMENTS & DOCUMENTATION

- `comment` / `line_comment` / `block_comment`
- `documentation_comment` / `doc_comment`
- `jsdoc` / `javadoc`
- `rustdoc` / `xml_documentation` (C#)

---

## Language-Specific Node Types

### JAVASCRIPT/TYPESCRIPT

- `jsx_element` / `jsx_fragment` / `jsx_attribute`
- `tsx_element`
- `template_literal` / `template_substitution`
- `rest_parameter` / `spread_element`
- `sequence_expression`
- `this_expression` / `super_expression`
- `meta_property` (`new.target`, `import.meta`)
- `ambient_declaration` (TS)
- `namespace_declaration` (TS)
- `enum_declaration` (TS)
- `interface_declaration` (TS)
- `type_alias_declaration` (TS)
- `as_expression` / `type_assertion` (TS)
- `satisfies_expression` (TS)
- `import_type` (TS)

### PYTHON

- `class_definition` - with `decorator_list`
- `function_definition` - with `decorator_list`
- `async_function_definition`
- `lambda`
- `with_statement`
- `global_statement` / `nonlocal_statement`
- `match_statement` / `case_clause` (Python 3.10+)
- `type_parameter` (Python 3.12+)
- `comprehension` / `list_comprehension` / `dict_comprehension` / `set_comprehension`
- `generator_expression`
- `f_string` / `formatted_string_literal`
- `slice`
- `ellipsis` (`...`)
- `walrus_operator` / `named_expression` (`:=`)
- `positional_only_parameter` / `keyword_only_parameter`

### JAVA

- `package_declaration`
- `annotation_type_declaration`
- `annotation` / `marker_annotation`
- `modifiers` - `public`, `private`, `protected`, `static`, `final`, `abstract`, `synchronized`, `volatile`, `transient`, `native`, `strictfp`
- `enhanced_for_statement`
- `synchronized_statement`
- `assert_statement`
- `static_initializer` / `instance_initializer`
- `constructor_body`
- `explicit_constructor_invocation` (`super()`, `this()`)
- `type_parameter` / `type_bound`
- `wildcard` (`? extends`, `? super`)
- `record_declaration` (Java 14+)
- `sealed_modifier` (Java 17+)
- `pattern_matching` (Java 16+)
- `switch_expression` (Java 14+)

### C/C++

- `struct_specifier`
- `union_specifier`
- `enum_specifier`
- `typedef_declaration`
- `pointer_declarator` / `reference_declarator`
- `template_declaration` / `template_instantiation`
- `namespace_definition`
- `using_declaration` / `using_directive`
- `friend_declaration`
- `virtual_function_specifier`
- `override_specifier` / `final_specifier`
- `operator_cast` / `conversion_function`
- `destructor_definition` (`~ClassName`)
- `initializer_list` (C++11)
- `lambda_expression` (C++11)
- `concept_definition` (C++20)
- `requires_clause` (C++20)
- `co_await_expression` / `co_yield_expression` / `co_return_statement` (C++20 coroutines)
- `static_assert`
- `preprocessor_include` / `preprocessor_define` / `preprocessor_if`

### C#

- `namespace_declaration`
- `using_directive` / `using_static_directive`
- `property_declaration` - with `get`/`set` accessors
- `indexer_declaration`
- `event_declaration`
- `delegate_declaration`
- `attribute_list`
- `explicit_interface_specifier`
- `finalizer_declaration`
- `conversion_operator_declaration`
- `query_expression` (LINQ)
- `anonymous_object_creation_expression`
- `tuple_expression`
- `switch_expression` (C# 8.0+)
- `pattern_matching` / `pattern`
- `null_coalescing_expression` (`??`)
- `null_conditional_operator` (`?.`)
- `interpolated_string_expression`
- `record_declaration` (C# 9.0+)
- `init_accessor` (C# 9.0+)
- `with_expression` (C# 9.0+)
- `global_statement` (C# 9.0+)
- `file_scoped_namespace_declaration` (C# 10.0+)

### RUST

- `mod_item` / `mod_declaration`
- `use_declaration`
- `impl_item` - trait implementation
- `trait_item`
- `struct_item`
- `enum_item`
- `union_item`
- `type_item` - type alias
- `const_item` / `static_item`
- `macro_definition` / `macro_invocation`
- `attribute_item` (`#[...]`)
- `visibility_modifier` (`pub`, `pub(crate)`)
- `lifetime` / `lifetime_parameter`
- `generic_type` / `type_parameters`
- `where_clause` / `where_predicate`
- `reference_expression` / `borrow_expression` (`&`, `&mut`)
- `dereference_expression` (`*`)
- `unsafe_block`
- `async_block`
- `closure_expression`
- `match_expression` / `match_arm`
- `if_let_expression` / `while_let_expression`
- `range_expression` (`..`, `..=`)
- `try_expression` (`?` operator)
- `await_expression` (`.await`)

### GO

- `package_clause`
- `import_declaration` / `import_spec`
- `function_declaration`
- `method_declaration` - with receiver
- `type_declaration` / `type_spec`
- `struct_type`
- `interface_type`
- `channel_type` / `send_statement` / `receive_expression`
- `go_statement` - goroutine launch
- `defer_statement`
- `select_statement` / `communication_case`
- `type_assertion_expression`
- `type_switch_statement`
- `slice_expression`
- `composite_literal`
- `variadic_argument` / `variadic_parameter_declaration`
- `pointer_type`
- `map_type`
- `func_literal` - anonymous function

### SWIFT

- `import_declaration`
- `class_declaration`
- `struct_declaration`
- `enum_declaration`
- `protocol_declaration`
- `extension_declaration`
- `typealias_declaration`
- `associatedtype_declaration`
- `init_declaration` / `deinit_declaration`
- `subscript_declaration`
- `precedence_group_declaration`
- `operator_declaration`
- `property_declaration` - with `willSet`/`didSet`
- `computed_property`
- `lazy_property`
- `guard_statement`
- `defer_statement`
- `repeat_while_statement`
- `do_statement` / `catch_clause`
- `throw_statement`
- `try_expression` / `try?` / `try!`
- `optional_chaining_expression` (`?.`)
- `forced_unwrap_expression` (`!`)
- `nil_coalescing_expression` (`??`)
- `closure_expression`
- `key_path_expression`
- `@available` / `@objc` / `@escaping` attributes
- `where_clause`
- `self_expression` / `super_expression`

### KOTLIN

- `package_header`
- `import_list` / `import_header`
- `class_declaration`
- `object_declaration` - singleton
- `companion_object`
- `data_class`
- `sealed_class` / `sealed_interface`
- `enum_class`
- `annotation_class`
- `interface_declaration`
- `type_alias`
- `primary_constructor`
- `secondary_constructor`
- `init_block`
- `property_declaration` - with custom getter/setter
- `lateinit_modifier` / `lazy_delegate`
- `extension_function`
- `infix_function`
- `inline_function`
- `suspend_function`
- `lambda_expression`
- `anonymous_function`
- `when_expression` / `when_entry`
- `elvis_expression` (`?:`)
- `safe_call_expression` (`?.`)
- `not_null_assertion` (`!!`)
- `range_expression` (`..`)
- `destructuring_declaration`
- `delegation_specifier` (`by`)
- `reified_type_parameter`
- `crossinline_modifier` / `noinline_modifier`

### PHP

- `namespace_definition` / `namespace_use_declaration`
- `class_declaration` / `trait_declaration` / `interface_declaration`
- `function_definition` / `method_declaration`
- `property_declaration`
- `const_declaration`
- `use_declaration` - trait usage
- `anonymous_function_creation_expression`
- `arrow_function`
- `variable_name` - with `$` prefix
- `member_access_expression` (`->`)
- `scoped_property_access_expression` (`::`)
- `yield_expression`
- `clone_expression`
- `include_expression` / `require_expression`
- `echo_statement` / `print_statement`
- `isset` / `empty` / `unset`
- `heredoc` / `nowdoc`
- `attribute` (PHP 8.0+)
- `match_expression` (PHP 8.0+)
- `named_argument` (PHP 8.0+)
- `nullsafe_member_access_expression` (`?->`) (PHP 8.0+)
- `enum_declaration` (PHP 8.1+)

### RUBY

- `module` / `class`
- `singleton_class` (`class << self`)
- `method` / `singleton_method`
- `alias` / `undef`
- `begin` / `rescue` / `ensure` / `retry`
- `raise`
- `yield`
- `super`
- `self`
- `block` / `do_block`
- `lambda` / `proc`
- `symbol` / `symbol_array`
- `string_array` / `word_array`
- `regex`
- `range` (`..`, `...`)
- `splat_parameter` / `double_splat_parameter`
- `block_parameter`
- `keyword_parameter`
- `case` / `when`
- `unless` / `until`
- `modifier_if` / `modifier_unless`
- `safe_navigation_operator` (`&.`)
- `instance_variable` (`@var`)
- `class_variable` (`@@var`)
- `global_variable` (`$var`)

### ELIXIR

- `defmodule`
- `defstruct`
- `defprotocol` / `defimpl`
- `def` / `defp` - public/private functions
- `defmacro` / `defmacrop`
- `defdelegate`
- `defguard` / `defguardp`
- `alias` / `import` / `require` / `use`
- `@attribute` - module attributes
- `pipe_operator` (`|>`)
- `capture_operator` (`&`)
- `pin_operator` (`^`)
- `match_operator` (`=`)
- `anonymous_function` (`fn ... end`)
- `case` / `cond` / `if` / `unless` / `with`
- `try` / `catch` / `rescue` / `after`
- `receive` / `send`
- `list_comprehension` (`for`)
- `sigil` - string sigils
- `tuple` / `list` / `map` / `binary`
- `keyword_list`
- `string_interpolation`

### LUA

- `function_declaration` / `local_function`
- `function_call`
- `table_constructor`
- `field` - table field
- `local_variable_declaration`
- `assignment_statement`
- `do_statement`
- `if_statement` / `elseif_clause`
- `while_statement` / `repeat_statement`
- `for_statement` / `for_in_statement`
- `goto_statement` / `label_statement`
- `break_statement` / `return_statement`
- `vararg_expression` (`...`)
- `method_index_expression` (`:`)
- `require_call`

### REACT/JSX (extends JavaScript/TypeScript)

- `jsx_element` / `jsx_opening_element` / `jsx_closing_element`
- `jsx_self_closing_element`
- `jsx_fragment` / `jsx_opening_fragment` / `jsx_closing_fragment`
- `jsx_attribute` / `jsx_spread_attribute`
- `jsx_expression` / `jsx_text`
- `jsx_namespace_name`
- `react_component` - functional component (function returning JSX)
- `react_class_component` - class extending React.Component
- `hook_call` - useState, useEffect, useContext, etc.
- `use_client_directive` (Next.js 13+)
- `use_server_directive` (Next.js 13+)
- `forward_ref_expression`
- `memo_expression`
- `create_context_expression`
- `provider_component` / `consumer_component`
- `higher_order_component` - function wrapping component

### NEXT.JS (extends React/TS)

- `page_component` - default export from pages/
- `layout_component` - layout.tsx/jsx
- `loading_component` - loading.tsx/jsx
- `error_component` - error.tsx/jsx
- `not_found_component` - not-found.tsx/jsx
- `route_handler` - app/api route handlers
- `server_component` - React Server Component
- `client_component` - marked with 'use client'
- `server_action` - marked with 'use server'
- `generate_metadata` - metadata export
- `generate_static_params` - static path generation
- `get_server_side_props` - SSR data fetching (Pages Router)
- `get_static_props` - SSG data fetching (Pages Router)
- `get_static_paths` - dynamic routes (Pages Router)
- `middleware_function` - middleware.ts
- `route_config` - route segment config exports
- `dynamic_import` - next/dynamic usage
- `image_component` - next/image usage
- `link_component` - next/link usage
- `script_component` - next/script usage
- `head_component` - next/head usage (Pages Router)
- `metadata_object` - Metadata API object

### VUE

- `template_element` - <template> block
- `script_element` - <script> or <script setup> block
- `style_element` - <style> or <style scoped> block
- `component_definition` - Vue component object/function
- `options_api_property` - data, methods, computed, watch, etc.
- `composition_api_setup` - setup() function
- `vue_directive` - v-if, v-for, v-bind, v-on, v-model, v-show, v-slot
- `directive_attribute`
- `slot_element` / `slot_outlet`
- `scoped_slot`
- `custom_directive_registration`
- `component_registration` - components option
- `prop_declaration` - props definition
- `emit_declaration` - emits definition
- `provide_inject` - provide/inject usage
- `computed_property` - computed ref
- `watch_expression` - watch/watchEffect
- `lifecycle_hook` - onMounted, onUpdated, etc.
- `ref_declaration` - ref() usage
- `reactive_declaration` - reactive() usage
- `template_ref` - ref attribute for DOM access
- `defineProps` / `defineEmits` / `defineExpose` (script setup)
- `v_model_directive`
- `teleport_element` / `suspense_element` / `transition_element`

### SVELTE

- `script_element` - <script> or <script context="module">
- `style_element` - <style>
- `component_element` - component usage
- `svelte_directive` - on:, bind:, use:, transition:, in:, out:, animate:
- `reactive_declaration` - $: labeled statement
- `store_subscription` - $storeName
- `slot_element` / `slot_directive`
- `svelte_component` - <svelte:component>
- `svelte_element` - <svelte:element>
- `svelte_window` - <svelte:window>
- `svelte_document` / `svelte_body` / `svelte_head`
- `svelte_options` - <svelte:options>
- `each_block` - {#each}
- `if_block` - {#if}
- `await_block` - {#await}
- `key_block` - {#key}
- `snippet_declaration` - {@render} (Svelte 5)
- `action_usage` - use: directive
- `transition_directive` - transition:, in:, out:
- `animation_directive` - animate:
- `class_directive` - class:
- `style_directive` - style:
- `let_directive` - let: in slots
- `const_tag` - {@const}
- `html_tag` - {@html}
- `debug_tag` - {@debug}

### ANGULAR (TypeScript + Templates)

- `component_decorator` - @Component
- `directive_decorator` - @Directive
- `pipe_decorator` - @Pipe
- `injectable_decorator` - @Injectable
- `ng_module_decorator` - @NgModule
- `input_decorator` - @Input
- `output_decorator` - @Output
- `view_child_decorator` - @ViewChild, @ViewChildren
- `content_child_decorator` - @ContentChild, @ContentChildren
- `host_binding_decorator` - @HostBinding
- `host_listener_decorator` - @HostListener
- `template_syntax` - Angular template
- `structural_directive` - *ngIf, *ngFor, \*ngSwitch
- `attribute_directive` - [ngClass], [ngStyle]
- `event_binding` - (click), (change)
- `property_binding` - [property]
- `two_way_binding` - [(ngModel)]
- `template_reference_variable` - #var
- `pipe_usage` - | pipeName
- `safe_navigation_operator` - ?.
- `non_null_assertion_operator` - !
- `ng_template` - <ng-template>
- `ng_container` - <ng-container>
- `ng_content` - <ng-content>
- `lifecycle_hook` - ngOnInit, ngOnDestroy, etc.
- `dependency_injection` - constructor injection
- `service_class`
- `guard_class` - CanActivate, CanDeactivate, etc.
- `resolver_class`
- `interceptor_class`
- `standalone_component` (Angular 14+)
- `signal_declaration` - signal() (Angular 16+)
- `computed_signal` - computed() (Angular 16+)
- `effect_declaration` - effect() (Angular 16+)

### REACT NATIVE (extends React)

- `style_sheet_create` - StyleSheet.create()
- `view_component` - <View>
- `text_component` - <Text>
- `image_component` - <Image>
- `scroll_view_component` - <ScrollView>
- `flat_list_component` - <FlatList>
- `section_list_component` - <SectionList>
- `touchable_component` - Touchable\* components
- `platform_select` - Platform.select()
- `platform_os_check` - Platform.OS
- `dimensions_get` - Dimensions.get()
- `animated_value` - Animated.Value
- `animated_component` - Animated.View, etc.
- `use_window_dimensions` - useWindowDimensions
- `use_color_scheme` - useColorScheme
- `native_module_import` - NativeModules usage
- `navigation_container` - React Navigation
- `stack_navigator` / `tab_navigator` / `drawer_navigator`
- `navigation_prop_usage` - navigation.navigate()
- `route_prop_usage` - route.params

### FLUTTER/DART

- `library_directive` - library declaration
- `part_directive` / `part_of_directive`
- `import_directive` / `export_directive`
- `class_definition` / `mixin_declaration` / `extension_declaration`
- `enum_declaration`
- `typedef_declaration`
- `function_declaration` / `method_declaration`
- `constructor_declaration` - named/factory constructors
- `getter_declaration` / `setter_declaration`
- `operator_overload`
- `async_function` / `async_generator_function`
- `sync_generator_function`
- `await_expression` / `yield_expression`
- `cascade_expression` - `..` operator
- `null_aware_expression` - `?.`, `??`, `??=`
- `spread_element` / `if_element` / `for_element` - collection literals
- `pattern_matching` - switch expressions (Dart 3.0+)
- `record_type` / `record_literal` (Dart 3.0+)
- `sealed_class` (Dart 3.0+)
- `stateless_widget` - extends StatelessWidget
- `stateful_widget` - extends StatefulWidget
- `inherited_widget` - extends InheritedWidget
- `widget_build_method` - build() method
- `state_class` - State<T> class
- `set_state_call` - setState() usage
- `build_context_usage`
- `widget_tree_structure`
- `gesture_detector` / `inkwell_widget`
- `stream_builder` / `future_builder`
- `provider_usage` - Provider, Consumer, etc.
- `bloc_usage` - BLoC pattern
- `riverpod_usage` - Riverpod providers
- `navigation_usage` - Navigator.push, etc.
- `route_definition`
- `theme_data_usage`
- `media_query_usage`
- `layout_builder_usage`

### SWIFT UI (extends Swift)

- `view_protocol` - struct conforming to View
- `view_modifier` - .modifier() calls
- `view_builder_attribute` - @ViewBuilder
- `state_property_wrapper` - @State
- `binding_property_wrapper` - @Binding
- `observed_object_wrapper` - @ObservedObject
- `state_object_wrapper` - @StateObject
- `environment_object_wrapper` - @EnvironmentObject
- `environment_wrapper` - @Environment
- `app_storage_wrapper` - @AppStorage
- `scene_storage_wrapper` - @SceneStorage
- `fetched_results_wrapper` - @FetchRequest (Core Data)
- `namespace_wrapper` - @Namespace (animations)
- `gesture_state_wrapper` - @GestureState
- `focusable_wrapper` - @FocusState
- `scaledmetric_wrapper` - @ScaledMetric
- `view_body` - body property
- `some_view_return` - opaque return type
- `view_composition` - VStack, HStack, ZStack, etc.
- `navigation_view` / `navigation_stack` (iOS 16+)
- `list_view` / `form_view`
- `foreach_view`
- `lazy_stack` - LazyVStack, LazyHStack
- `lazy_grid` - LazyVGrid, LazyHGrid
- `scroll_view`
- `geometry_reader`
- `preference_key` - PreferenceKey protocol
- `view_that_fits` (iOS 16+)
- `grid_view` (iOS 16+)
- `button_style` / `label_style` / `text_field_style`
- `animation_modifier`
- `transition_modifier`
- `gesture_modifier` - .gesture(), .onTapGesture()
- `sheet_modifier` / `full_screen_cover_modifier`
- `alert_modifier` / `confirmation_dialog_modifier`
- `task_modifier` - async task lifecycle
- `refreshable_modifier`
- `searchable_modifier`
- `toolbar_modifier` / `toolbar_item`
- `contextmenu_modifier`

### JETPACK COMPOSE (Kotlin)

- `composable_annotation` - @Composable
- `preview_annotation` - @Preview
- `composable_function` - @Composable function
- `remember_call` - remember { }
- `remember_saveable_call` - rememberSaveable { }
- `mutable_state_of` - mutableStateOf()
- `derived_state_of` - derivedStateOf()
- `state_hoisting` - state parameter pattern
- `side_effect_call` - SideEffect { }
- `disposable_effect` - DisposableEffect
- `launched_effect` - LaunchedEffect
- `derived_state_of` - derivedStateOf()
- `snapshot_flow` - snapshotFlow { }
- `produce_state` - produceState
- `column_composable` / `row_composable` / `box_composable`
- `lazy_column` / `lazy_row` / `lazy_vertical_grid`
- `scaffold_composable`
- `surface_composable`
- `text_composable` / `button_composable` / `image_composable`
- `modifier_chain` - Modifier.\* chaining
- `navigation_compose` - NavHost, NavController
- `view_model_integration` - viewModel()
- `live_data_observation` - observeAsState()
- `flow_collection` - collectAsState()
- `animation_spec` - animateFloatAsState, etc.
- `transition_animation` - AnimatedVisibility, etc.
- `material3_components` - Material 3 composables
- `accompanist_library_usage` - Accompanist helpers

### OBJECTIVE-C

- `interface_declaration` - @interface
- `implementation_declaration` - @implementation
- `protocol_declaration` - @protocol
- `category_declaration` - @interface Category
- `extension_declaration` - @interface Extension()
- `property_declaration` - @property
- `synthesize_directive` - @synthesize
- `dynamic_directive` - @dynamic
- `method_declaration` - instance/class methods
- `selector_expression` - @selector()
- `protocol_expression` - @protocol()
- `encode_expression` - @encode()
- `class_reference` - [ClassName class]
- `message_expression` - [receiver message]
- `block_declaration` - ^{ } block syntax
- `autoreleasepool_statement` - @autoreleasepool
- `try_statement` - @try/@catch/@finally
- `throw_statement` - @throw
- `synchronized_statement` - @synchronized
- `optional_keyword` - @optional (in protocol)
- `required_keyword` - @required (in protocol)
- `availability_attribute` - NS_AVAILABLE, API_AVAILABLE
- `nullability_annotation` - nullable, nonnull, null_resettable
- `generics` - **covariant, **contravariant
- `weak_reference` - \_\_weak
- `strong_reference` - \_\_strong
- `unsafe_reference` - \_\_unsafe_unretained
- `bridge_cast` - **bridge, **bridge_retained, \_\_bridge_transfer

### XML/HTML (for Android layouts, iOS XIBs, web)

- `element` - XML/HTML element
- `attribute` - element attribute
- `text_content` - text node
- `comment` - XML/HTML comment
- `cdata_section` - CDATA block
- `processing_instruction`
- `doctype_declaration`
- `namespace_declaration` - xmlns
- `android_attribute` - android:\* attributes
- `tools_attribute` - tools:\* attributes
- `app_attribute` - app:\* attributes
- `layout_element` - Android layout types
- `view_element` - Android View types
- `constraint_layout` - ConstraintLayout specific
- `data_binding_expression` - @{} in Android
- `vector_drawable` - <vector> elements
- `animation_resource` - <set>, <objectAnimator>
- `style_resource` - <style>, <item>
- `string_resource` - <string>, <plurals>
- `dimen_resource` - <dimen>
- `color_resource` - <color>
- `drawable_resource` - <shape>, <selector>, <layer-list>

### SQL (for database schemas, queries, ORMs)

- `create_table_statement`
- `create_index_statement`
- `create_view_statement`
- `create_trigger_statement`
- `create_procedure_statement` / `create_function_statement`
- `alter_table_statement`
- `drop_statement`
- `select_statement` / `select_clause`
- `insert_statement`
- `update_statement`
- `delete_statement`
- `with_clause` - CTE (Common Table Expression)
- `where_clause`
- `join_clause` - INNER/LEFT/RIGHT/FULL JOIN
- `group_by_clause`
- `having_clause`
- `order_by_clause`
- `limit_clause` / `offset_clause`
- `union_statement` / `intersect_statement` / `except_statement`
- `subquery`
- `column_definition`
- `constraint_definition` - PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK
- `index_definition`
- `aggregate_function` - COUNT, SUM, AVG, MAX, MIN
- `window_function` - ROW_NUMBER, RANK, PARTITION BY
- `case_expression`
- `cast_expression`
- `transaction_statement` - BEGIN, COMMIT, ROLLBACK

### GRAPHQL

- `schema_definition`
- `type_definition` - type, interface, union, enum, input
- `field_definition`
- `argument_definition`
- `directive_definition` - @directive
- `scalar_type_definition`
- `object_type_definition`
- `interface_type_definition`
- `union_type_definition`
- `enum_type_definition`
- `input_object_type_definition`
- `query_definition`
- `mutation_definition`
- `subscription_definition`
- `fragment_definition`
- `operation_definition`
- `selection_set`
- `field_selection`
- `fragment_spread`
- `inline_fragment`
- `variable_definition`
- `directive_usage` - @include, @skip, @deprecated
- `schema_extension`
- `type_extension`

### SOLIDITY (Smart Contracts)

- `pragma_directive`
- `import_directive`
- `contract_definition`
- `interface_definition`
- `library_definition`
- `abstract_contract`
- `struct_definition`
- `enum_definition`
- `event_definition`
- `error_definition`
- `modifier_definition`
- `function_definition` - function types: public, external, internal, private
- `constructor_definition`
- `fallback_function` / `receive_function`
- `state_variable_declaration` - storage variables
- `constant_variable`
- `immutable_variable`
- `mapping_type`
- `array_type`
- `address_type`
- `payable_modifier`
- `view_modifier` / `pure_modifier`
- `override_specifier`
- `virtual_specifier`
- `emit_statement` - event emission
- `require_statement` / `assert_statement` / `revert_statement`
- `assembly_block` - inline assembly
- `using_for_declaration`
- `inheritance_specifier` - is ContractName
- `modifier_invocation`

### YAML (for configs, CI/CD, Kubernetes, Docker Compose)

- `document` - YAML document
- `block_mapping` - key-value map
- `block_sequence` - list/array
- `flow_mapping` - inline map
- `flow_sequence` - inline array
- `block_scalar` - multiline string (|, >)
- `plain_scalar` - unquoted value
- `single_quoted_scalar`
- `double_quoted_scalar`
- `anchor` - &anchor
- `alias` - \*alias
- `tag` - !!type
- `comment`
- `directive` - %YAML, %TAG

### JSON

- `object`
- `array`
- `pair` - key-value pair
- `string`
- `number`
- `boolean` - true/false
- `null`

### TOML (for Rust Cargo.toml, Python pyproject.toml)

- `document`
- `table` - [section]
- `array_of_tables` - [[section]]
- `pair` - key = value
- `string` / `multiline_string`
- `integer` / `float`
- `boolean`
- `date` / `time` / `datetime`
- `array`
- `inline_table`
- `comment`

### DOCKERFILE

- `from_instruction`
- `run_instruction`
- `cmd_instruction`
- `label_instruction`
- `expose_instruction`
- `env_instruction`
- `add_instruction`
- `copy_instruction`
- `entrypoint_instruction`
- `volume_instruction`
- `user_instruction`
- `workdir_instruction`
- `arg_instruction`
- `onbuild_instruction`
- `stopsignal_instruction`
- `healthcheck_instruction`
- `shell_instruction`
- `comment`
- `expansion` - $VAR or ${VAR}

---

## PRIORITIZATION GUIDE

### TIER 1 (Must Have - Core Structure):

1. All class/interface/struct definitions
2. All function/method definitions
3. All import/export statements
4. All variable/field declarations
5. All call expressions
6. All type annotations

### TIER 2 (High Value - Relationships):

7. Control flow (if/for/while/switch)
8. Error handling (try/catch/throw)
9. Member access expressions
10. Assignment expressions
11. Constructor/destructor declarations
12. Inheritance/implementation relationships

### TIER 3 (Medium Value - Context):

13. Decorators/annotations
14. Async/await constructs
15. Lambda/closure expressions
16. Property accessors (getters/setters)
17. Constant declarations
18. Enum definitions

### TIER 4 (Nice to Have - Full Coverage):

19. Comments and documentation
20. Literals and constants
21. Binary/unary expressions
22. Template/string interpolation
23. Language-specific features

---

## EXTRACTION STRATEGY

For each node type, extract and store in Neo4j:

**Common Properties:**

- `name` - identifier name
- `type` - node type category
- `start_line` / `end_line` - location
- `start_byte` / `end_byte` - byte offset
- `file_path` - containing file
- `language` - source language
- `visibility` - public/private/protected/internal
- `is_static` / `is_abstract` / `is_async` - modifiers
- `signature` - full signature string
- `text_snippet` - actual code text (first 200 chars)

**Language-Specific Properties:**

- `receiver_type` - for methods (Go, Rust)
- `generic_parameters` - type parameters
- `decorators` / `annotations` - metadata
- `throws` - exception types
- `return_type` - return type annotation
- `parameter_types` - parameter type list
- `parent_class` - inheritance
- `implemented_interfaces` - interface list

This should cover 95%+ of meaningful code structures across all major languages!

# Comprehensive AI/ML Framework Patterns for Neo4j Indexing

## Pattern Detection Strategy

These aren't new Tree-sitter node types - they're **semantic patterns** to detect and tag in your graph. Add these as metadata properties and specialized relationships to existing nodes.

---

## CORE ML FRAMEWORKS

### PyTorch

**Class Patterns:**

- Inherits from `nn.Module` / `torch.nn.Module` → `pytorch_model`
- Inherits from `nn.Sequential` → `sequential_model`
- Inherits from `LightningModule` (PyTorch Lightning) → `lightning_model`

**Method Patterns:**

- `forward()` method in nn.Module → `model_forward_pass`
- `training_step()` in Lightning → `training_step`
- `validation_step()` / `test_step()` → validation/test steps
- `configure_optimizers()` → optimizer configuration

**Decorator Patterns:**

- `@torch.no_grad()` → inference mode
- `@torch.jit.script` / `@torch.jit.trace` → JIT compilation
- `@torch.compile` (PyTorch 2.0+) → compiled model
- `@torch.inference_mode()` → inference optimization

**Function Call Patterns:**

- `torch.save()` / `torch.load()` → checkpoint operations
- `.to(device)` / `.cuda()` / `.cpu()` → device placement
- `loss.backward()` → backpropagation
- `optimizer.step()` / `optimizer.zero_grad()` → optimization
- `DataLoader()` → data loading
- `DistributedDataParallel()` / `DataParallel()` → distributed training
- `torch.utils.checkpoint.checkpoint()` → gradient checkpointing

**Dataset Patterns:**

- Inherits from `torch.utils.data.Dataset` → `custom_dataset`
- `__getitem__()` and `__len__()` methods → dataset implementation
- Inherits from `IterableDataset` → `streaming_dataset`

### TensorFlow / Keras

**Class Patterns:**

- Inherits from `tf.keras.Model` / `keras.Model` → `keras_model`
- Inherits from `tf.keras.layers.Layer` → `custom_layer`
- Inherits from `tf.Module` → `tf_module`

**Method Patterns:**

- `call()` method → forward pass
- `build()` method → lazy layer building
- `get_config()` / `from_config()` → serialization

**Decorator Patterns:**

- `@tf.function` → graph compilation
- `@tf.keras.saving.register_keras_serializable()` → custom serialization

**Function Call Patterns:**

- `model.compile()` → model configuration
- `model.fit()` → training
- `model.evaluate()` / `model.predict()` → evaluation/inference
- `tf.GradientTape()` → custom gradients
- `tf.data.Dataset.from_*()` → data pipeline
- `tf.saved_model.save()` / `load()` → model persistence
- `strategy.scope()` → distribution strategy
- `tf.distribute.*` → distributed training

### JAX / Flax

**Decorator Patterns:**

- `@jax.jit` → JIT compilation
- `@jax.grad` / `@jax.value_and_grad` → automatic differentiation
- `@jax.vmap` → vectorization
- `@jax.pmap` → parallelization
- `@partial(jax.jit)` → partial JIT

**Class Patterns:**

- Inherits from `flax.linen.Module` / `nn.Module` → `flax_model`
- Inherits from `nnx.Module` (Flax NNX) → `nnx_model`

**Method Patterns:**

- `setup()` method in Flax → layer initialization
- `__call__()` method → forward pass

**Function Call Patterns:**

- `jax.lax.*` → low-level operations
- `optax.adam()` / other optimizers → optimizer creation
- `train_state.TrainState.create()` → training state
- `jax.tree_util.*` → pytree operations

### Scikit-learn

**Class Patterns:**

- Inherits from `BaseEstimator` → `sklearn_estimator`
- Inherits from `TransformerMixin` → `sklearn_transformer`
- Inherits from `ClassifierMixin` / `RegressorMixin` → classifier/regressor

**Method Patterns:**

- `fit()` / `fit_transform()` → training
- `predict()` / `predict_proba()` → inference
- `transform()` → data transformation
- `score()` → model evaluation

**Function Call Patterns:**

- `Pipeline()` / `make_pipeline()` → pipeline creation
- `GridSearchCV()` / `RandomizedSearchCV()` → hyperparameter tuning
- `train_test_split()` → data splitting
- `cross_val_score()` / `cross_validate()` → cross-validation
- `joblib.dump()` / `joblib.load()` → model persistence

---

## LLM & TRANSFORMER FRAMEWORKS

### Hugging Face Transformers

**Function Call Patterns:**

- `AutoModel.from_pretrained()` → model loading
- `AutoTokenizer.from_pretrained()` → tokenizer loading
- `AutoModelForCausalLM` / `AutoModelForSeq2SeqLM` / etc → task-specific models
- `pipeline()` → inference pipeline
- `.generate()` → text generation
- `.push_to_hub()` → model sharing
- `Trainer()` → training wrapper
- `TrainingArguments()` → training configuration
- `DataCollator*()` → data collation

**Class Patterns:**

- Inherits from `PreTrainedModel` → `custom_transformer_model`
- Inherits from `PreTrainedTokenizer` → `custom_tokenizer`

**Import Detection:**

- `from transformers import *` → mark file as using HF transformers
- Track specific model architectures: BERT, GPT, T5, LLaMA, Mistral, etc.

### vLLM

**Function Call Patterns:**

- `LLM()` → vLLM engine initialization
- `SamplingParams()` → generation parameters
- `.generate()` → batch inference
- `AsyncLLMEngine()` → async serving

### llama.cpp / llama-cpp-python

**Function Call Patterns:**

- `Llama()` → model loading
- `.create_completion()` / `.create_chat_completion()` → inference
- `llama_cpp.Llama()` with model_path → local model loading

### Ollama

**Function Call Patterns:**

- `ollama.generate()` / `ollama.chat()` → inference
- `ollama.list()` → model listing
- `ollama.pull()` → model downloading
- `ollama.create()` → custom model creation

### LiteLLM

**Function Call Patterns:**

- `litellm.completion()` → unified LLM API
- `litellm.acompletion()` → async completion
- `litellm.embedding()` → embeddings
- Router usage → load balancing

---

## AGENTIC AI FRAMEWORKS

### LangChain

**Class Patterns:**

- Inherits from `Chain` / `BaseChain` → `custom_chain`
- Inherits from `BaseTool` → `custom_tool`
- Inherits from `BaseAgent` → `custom_agent`
- Inherits from `BaseLLM` / `BaseLanguageModel` → `custom_llm`
- Inherits from `BaseRetriever` → `custom_retriever`
- Inherits from `BaseMemory` → `custom_memory`
- Inherits from `BaseLoader` → `custom_document_loader`
- Inherits from `Embeddings` → `custom_embeddings`

**Function Call Patterns:**

- `LLMChain()` / `SequentialChain()` / `RouterChain()` → chain creation
- `PromptTemplate()` / `ChatPromptTemplate()` → prompt definitions
- `ChatOpenAI()` / `ChatAnthropic()` / etc → LLM initialization
- `VectorStore.*()` → vector store operations (Chroma, Pinecone, Qdrant, etc.)
- `TextSplitter.*()` → document chunking
- `AgentExecutor()` → agent execution
- `create_*_agent()` → agent factories
- `ConversationBufferMemory()` / other memory types → memory management
- `RetrievalQA.from_chain_type()` → RAG setup
- LCEL patterns: `|` pipe operator usage → chain composition

**Import Detection:**

- `from langchain import *` / `from langchain_*` → LangChain usage
- Track integrations: `langchain_openai`, `langchain_anthropic`, etc.

### LangGraph

**Class Patterns:**

- `StateGraph()` → graph definition
- Node definitions with state → graph nodes
- Edge definitions → graph edges

**Function Call Patterns:**

- `.add_node()` → node addition
- `.add_edge()` / `.add_conditional_edges()` → edge addition
- `.compile()` → graph compilation
- `.invoke()` / `.stream()` → graph execution

### LlamaIndex

**Class Patterns:**

- Inherits from `BaseIndex` → `custom_index`
- Inherits from `BaseRetriever` → `custom_retriever`
- Inherits from `BaseNodeParser` → `custom_parser`
- Inherits from `BaseSynthesizer` → `custom_synthesizer`

**Function Call Patterns:**

- `VectorStoreIndex.*()` / `ListIndex.*()` / `TreeIndex.*()` → index types
- `ServiceContext.from_defaults()` → context configuration
- `StorageContext.from_defaults()` → storage configuration
- `.as_query_engine()` / `.as_chat_engine()` → engine creation
- `.query()` → querying
- `SimpleNodeParser()` / `SentenceSplitter()` → node parsing
- `ResponseSynthesizer()` → response generation
- `RetrieverQueryEngine()` → custom retrieval

### CrewAI

**Class Patterns:**

- Inherits from `Agent` → `crewai_agent`
- Inherits from `Task` → `crewai_task`
- Inherits from `Tool` → `crewai_tool`

**Function Call Patterns:**

- `Agent()` → agent creation
- `Task()` → task creation
- `Crew()` → crew assembly
- `.kickoff()` → execution

### AutoGen (Microsoft)

**Class Patterns:**

- Inherits from `ConversableAgent` → `autogen_agent`
- `AssistantAgent` / `UserProxyAgent` → agent types

**Function Call Patterns:**

- `AssistantAgent()` / `UserProxyAgent()` → agent creation
- `.initiate_chat()` → conversation start
- `.register_function()` → tool registration
- `GroupChat()` / `GroupChatManager()` → multi-agent setup

### Swarm (OpenAI)

**Function Patterns:**

- `Agent()` → agent definition
- `Swarm()` → swarm client
- `.run()` → execution
- Handoff patterns → agent transitions

### PydanticAI

**Class Patterns:**

- `Agent()` with type parameters → typed agent
- Pydantic models as return types → structured outputs
- `RunContext` usage → context management

**Decorator Patterns:**

- `@agent.system_prompt` → system prompt definition
- `@agent.tool` → tool registration
- Result validation with Pydantic → type-safe outputs

**Function Call Patterns:**

- `agent.run()` / `agent.run_sync()` → execution
- Dependency injection patterns → DI usage

### Phidata

**Class Patterns:**

- `Agent()` → phi agent
- `Assistant()` → assistant creation
- Inherits from `Tool` → custom tools

**Function Call Patterns:**

- Knowledge base integration
- Storage patterns
- Reasoning modes

### Haystack

**Class Patterns:**

- Inherits from `BaseComponent` → `custom_component`
- Pipeline definitions → haystack pipelines

**Function Call Patterns:**

- `Pipeline()` → pipeline creation
- `.add_node()` → node addition
- `.run()` → execution
- `DocumentStore` implementations → storage

### Semantic Kernel (Microsoft)

**Class Patterns:**

- `Kernel` → SK kernel
- `SKFunction` → function definitions

**Function Call Patterns:**

- `kernel.import_skill()` → skill import
- `kernel.run_async()` → async execution
- Prompt templates
- Planner usage

### DSPy

**Class Patterns:**

- Inherits from `dspy.Module` → `dspy_module`
- Inherits from `dspy.Signature` → `dspy_signature`

**Function Call Patterns:**

- `dspy.ChainOfThought()` / `dspy.Predict()` → predictors
- `dspy.configure()` → configuration
- `.compile()` → compilation with optimizer
- Teleprompter usage → prompt optimization

### Mirascope

**Decorator Patterns:**

- `@prompt_template` → prompt definitions
- Function decorators for LLM calls

**Function Call Patterns:**

- Structured output extraction
- Multi-provider support
- Streaming patterns

### Agno (formerly Phidata fork)

**Class Patterns:**

- Agent definitions
- Workflow patterns
- Tool integrations

**Function Call Patterns:**

- Agent orchestration
- Memory management
- Multi-agent coordination

### Rivet (Node-based)

**Import Detection:**

- Rivet project files → visual AI workflows
- Node connections → graph patterns

---

## VECTOR DATABASES & EMBEDDINGS

### Pinecone

**Function Call Patterns:**

- `pinecone.Index()` → index access
- `.upsert()` → vector insertion
- `.query()` → similarity search
- `.delete()` → vector deletion
- Namespace usage → multi-tenancy

### Qdrant

**Function Call Patterns:**

- `QdrantClient()` → client initialization
- `.upsert()` / `.upload_*()` → vector upload
- `.search()` / `.query()` → search operations
- Collection operations
- Payload filtering

### Weaviate

**Function Call Patterns:**

- `Client()` → client creation
- `.data.create()` → object creation
- `.query.get()` → retrieval
- `.query.nearVector()` → vector search
- Schema definitions

### Chroma

**Function Call Patterns:**

- `chromadb.Client()` / `chromadb.PersistentClient()` → client
- `.create_collection()` / `.get_collection()` → collection ops
- `.add()` / `.query()` → CRUD operations
- Embedding function configuration

### Milvus

**Function Call Patterns:**

- `connections.connect()` → connection
- Collection operations
- Index creation
- Search operations

### FAISS

**Function Call Patterns:**

- `faiss.IndexFlatL2()` / other index types → index creation
- `.add()` → vector addition
- `.search()` → similarity search
- Index serialization

### LanceDB

**Function Call Patterns:**

- `lancedb.connect()` → connection
- Table operations
- Vector search
- SQL-like queries

### Embedding Models

**OpenAI Embeddings:**

- `client.embeddings.create()` → embedding generation
- Model: `text-embedding-3-small`, `text-embedding-3-large`, `ada-002`

**Sentence Transformers:**

- `SentenceTransformer()` → model loading
- `.encode()` → embedding generation
- Model names: `all-MiniLM-L6-v2`, `all-mpnet-base-v2`, etc.

**Cohere:**

- `co.embed()` → embedding generation

**Voyage AI:**

- Embedding API calls

**Jina AI:**

- Embedding API calls

---

## LLM API PROVIDERS

### OpenAI

**Function Call Patterns:**

- `openai.ChatCompletion.create()` (legacy) → chat completion
- `client.chat.completions.create()` (new SDK) → chat completion
- `client.embeddings.create()` → embeddings
- `client.images.generate()` → DALL-E
- `client.audio.transcriptions.create()` → Whisper
- `client.audio.speech.create()` → TTS
- `client.fine_tuning.jobs.create()` → fine-tuning
- `client.assistants.create()` → Assistants API
- `client.beta.threads.*` → Threads API
- Function/tool calling patterns
- Structured outputs with `response_format`
- Streaming: `stream=True`

### Anthropic

**Function Call Patterns:**

- `client.messages.create()` → Claude API
- `client.messages.stream()` → streaming
- Tool use patterns → function calling
- System prompts
- Multi-turn conversations
- Thinking/reasoning tokens (extended thinking)

### Google AI (Gemini)

**Function Call Patterns:**

- `genai.GenerativeModel()` → model initialization
- `.generate_content()` → generation
- `.start_chat()` → chat sessions
- Function calling
- Safety settings
- Multi-modal inputs (image, video, audio)

**Vertex AI:**

- `aiplatform.init()` → initialization
- `GenerativeModel()` → model access
- `.predict()` / `.generate_content()` → inference
- Custom model deployment

### Groq

**Function Call Patterns:**

- Similar to OpenAI SDK
- Fast inference patterns
- Model-specific calls

### Together AI

**Function Call Patterns:**

- OpenAI-compatible API
- Model selection patterns

### Replicate

**Function Call Patterns:**

- `replicate.run()` → model execution
- Model version strings
- Input/output schemas

### Cohere

**Function Call Patterns:**

- `co.chat()` → chat
- `co.generate()` → generation
- `co.embed()` → embeddings
- `co.rerank()` → reranking
- `co.classify()` → classification

### AI21 Labs

**Function Call Patterns:**

- Jurassic model calls
- Task-specific APIs

### Mistral AI

**Function Call Patterns:**

- OpenAI-compatible API
- Model-specific features
- Function calling

### Perplexity AI

**Function Call Patterns:**

- Search-augmented generation
- Source citations

---

## FINE-TUNING & TRAINING PLATFORMS

### Hugging Face Hub

**Function Call Patterns:**

- `hf_hub_download()` → model download
- `.push_to_hub()` → model upload
- `login()` → authentication
- `create_repo()` → repo creation

### Weights & Biases (wandb)

**Function Call Patterns:**

- `wandb.init()` → run initialization
- `wandb.log()` → metric logging
- `wandb.config` → hyperparameter tracking
- `wandb.watch()` → model watching
- `wandb.Artifact()` → artifact tracking
- Sweep configuration → hyperparameter search

### MLflow

**Function Call Patterns:**

- `mlflow.start_run()` → run start
- `mlflow.log_param()` / `mlflow.log_metric()` → logging
- `mlflow.log_artifact()` / `mlflow.log_model()` → artifacts
- `mlflow.autolog()` → automatic logging
- `mlflow.pyfunc.*` → custom models
- Model registry operations

### CometML

**Function Call Patterns:**

- `Experiment()` → experiment creation
- `.log_metric()` / `.log_parameter()` → logging
- `.log_model()` → model tracking

### Neptune.ai

**Function Call Patterns:**

- `neptune.init_run()` → run initialization
- Logging operations
- Model versioning

### TensorBoard

**Function Call Patterns:**

- `SummaryWriter()` → writer creation
- `.add_scalar()` / `.add_image()` → logging
- PyTorch/TF integration

### Aim

**Function Call Patterns:**

- `Run()` → run tracking
- `.track()` → metric tracking

---

## SPECIALIZED AI FRAMEWORKS

### LangSmith (LangChain)

**Function Call Patterns:**

- `@traceable` decorator → tracing
- Client operations
- Dataset management

### LangFuse

**Function Call Patterns:**

- Tracing decorators
- Observability patterns
- Cost tracking

### PromptLayer

**Function Call Patterns:**

- API wrapping for tracking
- Prompt versioning

### Helicone

**Function Call Patterns:**

- Proxy-based tracking
- Cost monitoring

### Arize AI

**Function Call Patterns:**

- Model monitoring
- Drift detection

### WhyLabs

**Function Call Patterns:**

- Data profiling
- ML monitoring

### Ray

**Decorator Patterns:**

- `@ray.remote` → remote functions/actors
- `@ray.method` → actor methods

**Function Call Patterns:**

- `ray.init()` → cluster initialization
- `.remote()` → remote execution
- `ray.get()` / `ray.put()` → object store
- **Ray Tune:** `tune.run()` → hyperparameter tuning
- **Ray Train:** Distributed training
- **Ray Serve:** `serve.deployment()` → model serving
- **Ray Data:** Distributed data processing

### Dask

**Function Call Patterns:**

- `dask.delayed()` → lazy evaluation
- `dask.distributed.Client()` → cluster client
- Dask DataFrame/Array operations

---

## COMPUTER VISION

### OpenCV

**Import Detection:**

- `import cv2` → OpenCV usage

**Function Call Patterns:**

- `cv2.imread()` / `cv2.imwrite()` → I/O
- `cv2.VideoCapture()` → video processing
- Image processing functions

### Pillow (PIL)

**Function Call Patterns:**

- `Image.open()` / `Image.save()` → I/O
- Image transformations

### Albumentations

**Function Call Patterns:**

- `A.Compose()` → augmentation pipeline
- Transform definitions

### imgaug

**Function Call Patterns:**

- Augmentation sequences

### YOLO (Ultralytics)

**Function Call Patterns:**

- `YOLO()` → model loading
- `.predict()` / `.train()` → operations
- Model export

### MMDetection / MMSegmentation

**Import Detection:**

- MM framework usage
- Config-based patterns

### Detectron2

**Function Call Patterns:**

- Config system usage
- Trainer patterns

### SAM (Segment Anything)

**Function Call Patterns:**

- `SamPredictor()` / `SamAutomaticMaskGenerator()`
- Segmentation patterns

### CLIP

**Function Call Patterns:**

- `clip.load()` → model loading
- `.encode_image()` / `.encode_text()` → encoding

---

## NLP SPECIFIC

### spaCy

**Function Call Patterns:**

- `spacy.load()` → model loading
- `nlp()` → pipeline processing
- Custom pipeline components
- Entity recognition patterns

**Class Patterns:**

- Inherits from `Pipe` → custom component

### NLTK

**Import Detection:**

- `import nltk`
- Corpus downloads

### Gensim

**Function Call Patterns:**

- Word2Vec, Doc2Vec models
- Topic modeling (LDA)

### FastText

**Function Call Patterns:**

- Model training/loading
- Word embeddings

---

## AUDIO / SPEECH

### Whisper (OpenAI)

**Function Call Patterns:**

- `whisper.load_model()` → model loading
- `model.transcribe()` → transcription

### SpeechBrain

**Import Detection:**

- SpeechBrain models

### Coqui TTS

**Function Call Patterns:**

- TTS model loading
- Synthesis

### pyannote.audio

**Function Call Patterns:**

- Speaker diarization
- Audio segmentation

---

## MULTIMODAL

### LLaVA

**Function Call Patterns:**

- Vision-language model patterns
- Image + text inputs

### BLIP / BLIP-2

**Function Call Patterns:**

- Image captioning
- VQA (Visual Question Answering)

### Flamingo

**Import Detection:**

- Multimodal patterns

### GPT-4V / Gemini Vision

**Function Call Patterns:**

- Image inputs to LLM APIs
- Vision-language tasks

---

## REINFORCEMENT LEARNING

### Stable-Baselines3

**Class Patterns:**

- Algorithm classes: PPO, A2C, SAC, TD3, DQN
- Custom policies/networks

**Function Call Patterns:**

- `.learn()` → training
- `.predict()` → inference
- Environment wrappers

### OpenAI Gym / Gymnasium

**Class Patterns:**

- Inherits from `gym.Env` → custom environment

**Function Call Patterns:**

- `gym.make()` → environment creation
- `.step()` / `.reset()` → environment interaction

### RLlib (Ray)

**Function Call Patterns:**

- Training configuration
- Custom models/policies

---

## DEPLOYMENT & SERVING

### FastAPI (for ML APIs)

**Decorator Patterns:**

- `@app.post("/predict")` → ML endpoint

**Function Call Patterns:**

- Pydantic models for validation
- Background tasks for inference

### BentoML

**Decorator Patterns:**

- `@bentoml.service` → service definition
- `@bentoml.api` → API endpoint

**Function Call Patterns:**

- Model loading patterns
- Runner usage

### Seldon Core

**Import Detection:**

- Seldon deployment patterns

### KServe

**Import Detection:**

- KServe model serving

### TorchServe

**Function Call Patterns:**

- Model archiving
- Handler patterns

### TensorFlow Serving

**Import Detection:**

- SavedModel format
- Serving patterns

### Triton Inference Server

**Import Detection:**

- Model repository
- Ensemble models

### Modal

**Decorator Patterns:**

- `@app.function()` → serverless function
- `@app.cls()` → class deployment

**Function Call Patterns:**

- GPU allocation
- Image definitions

### Banana.dev / RunPod / etc

**Import Detection:**

- Serverless inference patterns

---

## GRAPH NEURAL NETWORKS

### PyTorch Geometric (PyG)

**Class Patterns:**

- Inherits from `MessagePassing` → custom GNN layer
- Inherits from `InMemoryDataset` / `Dataset` → graph datasets

**Function Call Patterns:**

- `Data()` → graph data structure
- `.to_homogeneous()` / `.to_heterogeneous()` → conversions
- GNN layer usage

### DGL (Deep Graph Library)

**Function Call Patterns:**

- `dgl.graph()` → graph creation
- Message passing functions
- Heterogeneous graph handling

### Graph-tool

**Import Detection:**

- Graph analysis patterns

---

## TIME SERIES

### Prophet (Facebook)

**Function Call Patterns:**

- `Prophet()` → model creation
- `.fit()` / `.predict()` → forecasting

### statsmodels

**Function Call Patterns:**

- ARIMA, SARIMA models
- Time series analysis

### tslearn

**Import Detection:**

- Time series ML patterns

### Darts

**Function Call Patterns:**

- Time series forecasting
- Model ensembles

---

## PROMPT ENGINEERING TOOLS

### Guidance (Microsoft)

**Import Detection:**

- `import guidance`
- Template patterns

**Decorator/Function Patterns:**

- `@guidance` decorator
- Structured generation

### Outlines

**Function Call Patterns:**

- `outlines.models.openai()` → model wrapping
- `.generate.*()` → structured generation
- Regex/JSON schema constraints

### LMQL

**Import Detection:**

- LMQL query syntax
- Constraints

### jsonformer

**Function Call Patterns:**

- JSON schema enforcement
- Structured output

---

## GRAPH & KNOWLEDGE PATTERNS

### NetworkX

**Import Detection:**

- `import networkx as nx`
- Graph algorithms

### Neo4j Python Driver

**Function Call Patterns:**

- `GraphDatabase.driver()` → connection
- Cypher query execution
- Transaction patterns

### RDFLib

**Import Detection:**

- RDF/SPARQL patterns
- Knowledge graph operations

---

## AUTOMATED ML

### AutoGluon

**Function Call Patterns:**

- `TabularPredictor()` / `TextPredictor()` / etc → AutoML
- `.fit()` → automatic training

### H2O.ai

**Function Call Patterns:**

- `h2o.init()` → initialization
- AutoML patterns

### TPOT

**Function Call Patterns:**

- `TPOTClassifier()` / `TPOTRegressor()` → AutoML
- Pipeline optimization

### PyCaret

**Function Call Patterns:**

- `setup()` → environment setup
- `compare_models()` → model comparison
- AutoML workflows

---

## FEATURE ENGINEERING

### Featuretools

**Function Call Patterns:**

- `ft.EntitySet()` → entity set creation
- `ft.dfs()` → deep feature synthesis

### Feature-engine

**Import Detection:**

- Feature engineering transformers

### Category Encoders

**Import Detection:**

- Categorical encoding patterns

---

## DATA VERSIONING & PIPELINES

### DVC (Data Version Control)

**Import Detection:**

- `dvc.yaml` / `.dvc` files
- Pipeline definitions

### Kedro

**Import Detection:**

- Pipeline patterns
- Node definitions

### Prefect / Airflow

**Decorator Patterns:**

- `@task` / `@flow` (Prefect)
- `@dag` (Airflow)

**Function Call Patterns:**

- Task dependencies
- Workflow orchestration

### Metaflow

**Decorator Patterns:**

- `@step` decorator
- Flow definitions

---

## MODEL COMPRESSION & OPTIMIZATION

### ONNX

**Function Call Patterns:**

- `torch.onnx.export()` → model export
- ONNX Runtime inference

### TensorRT

**Import Detection:**

- TensorRT optimization patterns

### OpenVINO

**Import Detection:**

- Model optimization for Intel hardware

### Quantization Patterns

**PyTorch:**

- `torch.quantization.*` usage
- QAT (Quantization-Aware Training)

**TensorFlow:**

- `tfmot.quantization.*` usage

### Pruning

**Function Call Patterns:**

- Model pruning APIs
- Sparsity patterns

---

## EXPLAINABILITY & INTERPRETABILITY

### SHAP

**Function Call Patterns:**

- `shap.Explainer()` → explainer creation
- `.shap_values()` → explanations
- Visualization functions

### LIME

**Function Call Patterns:**

- `LimeTextExplainer()` / `LimeTabularExplainer()` → explainers
- `.explain_instance()` → explanations

### InterpretML

**Function Call Patterns:**

- Explainable boosting machines
- Global/local explanations

### Captum (PyTorch)

**Function Call Patterns:**

- Attribution methods
- Feature importance

---

## PRIVACY & FEDERATED LEARNING

### PySyft

**Import Detection:**

- Federated learning patterns
- Differential privacy

### TensorFlow Federated

**Import Detection:**

- Federated computation patterns

### Opacus (PyTorch DP)

**Function Call Patterns:**

- `PrivacyEngine()` → differential privacy
- DP-SGD training

---

## SYNTHETIC DATA

### SDV (Synthetic Data Vault)

**Function Call Patterns:**

- Synthesizer creation
- Data generation

### Gretel

**Import Detection:**

- Synthetic data generation patterns

---

## MISCELLANEOUS AI TOOLS

### Gradio

**Decorator Patterns:**

- `gr.Interface()` → UI creation
- `gr.Blocks()` → custom layouts

**Function Call Patterns:**

- `.launch()` → app deployment
- Component definitions

### Streamlit

\*\*Function Call Patterns
