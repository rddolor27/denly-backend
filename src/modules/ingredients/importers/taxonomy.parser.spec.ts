import { describe, expect, it } from 'vitest';
import { CatalogImportError } from '../errors/ingredients.errors.js';
import { parseTaxonomy } from './taxonomy.parser.js';

function problemsOf(text: string): string[] {
  try {
    parseTaxonomy(text);
  } catch (error) {
    expect(error).toBeInstanceOf(CatalogImportError);
    return (error as CatalogImportError).details?.['problems'] as string[];
  }
  throw new Error('expected parseTaxonomy to throw');
}

const VALID = `
version: "2026.09.2"
sources:
  lvis: LVIS v1 category names
classes:
  - { id: 0, name: egg, tier: A, group: egg, aliases: { tl: [itlog], en: [eggs] }, sources: { lvis: [egg] } }
  - { id: 1, name: sweet_potato, tier: B, group: root, aliases: {} }
  - { id: 2, name: clams, tier: A, group: seafood, aliases: { tl: [halaan], ceb: [], mdh: } }
  - { id: 3, name: leek, tier: B, group: vegetable }
`;

describe('parseTaxonomy', () => {
  it('parses version, classes and aliases, ignoring sources', () => {
    const taxonomy = parseTaxonomy(VALID);

    expect(taxonomy.version).toBe('2026.09.2');
    expect(taxonomy.classes).toEqual([
      {
        id: 0,
        name: 'egg',
        tier: 'A',
        group: 'egg',
        aliases: { tl: ['itlog'], en: ['eggs'] },
      },
      { id: 1, name: 'sweet_potato', tier: 'B', group: 'root', aliases: {} },
      {
        id: 2,
        name: 'clams',
        tier: 'A',
        group: 'seafood',
        aliases: { tl: ['halaan'], ceb: [], mdh: [] },
      },
      { id: 3, name: 'leek', tier: 'B', group: 'vegetable', aliases: {} },
    ]);
  });

  it('rejects text that is not YAML', () => {
    expect(problemsOf('classes: [\n  - {')).toHaveLength(1);
  });

  it('rejects a document that is not a mapping', () => {
    expect(problemsOf('- 1\n- 2')).toEqual(['the document must be a mapping']);
  });

  it('rejects a missing version and an empty class list', () => {
    expect(problemsOf('classes: []')).toEqual([
      'version must be a non-empty string',
      'classes must be a non-empty list',
    ]);
  });

  it('rejects ids that are not contiguous from 0 in file order', () => {
    const problems = problemsOf(`
version: v
classes:
  - { id: 1, name: egg, tier: A, group: egg }
  - { id: 0, name: tomato, tier: A, group: vegetable }
`);
    expect(problems).toEqual([
      'classes[0]: ids must be contiguous from 0, got 1',
      'classes[1]: ids must be contiguous from 0, got 0',
    ]);
  });

  it('rejects a non-integer id', () => {
    expect(
      problemsOf(
        'version: v\nclasses:\n  - { id: 0.5, name: egg, tier: A, group: egg }',
      ),
    ).toEqual(['classes[0]: id must be an integer']);
  });

  it('rejects bad names, duplicate names, tiers and groups', () => {
    const problems = problemsOf(`
version: v
classes:
  - { id: 0, name: Egg, tier: A, group: egg }
  - { id: 1, name: tomato, tier: C, group: "" }
  - { id: 2, name: tomato, tier: B, group: vegetable }
  - "not a mapping"
`);
    expect(problems).toEqual([
      'classes[0]: name must be lowercase snake_case',
      'classes[1]: tier must be A or B',
      'classes[1]: group must be a non-empty string',
      'classes[2]: duplicate class name tomato',
      'classes[3]: must be a mapping',
    ]);
  });

  it('rejects malformed aliases', () => {
    const problems = problemsOf(`
version: v
classes:
  - { id: 0, name: egg, tier: A, group: egg, aliases: [itlog] }
  - { id: 1, name: tomato, tier: A, group: vegetable, aliases: { Tagalog: [kamatis] } }
  - { id: 2, name: onion, tier: A, group: aromatic, aliases: { tl: sibuyas } }
  - { id: 3, name: garlic, tier: A, group: aromatic, aliases: { tl: [bawang, 3] } }
`);
    expect(problems).toEqual([
      'classes[0]: aliases must be a mapping',
      'classes[1]: alias language "Tagalog" is not a 2-3 letter code',
      'classes[2]: aliases.tl must be a list of strings',
      'classes[3]: aliases.tl must be a list of strings',
    ]);
  });

  it('collects every problem into one error', () => {
    const problems = problemsOf(`
version: ""
classes:
  - { id: 3, name: egg, tier: A, group: egg }
  - { id: 1, name: 9lives, tier: A, group: egg }
`);
    expect(problems).toEqual([
      'version must be a non-empty string',
      'classes[0]: ids must be contiguous from 0, got 3',
      'classes[1]: name must be lowercase snake_case',
    ]);
  });
});
