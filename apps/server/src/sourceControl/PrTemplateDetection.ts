import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

const TEMPLATE_MAX_BYTES = 8_000;

const TEMPLATE_PATHS = [
  [".github", "pull_request_template.md"],
  [".github", "PULL_REQUEST_TEMPLATE.md"],
  ["pull_request_template.md"],
  ["PULL_REQUEST_TEMPLATE.md"],
  ["docs", "pull_request_template.md"],
  ["docs", "PULL_REQUEST_TEMPLATE.md"],
] as const;

const TEMPLATE_DIRECTORIES = [
  [".github", "PULL_REQUEST_TEMPLATE"],
  ["PULL_REQUEST_TEMPLATE"],
  ["docs", "PULL_REQUEST_TEMPLATE"],
] as const;

function isWithinRoot(path: Path.Path, canonicalRoot: string, canonicalCandidate: string): boolean {
  const relative = path.relative(canonicalRoot, canonicalCandidate);
  return !path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`);
}

function readTemplate(input: {
  fileSystem: FileSystem.FileSystem;
  path: Path.Path;
  canonicalRoot: string;
  templatePath: string;
}): Effect.Effect<Option.Option<string>, never> {
  return Effect.gen(function* () {
    const canonicalTemplate = yield* input.fileSystem.realPath(input.templatePath);
    if (!isWithinRoot(input.path, input.canonicalRoot, canonicalTemplate)) {
      return Option.none();
    }

    return yield* Effect.scoped(
      Effect.gen(function* () {
        const file = yield* input.fileSystem.open(canonicalTemplate, { flag: "r" });
        const info = yield* file.stat;
        if (info.type !== "File" || info.size === 0n) {
          return Option.none();
        }

        const bytesToRead = Number(
          info.size > BigInt(TEMPLATE_MAX_BYTES) ? BigInt(TEMPLATE_MAX_BYTES) : info.size,
        );
        const chunks: Uint8Array[] = [];
        let bytesRead = 0;
        while (bytesRead < bytesToRead) {
          const chunk = yield* file.readAlloc(bytesToRead - bytesRead);
          if (Option.isNone(chunk)) {
            break;
          }
          chunks.push(chunk.value);
          bytesRead += chunk.value.length;
        }
        if (bytesRead === 0) {
          return Option.none();
        }

        const bytes = new Uint8Array(bytesRead);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        const template = new TextDecoder().decode(bytes).trim();
        if (template.length === 0) {
          return Option.none();
        }

        return Option.some(
          info.size > BigInt(TEMPLATE_MAX_BYTES) ? `${template}\n\n[truncated]` : template,
        );
      }),
    );
  }).pipe(Effect.orElseSucceed(() => Option.none()));
}

type DirectoryTemplateResult =
  | { readonly _tag: "None" }
  | { readonly _tag: "Ambiguous" }
  | { readonly _tag: "Template"; readonly template: string };

function readTemplateDirectory(input: {
  fileSystem: FileSystem.FileSystem;
  path: Path.Path;
  canonicalRoot: string;
  directoryPath: string;
}): Effect.Effect<DirectoryTemplateResult, never> {
  return Effect.gen(function* () {
    const canonicalDirectory = yield* input.fileSystem.realPath(input.directoryPath);
    if (!isWithinRoot(input.path, input.canonicalRoot, canonicalDirectory)) {
      return { _tag: "None" } as const;
    }

    const info = yield* input.fileSystem.stat(canonicalDirectory);
    if (info.type !== "Directory") {
      return { _tag: "None" } as const;
    }

    const entries = yield* input.fileSystem.readDirectory(canonicalDirectory);
    const templates: string[] = [];
    for (const entry of entries) {
      if (input.path.extname(entry).toLowerCase() !== ".md") {
        continue;
      }

      const template = yield* readTemplate({
        ...input,
        templatePath: input.path.join(canonicalDirectory, entry),
      });
      if (Option.isSome(template)) {
        templates.push(template.value);
        if (templates.length > 1) {
          return { _tag: "Ambiguous" } as const;
        }
      }
    }

    return templates[0]
      ? ({ _tag: "Template", template: templates[0] } as const)
      : ({ _tag: "None" } as const);
  }).pipe(Effect.orElseSucceed(() => ({ _tag: "None" }) as const));
}

export const detectPrTemplate = Effect.fn("detectPrTemplate")(function* (cwd: string) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const canonicalRoot = yield* fileSystem.realPath(cwd).pipe(Effect.option);
  if (Option.isNone(canonicalRoot)) {
    return Option.none();
  }

  for (const segments of TEMPLATE_PATHS) {
    const template = yield* readTemplate({
      fileSystem,
      path,
      canonicalRoot: canonicalRoot.value,
      templatePath: path.join(cwd, ...segments),
    });
    if (Option.isSome(template)) {
      return template;
    }
  }

  for (const segments of TEMPLATE_DIRECTORIES) {
    const result = yield* readTemplateDirectory({
      fileSystem,
      path,
      canonicalRoot: canonicalRoot.value,
      directoryPath: path.join(cwd, ...segments),
    });
    if (result._tag === "Template") {
      return Option.some(result.template);
    }
    if (result._tag === "Ambiguous") {
      return Option.none();
    }
  }

  return Option.none();
});
