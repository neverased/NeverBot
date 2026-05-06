#!/usr/bin/env node

const fs = require('node:fs');

const MAX_GITHUB_SARIF_RUNS = 20;
const [inputPath = 'results.sarif', outputPath = 'github-code-scanning.sarif'] =
  process.argv.slice(2);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function slug(value, fallback) {
  const normalized = String(value ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function ruleKey(rule, index) {
  return rule?.id ?? rule?.name ?? JSON.stringify(rule) ?? `rule-${index}`;
}

function artifactKey(artifact, index) {
  return (
    artifact?.location?.uri ??
    artifact?.location?.uriBaseId ??
    JSON.stringify(artifact) ??
    `artifact-${index}`
  );
}

function dedupePush(target, values = []) {
  const seen = new Set(target.map((value) => JSON.stringify(value)));

  for (const value of values) {
    const key = JSON.stringify(value);
    if (!seen.has(key)) {
      seen.add(key);
      target.push(clone(value));
    }
  }
}

function remapArtifactIndices(value, artifactIndexMap) {
  if (!value || typeof value !== 'object') {
    return;
  }

  if (
    !Array.isArray(value) &&
    Number.isInteger(value.index) &&
    ('uri' in value || 'uriBaseId' in value)
  ) {
    const mappedIndex = artifactIndexMap.get(value.index);
    if (mappedIndex !== undefined) {
      value.index = mappedIndex;
    }
  }

  for (const child of Object.values(value)) {
    remapArtifactIndices(child, artifactIndexMap);
  }
}

function mergeRuns(target, source) {
  const targetRules = (target.tool.driver.rules ??= []);
  const ruleIndexes = new Map(
    targetRules.map((rule, index) => [ruleKey(rule, index), index]),
  );
  const ruleIndexMap = new Map();

  for (const [index, rule] of (source.tool?.driver?.rules ?? []).entries()) {
    const key = ruleKey(rule, index);
    let targetIndex = ruleIndexes.get(key);

    if (targetIndex === undefined) {
      targetIndex = targetRules.length;
      ruleIndexes.set(key, targetIndex);
      targetRules.push(clone(rule));
    }

    ruleIndexMap.set(index, targetIndex);
  }

  const targetArtifacts = (target.artifacts ??= []);
  const artifactIndexes = new Map(
    targetArtifacts.map((artifact, index) => [
      artifactKey(artifact, index),
      index,
    ]),
  );
  const artifactIndexMap = new Map();

  for (const [index, artifact] of (source.artifacts ?? []).entries()) {
    const key = artifactKey(artifact, index);
    let targetIndex = artifactIndexes.get(key);

    if (targetIndex === undefined) {
      targetIndex = targetArtifacts.length;
      artifactIndexes.set(key, targetIndex);
      targetArtifacts.push(clone(artifact));
    }

    artifactIndexMap.set(index, targetIndex);
  }

  for (const sourceResult of source.results ?? []) {
    const result = clone(sourceResult);

    if (Number.isInteger(result.ruleIndex)) {
      result.ruleIndex = ruleIndexMap.get(result.ruleIndex) ?? result.ruleIndex;
    }

    remapArtifactIndices(result, artifactIndexMap);
    target.results.push(result);
  }

  for (const property of [
    'invocations',
    'logicalLocations',
    'policies',
    'taxonomies',
    'translations',
    'versionControlProvenance',
    'webRequests',
    'webResponses',
  ]) {
    if (source[property]) {
      target[property] ??= [];
      dedupePush(target[property], source[property]);
    }
  }
}

function runGroupKey(run, index) {
  const driver = run.tool?.driver ?? {};
  const name = driver.name ?? driver.fullName ?? `run-${index + 1}`;
  const version = driver.semanticVersion ?? driver.version ?? '';
  const informationUri = driver.informationUri ?? '';

  return `${name}\0${version}\0${informationUri}`;
}

function normalizeSarif(sarif) {
  const runs = Array.isArray(sarif.runs) ? sarif.runs : [];
  const groupedRuns = new Map();

  for (const [index, run] of runs.entries()) {
    const key = runGroupKey(run, index);
    const existing = groupedRuns.get(key);

    if (!existing) {
      const nextRun = clone(run);
      nextRun.results = [];
      groupedRuns.set(key, {
        firstIndex: index,
        run: nextRun,
      });
    }

    mergeRuns(groupedRuns.get(key).run, run);
  }

  let normalizedRuns = [...groupedRuns.values()].sort(
    (left, right) => left.firstIndex - right.firstIndex,
  );

  if (normalizedRuns.length > MAX_GITHUB_SARIF_RUNS) {
    const selected = normalizedRuns
      .map((entry) => ({
        ...entry,
        resultCount: entry.run.results?.length ?? 0,
      }))
      .sort(
        (left, right) =>
          right.resultCount - left.resultCount ||
          left.firstIndex - right.firstIndex,
      )
      .slice(0, MAX_GITHUB_SARIF_RUNS)
      .sort((left, right) => left.firstIndex - right.firstIndex);

    const droppedCount = normalizedRuns.length - selected.length;
    console.warn(
      `Codacy SARIF has ${normalizedRuns.length} tool groups; keeping ${selected.length} with the most results and dropping ${droppedCount} to satisfy GitHub's ${MAX_GITHUB_SARIF_RUNS}-run limit.`,
    );
    normalizedRuns = selected;
  }

  for (const [index, entry] of normalizedRuns.entries()) {
    const toolName = slug(entry.run.tool?.driver?.name, `run-${index + 1}`);
    entry.run.automationDetails = {
      ...(entry.run.automationDetails ?? {}),
      id: `codacy-${toolName}-${index + 1}`,
    };
  }

  console.log(
    `Codacy SARIF normalized: ${runs.length} input runs -> ${normalizedRuns.length} GitHub runs.`,
  );

  return {
    ...sarif,
    runs: normalizedRuns.map((entry) => entry.run),
  };
}

const sarif = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const normalizedSarif = normalizeSarif(sarif);

fs.writeFileSync(outputPath, JSON.stringify(normalizedSarif));
