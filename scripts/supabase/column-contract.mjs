import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const member = (type, name) => type?.members?.find(node => node.name?.text === name)?.type;

/** Validate the checked-in database row contract too, including select('*'). */
export function typedColumns(source) {
  const file = ts.createSourceFile("database.types.ts", source, ts.ScriptTarget.Latest, true);
  const database = file.statements.find(node => node.name?.text === "Database")?.type;
  const schema = member(database, "public");
  if (!schema) throw new Error("Database.public 타입을 읽을 수 없습니다.");
  const result = [];
  for (const kind of ["Tables", "Views"]) {
    for (const table of member(schema, kind)?.members ?? []) {
      for (const column of member(table.type, "Row")?.members ?? []) {
        if (column.name?.text) result.push({ kind: "relation", name: table.name.text, column: column.name.text, file: "src/lib/database.types.ts" });
      }
    }
  }
  if (!result.length) throw new Error("DB 컬럼 계약이 비어 있습니다.");
  return result;
}

function unwrap(node) {
  while (node && (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node))) node = node.expression;
  return node;
}

/** Constants and imported constants are resolved with TS symbols, not regex. */
export function inspectQueryColumns(files, projectRoot) {
  const config = ts.readConfigFile(path.join(projectRoot, "tsconfig.json"), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config ?? {}, ts.sys, projectRoot);
  const program = ts.createProgram(files, { ...parsed.options, noEmit: true });
  const checker = program.getTypeChecker();
  const initializer = node => {
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return symbol?.valueDeclaration?.initializer;
  };
  const literal = (input, depth = 0) => {
    const node = unwrap(input);
    if (!node || depth > 12) return null;
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isIdentifier(node)) return literal(initializer(node), depth + 1);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = literal(node.left, depth + 1), right = literal(node.right, depth + 1);
      return left !== null && right !== null ? left + right : null;
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "join") {
      let array = unwrap(node.expression.expression);
      if (ts.isIdentifier(array)) array = unwrap(initializer(array));
      if (array && ts.isArrayLiteralExpression(array)) {
        const values = array.elements.map(item => literal(item, depth + 1));
        const delimiter = node.arguments.length ? literal(node.arguments[0], depth + 1) : ",";
        if (values.every(value => value !== null) && delimiter !== null) return values.join(delimiter);
      }
    }
    if (ts.isTemplateExpression(node)) {
      let result = node.head.text;
      for (const span of node.templateSpans) {
        const value = literal(span.expression, depth + 1);
        if (value === null) return null;
        result += value + span.literal.text;
      }
      return result;
    }
    return null;
  };
  const origin = (input, depth = 0) => {
    const node = unwrap(input);
    if (!node || depth > 24) return null;
    if (ts.isIdentifier(node)) return origin(initializer(node), depth + 1);
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return null;
    const method = node.expression.name.text;
    if (method === "from" || method === "rpc") {
      if (node.expression.expression.getText().includes(".storage")) return null;
      const name = literal(node.arguments[0]);
      return name ? { kind: method === "rpc" ? "function" : "relation", name } : null;
    }
    return origin(node.expression.expression, depth + 1);
  };
  const projections = [], unresolved = [];
  for (const name of files) {
    const file = program.getSourceFile(name);
    if (!file) continue;
    const visit = node => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "select") {
        const target = origin(node.expression.expression);
        if (target) {
          const select = node.arguments.length ? literal(node.arguments[0]) : "*";
          const reference = { ...target, file: path.relative(projectRoot, name), line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1 };
          if (select === null) unresolved.push(reference);
          else projections.push({ ...reference, select });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return { projections, unresolved };
}

// Split only at the current projection level, preserving embedded relations.
function splitProjection(value) {
  let depth = 0, start = 0; const parts = [];
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") depth++;
    if (value[i] === ")") depth--;
    if (value[i] === "," && depth === 0) { parts.push(value.slice(start, i)); start = i + 1; }
  }
  parts.push(value.slice(start));
  return parts.map(part => part.trim()).filter(Boolean);
}

export function diffColumns(contracts, projections, catalog) {
  const missing = [], required = [...contracts];
  const columns = new Set(catalog.columns.map(row => `${row.kind}:${row.name}.${row.column}`));
  function expand(reference, select) {
    for (const item of splitProjection(select)) {
      if (item === "*" || item === "count()") continue;
      const open = item.indexOf("(");
      if (open !== -1) {
        const relation = item.slice(0, open).split(":").at(-1).split("!")[0];
        const target = catalog.foreignKeys.find(row => row.name === reference.name && (row.column === relation || row.target === relation || row.constraint === relation))?.target;
        if (target) expand({ ...reference, kind: "relation", name: target }, item.slice(open + 1, -1));
        else missing.push({ ...reference, column: item, reason: "검증할 수 없는 관계 선택" });
      } else {
        const column = item.replace(/^[^:]+:(?!:)/, "").split(/->|::/)[0];
        required.push({ ...reference, column });
      }
    }
  }
  for (const reference of projections) expand(reference, reference.select);
  for (const reference of required) if (!columns.has(`${reference.kind}:${reference.name}.${reference.column}`)) missing.push(reference);
  return missing;
}

export function scanColumnContract(projectRoot, files) {
  const contracts = typedColumns(fs.readFileSync(path.join(projectRoot, "src/lib/database.types.ts"), "utf8"));
  return { contracts, ...inspectQueryColumns(files, projectRoot) };
}
