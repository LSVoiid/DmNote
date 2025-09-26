import Module from "module";
import path from "node:path";

type ResolveFn = (
  request: string,
  parent: NodeModule | null | undefined,
  isMain: boolean,
  options?: { paths?: string[] }
) => string;

const moduleRef = Module as unknown as { _resolveFilename: ResolveFn };

const aliasEntries = [
  ["@main", path.join(__dirname)],
  ["@shared", path.join(__dirname, "..", "shared")],
  ["@src", path.join(__dirname, "..")],
] as const;

const originalResolveFilename: ResolveFn =
  moduleRef._resolveFilename.bind(Module);

moduleRef._resolveFilename = function (request, parent, isMain, options) {
  for (const [alias, target] of aliasEntries) {
    if (request === alias) {
      return originalResolveFilename(target, parent, isMain, options);
    }
    if (request.startsWith(`${alias}/`)) {
      const relative = request.slice(alias.length + 1);
      const resolved = path.join(target, relative);
      return originalResolveFilename(resolved, parent, isMain, options);
    }
  }

  return originalResolveFilename(request, parent, isMain, options);
};
