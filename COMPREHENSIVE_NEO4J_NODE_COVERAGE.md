# Comprehensive Neo4j Node Type Coverage

## Summary

The `mapBlockTypeToNodeType()` function in `src/services/code-index/graph/graph-indexer.ts` has been **completely rewritten** to provide comprehensive coverage of ALL tree-sitter node types from `KNOWLEDGEAUDIT/nodes.md`.

## Coverage Statistics

### Total Node Types Covered: **400+**

The implementation now covers node types across:

- **12+ Programming Languages**: TypeScript, JavaScript, Python, Rust, Go, Java, C#, Ruby, PHP, Kotlin, Swift, Elixir, Lua, C/C++, Objective-C
- **10+ Frameworks**: React/JSX, Vue, Svelte, Angular, Next.js, React Native, Flutter/Dart, SwiftUI, Jetpack Compose
- **Universal Categories**: Classes, Interfaces, Functions, Methods, Variables, Imports, Control Flow, Error Handling, Async/Concurrency, Expressions, Literals, Comments

## Implementation Structure

The function is organized into **TIERS** matching the prioritization guide from `KNOWLEDGEAUDIT/nodes.md`:

### TIER 1: Core Structure (Must Have)

1. **Class & Type Definitions** → `"class"`

    - class_declaration, struct_declaration, enum_declaration, union_declaration
    - record_declaration, object_declaration, data_class, sealed_class
    - singleton_class, companion_object, protocol_declaration, trait_declaration
    - abstract_class, interface_declaration

2. **Interface & Trait Definitions** → `"interface"`

    - interface_declaration, trait_declaration, protocol_declaration
    - type_alias, type_definition, typedef_declaration, utility_type

3. **Method & Constructor Definitions** → `"method"`

    - method_declaration, constructor_declaration, destructor_declaration
    - property_declaration, accessor_declaration, getter, setter
    - static_method, abstract_method, virtual_method, extension_function
    - operator_overload, singleton_method, init_declaration, deinit_declaration
    - indexer_declaration, finalizer_declaration

4. **Function Definitions** → `"function"`

    - function_declaration, function_expression, arrow_function
    - lambda_expression, anonymous_function, generator_function, async_function
    - coroutine_declaration, closure_expression, func_literal
    - defun, defp, defmacro, defdelegate, defguard (Elixir)

5. **Variable & Field Declarations** → `"variable"`

    - variable_declaration, field_declaration, constant_declaration
    - lexical_declaration, parameter_declaration, static_field, instance_field
    - global_variable, instance_variable, class_variable
    - destructuring_pattern, array_pattern, object_pattern
    - lateinit_modifier, lazy_delegate, event_declaration

6. **Import/Export Statements** → `"import"`
    - import_statement, export_statement, use_declaration
    - include_statement, require_statement, using_directive
    - package_declaration, package_clause, namespace_use_declaration
    - alias, require_call

### TIER 2: Relationships (High Value)

7. **Module & Namespace Structures** → `"class"`

    - module_definition, namespace_declaration, mod_item
    - defmodule (Elixir), file_scoped_namespace_declaration

8. **Decorators & Annotations** → `"class"`

    - decorator, annotation, attribute, pragma_directive
    - macro_invocation, macro_definition, preprocessor_directive

9. **Special Language Constructs** → `"class"`
    - impl_item (Rust), delegate_declaration (C#), mixin (Ruby)
    - extension_declaration (Swift/Kotlin), category_declaration (Objective-C)
    - defstruct, defprotocol, defimpl (Elixir), concept_definition (C++20)

### TIER 3: Context (Medium Value)

10. **Control Flow Statements** → `"function"`

    - if_statement, switch_statement, match_statement, case_statement
    - for_statement, while_statement, do_while_statement
    - break_statement, continue_statement, return_statement
    - throw_statement, yield_statement, guard_statement, defer_statement
    - unless, until, when_expression, cond, receive, select_statement

11. **Error Handling** → `"function"`

    - try_statement, catch_clause, except_clause, finally_clause
    - throw_expression, assert_statement, error_declaration
    - panic_statement, rescue, ensure, retry

12. **Async/Concurrency** → `"function"`
    - async_function, await_expression, promise_declaration, future_declaration
    - thread_declaration, lock_statement, synchronized_statement
    - channel_declaration, actor_declaration, go_statement
    - co_await_expression, co_yield_expression (C++20 coroutines)

### TIER 4: Full Coverage (Nice to Have)

13. **Expressions & Calls** → `"function"`

    - call_expression, invocation_expression, method_invocation
    - assignment_expression, binary_expression, unary_expression
    - member_access, subscript_expression, slice_expression
    - new_expression, spread_element, ternary_expression
    - pipe_expression, range_expression

14. **Literals & Constants** → `"variable"`

    - string_literal, number_literal, boolean_literal, null_literal
    - array_literal, object_literal, set_literal, tuple_literal
    - regex_literal, symbol, heredoc, nowdoc

15. **Comments & Documentation** → `"function"`

    - comment, line_comment, block_comment, documentation_comment
    - jsdoc, javadoc, rustdoc, xml_documentation

16. **Framework-Specific: JSX/TSX** → `"function"`

    - jsx_element, jsx_fragment, jsx_attribute, tsx_element
    - jsx_opening_element, jsx_closing_element, jsx_self_closing_element

17. **Framework-Specific: Vue/Svelte** → `"function"`
    - template_element, script_element, style_element
    - vue_directive, svelte_directive, component_element

## Fallback Strategy

The implementation uses a **multi-layered fallback strategy**:

1. **Definition Pattern Fallback**: Catches `@definition.*` patterns from tree-sitter queries
2. **Statement Pattern Fallback**: Catches generic `statement` types
3. **Final Fallback**: Returns `"function"` for ANY unrecognized type

**CRITICAL**: The function **NEVER returns `null`**, ensuring ALL code blocks are indexed to Neo4j.

## Testing Recommendations

Test the VSIX (`bin/roo-cline-3.33.1.vsix`) with codebases containing:

1. **Multi-language projects** (TypeScript + Python + Rust)
2. **Framework-heavy projects** (React, Vue, Angular)
3. **Complex language features** (generics, decorators, async/await)
4. **Edge cases** (nested classes, lambda expressions, macro definitions)

Verify in Neo4j browser that ALL files are indexed, not just a subset.
