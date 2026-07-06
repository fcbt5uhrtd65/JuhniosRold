import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const agentDir = path.join(rootDir, 'dialogflow-agent');
const outputDir = path.join(agentDir, 'dist');
const outputFile = path.join(outputDir, 'juhnios-rold-dialogflow-agent.zip');
const requireFromAgent = createRequire(path.join(agentDir, 'package.json'));

type ArchiverFactory = typeof import('archiver');

async function buildAgentZip() {
  const archiver = requireFromAgent('archiver') as ArchiverFactory;

  await mkdir(outputDir, { recursive: true });
  await rm(outputFile, { force: true });

  const output = createWriteStream(outputFile);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const rawAgent = await readFile(path.join(agentDir, 'agent.json'), 'utf8');
  const agentJson = rawAgent
    .replace('${DIALOGFLOW_WEBHOOK_URL}', process.env.DIALOGFLOW_WEBHOOK_URL || '')
    .replace('${DIALOGFLOW_WEBHOOK_TOKEN}', process.env.DIALOGFLOW_WEBHOOK_TOKEN || '');

  const finished = new Promise<void>((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(output);

  archive.append(agentJson, { name: 'agent.json' });
  archive.directory(path.join(agentDir, 'intents'), 'intents');
  archive.directory(path.join(agentDir, 'entities'), 'entities');
  archive.file(path.join(agentDir, 'package.json'), { name: 'package.json' });

  await archive.finalize();
  await finished;

  console.log(`Dialogflow ES agent ZIP generated: ${outputFile}`);
}

buildAgentZip().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Could not build Dialogflow agent ZIP: ${message}`);
  process.exit(1);
});
