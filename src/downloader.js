import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import chalk from 'chalk';

// Set the ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

export async function downloadStream(streamInfo, outputPath) {
    return new Promise((resolve, reject) => {
        let ffmpegProcess = null;

        // Normalize headers to Title Case for critical ones to satisfy strict WAFs
        const headers = {};
        if (streamInfo.headers) {
            Object.entries(streamInfo.headers).forEach(([key, value]) => {
                const lowerKey = key.toLowerCase();

                // Skip headers we will set manually or that are risky
                if (['referer', 'cookie', 'user-agent', 'host', 'connection'].includes(lowerKey) || lowerKey.startsWith('sec-ch-ua')) {
                    return;
                }

                // Map common headers to Title-Case
                const titleCaseMap = {
                    'origin': 'Origin',
                    'accept': 'Accept',
                    'accept-encoding': 'Accept-Encoding',
                    'accept-language': 'Accept-Language',
                    'content-type': 'Content-Type',
                    'cache-control': 'Cache-Control',
                    'pragma': 'Pragma',
                    'upgrade-insecure-requests': 'Upgrade-Insecure-Requests'
                };

                if (titleCaseMap[lowerKey]) {
                    headers[titleCaseMap[lowerKey]] = value;
                } else {
                    headers[key] = value; // Fallback to original
            ]);

            if (streamInfo.duration) {
                // duration in seconds
                command.outputOptions(['-t', streamInfo.duration]);
            }

            command.output(outputPath)
                .on('start', (commandLine) => {
                    console.log('Spawned Ffmpeg with command: ' + commandLine);
                })
                .on('codecData', (data) => {
                    console.log('Input is ' + data.audio + ' audio ' +
                        'with ' + data.video + ' video');
                })
                .on('progress', (progress) => {
                    process.stdout.write(`\rRecording duration: ${chalk.bold(progress.timemark)}`);
                })
                .on('error', (err) => {
                    if (err.message.includes('SIGINT') || err.message.includes('SIGTERM')) {
                        console.log(chalk.green('\nRecording stopped by user (graceful).'));
                        resolve();
                    } else {
                        console.error('\nError:', err.message);
                        reject(err);
                    }
                })
                .on('end', () => {
                    console.log(chalk.green('\nStream recording finished!'));
                    resolve();
                });

            // Save reference to the process
            command.on('start', () => {
                ffmpegProcess = command.ffmpegProc;
            });

            // Handle Ctrl+C gracefully
            process.on('SIGINT', () => {
                console.log(chalk.yellow('\nStopping recording...'));
                if (ffmpegProcess) {
                    // Try to send 'q' to stop cleanly
                    try {
                        ffmpegProcess.stdin.write('q');
                    } catch (e) { }

                    // Give it time to close
                    setTimeout(() => {
                        if (ffmpegProcess && !ffmpegProcess.killed) {
                            console.log('Sending SIGTERM to ffmpeg...');
                            command.kill('SIGTERM');
                        }
                    }, 2000);
                } else {
                    process.exit(0);
                }
            });

            command.run();
        });
}

function formatHeaders(headers) {
    let headerString = '';
    for (const [key, value] of Object.entries(headers)) {
        headerString += `${key}: ${value}\r\n`;
    }
    return headerString;
}
