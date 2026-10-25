// Canonical skill normalization — pure, deterministic, no imports, no side effects.

// Tech names whose punctuation must be preserved before the generic punctuation-strip.
// Sorted longest-first at module init so e.g. 'asp.net' wins over '.net'.
const PROTECTED_MAP = {
  'node.js': 'nodejs',
  'react.js': 'reactjs',
  'vue.js': 'vuejs',
  'next.js': 'nextjs',
  'nuxt.js': 'nuxtjs',
  'express.js': 'expressjs',
  'three.js': 'threejs',
  'angular.js': 'angularjs',
  'd3.js': 'd3js',
  'asp.net': 'aspnet',
  'vb.net': 'vbnet',
  '.net': 'dotnet',
  'c++': 'cplusplus',
  'c#': 'csharp',
  'f#': 'fsharp',
  'ci/cd': 'cicd',
  'ui/ux': 'uiux',
  'objective-c': 'objectivec',
};

const PROTECTED_PAIRS = Object.entries(PROTECTED_MAP).sort(([a], [b]) => b.length - a.length);

// NFKC + lowercase -> protect punctuated tech names -> strip remaining punctuation -> collapse spaces.
export function normalize(raw) {
  let s = String(raw ?? '').normalize('NFKC').toLowerCase();
  for (const [from, to] of PROTECTED_PAIRS) s = s.replaceAll(from, to);
  return s.replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

// Abbreviation aliases only; the LLM judge handles open-ended synonyms.
// Keys are already-normalized forms. Ambiguous abbreviations (tf, cv, ai, r, c, go) are deliberately left out.
export const ALIASES = {
  k8s: 'kubernetes',
  pg: 'postgresql',
  postgres: 'postgresql',
  psql: 'postgresql',
  'postgre sql': 'postgresql',
  mongo: 'mongodb',
  mssql: 'sql server',
  'ms sql': 'sql server',
  'microsoft sql server': 'sql server',
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  golang: 'go',
  cpp: 'cplusplus',
  reactjs: 'react',
  'react js': 'react',
  vuejs: 'vue',
  'vue js': 'vue',
  angularjs: 'angular',
  'angular js': 'angular',
  node: 'nodejs',
  'node js': 'nodejs',
  'next js': 'nextjs',
  expressjs: 'express',
  'express js': 'express',
  gql: 'graphql',
  restful: 'rest',
  'rest api': 'rest',
  'rest apis': 'rest',
  'restful api': 'rest',
  'restful apis': 'rest',
  'object oriented': 'oop',
  'object oriented programming': 'oop',
  'ci cd': 'cicd',
  'continuous integration': 'cicd',
  'continuous delivery': 'cicd',
  'continuous deployment': 'cicd',
  'amazon web services': 'aws',
  'google cloud': 'gcp',
  'google cloud platform': 'gcp',
  'microsoft azure': 'azure',
  ml: 'machine learning',
  dl: 'deep learning',
  nlp: 'natural language processing',
  sklearn: 'scikit learn',
  'tailwind css': 'tailwind',
  tailwindcss: 'tailwind',
  powerbi: 'power bi',
  'ms excel': 'excel',
  'microsoft excel': 'excel',
  html5: 'html',
  css3: 'css',
  dsa: 'data structures and algorithms',
};

// Single hop: normalize -> alias lookup -> re-normalize. Idempotent (alias values are never alias keys).
export function canonical(raw) {
  const n = normalize(raw);
  const a = Object.hasOwn(ALIASES, n) ? ALIASES[n] : undefined;
  return a !== undefined ? normalize(a) : n;
}
