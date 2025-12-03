import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import chalk from 'chalk';

// Set the ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

export async function downloadStream(streamInfo, outputPath) {
    return new Promise((resolve, reject) => {
        let ffmpegProcess = null;

        const command = ffmpeg(streamInfo.m3u8Url)
            .inputOptions([
                '-headers', formatHeaders(streamInfo.headers),
                '-fflags', '+genpts+discardcorrupt',
                '-use_wallclock_as_timestamps', '1',
                '-async', '1',
                '-timeout', '60000000'
            ])
            .outputOptions([
                '-c', 'copy', // Copy streams directly (no re-encoding)
                '-bsf:a', 'aac_adtstoasc', // Fix AAC bitstream
                '-f', 'mpegts', // Use MPEG-TS container for robustness
                '-avoid_negative_ts', 'make_zero'
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
