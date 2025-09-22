// translator-worker.js
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.3';

let transcriber;
let generator;
let synthesizer;
const speaker_embeddings = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin';

async function initializeTranscriber() {
  transcriber = await pipeline('automatic-speech-recognition', 'nzhenev/whisper-small-ru-1k-steps-ONNX'); //'Xenova/whisper-base');
  // Notify the main thread that the generator is ready
  postMessage({ type: 'ready' });
}

initializeTranscriber();

async function initializeGenerator() {
  //generator = await pipeline('text-generation', 'onnx-community/Qwen2.5-0.5B-Instruct', { dtype: 'q4' });
  generator = await pipeline('translation', 'Xenova/opus-mt-ru-en');
  // Notify the main thread that the generator is ready
  postMessage({ type: 'ready' });
}

initializeGenerator();

async function initializeSynthesizer() {
  synthesizer = await pipeline("text-to-speech", "Xenova/speecht5_tts", { dtype: 'q4' }); //"Xenova/mms-tts-eng");
  // Notify the main thread that the generator is ready
  postMessage({ type: 'ready' });
}

initializeSynthesizer();

onmessage = async function(event) {
  const { audio, src, tgt } = event.data;
  try {
    if (!transcriber) {
      await initializeTranscriber();
    }
    if (!generator) {
      await initializeGenerator();
    }
    if (!synthesizer) {
      await initializeSynthesizer();
    }
    const output1 = await transcriber(audio,  { speaker_embeddings }); //, { language: 'russian', task: 'transcribe' });
    const stt_result = output1.text;
    postMessage({ type: 'stt_result', stt_result });
    const output2 = await generator(stt_result);
    const trans_result = output2[0].translation_text;
    postMessage({ type: 'trans_result', trans_result });
    const output3 = await synthesizer(trans_result);
    this.postMessage({ type: 'tts_result', output3 });
  } catch (err) {
    postMessage({ type: 'error', error: err.message });
  }
};
