import Config from "../models/Config.js";
import ConfigVersion from "../models/ConfigVersion.js";

const VALID_TYPES = ['string', 'boolean', 'number', 'json'];

function coerceValue(value, type) {
  if (type === 'boolean') return value === true || value === 'true';
  if (type === 'number') return Number(value);
  if (type === 'json') return typeof value === 'string' ? JSON.parse(value) : value;
  return String(value);
}

export async function createOrUpdateConfig({ key, environment, value, type = 'string', createdBy = 'system', clientId }) {
  if (!VALID_TYPES.includes(type)) throw new Error(`Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`);

  const coerced = coerceValue(value, type);

  const latestVersion = await ConfigVersion
    .findOne({ clientId, configKey: key, environment })
    .sort({ version: -1 });

  const nextVersion = latestVersion ? latestVersion.version + 1 : 1;

  await ConfigVersion.create({
    clientId,
    configKey: key,
    environment,
    version: nextVersion,
    value: coerced,
    type,
    createdBy,
  });

  await Config.findOneAndUpdate(
    { clientId, key, environment },
    { activeVersion: nextVersion, type },
    { upsert: true, new: true }
  );

  return { key, environment, version: nextVersion, type };
}

export async function getActiveConfig(key, environment, clientId) {
  const configDoc = await Config.findOne({ clientId, key, environment });
  if (!configDoc) return null;

  return ConfigVersion.findOne({
    clientId,
    configKey: key,
    environment,
    version: configDoc.activeVersion,
  });
}

export async function getAllActiveConfigs(environment, clientId) {
  const configs = await Config.find({ clientId, environment }).sort({ key: 1 });
  const results = [];

  for (const config of configs) {
    const version = await ConfigVersion.findOne({
      clientId,
      configKey: config.key,
      environment,
      version: config.activeVersion,
    });
    if (version) {
      results.push({
        key: config.key,
        value: version.value,
        type: config.type || version.type || 'string',
        environment,
        version: config.activeVersion,
        updatedAt: version.createdAt,
        updatedBy: version.createdBy,
      });
    }
  }

  return results;
}

export async function deleteConfig({ key, environment, clientId }) {
  const exists = await Config.findOne({ clientId, key, environment });
  if (!exists) throw new Error(`Config key "${key}" not found in ${environment}`);

  await ConfigVersion.deleteMany({ clientId, configKey: key, environment });
  await Config.deleteOne({ clientId, key, environment });
}

export async function rollbackConfig({ key, environment, targetVersion, clientId }) {
  const exists = await ConfigVersion.findOne({ clientId, configKey: key, environment, version: targetVersion });
  if (!exists) throw new Error("Target version does not exist");

  await Config.findOneAndUpdate(
    { clientId, key, environment },
    { activeVersion: targetVersion }
  );

  return { key, environment, activeVersion: targetVersion };
}

export async function getConfigVersions(key, environment, clientId) {
  const versions = await ConfigVersion
    .find({ clientId, configKey: key, environment })
    .sort({ version: -1 });

  if (versions.length === 0) throw new Error(`No versions found for key: ${key} in environment: ${environment}`);
  return versions;
}
