const BASE_URL = process.env.NEXT_PUBLIC_CONFIG_SERVICE_BASE_URL;
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_API_TOKEN;

export async function fetchConfigs(env) {
  if (!BASE_URL) {
    throw new Error("CONFIG_SERVICE_BASE_URL is not defined");
  }

  try {
    const res = await fetch(`${BASE_URL}/configs?env=${env}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch configs: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    
    // Convert object to array format
    const configsArray = Object.entries(data).map(([key, value]) => ({
      key,
      value,
      version: 1, // Default version, adjust based on your backend
    }));

    return { configs: configsArray };
  } catch (err) {
    console.error('Fetch error:', err);
    throw new Error(`Failed to fetch configs: ${err.message}`);
  }
}

export async function createConfig(payload) {
  if (!BASE_URL || !ADMIN_TOKEN) {
    throw new Error("Missing required environment variables");
  }

  console.log('BASE_URL:', BASE_URL);
  console.log('ADMIN_TOKEN:', ADMIN_TOKEN);
  console.log('Creating config with payload:', JSON.stringify(payload, null, 2));

  try {
    const url = `${BASE_URL}/configs`;
    console.log('Fetching from URL:', url);
    
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": ADMIN_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    console.log('Response status:', res.status);
    console.log('Response ok:', res.ok);

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Error response:', errorText);
      throw new Error(`Failed to create config: ${res.status} ${res.statusText}`);
    }

    return res.json();
  } catch (err) {
    console.error('Create config error:', err);
    throw err;
  }
}

export async function rollbackConfig(payload) {
  if (!BASE_URL || !ADMIN_TOKEN) {
    throw new Error("Missing required environment variables");
  }

  try {
    const res = await fetch(`${BASE_URL}/configs/rollback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": ADMIN_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Failed to rollback config: ${res.status} ${res.statusText}`);
    }

    return res.json();
  } catch (err) {
    console.error('Rollback config error:', err);
    throw err;
  }
}