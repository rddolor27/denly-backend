import { describe, expect, it } from 'vitest';
import { ModelVersionImportError } from '../errors/model-registry.errors.js';
import { parseClassesFile } from './classes-file.parser.js';

function problemsOf(text: string): string[] {
  try {
    parseClassesFile(text);
  } catch (error) {
    expect(error).toBeInstanceOf(ModelVersionImportError);
    return (error as ModelVersionImportError).details?.['problems'] as string[];
  }
  throw new Error('expected parseClassesFile to throw');
}

describe('parseClassesFile', () => {
  it('reads id and name from the denly-ml release format, ignoring other keys', () => {
    const entries = parseClassesFile(`- id: 0
  name: egg
  tier: A
  group: egg
- id: 1
  name: sweet_potato
  tier: A
  group: root
`);

    expect(entries).toEqual([
      { classId: 0, className: 'egg' },
      { classId: 1, className: 'sweet_potato' },
    ]);
  });

  it('keeps file order and allows gaps in ids', () => {
    expect(
      parseClassesFile('- {id: 4, name: leek}\n- {id: 2, name: egg}'),
    ).toEqual([
      { classId: 4, className: 'leek' },
      { classId: 2, className: 'egg' },
    ]);
  });

  it('rejects invalid YAML', () => {
    expect(problemsOf('- {id: 0, name: egg')).toHaveLength(1);
  });

  it('rejects anything but a non-empty list', () => {
    expect(problemsOf('[]')).toEqual(['the document must be a non-empty list']);
    expect(problemsOf('names: [egg]')).toEqual([
      'the document must be a non-empty list',
    ]);
  });

  it('collects every problem', () => {
    expect(
      problemsOf(`- {id: 0, name: egg}
- {id: 0, name: tomato}
- {id: -1, name: onion}
- {id: 1.5, name: Garlic}
- {id: 2, name: egg}
- just a string
`),
    ).toEqual([
      '[1]: duplicate id 0',
      '[2]: id must be a non-negative integer',
      '[3]: id must be a non-negative integer',
      '[3]: name must match ^[a-z][a-z0-9_]{0,63}$',
      '[4]: duplicate name egg',
      '[5]: must be a mapping',
    ]);
  });
});
