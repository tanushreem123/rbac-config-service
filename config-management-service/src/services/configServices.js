import Config from "../models/config.js";
import ConfigVersion from "../models/ConfigVersion.js";

export async function createOrUpdateConfig({
  key,
  environment,
  value,
  createdBy = "admin",
}) {
  // 1. Find latest version
  const latestVersion = await ConfigVersion
    .findOne({ configKey: key, environment })
    .sort({ version: -1 });

  // const nextVersion = latestVersion ? latestVersion.version + 1 : 1;
  const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

  // 2. Create new immutable version
  await ConfigVersion.create({
    configKey: key,
    environment,
    version: nextVersion,
    value,
    createdBy,
  });

  // 3. Update or create Config pointer
  await Config.findOneAndUpdate(
    { key, environment },
    { activeVersion: nextVersion },
    { upsert: true, new: true }
  );

  return {
    key,
    environment,
    version: nextVersion,
  };
}

export async function getActiveConfig(key, environment) {
  const config = await config.findOne({ key, environment });

  if (!config) {
    return null;
  }

  const activeVersion = await ConfigVersion.findOne({
    configKey: key,
    environment,
    version: config.activeVersion,
  });

  return activeVersion;
}

export async function getAllActiveConfigs(environment) {
  const configs = await Config.find({ environment });

  const results = {};

  for (const config of configs) {
    const version = await ConfigVersion.findOne({
      configKey: config.key,
      environment,
      version: config.activeVersion,
    });

    if (version) {
      results[config.key] = version.value;
    }
  }

  return results;
}

export async function rollbackConfig({
  key,
  environment,
  targetVersion,
}) {
  const exists = await ConfigVersion.findOne({
    configKey: key,
    environment,
    version: targetVersion,
  });

  if (!exists) {
    throw new Error("Target version does not exist");
  }

  await Config.findOneAndUpdate(
    { key, environment },
    { activeVersion: targetVersion }
  );

  return {
    key,
    environment,
    activeVersion: targetVersion,
  };
}

export async function getConfigVersions(key, environment) {
  const versions = await ConfigVersion.find({
    configKey: key,
    environment,
  }).sort({ version: -1 });

  if (versions.length === 0) {
    throw new Error(`No versions found for key: ${key} in environment: ${environment}`);
  }

  return versions;
}


