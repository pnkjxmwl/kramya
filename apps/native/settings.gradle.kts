// A STANDALONE Gradle build that happens to live inside the pnpm workspace.
//
// pnpm-workspace.yaml globs the apps directory, but a folder with no package.json is
// simply not a workspace package - so pnpm, turbo and the root lint/typecheck pipeline
// ignore this whole tree. That is deliberate: a Kotlin app has nothing to say to
// `turbo run typecheck`, and wiring it in would only mean a Node task that shells out
// to Gradle and makes every JS build wait on the Android toolchain.
//
// LINE COMMENTS, NOT A BLOCK COMMENT, AND THAT IS LOAD-BEARING.
//
// Kotlin block comments NEST, unlike Java's. This header originally said "globs
// `apps/*`" inside a block comment - and that slash-star opened a nested comment, so
// the closing star-slash only closed the inner one and the entire pluginManagement
// block below was swallowed as comment text. Gradle does not report that as an error:
// it falls back to the default plugin repository and reports AGP as missing, listing a
// repository set that excludes everything declared here. An hour, for a glob in prose.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    // Modules declare no repositories of their own; everything resolves from here.
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "kramya-native"
include(":app")
