import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Scope from "effect/Scope";

import { detectPrTemplate } from "./PrTemplateDetection.ts";

const SINGLE_TEMPLATE_PATHS = [
  ".github/pull_request_template.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  "pull_request_template.md",
  "PULL_REQUEST_TEMPLATE.md",
  "docs/pull_request_template.md",
  "docs/PULL_REQUEST_TEMPLATE.md",
] as const;

const TEMPLATE_DIRECTORIES = [
  ".github/PULL_REQUEST_TEMPLATE",
  "PULL_REQUEST_TEMPLATE",
  "docs/PULL_REQUEST_TEMPLATE",
] as const;

const runWithTempDirectory = <A>(
  test: (
    cwd: string,
  ) => Effect.Effect<
    A,
    PlatformError.PlatformError,
    FileSystem.FileSystem | Path.Path | Scope.Scope
  >,
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const cwd = yield* fileSystem.makeTempDirectoryScoped({ prefix: "t3-pr-template-" });
      return yield* test(cwd);
    }),
  ).pipe(Effect.provide(NodeServices.layer));

const writeTemplate = (cwd: string, relativePath: string, contents: string) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const templatePath = path.join(cwd, relativePath);
    yield* fileSystem.makeDirectory(path.dirname(templatePath), { recursive: true });
    yield* fileSystem.writeFileString(templatePath, contents);
    return templatePath;
  });

it.effect.each(SINGLE_TEMPLATE_PATHS)("recognizes $0", (relativePath) =>
  runWithTempDirectory((cwd) =>
    Effect.gen(function* () {
      yield* writeTemplate(cwd, relativePath, `template from ${relativePath}`);

      const template = yield* detectPrTemplate(cwd);
      assert.strictEqual(Option.getOrUndefined(template), `template from ${relativePath}`);
    }),
  ),
);

it.effect("uses the first non-empty template in the configured path order", () =>
  runWithTempDirectory((cwd) =>
    Effect.gen(function* () {
      yield* writeTemplate(cwd, ".github/pull_request_template.md", " \n");
      yield* writeTemplate(cwd, ".github/PULL_REQUEST_TEMPLATE.md", "  ## Preferred template  \n");
      yield* writeTemplate(cwd, "pull_request_template.md", "## Later template");

      const template = yield* detectPrTemplate(cwd);
      assert.strictEqual(Option.getOrUndefined(template), "## Preferred template");
    }),
  ),
);

it.effect.each(TEMPLATE_DIRECTORIES)("recognizes the $0 directory", (relativeDirectory) =>
  runWithTempDirectory((cwd) =>
    Effect.gen(function* () {
      yield* writeTemplate(cwd, `${relativeDirectory}/template.MD`, "directory template");

      const template = yield* detectPrTemplate(cwd);
      assert.strictEqual(Option.getOrUndefined(template), "directory template");
    }),
  ),
);

it.effect("skips unusable directory entries and uses the one valid template", () =>
  runWithTempDirectory((cwd) =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const templateDirectory = path.join(cwd, ".github", "PULL_REQUEST_TEMPLATE");
      yield* fileSystem.makeDirectory(path.join(templateDirectory, "b-directory.md"), {
        recursive: true,
      });
      yield* fileSystem.writeFileString(path.join(templateDirectory, "a-empty.md"), " \n");
      yield* fileSystem.symlink(
        path.join(templateDirectory, "missing.md"),
        path.join(templateDirectory, "c-broken.md"),
      );
      yield* fileSystem.writeFileString(path.join(templateDirectory, "z-valid.md"), "valid");

      const template = yield* detectPrTemplate(cwd);
      assert.strictEqual(Option.getOrUndefined(template), "valid");
    }),
  ),
);

it.effect("does not guess between multiple directory templates", () =>
  runWithTempDirectory((cwd) =>
    Effect.gen(function* () {
      yield* writeTemplate(cwd, ".github/PULL_REQUEST_TEMPLATE/a.md", "first");
      yield* writeTemplate(cwd, ".github/PULL_REQUEST_TEMPLATE/b.md", "second");
      yield* writeTemplate(cwd, "PULL_REQUEST_TEMPLATE/fallback.md", "fallback");

      const template = yield* detectPrTemplate(cwd);
      assert.isTrue(Option.isNone(template));
    }),
  ),
);

it.effect("rejects a template symlink escaping the repository", () =>
  runWithTempDirectory((cwd) =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const outsideDirectory = yield* fileSystem.makeTempDirectoryScoped({
        prefix: "t3-pr-template-outside-",
      });
      const outsideTemplate = path.join(outsideDirectory, "secret.md");
      yield* fileSystem.writeFileString(outsideTemplate, "LOCAL_SECRET_SENTINEL");
      yield* fileSystem.makeDirectory(path.join(cwd, ".github"), { recursive: true });
      yield* fileSystem.symlink(
        outsideTemplate,
        path.join(cwd, ".github", "pull_request_template.md"),
      );
      yield* writeTemplate(cwd, "pull_request_template.md", "safe template");

      const template = yield* detectPrTemplate(cwd);
      assert.strictEqual(Option.getOrUndefined(template), "safe template");
      assert.notInclude(
        Option.getOrElse(template, () => ""),
        "LOCAL_SECRET_SENTINEL",
      );
    }),
  ),
);

it.effect("bounds template reads and marks truncated content", () =>
  runWithTempDirectory((cwd) =>
    Effect.gen(function* () {
      const prefix = "a".repeat(8_000);
      yield* writeTemplate(cwd, ".github/pull_request_template.md", `${prefix}SECRET_SENTINEL`);

      const template = Option.getOrThrow(yield* detectPrTemplate(cwd));
      assert.strictEqual(template, `${prefix}\n\n[truncated]`);
      assert.notInclude(template, "SECRET_SENTINEL");
    }),
  ),
);
