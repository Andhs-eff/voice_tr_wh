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

myProgress.animate(0.3);
myProgress.setText("30%");

// Create the Web Worker instance
const translatorWorker = new Worker('translator-worker.js', { type: 'module' });

let iter = 0;

function progressShow() {
    switch (iter) {
        case 0:
            myProgress.animate(0.5);
            myProgress.setText("50%");
            break;
        case 1:
            myProgress.animate(0.7);
            myProgress.setText("70%");
            break;
        case 2:
            // Generator is ready—remove the progress bar
            myProgress.animate(1.0);
            myProgress.setText("100%");
            myProgress.destroy();
            document.getElementById("progress").remove();
            resultParagraph.style.display = "block";
            startButton.style.display = "block";
            createDOMElements();
            iter = -1;
            break;
    }
}

// Listen for messages from the worker
translatorWorker.onmessage = async function (event) {
    const data = event.data;
    if (data.type === 'ready') {
        progressShow();
        ++iter;
    } else if (data.type === 'stt_result') {
        processingImage.style.display = "none";
        resultParagraph.style.display = "block";
        resultParagraph.style.fontStyle = "italic";
        resultParagraph.textContent = data.stt_result;
    } else if (data.type === 'trans_result') {
        processingImage.style.display = "none";
        resultParagraph.style.display = "block";
        resultParagraph.style.fontStyle = "normal";
        resultParagraph.textContent = data.trans_result;
    } else if (data.type === 'tts_result') {
        originalOnClick = startButton.onclick;
        restoreButton();
        // Create an AudioContext
        const audioContext = new AudioContext();
        const audioBuffer = audioContext.createBuffer(1, data.output3.audio.length, data.output3.sampling_rate);
        audioBuffer.copyToChannel(data.output3.audio, 0);

        // Create a BufferSource and play the audio
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
    } else if (data.type === 'error') {
        console.error('Translation error:', data.error);
        // Optionally do additional error handling here
        originalOnClick = startButton.onclick;
        restoreButton();
    }
};

const myvad = await vad.MicVAD.new({
    model: "v5",
    onSpeechStart: () => {
        console.log("Speech start detected")
    },
    onSpeechEnd: async (audio) => {
        translatorWorker.postMessage({ 'audio': audio, 'src': formValues.dropdown2, 'tgt': formValues.dropdown1 });
        resultParagraph.style.display = "none";
        processingImage.style.display = "block";
        console.log("Speech end detected")
        myvad.pause();
    }
})

startButton.onclick = () => {
    formValues = getFormValues();
    myvad.start();
    resultParagraph.textContent = "";
    init();
};



