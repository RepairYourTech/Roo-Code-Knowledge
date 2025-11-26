// Query patterns for TOML syntax elements for Build Tool Configuration Detection
export const tomlQuery = `
; ===== TOML CONFIGURATION PATTERNS =====

; Rust Cargo configuration
(table
  (bare_key) @cargo.table
  (#match? @cargo.table "^(package|lib|bin|dependencies|dev-dependencies|build-dependencies|target|features|workspace|profile|patch|source)$")) @definition.cargo_config

; Cargo package configuration
(pair
  key: (bare_key) @cargo.package.key
  (#match? @cargo.package.key "^(name|version|description|license|authors|homepage|repository|documentation|readme|keywords|categories|edition|rust-version|resolver|publish|metadata|build|exclude|include|links|autobins|autoexamples|autotests|autobenches)$")
  value: (_) @cargo.package.value) @definition.cargo_package

; Cargo dependencies
(pair
  key: (bare_key) @cargo.dep.key
  value: [
    (string) @cargo.dep.version
    (inline_table) @cargo.dep.details
  ]) @definition.cargo_dependency

; Python Poetry configuration
(table
  (bare_key) @poetry.table
  (#match? @poetry.table "^(tool|poetry|build-system|dependencies|dev-dependencies|group|source)$")) @definition.poetry_config

; Poetry package configuration
(pair
  key: (bare_key) @poetry.package.key
  (#match? @poetry.package.key "^(name|version|description|authors|maintainers|license|readme|homepage|repository|documentation|keywords|classifiers|packages|include|exclude)$")
  value: (_) @poetry.package.value) @definition.poetry_package

; Poetry dependencies
(table_array_element
  (bare_key) @poetry.dep.name
  value: [
    (string) @poetry.dep.version
    (inline_table) @poetry.dep.details
  ]) @definition.poetry_dependency)

; Python PDM configuration
(table
  (bare_key) @pdm.table
  (#match? @pdm.table "^(project|build-system|tool|dependencies|dev-dependencies|optional-dependencies|groups|source|package)$")) @definition.pdm_config

; Python Hatch configuration
(table
  (bare_key) @hatch.table
  (#match? @hatch.table "^(project|build-system|tool|hatch|dependencies|dev-dependencies|optional-dependencies|source)$")) @definition.hatch_config

; Python Setuptools configuration
(table
  (bare_key) @setuptools.table
  (#match? @setuptools.table "^(project|build-system|tool|setuptools)$")) @definition.setuptools_config



; Rust/Cargo workspace configuration
(table
  (bare_key) @workspace.table
  (#eq? @workspace.table "workspace")
  (pair
    key: (bare_key) @workspace.key
    (#match? @workspace.key "^(members|exclude|dependencies|dev-dependencies|resolver|package)$")
    value: (_) @workspace.value)*) @definition.cargo_workspace

; Cargo target configuration
(table
  (bare_key) @target.table
  (#match? @target.table "^target\\.")
  (pair
    key: (bare_key) @target.key
    value: (_) @target.value)*) @definition.cargo_target

; Cargo profile configuration
(table
  (bare_key) @profile.table
  (#match? @profile.table "^profile\\.")
  (pair
    key: (bare_key) @profile.key
    (#match? @profile.key "^(opt-level|debug|overflow-checks|lto|panic|codegen-units|incremental|rpath|debug-assertions)$")
    value: (_) @profile.value)*) @definition.cargo_profile

; Cargo features configuration
(pair
  key: (bare_key) @features.key
  (#eq? @features.key "features")
  value: (inline_table
    (pair
      key: (bare_key) @feature.name
      value: (array) @feature.dependencies)*) @definition.cargo_features)

; Rust/Cargo source configuration
(table
  (bare_key) @source.table
  (#match? @source.table "^source\\.")
  (pair
    key: (bare_key) @source.key
    (#match? @source.key "^(registry|git|branch|tag|rev|replace-with|directory)$")
    value: (_) @source.value)*) @definition.cargo_source

; Poetry source configuration
(table_array_element
  (bare_key) @poetry.source.name
  value: (inline_table
    (pair
      key: (bare_key) @poetry.source.key
      (#match? @poetry.source.key "^(name|url|type|default|verify_ssl)$")
      value: (_) @poetry.source.value)*) @definition.poetry_source

; Poetry scripts configuration
(pair
  key: (bare_key) @poetry.scripts.key
  (#eq? @poetry.scripts.key "scripts")
  value: (inline_table
    (pair
      key: (bare_key) @poetry.script.name
      value: (string) @poetry.script.command)*) @definition.poetry_scripts

; Poetry extras configuration
(pair
  key: (bare_key) @poetry.extras.key
  (#eq? @poetry.extras.key "extras")
  value: (inline_table
    (pair
      key: (bare_key) @poetry.extra.name
      value: (array) @poetry.extra.dependencies)*) @definition.poetry_extras)

; General TOML tables
(table) @definition.toml_table

; Array tables
(table_array_element) @definition.toml_array_table

; Key-value pairs
(pair) @definition.toml_pair

; Arrays
(array) @definition.toml_array

; Inline tables
(inline_table) @definition.toml_inline_table

; Basic values
(string) @definition.toml_string
(integer) @definition.toml_integer
(float) @definition.toml_float
(boolean) @definition.toml_boolean
(offset_date_time) @definition.toml_datetime
(local_date) @definition.toml_date
(local_time) @definition.toml_time
`
