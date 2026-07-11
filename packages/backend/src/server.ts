import 'dotenv/config';
import { env } from './env.js';
import { createApp } from './app.js';

const app = createApp();
app.listen(env.PORT, () => {
  console.log(`@creighton/backend listening on port ${env.PORT}`);
});
