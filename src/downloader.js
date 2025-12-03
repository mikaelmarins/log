import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import chalk from 'chalk';

// Set the ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

export async function downloadStream(streamInfo, outputPath) {
    return new Promise((resolve, reject) => {
        let ffmpegProcess = null;

        // Merge cookies into headers if present
        const headers = { ...streamInfo.headers };

        // Remove risky Client Hint headers that might reveal automation or cause mismatches
        Object.keys(headers).forEach(key => {
            if (key.toLowerCase().startsWith('sec-ch-ua')) {
                delete headers[key];
            }
        });

        // Add Referer if available
        if (streamInfo.referer) headers['Referer'] = streamInfo.referer;

        if (streamInfo.cookies && streamInfo.cookies.length > 0) {
            // Deduplicate cookies by name
            const uniqueCookies = new Map();
            streamInfo.cookies.forEach(c => uniqueCookies.set(c.name, c.value));
            const cookieString = Array.from(uniqueCookies.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
            headers['Cookie'] = cookieString;
        }

        // Ensure User-Agent is NOT in headers to avoid duplication with -user_agent flag
        delete headers['User-Agent'];
        delete headers['user-agent'];

        console.log('--- FFMPEG DEBUG ---');
        console.log('Stream URL:', streamInfo.m3u8Url);
        console.log('User-Agent (Flag):', streamInfo.userAgent);
        console.log('Referer:', headers['Referer']);
        console.log('Cookie Count:', streamInfo.cookies ? streamInfo.cookies.length : 0);
        console.log('Full Headers (excluding UA):', JSON.stringify(headers, null, 2));
        console.log('--------------------');

        const command = ffmpeg(streamInfo.m3u8Url)
            .inputOptions([
                '-user_agent', streamInfo.userAgent, // Explicitly override default UA
                '-headers', formatHeaders(headers),
                '-timeout', '10000000' // 10s timeout
            ])
            .outputOptions([
                '-c', 'copy',
                '-bsf:a', 'aac_adtstoasc',
                '-f', 'mpegts'
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
