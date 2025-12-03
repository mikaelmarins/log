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

        // SIMPLIFICATION ATTEMPT: Only send minimal headers to avoid "fake browser" detection
        // if the TLS fingerprint doesn't match the User-Agent.

        if (streamInfo.referer) headers['Referer'] = streamInfo.referer;

        // Try WITHOUT User-Agent first (let ffmpeg use default or none)
        // headers['User-Agent'] = streamInfo.userAgent; 

        if (streamInfo.cookies && streamInfo.cookies.length > 0) {
            const uniqueCookies = new Map();
            streamInfo.cookies.forEach(c => uniqueCookies.set(c.name, c.value));
            const cookieString = Array.from(uniqueCookies.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
            headers['Cookie'] = cookieString;
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
