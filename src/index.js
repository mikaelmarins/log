import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import ora from 'ora';
import { detectStream } from './detector.js';
import { downloadStream } from './downloader.js';
import fs from 'fs';
import path from 'path';

const argv = yargs(hideBin(process.argv))
  .option('url', {
    alias: 'u',
    type: 'string',
    description: 'URL of the live stream page',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Output filename (optional)',
  })
  .option('city', {
    alias: 'c',
    type: 'string',
    description: 'City name for folder organization',
  })
  .option('username', {
    alias: 'n',
    type: 'string',
    description: 'Username for folder organization',
  })
  .option('duration', {
    alias: 'd',
    type: 'number',
    description: 'Recording duration in seconds',
  })
  .help()
  .argv;

(async () => {
  const spinner = ora('Initializing...').start();

  try {
    const targetUrl = argv.url;
    spinner.text = `Navigating to ${targetUrl} and searching for stream...`;

    // 1. Detect Stream
    const streamInfo = await detectStream(targetUrl, (status) => {
      spinner.text = status;
    });

    if (!streamInfo || !streamInfo.m3u8Url) {
      spinner.fail('Could not find any m3u8 stream on the page.');
      process.exit(1);
    }

    // Pass duration if provided
    if (argv.duration) {
      streamInfo.duration = argv.duration;
    }

    spinner.succeed(chalk.green(`Stream found: ${streamInfo.m3u8Url}`));

    // 2. Prepare Output
    let downloadsDir = path.resolve('downloads');

    // If city and username are provided, create subfolders
    if (argv.city && argv.username) {
      // Sanitize folder names
      const safeCity = argv.city.replace(/[<>:"/\\|?*]/g, '').trim();
      const safeUser = argv.username.replace(/[<>:"/\\|?*]/g, '').trim();
      downloadsDir = path.join(downloadsDir, safeCity, safeUser);
    }

    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    let filename = argv.output;
    if (!filename) {
      // Use username if available, otherwise 'live'
      const namePart = argv.username ? argv.username.replace(/[<>:"/\\|?*]/g, '').trim() : 'live';
      // Use timestamp for unique, sortable filenames
      filename = `${namePart}-${Date.now()}.mkv`;
    }
    const outputPath = path.join(downloadsDir, filename);

    // 3. Download Stream
    console.log(chalk.blue(`\nStarting capture to: ${outputPath}`));
    if (argv.duration) {
      console.log(chalk.blue(`Duration limit: ${argv.duration} seconds`));
    }
    console.log(chalk.yellow('Press Ctrl+C to stop recording safely.\n'));

    await downloadStream(streamInfo, outputPath);

  } catch (error) {
    spinner.fail(chalk.red('An error occurred:'));
    console.error(error);
    process.exit(1);
  }
})();
