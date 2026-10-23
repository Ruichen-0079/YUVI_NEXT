import { parentPort, workerData } from 'node:worker_threads';
import { buildIndex } from './archive-index.js';
buildIndex(workerData.directory, undefined, workerData.scope);
parentPort!.postMessage('ready');
