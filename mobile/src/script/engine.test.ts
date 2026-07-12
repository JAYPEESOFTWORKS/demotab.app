// Run with: npx tsx src/script/engine.test.ts
import { evaluateCondition, executeInstruction, runScript, validateScript } from './engine';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    failures++;
    console.error(`FAIL ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  } else {
    console.log(`ok   ${name}`);
  }
}
function checkThrows(name: string, fn: () => void) {
  try {
    fn();
    failures++;
    console.error(`FAIL ${name}: expected an error`);
  } catch {
    console.log(`ok   ${name}`);
  }
}

const env = { 'inv.gold': 10, 'story.done': false, 'hero.name': 'Ana' };

check('literal number', runScript('42', env).result, 42);
check('arith precedence', runScript('2 + 3 * 4', env).result, 14);
check('parens', runScript('(2 + 3) * 4', env).result, 20);
check('integer division truncates', runScript('7 / 2', env).result, 3);
check('modulo', runScript('7 % 3', env).result, 1);
check('unary minus', runScript('-(3 + 2)', env).result, -5);
check('var read', runScript('inv.gold', env).result, 10);
check('comparison', evaluateCondition('inv.gold >= 10', env), true);
check('comparison false', evaluateCondition('inv.gold > 10', env), false);
check('and/or', evaluateCondition('inv.gold >= 5 && !story.done', env), true);
check('or shortcut', evaluateCondition('story.done || inv.gold == 10', env), true);
check('string equality', evaluateCondition('hero.name == "Ana"', env), true);
check('string concat', runScript('hero.name + "!"', env).result, 'Ana!');
check('empty condition is true', evaluateCondition('   ', env), true);
check('bool literals', evaluateCondition('true && !false', env), true);

const afterAssign = executeInstruction('inv.gold = 3; story.done = true', env);
check('assignment', afterAssign['inv.gold'], 3);
check('assignment bool', afterAssign['story.done'], true);
check('original env untouched', env['inv.gold'], 10);

const afterCompound = executeInstruction('inv.gold += 5; inv.gold -= 2; inv.gold *= 2', env);
check('compound assignment', afterCompound['inv.gold'], 26);

check('multi statement result', runScript('inv.gold = 4; inv.gold + 1', env).result, 5);
check('comments ignored', runScript('// setup\ninv.gold = 2; inv.gold', env).result, 2);

checkThrows('unknown variable read', () => runScript('quest.stage', env));
checkThrows('unknown variable write', () => executeInstruction('quest.stage = 1', env));
checkThrows('type mismatch assignment', () => executeInstruction('inv.gold = "rich"', env));
checkThrows('division by zero', () => runScript('1 / 0', env));
checkThrows('unterminated string', () => runScript('"abc', env));

check('validate ok', validateScript('inv.gold >= 1 && story.done'), null);
check('validate empty ok', validateScript(''), null);
check('validate bad is message', typeof validateScript('inv.gold >='), 'string');

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  throw new Error('engine tests failed');
}
console.log('\nAll engine tests passed');
