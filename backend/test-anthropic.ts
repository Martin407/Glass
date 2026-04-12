import { Anthropic } from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: 'dummy' });
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(client.beta.sessions.events)));
