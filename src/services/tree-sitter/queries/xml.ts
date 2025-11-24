/*
XML Tree-sitter Query Patterns for Build Tool Configuration Detection
*/
export default `
; ===== XML CONFIGURATION PATTERNS =====

; Maven POM configuration
(element
  (start_tag
    (tag_name) @maven.tag
    (#match? @maven.tag "^(project|modelVersion|groupId|artifactId|version|packaging|name|description|url|dependencies|dependency|build|plugins|plugin|repositories|repository|properties|parent|modules|dependencyManagement)$"))
  (element)*) @definition.maven_config

; Maven dependency elements
(element
  (start_tag
    (tag_name) @maven.dependency.tag
    (#eq? @maven.dependency.tag "dependency"))
  (element
    (start_tag
      (tag_name) @maven.dependency.field
      (#match? @maven.dependency.field "^(groupId|artifactId|version|scope|type|optional|exclusions)$"))
    (text) @maven.dependency.value))*) @definition.maven_dependency

; Maven plugin elements
(element
  (start_tag
    (tag_name) @maven.plugin.tag
    (#eq? @maven.plugin.tag "plugin"))
  (element
    (start_tag
      (tag_name) @maven.plugin.field
      (#match? @maven.plugin.field "^(groupId|artifactId|version|executions|execution|goals|goal|configuration|dependencies|inherited|extensions)$"))
    (text) @maven.plugin.value))*) @definition.maven_plugin

; Gradle build scripts (XML-based)
(element
  (start_tag
    (tag_name) @gradle.tag
    (#match? @gradle.tag "^(project|properties|dependencies|dependency|repositories|repository|build|plugins|plugin|task|extensions|configurations|configuration)$"))
  (element)*) @definition.gradle_config

; Ant build files
(element
  (start_tag
    (tag_name) @ant.tag
    (#match? @ant.tag "^(project|target|property|taskdef|typedef|path|classpath|import|include|macrodef|presetdef|condition|echo|mkdir|copy|delete|move|javac|jar|war|ear|test|junit|java|exec)$"))
  (attribute
    (attribute_name) @ant.attr.name
    (attribute_value) @ant.attr.value)*
  (element)*) @definition.ant_config

; Ant target definitions
(element
  (start_tag
    (tag_name) @ant.target.tag
    (#eq? @ant.target.tag "target")
    (attribute
      (attribute_name) @ant.target.name.attr
      (#eq? @ant.target.name.attr "name")
      (attribute_value) @ant.target.name.value))
  (attribute
    (attribute_name) @ant.target.depends.attr
    (#eq? @ant.target.depends.attr "depends")
    (attribute_value) @ant.target.depends.value)?
  (element)*) @definition.ant_target

; Android manifest and build configurations
(element
  (start_tag
    (tag_name) @android.tag
    (#match? @android.tag "^(manifest|application|activity|service|receiver|provider|uses-permission|uses-feature|meta-data|intent-filter|action|category|data)$"))
  (attribute
    (attribute_name) @android.attr.name
    (attribute_value) @android.attr.value)*
  (element)*) @definition.android_config

; Android Gradle plugin configurations
(element
  (start_tag
    (tag_name) @android.gradle.tag
    (#match? @android.gradle.tag "^(com.android.application|com.android.library|android|defaultConfig|buildTypes|buildType|productFlavors|productFlavor|compileOptions|sourceSets|dependencies|repositories)$"))
  (element)*) @definition.android_gradle_config

; .NET/MSBuild project files
(element
  (start_tag
    (tag_name) @msbuild.tag
    (#match? @msbuild.tag "^(Project|PropertyGroup|ItemGroup|Target|UsingTask|Import|When|Otherwise|Choose|Error|Warning|Message|Text|Output|Task|ParameterGroup|Parameter|Using)$"))
  (attribute
    (attribute_name) @msbuild.attr.name
    (attribute_value) @msbuild.attr.value)*
  (element)*) @definition.msbuild_config

; MSBuild property groups
(element
  (start_tag
    (tag_name) @msbuild.property.tag
    (#eq? @msbuild.property.tag "PropertyGroup")
    (attribute
      (attribute_name) @msbuild.property.condition.attr
      (#eq? @msbuild.property.condition.attr "Condition")
      (attribute_value) @msbuild.property.condition.value)?)
  (element
    (start_tag
      (tag_name) @msbuild.property.name
      (#match? @msbuild.property.name "^(Configuration|Platform|OutputPath|AssemblyName|RootNamespace|TargetFramework|TargetFrameworkVersion|DefineConstants|AllowUnsafeBlocks|Optimize|DebugType|WarningLevel|TreatWarningsAsErrors|DocumentationFile|NoWarn|LangVersion)$"))
    (text) @msbuild.property.value)*) @definition.msbuild_property_group

; MSBuild item groups
(element
  (start_tag
    (tag_name) @msbuild.item.tag
    (#eq? @msbuild.item.tag "ItemGroup"))
  (element
    (start_tag
      (tag_name) @msbuild.item.name
      (#match? @msbuild.item.name "^(Reference|PackageReference|ProjectReference|Compile|EmbeddedResource|Content|None|Folder|ProjectCapability|ProjectConfiguration|ProjectSdk|Sdk)$"))
    (attribute
      (attribute_name) @msbuild.item.attr.name
      (attribute_value) @msbuild.item.attr.value)*
    (element)*)*) @definition.msbuild_item_group

; NuGet package configurations
(element
  (start_tag
    (tag_name) @nuget.tag
    (#match? @nuget.tag "^(package|metadata|files|file|dependencies|group|dependency|contentFiles|license|repository|authors|owners|projectUrl|iconUrl|requireLicenseAcceptance|developmentDependency|summary|releaseNotes|copyright|language|tags|readme)$"))
  (element)*) @definition.nuget_config

; NuGet package metadata
(element
  (start_tag
    (tag_name) @nuget.metadata.tag
    (#eq? @nuget.metadata.tag "metadata"))
  (element
    (start_tag
      (tag_name) @nuget.metadata.field
      (#match? @nuget.metadata.field "^(id|version|title|authors|owners|description|summary|language|projectUrl|iconUrl|licenseUrl|requireLicenseAcceptance|developmentDependency|tags|repositoryUrl|repository_type|repository_commit|copyright|releaseNotes)$"))
    (text) @nuget.metadata.value)*) @definition.nuget_metadata

; Web application configurations (web.xml)
(element
  (start_tag
    (tag_name) @web.tag
    (#match? @web.tag "^(web-app|display-name|description|context-param|listener|filter|filter-mapping|servlet|servlet-mapping|session-config|mime-mapping|welcome-file-list|error-page|taglib|resource-ref|env-entry|ejb-ref|ejb-local-ref|service-ref|resource-env-ref|message-destination-ref|message-destination|persistence-context-ref|persistence-unit-ref)$"))
  (element)*) @definition.web_config

; Spring Framework configurations
(element
  (start_tag
    (tag_name) @spring.tag
    (#match? @spring.tag "^(beans|bean|property|constructor-arg|import|alias|util|context|aop|tx|jdbc|jee|mvc|task|cache|jms|jmx|lang|security)$"))
  (attribute
    (attribute_name) @spring.attr.name
    (attribute_value) @spring.attr.value)*
  (element)*) @definition.spring_config

; Spring bean definitions
(element
  (start_tag
    (tag_name) @spring.bean.tag
    (#eq? @spring.bean.tag "bean")
    (attribute
      (attribute_name) @spring.bean.id.attr
      (#match? @spring.bean.id.attr "^(id|name|class|parent|abstract|lazy-init|autowire|dependency-check|depends-on|autowire-candidate|primary|factory-method|factory-bean|init-method|destroy-method|scope)$")
      (attribute_value) @spring.bean.id.value))*)
  (element
    (start_tag
      (tag_name) @spring.property.tag
      (#eq? @spring.property.tag "property")
      (attribute
        (attribute_name) @spring.property.name.attr
        (#eq? @spring.property.name.attr "name")
        (attribute_value) @spring.property.name.value))
      (attribute
        (attribute_name) @spring.property.ref.attr
        (#eq? @spring.property.ref.attr "ref")
        (attribute_value) @spring.property.ref.value)?
      (attribute
        (attribute_name) @spring.property.value.attr
        (#eq? @spring.property.value.attr "value")
        (attribute_value) @spring.property.value.value)?)*) @definition.spring_bean

; JBoss/WildFly configurations
(element
  (start_tag
    (tag_name) @jboss.tag
    (#match? @jboss.tag "^(server|profile|subsystem|socket-binding-group|interfaces|socket-bindings|system-properties|management|extensions|datasources|datasource|drivers|driver|deployment-scanner|logging|periodic-rotating-file-handler|size-rotating-file-handler|async-handler|logger|root-logger|console-handler)$"))
  (element)*) @definition.jboss_config

; Tomcat configurations
(element
  (start_tag
    (tag_name) @tomcat.tag
    (#match? @tomcat.tag "^(Server|Service|Connector|Engine|Host|Context|Realm|Valve|Listener|GlobalNamingResources|Resource|ResourceParams|Environment|Manager|Store|Loader|Pipeline|Cluster|ClusterListener|Manager|SessionIdGenerator)$"))
  (attribute
    (attribute_name) @tomcat.attr.name
    (attribute_value) @tomcat.attr.value)*
  (element)*) @definition.tomcat_config

; JPA/Hibernate configurations
(element
  (start_tag
    (tag_name) @jpa.tag
    (#match? @jpa.tag "^(persistence|persistence-unit|properties|property|class|mapping-file|jar-file|exclude-unlisted-classes|shared-cache-mode|validation-mode|provider|jta-data-source|non-jta-data-source|transaction-type|caching|entity|embeddable|mapped-superclass|entity-listeners|pre-persist|post-persist|pre-remove|post-remove|pre-update|post-update|post-load)$"))
  (element)*) @definition.jpa_config

; JAXB configurations
(element
  (start_tag
    (tag_name) @jaxb.tag
    (#match? @jaxb.tag "^(bindings|schemaBindings|package|nameXmlTransform|javaType|class|globalBindings|serializable|typesafeEnumClass|typesafeEnumMember)$"))
  (element)*) @definition.jaxb_config

; General XML element with attributes
(element
  (start_tag
    (tag_name) @element.tag
    (attribute
      (attribute_name) @element.attr.name
      (attribute_value) @element.attr.value)*)
  (element)*) @definition.xml_element

; XML attributes
(attribute
  (attribute_name) @attr.name
  (attribute_value) @attr.value) @definition.xml_attribute

; XML text content
(text) @xml_text_content

; XML comments
(comment) @xml_comment
`
