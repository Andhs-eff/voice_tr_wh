const startButton = document.getElementById('startButton');
startButton.style.display = "none";
class AudioVisualizer {
    constructor(audioContext, processFrame, processError) {
        this.audioContext = audioContext;
        this.processFrame = processFrame;
        this.connectStream = this.connectStream.bind(this);
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(this.connectStream)
            .catch((error) => {
                if (processError) {
                    processError(error);
                }
            });
    }

    connectStream(stream) {
        this.analyser = this.audioContext.createAnalyser();
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.analyser);
        this.analyser.smoothingTimeConstant = 0.5;
        this.analyser.fftSize = 32;

        this.initRenderLoop(this.analyser);
    }

    initRenderLoop() {
        const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        const processFrame = this.processFrame || (() => { });

        const renderFrame = () => {
            this.analyser.getByteFrequencyData(frequencyData);
            processFrame(frequencyData);

            requestAnimationFrame(renderFrame);
        };
        requestAnimationFrame(renderFrame);
    }
}

const myProgress = new ProgressBar.Circle('#progress', {
    color: "palegreen",
    strokeWidth: 10.0,
    trailColor: 'transparent',
    text: {
        style: {
            position: 'absolute',
            left: '50%',
            top: '50%',
            padding: 0,
            margin: 0,
            fontSize: '30px',
            fontWeight: 'bold',
            transform: {
                prefix: true,
                value: 'translate(-50%, -50%)'
            }
        }
    },
});

myProgress.animate(0.1);
myProgress.setText("10%");

const visualMainElement = document.querySelector('main');
const visualValueCount = 16;
let visualElements;
const createDOMElements = () => {
    let i;
    for (i = 0; i < visualValueCount; ++i) {
        const elm = document.createElement('div');
        visualMainElement.appendChild(elm);
    }

    visualElements = document.querySelectorAll('main div');
};

const destroyDOMElements = () => {
    visualMainElement.innerHTML = ''; // Clear the existing elements
};

const restoreDOMElements = () => {
    let i;
    for (i = 0; i < visualValueCount; ++i) {
        const elm = document.createElement('div');
        visualMainElement.appendChild(elm);
    }
};

const restoreButton = () => {
    destroyDOMElements();
    const button = document.createElement('button');
    button.onclick = originalOnClick;
    button.innerText = 'Старт';
    visualMainElement.appendChild(button);
    restoreDOMElements();
};

const init = () => {
    // Creating initial DOM elements
    const audioContext = new AudioContext();
    const initDOM = () => {
        visualMainElement.innerHTML = '';
        createDOMElements();
    };
    initDOM();

    // Swapping values around for a better visual effect
    const dataMap = { 0: 15, 1: 10, 2: 8, 3: 9, 4: 6, 5: 5, 6: 2, 7: 1, 8: 0, 9: 4, 10: 3, 11: 7, 12: 11, 13: 12, 14: 13, 15: 14 };
    const processFrame = (data) => {
        const values = Object.values(data);
        let i;
        for (i = 0; i < visualValueCount; ++i) {
            const value = values[dataMap[i]] / 255;
            const elmStyles = visualElements[i].style;
            elmStyles.transform = `scaleY( ${value} )`;
            elmStyles.opacity = Math.max(.25, value);
        }
    };

    const processError = () => {
        visualMainElement.classList.add('error');
        visualMainElement.innerText = 'Please allow access to your microphone in order to see this demo.';
    }

    const a = new AudioVisualizer(audioContext, processFrame, processError);
};

const processingImage = document.getElementById('processing');
const resultParagraph = document.getElementById('result');

// Get references to the dropdown and textarea elements
const dropdown1 = document.getElementById('dropdown1');
const dropdown2 = document.getElementById('dropdown2');
const glossaryTextarea = document.getElementById('glossary');
const codeToLanguage = {
    'ru-RU': 'Russian',
    'en-US': 'English',
    'zh-CN': 'Chinese'
}
let formValues;
let prompt;

// Function to retrieve the selected values and textarea text
function getFormValues() {
    // Get the selected value from dropdown1
    const dropdown1Value = dropdown1.value;

    // Get the selected value from dropdown2
    const dropdown2Value = dropdown2.value;

    // Get the text from the textarea
    const glossary = glossaryTextarea.value;

    // Return an object containing the values
    return {
        dropdown1: dropdown1Value,
        dropdown2: dropdown2Value,
        glossary: glossary
    };
}

let originalOnClick = startButton.onclick;

myProgress.animate(0.7);
myProgress.setText("70%");

// Create the Web Worker instance
const translatorWorker = new Worker('translator-worker.js', { type: 'module' });

// Listen for messages from the worker
translatorWorker.onmessage = function (event) {
    const data = event.data;
    if (data.type === 'ready') {
        // Generator is ready—remove the progress bar
        myProgress.animate(1.0);
        myProgress.setText("100%");
        myProgress.destroy();
        document.getElementById("progress").remove();
        resultParagraph.style.display = "block";
        startButton.style.display = "block";
        createDOMElements();
    } else if (data.type === 'result') {
        // Process the translation result
        processingImage.style.display = "none";
        resultParagraph.style.display = "block";
        resultParagraph.style.fontStyle = "normal";
        resultParagraph.textContent = data.result;
        speakText(data.result);
        originalOnClick = startButton.onclick;
        restoreButton();
    } else if (data.type === 'error') {
        console.error('Translation error:', data.error);
        // Optionally do additional error handling here
    }
};

// Check if SpeechRecognition is supported
if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    startButton.addEventListener('click', () => {
        formValues = getFormValues();
        recognition.lang = formValues.dropdown2;
        recognition.start();
        console.log('Speech recognition started');
        resultParagraph.textContent = "";
        init();
    });

    recognition.addEventListener('result', async (event) => {
        const speechResult = event.results[0][0].transcript;
        console.log(speechResult);
        processingImage.style.display = "none";
        resultParagraph.style.display = "block";
        resultParagraph.style.fontStyle = "italic";
        resultParagraph.textContent = speechResult;

        // Force a break so the DOM can update
        await new Promise(resolve => setTimeout(resolve, 0));

        // Define the prompt and list of messages
        let prompt;
        if (formValues.glossary != "") {
            prompt = `You are a translation machine. Your interface with users will be voice. 
Your sole function is to translate the provided text from ${codeToLanguage[formValues.dropdown2]} to ${codeToLanguage[formValues.dropdown1]}.
Do not add, omit, or alter any information.
Always take into account the terms provided in the glossary: ${formValues.glossary}. 
The terms of the glossary in ${codeToLanguage[formValues.dropdown2]} must be translated as specified in the glossary, irrespective of their meaning.
Do not provide explanations, opinions, timestamps or any additional text beyond the direct translation.
Use polite forms in translation.
Avoid usage of unpronounceable punctuation.`;
        } else {
            prompt = `You are a translation machine. Your interface with users will be voice. 
Your sole function is to translate the provided text from ${codeToLanguage[formValues.dropdown2]} to ${codeToLanguage[formValues.dropdown1]}.
Do not add, omit, or alter any information.
Do not provide explanations, opinions, timestamps or any additional text beyond the direct translation.
Use polite forms in translation.
Avoid usage of unpronounceable punctuation.`;
        }

        const messages = [
            { role: 'system', content: prompt },
            { role: 'user', content: speechResult }
        ];

        console.log(messages);

        // Instead of calling generator directly, post a message to the worker
        translatorWorker.postMessage({ messages, options: { max_new_tokens: 128, temperature: 0.1 } });
    });

    recognition.addEventListener('speechend', async () => {
        recognition.stop();
        console.log('Speech recognition stopped');
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (resultParagraph.textContent.trim() === '' || window.getComputedStyle(resultParagraph).fontStyle === "italic") {
            resultParagraph.style.display = "none";
            processingImage.style.display = "block";
        }
    });

    recognition.addEventListener('error', (event) => {
        console.log('Error occurred in recognition: ' + event.error);
        originalOnClick = startButton.onclick;
        restoreButton();
    });
} else {
    originalOnClick = startButton.onclick;
    restoreButton();
    console.log('Speech Recognition is not supported in this browser.');
}

// Speech synthesis function
function speakText(text) {
    if ('speechSynthesis' in window) {
        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(text);

        // Configure the utterance
        utterance.lang = formValues.dropdown1;
        utterance.rate = 1.0;
        synth.speak(utterance);
    } else {
        console.log('Speech Synthesis is not supported in this browser.');
    }
}

