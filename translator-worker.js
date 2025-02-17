// translator-worker.js
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3';

let generator;

async function initializeGenerator() {
  //generator = await pipeline('text-generation', 'onnx-community/Qwen2.5-0.5B-Instruct', { dtype: 'q4' });
  generator = await pipeline('translation', 'Xenova/opus-mt-ru-en');
  // Notify the main thread that the generator is ready
  postMessage({ type: 'ready' });
}

initializeGenerator();

onmessage = async function(event) {
  const { messages, options } = event.data;
  try {
    if (!generator) {
      await initializeGenerator();
    }
    //const output = await generator(messages, options);
    //const result = output[0].generated_text.at(-1).content;
    const output = await generator(messages[1].content);
    const result = output[0].translation_text;
    postMessage({ type: 'result', result });
  } catch (err) {
    postMessage({ type: 'error', error: err.message });
  }
};
