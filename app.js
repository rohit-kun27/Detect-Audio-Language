const express = require('express');
const multer = require('multer');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const speech = require('@google-cloud/speech');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

ffmpeg.setFfmpegPath(ffmpegPath);
const app = express();
const client = new speech.SpeechClient({ keyFilename: 'your api key file name.json' });

// Folder to temporarily store uploads
const UPLOAD_FOLDER = 'uploads';
fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });

const upload = multer({ dest: UPLOAD_FOLDER });

app.use(express.static('public'));

// Endpoint to handle audio upload and language detection
app.post('/detect-language', upload.single('audio'), async (req, res) => {
    const filePath = req.file.path;
    const flacPath = path.join(UPLOAD_FOLDER, `${uuidv4()}.flac`);

    // Convert audio file to FLAC
    ffmpeg(filePath)
        .output(flacPath)
        .on('end', async () => {
            const audioBytes = fs.readFileSync(flacPath).toString('base64');

            const request = {
                audio: { content: audioBytes },
                config: {
                    encoding: 'FLAC',
                    sampleRateHertz: 48000,  // Set this to match the audio sample rate
                    languageCode: 'en-US',
                    alternativeLanguageCodes: ['es-ES', 'fr-FR', 'de-DE'],
                    enableAutomaticPunctuation: true,
                },
            };
            

            try {
                const [response] = await client.recognize(request);
                const transcription = response.results
                    .map(result => result.alternatives[0].transcript)
                    .join('\n');
                const language = response.results[0]?.languageCode || 'Unknown';

                res.json({ language, transcription });
            } catch (error) {
                console.error("Error during speech recognition:", error);
                res.status(500).json({ error: "Speech recognition failed." });
            } finally {
                // Clean up temporary files
                fs.unlinkSync(filePath);
                fs.unlinkSync(flacPath);
            }
        })
        .on('error', error => {
            console.error("Error during conversion:", error);
            res.status(500).json({ error: "Audio conversion failed." });
        })
        .run();
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
