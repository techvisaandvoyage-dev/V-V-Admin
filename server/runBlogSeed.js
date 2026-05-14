#!/usr/bin/env node
/**
 * Standalone runner: `node runBlogSeed.js` (or `npm run seed:blog`)
 *
 * Connects to MongoDB using the same `.env` as the live server, runs the
 * idempotent blog seed, then exits. Safe to run on a live database — the
 * seed never overwrites existing categories or posts.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const { seedBlog } = require('./seedBlog');

(async () => {
  try {
    await connectDB();
    const result = await seedBlog();
    if (result.ok) {
      console.log(
        `[blog seed] OK — ${result.categories} categories ensured, ${result.postsInserted} new posts inserted.`,
      );
      if (result.insertedSlugs?.length) {
        console.log('[blog seed] new slugs:', result.insertedSlugs.join(', '));
      }
    } else {
      console.error('[blog seed] FAILED:', result.reason);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[blog seed] ERROR:', err.message);
    process.exitCode = 1;
  } finally {
    const mongoose = require('mongoose');
    await mongoose.connection.close().catch(() => {});
  }
})();
