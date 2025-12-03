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
                if (lowerKey === 'referer' || lowerKey === 'cookie' || lowerKey === 'user-agent' || lowerKey.startsWith('sec-ch-ua') || lowerKey === 'host' || lowerKey === 'connection') {
                    return;
                }
                headers[key] = value;
            });
        }

        // Set/Update critical headers in Title Case
        if (streamInfo.referer) headers['Referer'] = streamInfo.referer;

        // Remove User-Agent from headers (will use flag)
        delete headers['User-Agent'];
        delete headers['user-agent'];

        if (streamInfo.cookies && streamInfo.cookies.length > 0) {
            const uniqueCookies = new Map();
            streamInfo.cookies.forEach(c => uniqueCookies.set(c.name, c.value));
            const cookieString = Array.from(uniqueCookies.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
            headers['Cookie'] = cookieString;
        }

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
