// A small expression / statement language used by condition nodes,
// instruction nodes, and pin scripts. Grammar (loosely):
//
//   program    := statement (';' statement)* ';'?
//   statement  := IDENT ('=' | '+=' | '-=' | '*=' | '/=') expr | expr
//   expr       := or
//   or         := and ('||' and)*
//   and        := equality ('&&' equality)*
//   equality   := comparison (('==' | '!=') comparison)*
//   comparison := additive (('<' | '>' | '<=' | '>=') additive)*
//   additive   := multiplicative (('+' | '-') multiplicative)*
//   mult       := unary (('*' | '/' | '%') unary)*
//   unary      := ('!' | '-') unary | primary
//   primary    := NUMBER | STRING | 'true' | 'false' | IDENT | '(' expr ')'
//
// Identifiers are namespaced variable references such as `inventory.gold`.
// Variables must be declared in the project's variable sets; assigning a
// value of a different type than the variable's current value is an error.

import type { ScriptValue } from '../types';

export type VarEnv = Record<string, ScriptValue>;

export class ScriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScriptError';
  }
}

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'id'; value: string }
  | { kind: 'op'; value: string };

const TWO_CHAR_OPS = new Set(['==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=']);
const ONE_CHAR_OPS = new Set(['+', '-', '*', '/', '%', '<', '>', '!', '=', '(', ')', ';']);

function isIdentStart(c: string): boolean {
  return /[A-Za-z_]/.test(c);
}

function isIdentChar(c: string): boolean {
  return /[A-Za-z0-9_]/.test(c);
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    // line comments
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j]!)) j++;
      const raw = src.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new ScriptError(`Invalid number "${raw}"`);
      tokens.push({ kind: 'num', value });
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let out = '';
      while (j < src.length && src[j] !== quote) {
        if (src[j] === '\\' && j + 1 < src.length) {
          const esc = src[j + 1]!;
          out += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc;
          j += 2;
        } else {
          out += src[j];
          j++;
        }
      }
      if (j >= src.length) throw new ScriptError('Unterminated string');
      tokens.push({ kind: 'str', value: out });
      i = j + 1;
      continue;
    }
    if (isIdentStart(c)) {
      let j = i;
      while (j < src.length && (isIdentChar(src[j]!) || (src[j] === '.' && j + 1 < src.length && isIdentStart(src[j + 1]!)))) {
        j++;
      }
      tokens.push({ kind: 'id', value: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (TWO_CHAR_OPS.has(two)) {
      tokens.push({ kind: 'op', value: two });
      i += 2;
      continue;
    }
    if (ONE_CHAR_OPS.has(c)) {
      tokens.push({ kind: 'op', value: c });
      i++;
      continue;
    }
    throw new ScriptError(`Unexpected character "${c}"`);
  }
  return tokens;
}

type Expr =
  | { type: 'lit'; value: ScriptValue }
  | { type: 'var'; name: string }
  | { type: 'unary'; op: string; operand: Expr }
  | { type: 'binary'; op: string; left: Expr; right: Expr };

type Stmt = { type: 'assign'; target: string; op: string; expr: Expr } | { type: 'expr'; expr: Expr };

class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new ScriptError('Unexpected end of script');
    this.pos++;
    return t;
  }

  private matchOp(...ops: string[]): string | null {
    const t = this.peek();
    if (t && t.kind === 'op' && ops.includes(t.value)) {
      this.pos++;
      return t.value;
    }
    return null;
  }

  parseProgram(): Stmt[] {
    const stmts: Stmt[] = [];
    while (this.peek()) {
      if (this.matchOp(';')) continue; // tolerate stray semicolons
      stmts.push(this.parseStatement());
      const after = this.peek();
      if (after) {
        if (after.kind === 'op' && after.value === ';') {
          this.pos++;
        } else {
          throw new ScriptError(`Expected ";" between statements, found "${tokenText(after)}"`);
        }
      }
    }
    return stmts;
  }

  private parseStatement(): Stmt {
    const t = this.peek();
    const t2 = this.tokens[this.pos + 1];
    if (
      t &&
      t.kind === 'id' &&
      t.value !== 'true' &&
      t.value !== 'false' &&
      t2 &&
      t2.kind === 'op' &&
      ['=', '+=', '-=', '*=', '/='].includes(t2.value)
    ) {
      this.pos += 2;
      return { type: 'assign', target: t.value, op: t2.value, expr: this.parseExpr() };
    }
    return { type: 'expr', expr: this.parseExpr() };
  }

  private parseExpr(): Expr {
    return this.parseOr();
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.matchOp('||')) {
      left = { type: 'binary', op: '||', left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseEquality();
    while (this.matchOp('&&')) {
      left = { type: 'binary', op: '&&', left, right: this.parseEquality() };
    }
    return left;
  }

  private parseEquality(): Expr {
    let left = this.parseComparison();
    let op: string | null;
    while ((op = this.matchOp('==', '!='))) {
      left = { type: 'binary', op, left, right: this.parseComparison() };
    }
    return left;
  }

  private parseComparison(): Expr {
    let left = this.parseAdditive();
    let op: string | null;
    while ((op = this.matchOp('<', '>', '<=', '>='))) {
      left = { type: 'binary', op, left, right: this.parseAdditive() };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    let op: string | null;
    while ((op = this.matchOp('+', '-'))) {
      left = { type: 'binary', op, left, right: this.parseMultiplicative() };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    let op: string | null;
    while ((op = this.matchOp('*', '/', '%'))) {
      left = { type: 'binary', op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): Expr {
    const op = this.matchOp('!', '-');
    if (op) {
      return { type: 'unary', op, operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const t = this.next();
    if (t.kind === 'num') return { type: 'lit', value: t.value };
    if (t.kind === 'str') return { type: 'lit', value: t.value };
    if (t.kind === 'id') {
      if (t.value === 'true') return { type: 'lit', value: true };
      if (t.value === 'false') return { type: 'lit', value: false };
      return { type: 'var', name: t.value };
    }
    if (t.kind === 'op' && t.value === '(') {
      const inner = this.parseExpr();
      if (!this.matchOp(')')) throw new ScriptError('Expected ")"');
      return inner;
    }
    throw new ScriptError(`Unexpected token "${tokenText(t)}"`);
  }
}

function tokenText(t: Token): string {
  return t.kind === 'str' ? `"${t.value}"` : String(t.value);
}

export function truthy(v: ScriptValue): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  return v.length > 0;
}

function typeName(v: ScriptValue): string {
  return typeof v === 'number' ? 'integer' : typeof v;
}

function evalExpr(expr: Expr, env: VarEnv): ScriptValue {
  switch (expr.type) {
    case 'lit':
      return expr.value;
    case 'var': {
      const v = env[expr.name];
      if (v === undefined) throw new ScriptError(`Unknown variable "${expr.name}"`);
      return v;
    }
    case 'unary': {
      const v = evalExpr(expr.operand, env);
      if (expr.op === '!') return !truthy(v);
      if (typeof v !== 'number') throw new ScriptError('Unary "-" needs a number');
      return -v;
    }
    case 'binary': {
      const { op } = expr;
      if (op === '&&') return truthy(evalExpr(expr.left, env)) && truthy(evalExpr(expr.right, env));
      if (op === '||') return truthy(evalExpr(expr.left, env)) || truthy(evalExpr(expr.right, env));
      const l = evalExpr(expr.left, env);
      const r = evalExpr(expr.right, env);
      if (op === '==') return l === r;
      if (op === '!=') return l !== r;
      if (op === '+') {
        if (typeof l === 'string' || typeof r === 'string') return String(l) + String(r);
        if (typeof l === 'number' && typeof r === 'number') return l + r;
        throw new ScriptError('Cannot add booleans');
      }
      if (typeof l !== 'number' || typeof r !== 'number') {
        if ((op === '<' || op === '>' || op === '<=' || op === '>=') && typeof l === 'string' && typeof r === 'string') {
          if (op === '<') return l < r;
          if (op === '>') return l > r;
          if (op === '<=') return l <= r;
          return l >= r;
        }
        throw new ScriptError(`Operator "${op}" needs numbers (got ${typeName(l)} and ${typeName(r)})`);
      }
      switch (op) {
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          if (r === 0) throw new ScriptError('Division by zero');
          return Math.trunc(l / r);
        case '%':
          if (r === 0) throw new ScriptError('Division by zero');
          return l % r;
        case '<':
          return l < r;
        case '>':
          return l > r;
        case '<=':
          return l <= r;
        case '>=':
          return l >= r;
        default:
          throw new ScriptError(`Unknown operator "${op}"`);
      }
    }
  }
}

function parse(src: string): Stmt[] {
  return new Parser(tokenize(src)).parseProgram();
}

/** Runs a script against a copy of `env`; returns the new env and the last value. */
export function runScript(src: string, env: VarEnv): { env: VarEnv; result: ScriptValue | undefined } {
  const stmts = parse(src);
  const next: VarEnv = { ...env };
  let result: ScriptValue | undefined;
  for (const stmt of stmts) {
    if (stmt.type === 'expr') {
      result = evalExpr(stmt.expr, next);
      continue;
    }
    const current = next[stmt.target];
    if (current === undefined) throw new ScriptError(`Unknown variable "${stmt.target}"`);
    let value = evalExpr(stmt.expr, next);
    if (stmt.op !== '=') {
      const op = stmt.op[0]!;
      value = evalExpr(
        { type: 'binary', op, left: { type: 'lit', value: current }, right: { type: 'lit', value } },
        next
      );
    }
    if (typeof value !== typeof current) {
      throw new ScriptError(
        `Cannot assign ${typeName(value)} to ${typeName(current)} variable "${stmt.target}"`
      );
    }
    if (typeof value === 'number') value = Math.trunc(value);
    next[stmt.target] = value;
    result = value;
  }
  return { env: next, result };
}

/** Empty scripts are treated as `true`. */
export function evaluateCondition(src: string, env: VarEnv): boolean {
  if (!src.trim()) return true;
  const { result } = runScript(src, env);
  return result === undefined ? true : truthy(result);
}

/** Empty scripts are a no-op. Returns a new env. */
export function executeInstruction(src: string, env: VarEnv): VarEnv {
  if (!src.trim()) return env;
  return runScript(src, env).env;
}

/** Returns null when the script parses, else a human-readable error. */
export function validateScript(src: string): string | null {
  if (!src.trim()) return null;
  try {
    parse(src);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
