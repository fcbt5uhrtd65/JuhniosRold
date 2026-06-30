import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const agentDir = path.join(rootDir, 'dialogflow-agent');
const requireFromAgent = createRequire(path.join(agentDir, 'package.json'));
const zipPath = path.join(
  rootDir,
  'dialogflow-agent',
  'dist',
  'juhnios-rold-dialogflow-agent.zip'
);

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

async function deployAgent() {
  const { AgentsClient } = requireFromAgent('@google-cloud/dialogflow') as typeof import('@google-cloud/dialogflow');
  const projectId = requireEnv('GOOGLE_CLOUD_PROJECT_ID');
  requireEnv('GOOGLE_APPLICATION_CREDENTIALS');

  const languageCode = process.env.DIALOGFLOW_LANGUAGE_CODE || 'es';

  if (languageCode !== 'es') {
    console.warn(
      `DIALOGFLOW_LANGUAGE_CODE is "${languageCode}". This agent was authored for "es".`
    );
  }

  try {
    await access(zipPath);
  } catch {
    throw new Error(
      `Agent ZIP not found at ${zipPath}. Run "npm run build" inside dialogflow-agent first.`
    );
  }

  const client = new AgentsClient();
  const parent = client.projectPath(projectId);
  const agentContent = await readFile(zipPath);
  const [operation] = await client.restoreAgent({
    parent,
    agentContent,
  });

  console.log('Dialogflow restore started. Waiting for completion...');
  await operation.promise();
  console.log(`Dialogflow ES agent restored successfully in project ${projectId}.`);
}

deployAgent().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Could not deploy Dialogflow agent: ${message}`);
  process.exit(1);
});
