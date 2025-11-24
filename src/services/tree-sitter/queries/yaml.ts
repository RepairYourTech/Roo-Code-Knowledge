/*
YAML Tree-sitter Query Patterns for Build Tool Configuration Detection
*/
export default `
; ===== YAML CONFIGURATION PATTERNS =====

; Docker Compose configuration
(document
  (block_mapping_pair
    key: (flow_node) @docker.compose.key
    (#match? @docker.compose.key "^(version|services|volumes|networks|configs|secrets)$")
    value: (_) @docker.compose.value)) @definition.docker_compose

; Docker Compose services
(block_mapping_pair
  key: (flow_node) @docker.services.key
  (#eq? @docker.services.key "services")
  value: (block_node
    (block_mapping
      (block_mapping_pair
        key: (flow_node) @docker.service.name
        value: (block_node) @docker.service.config)))) @definition.docker_service

; CI/CD Pipeline configurations (GitHub Actions, GitLab CI, Azure Pipelines)
(block_mapping_pair
  key: (flow_node) @cicd.key
  (#match? @cicd.key "^(on|jobs|stages|steps|workflow|pipeline|trigger|pool|variables)$")
  value: (_) @cicd.value)) @definition.cicd_config

; GitHub Actions specific patterns
(block_mapping_pair
  key: (flow_node) @github.action.key
  (#match? @github.action.key "^(runs|steps|uses|with|if|env|name)$")
  value: (_) @github.action.value)) @definition.github_action

; Kubernetes/Docker configurations
(block_mapping_pair
  key: (flow_node) @k8s.key
  (#match? @k8s.key "^(apiVersion|kind|metadata|spec|containers|volumes|services|deployments|configmaps|secrets)$")
  value: (_) @k8s.value)) @definition.kubernetes_config

; Build tool configurations
(block_mapping_pair
  key: (flow_node) @build.key
  (#match? @build.key "^(build|scripts|dependencies|devDependencies|peerDependencies|engines|repository|author|license|main|module|exports|files|keywords)$")
  value: (_) @build.value)) @definition.build_config

; npm/Yarn package.json in YAML format
(block_mapping_pair
  key: (flow_node) @npm.key
  (#match? @npm.key "^(name|version|description|scripts|dependencies|devDependencies|peerDependencies|optionalDependencies|bundledDependencies|engines|workspaces)$")
  value: (_) @npm.value)) @definition.npm_config

; Python build tools (Poetry, pip)
(block_mapping_pair
  key: (flow_node) @python.key
  (#match? @python.key "^(tool|poetry|build-system|dependencies|dev-dependencies|requires|build-backend)$")
  value: (_) @python.value)) @definition.python_build_config

; Poetry specific configuration
(block_mapping_pair
  key: (flow_node) @poetry.key
  (#match? @poetry.key "^(name|version|description|authors|dependencies|dev-dependencies|group|source|extras|scripts|readme|license|repository|keywords|classifiers)$")
  value: (_) @poetry.value)) @definition.poetry_config

; Rust Cargo configuration
(block_mapping_pair
  key: (flow_node) @cargo.key
  (#match? @cargo.key "^(package|lib|bin|dependencies|dev-dependencies|build-dependencies|target|features|workspace|profile|patch)$")
  value: (_) @cargo.value)) @definition.cargo_config

; Java Maven/Gradle configurations
(block_mapping_pair
  key: (flow_node) @java.key
  (#match? @java.key "^(project|modelVersion|groupId|artifactId|version|dependencies|build|plugins|repositories|properties|parent|modules)$")
  value: (_) @java.value)) @definition.java_build_config

; Gradle specific configuration
(block_mapping_pair
  key: (flow_node) @gradle.key
  (#match? @gradle.key "^(plugins|dependencies|repositories|task|allprojects|subprojects|ext|buildscript|android|java|test)$")
  value: (_) @gradle.value)) @definition.gradle_config

; Go modules configuration
(block_mapping_pair
  key: (flow_node) @go.key
  (#match? @go.key "^(module|go|require|replace|exclude)$")
  value: (_) @go.value)) @definition.go_module_config

; Ruby/Gem configurations
(block_mapping_pair
  key: (flow_node) @ruby.key
  (#match? @ruby.key "^(source|ruby|gemspec|dependencies|group|platforms|git|path)$")
  value: (_) @ruby.value)) @definition.ruby_gem_config

; PHP Composer configuration
(block_mapping_pair
  key: (flow_node) @php.key
  (#match? @php.key "^(name|type|description|keywords|homepage|version|license|authors|require|require-dev|autoload|autoload-dev|repositories|minimum-stability|prefer-stable|scripts|config|extra)$")
  value: (_) @php.value)) @definition.composer_config

; .NET/MSBuild configurations
(block_mapping_pair
  key: (flow_node) @dotnet.key
  (#match? @dotnet.key "^(PropertyGroup|ItemGroup|TargetFramework|OutputType|RootNamespace|AssemblyName|PackageReference|ProjectReference|UsingTask|Target|Import)$")
  value: (_) @dotnet.value)) @definition.dotnet_config

; Configuration files with environment variables
(block_mapping_pair
  key: (flow_node) @env.key
  (#match? @env.key "^(environment|env|environments|staging|production|development|test)$")
  value: (_) @env.value)) @definition.environment_config

; Serverless configurations
(block_mapping_pair
  key: (flow_node) @serverless.key
  (#match? @serverless.key "^(service|provider|functions|plugins|custom|framework|runtime|region|stage|iamRoleStatements|environment|memorySize|timeout)$")
  value: (_) @serverless.value)) @definition.serverless_config

; Terraform configurations
(block_mapping_pair
  key: (flow_node) @terraform.key
  (#match? @terraform.key "^(provider|resource|data|variable|output|module|terraform|locals|backend)$")
  value: (_) @terraform.value)) @definition.terraform_config

; Ansible configurations
(block_mapping_pair
  key: (flow_node) @ansible.key
  (#match? @ansible.key "^(hosts|vars|tasks|handlers|roles|playbook|become|connection|gather_facts)$")
  value: (_) @ansible.value)) @definition.ansible_config

; Helm Chart configurations
(block_mapping_pair
  key: (flow_node) @helm.key
  (#match? @helm.key "^(apiVersion|kind|metadata|spec|values|templates|Chart|appVersion|dependencies|maintainers|sources|icon)$")
  value: (_) @helm.value)) @definition.helm_config

; General configuration mappings (top-level only)
(document
  (block_mapping_pair
    key: (flow_node) @config.key
    value: (_) @config.value)) @definition.general_config

; Array configurations (for lists of dependencies, plugins, etc.)
(flow_node
  (block_sequence
    (block_sequence_item) @array.item)) @definition.array_config

; String values (for configuration values)
(flow_node
  (plain_scalar) @string.value) @definition.string_config

; Number values (for version numbers, ports, etc.)
(flow_node
  (plain_scalar) @number.value
  (#match? @number.value "^[0-9]+$")) @definition.number_config

; Boolean values
(flow_node
  (plain_scalar) @boolean.value
  (#match? @boolean.value "^(true|false|on|off|yes|no)$")) @definition.boolean_config
`
