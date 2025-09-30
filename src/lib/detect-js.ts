import * as parser from "@babel/parser";
import traverse from "@babel/traverse";

export type JsDetection = { file: string; hits: string[] };

const RE_LIGHT = {
  has: /:has\s*\(/, // handles string selectors in code, e.g., querySelector(":has(a)")
  "color-mix": /\bcolor-mix\s*\(/,
};

const JS_EXT = new Set([".js", ".jsx", ".ts", ".tsx"]);

export function isJsPath(p: string) {
  const ext = p.slice(p.lastIndexOf(".")).toLowerCase();
  return JS_EXT.has(ext);
}

export function detectJs(content: string, file: string): JsDetection | null {
  const hits = new Set<string>();

  // Light regex for simple string mentions (cheap wins)
  for (const [id, rx] of Object.entries(RE_LIGHT)) {
    if (rx.test(content)) hits.add(id);
  }

  // AST for document.startViewTransition(...) and AbortSignal.timeout(...)
  try {
    const ast = parser.parse(content, {
      sourceType: "unambiguous",
      plugins: ["jsx", "typescript"],
    });

    traverse(ast, {
      CallExpression(path) {
        const callee: any = path.node.callee;

        // document.startViewTransition(...)
        // Matches MemberExpression { object: Identifier 'document', property: Identifier 'startViewTransition' }
        if (
          callee?.type === "MemberExpression" &&
          callee.object?.type === "Identifier" &&
          callee.object.name === "document" &&
          callee.property?.type === "Identifier" &&
          callee.property.name === "startViewTransition"
        ) {
          hits.add("view-transitions");
        }

        // AbortSignal.timeout(...)
        if (
          callee?.type === "MemberExpression" &&
          callee.object?.type === "Identifier" &&
          callee.object.name === "AbortSignal" &&
          callee.property?.type === "Identifier" &&
          callee.property.name === "timeout"
        ) {
          hits.add("abortsignal-timeout");
        }
      },
    });
  } catch {
    // If AST parse fails (e.g., syntax), ignore silently for MVP
  }

  return hits.size ? { file, hits: Array.from(hits) } : null;
}
