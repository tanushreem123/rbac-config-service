// Diagnostic: connect to Mongo and run the same kind of query GET /configs does,
// a few times, to see if the TLS error is consistent or intermittent.
import '../src/config.js';
import mongoose from 'mongoose';
import Config from '../src/models/Config.js';

try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('✓ connected. driver:', mongoose.version);
  for (let i = 1; i <= 5; i++) {
    try {
      const n = await Config.countDocuments({});
      console.log(`  attempt ${i}: ok — ${n} config docs`);
    } catch (e) {
      console.log(`  attempt ${i}: FAILED — ${e.message}`);
    }
  }
} catch (e) {
  console.error('✗ connect failed:', e.message);
} finally {
  await mongoose.connection.close();
  process.exit(0);
}
