const CHUNK_SIZE = 16 * 1024;

let pc = null;
let dataChannel = null;

let offerChunks = [];
let answerChunks = [];

let offerIndex = 0;
let answerIndex = 0;

let receivedOfferChunks = [];
let receivedAnswerChunks = [];

let offerScanner = null;
let answerScanner = null;

let receivedFileChunks = [];
let receivedBytes = 0;

let incomingFile = null;


/* =====================================================
   ELEMENTS
===================================================== */

const roleSelection =
    document.getElementById("role-selection");

const senderScreen =
    document.getElementById("sender-screen");

const receiverScreen =
    document.getElementById("receiver-screen");

const senderStatus =
    document.getElementById("sender-status");

const receiverStatus =
    document.getElementById("receiver-status");

const senderFileArea =
    document.getElementById("sender-file-area");

const receiverAnswerArea =
    document.getElementById("receiver-answer-area");

const receiveFileArea =
    document.getElementById("receive-file-area");


/* =====================================================
   ROLE SELECTION
===================================================== */

document.getElementById("send-btn").addEventListener(
    "click",
    startSender
);

document.getElementById("receive-btn").addEventListener(
    "click",
    startReceiver
);


/* =====================================================
   CREATE PEER CONNECTION
===================================================== */

function createPeerConnection() {

    const connection = new RTCPeerConnection({

        iceServers: [
            {
                urls: "stun:stun.l.google.com:19302"
            }
        ]

    });

    connection.oniceconnectionstatechange = () => {

        console.log(
            "ICE state:",
            connection.iceConnectionState
        );

    };

    connection.onconnectionstatechange = () => {

        console.log(
            "Connection:",
            connection.connectionState
        );

        if (
            connection.connectionState === "connected"
        ) {

            senderStatus.textContent =
                "Connected directly to receiver.";

            receiverStatus.textContent =
                "Connected directly to sender.";

        }

        if (
            connection.connectionState === "failed"
        ) {

            senderStatus.textContent =
                "Connection failed.";

            receiverStatus.textContent =
                "Connection failed.";

        }

    };

    return connection;
}


/* =====================================================
   WAIT FOR ICE
===================================================== */

function waitForIceGathering() {

    return new Promise(resolve => {

        if (!pc) {
            resolve();
            return;
        }

        if (
            pc.iceGatheringState === "complete"
        ) {

            resolve();
            return;

        }

        let finished = false;

        const finish = () => {

            if (finished) return;

            finished = true;

            pc.removeEventListener(
                "icegatheringstatechange",
                check
            );

            resolve();

        };

        const check = () => {

            if (
                pc.iceGatheringState === "complete"
            ) {

                finish();

            }

        };

        pc.addEventListener(
            "icegatheringstatechange",
            check
        );

        setTimeout(
            finish,
            10000
        );

    });
}


/* =====================================================
   START SENDER
===================================================== */

async function startSender() {

    roleSelection.classList.add("hidden");

    senderScreen.classList.remove("hidden");

    senderStatus.textContent =
        "Creating connection...";

    pc = createPeerConnection();

    dataChannel =
        pc.createDataChannel(
            "file-transfer",
            {
                ordered: true
            }
        );

    setupSenderChannel();

    try {

        const offer =
            await pc.createOffer();

        await pc.setLocalDescription(
            offer
        );

        senderStatus.textContent =
            "Gathering network information...";

        await waitForIceGathering();

        const description =
            pc.localDescription;

        const encoded =
            encodeSignal(description);

        offerChunks =
            splitChunks(encoded);

        offerIndex = 0;

        showOfferQR();

        document
            .getElementById("offer-area")
            .classList.remove("hidden");

        document
            .getElementById("answer-area")
            .classList.remove("hidden");

        startAnswerScanner();

        senderStatus.textContent =
            "Show the offer QR to the receiver.";

    } catch (error) {

        console.error(error);

        senderStatus.textContent =
            "Error: " + error.message;

    }

}


/* =====================================================
   SENDER DATA CHANNEL
===================================================== */

function setupSenderChannel() {

    dataChannel.onopen = () => {

        console.log(
            "Data channel opened"
        );

        senderStatus.textContent =
            "Connected. Select a file.";

        senderFileArea.classList.remove(
            "hidden"
        );

    };

    dataChannel.onclose = () => {

        senderStatus.textContent =
            "Data channel closed.";

    };

    dataChannel.onerror = error => {

        console.error(
            "Data channel error:",
            error
        );

    };

}


/* =====================================================
   FILE SELECTION
===================================================== */

const fileInput =
    document.getElementById("file-input");

fileInput.addEventListener(
    "change",
    () => {

        const file =
            fileInput.files[0];

        if (!file) return;

        document.getElementById(
            "file-info"
        ).textContent =
            `${file.name} — ${formatBytes(file.size)}`;

    }
);


/* =====================================================
   SEND FILE
===================================================== */

document
    .getElementById("send-file-btn")
    .addEventListener(
        "click",
        async () => {

            const file =
                fileInput.files[0];

            if (!file) {

                alert(
                    "Please select a file."
                );

                return;

            }

            if (
                !dataChannel ||
                dataChannel.readyState !== "open"
            ) {

                alert(
                    "P2P connection is not ready."
                );

                return;

            }

            try {

                await sendFile(file);

            } catch (error) {

                console.error(error);

                senderStatus.textContent =
                    "File transfer failed.";

            }

        }
    );


async function sendFile(file) {

    const totalChunks =
        Math.ceil(
            file.size / CHUNK_SIZE
        );

    const metadata = {

        type: "file-info",

        name: file.name,

        size: file.size,

        mime:
            file.type ||
            "application/octet-stream",

        totalChunks:
            totalChunks

    };

    dataChannel.send(
        JSON.stringify(metadata)
    );

    let offset = 0;

    let chunkNumber = 0;

    while (offset < file.size) {

        const end =
            Math.min(
                offset + CHUNK_SIZE,
                file.size
            );

        const blob =
            file.slice(
                offset,
                end
            );

        const buffer =
            await blob.arrayBuffer();

        await waitForChannelBuffer();

        dataChannel.send(buffer);

        offset += buffer.byteLength;

        chunkNumber++;

        const progress =
            (offset / file.size) * 100;

        document.getElementById(
            "send-progress"
        ).style.width =
            progress + "%";

        document.getElementById(
            "send-progress-text"
        ).textContent =
            `${progress.toFixed(1)}%`;

    }

    await waitForChannelBuffer();

    dataChannel.send(
        JSON.stringify({
            type: "file-complete"
        })
    );

    document.getElementById(
        "send-progress-text"
    ).textContent =
        "File sent successfully.";

}


/* =====================================================
   DATA CHANNEL BACKPRESSURE
===================================================== */

function waitForChannelBuffer() {

    return new Promise(resolve => {

        if (
            !dataChannel ||
            dataChannel.bufferedAmount <
            1024 * 1024
        ) {

            resolve();

            return;

        }

        const timer =
            setInterval(
                () => {

                    if (
                        dataChannel.bufferedAmount <
                        512 * 1024
                    ) {

                        clearInterval(timer);

                        resolve();

                    }

                },
                20
            );

    });

}


/* =====================================================
   START RECEIVER
===================================================== */

function startReceiver() {

    roleSelection.classList.add("hidden");

    receiverScreen.classList.remove("hidden");

    receiverStatus.textContent =
        "Scan the sender QR.";

    pc = createPeerConnection();

    pc.ondatachannel = event => {

        dataChannel =
            event.channel;

        setupReceiverChannel();

    };

    startOfferScanner();

}


/* =====================================================
   RECEIVER DATA CHANNEL
===================================================== */

function setupReceiverChannel() {

    dataChannel.binaryType =
        "arraybuffer";

    dataChannel.onopen = () => {

        console.log(
            "Receiver data channel opened"
        );

        receiverStatus.textContent =
            "Connected. Waiting for file.";

        receiveFileArea.classList.remove(
            "hidden"
        );

    };

    dataChannel.onmessage = event => {

        receiveData(
            event.data
        );

    };

    dataChannel.onerror = error => {

        console.error(
            "Receiver data channel error:",
            error
        );

    };

}


/* =====================================================
   RECEIVE DATA
===================================================== */

function receiveData(data) {

    if (typeof data === "string") {

        let message;

        try {

            message =
                JSON.parse(data);

        } catch (error) {

            console.error(
                "Invalid message:",
                error
            );

            return;

        }

        if (
            message.type === "file-info"
        ) {

            incomingFile = {

                name:
                    message.name,

                size:
                    message.size,

                mime:
                    message.mime,

                totalChunks:
                    message.totalChunks

            };

            receivedFileChunks = [];

            receivedBytes = 0;

            document.getElementById(
                "received-file-name"
            ).textContent =
                `${incomingFile.name} — ${formatBytes(incomingFile.size)}`;

            return;

        }

        if (
            message.type === "file-complete"
        ) {

            finishFile();

            return;

        }

    }


    if (
        data instanceof ArrayBuffer
    ) {

        receivedFileChunks.push(data);

        receivedBytes +=
            data.byteLength;

        if (
            incomingFile &&
            incomingFile.size > 0
        ) {

            const progress =
                (
                    receivedBytes /
                    incomingFile.size
                ) * 100;

            document.getElementById(
                "receive-progress"
            ).style.width =
                progress + "%";

            document.getElementById(
                "receive-progress-text"
            ).textContent =
                `${progress.toFixed(1)}%`;

        }

    }

}


/* =====================================================
   FINISH FILE
===================================================== */

function finishFile() {

    if (!incomingFile) {

        return;

    }

    const blob =
        new Blob(
            receivedFileChunks,
            {
                type:
                    incomingFile.mime
            }
        );

    const url =
        URL.createObjectURL(blob);

    const download =
        document.getElementById(
            "download-btn"
        );

    download.href =
        url;

    download.download =
        incomingFile.name;

    download.classList.remove(
        "hidden"
    );

    document.getElementById(
        "receive-progress-text"
    ).textContent =
        "File received successfully.";

}


/* =====================================================
   SIGNAL ENCODING
===================================================== */

function encodeSignal(description) {

    const json =
        JSON.stringify(description);

    const compressed =
        pako.deflate(json);

    let binary = "";

    for (
        let i = 0;
        i < compressed.length;
        i++
    ) {

        binary += String.fromCharCode(
            compressed[i]
        );

    }

    return btoa(binary);

}


function decodeSignal(encoded) {

    const binary =
        atob(encoded);

    const bytes =
        new Uint8Array(
            binary.length
        );

    for (
        let i = 0;
        i < binary.length;
        i++
    ) {

        bytes[i] =
            binary.charCodeAt(i);

    }

    const json =
        pako.inflate(
            bytes,
            {
                to: "string"
            }
        );

    return JSON.parse(json);

}


/* =====================================================
   SPLIT QR DATA
===================================================== */

function splitChunks(data) {

    const size = 800;

    const chunks = [];

    for (
        let i = 0;
        i < data.length;
        i += size
    ) {

        chunks.push(
            data.substring(
                i,
                i + size
            )
        );

    }

    return chunks;

}


/* =====================================================
   OFFER QR
===================================================== */

function showOfferQR() {

    const container =
        document.getElementById(
            "offer-qr"
        );

    container.innerHTML = "";

    const payload =
        JSON.stringify({

            protocol:
                "p2p-file-transfer",

            type:
                "offer",

            index:
                offerIndex,

            total:
                offerChunks.length,

            data:
                offerChunks[offerIndex]

        });

    new QRCode(
        container,
        {

            text:
                payload,

            width:
                240,

            height:
                240,

            correctLevel:
                QRCode.CorrectLevel.L

        }
    );

    document.getElementById(
        "offer-progress"
    ).textContent =
        `${offerIndex + 1} / ${offerChunks.length}`;

}


document
    .getElementById("offer-next")
    .addEventListener(
        "click",
        () => {

            if (
                offerIndex <
                offerChunks.length - 1
            ) {

                offerIndex++;

                showOfferQR();

            }

        }
    );


document
    .getElementById("offer-prev")
    .addEventListener(
        "click",
        () => {

            if (offerIndex > 0) {

                offerIndex--;

                showOfferQR();

            }

        }
    );


/* =====================================================
   OFFER SCANNER
===================================================== */

async function startOfferScanner() {

    try {

        offerScanner =
            new Html5Qrcode(
                "offer-scanner"
            );

        await offerScanner.start(

            {
                facingMode:
                    "environment"
            },

            {
                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                }

            },

            text => {

                processOfferQR(text);

            },

            () => {}

        );

    } catch (error) {

        console.error(error);

        receiverStatus.textContent =
            "Camera error: " +
            error.message;

    }

}


/* =====================================================
   PROCESS OFFER QR
===================================================== */

async function processOfferQR(text) {

    try {

        const packet =
            JSON.parse(text);

        if (
            packet.protocol !==
            "p2p-file-transfer"
        ) {

            return;

        }

        if (
            packet.type !== "offer"
        ) {

            return;

        }

        receivedOfferChunks[
            packet.index
        ] = packet.data;

        const count =
            receivedOfferChunks.filter(
                Boolean
            ).length;

        document.getElementById(
            "offer-scan-status"
        ).textContent =
            `Received ${count} / ${packet.total}`;

        if (
            count === packet.total
        ) {

            await finishOffer();

        }

    } catch (error) {

        console.error(
            "Offer QR error:",
            error
        );

    }

}


/* =====================================================
   FINISH OFFER
===================================================== */

async function finishOffer() {

    try {

        if (offerScanner) {

            await offerScanner.stop();

            offerScanner.clear();

        }

        const encoded =
            receivedOfferChunks.join("");

        const offer =
            decodeSignal(encoded);

        await pc.setRemoteDescription(
            offer
        );

        const answer =
            await pc.createAnswer();

        await pc.setLocalDescription(
            answer
        );

        receiverStatus.textContent =
            "Creating answer...";

        await waitForIceGathering();

        const encodedAnswer =
            encodeSignal(
                pc.localDescription
            );

        answerChunks =
            splitChunks(
                encodedAnswer
            );

        answerIndex = 0;

        showAnswerQR();

        document
            .getElementById("offer-scan-area")
            .classList.add("hidden");

        receiverAnswerArea.classList.remove(
            "hidden"
        );

        receiverStatus.textContent =
            "Show the answer QR to the sender.";

    } catch (error) {

        console.error(error);

        receiverStatus.textContent =
            "Offer processing failed: " +
            error.message;

    }

}


/* =====================================================
   ANSWER QR
===================================================== */

function showAnswerQR() {

    const container =
        document.getElementById(
            "receiver-answer-qr"
        );

    container.innerHTML = "";

    const payload =
        JSON.stringify({

            protocol:
                "p2p-file-transfer",

            type:
                "answer",

            index:
                answerIndex,

            total:
                answerChunks.length,

            data:
                answerChunks[answerIndex]

        });

    new QRCode(
        container,
        {

            text:
                payload,

            width:
                240,

            height:
                240,

            correctLevel:
                QRCode.CorrectLevel.L

        }
    );

    document.getElementById(
        "answer-progress"
    ).textContent =
        `${answerIndex + 1} / ${answerChunks.length}`;

}


document
    .getElementById("answer-next")
    .addEventListener(
        "click",
        () => {

            if (
                answerIndex <
                answerChunks.length - 1
            ) {

                answerIndex++;

                showAnswerQR();

            }

        }
    );


document
    .getElementById("answer-prev")
    .addEventListener(
        "click",
        () => {

            if (answerIndex > 0) {

                answerIndex--;

                showAnswerQR();

            }

        }
    );


/* =====================================================
   ANSWER SCANNER
===================================================== */

async function startAnswerScanner() {

    try {

        answerScanner =
            new Html5Qrcode(
                "answer-scanner"
            );

        await answerScanner.start(

            {
                facingMode:
                    "environment"
            },

            {
                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                }

            },

            text => {

                processAnswerQR(text);

            },

            () => {}

        );

    } catch (error) {

        console.error(error);

        senderStatus.textContent =
            "Camera error: " +
            error.message;

    }

}


/* =====================================================
   PROCESS ANSWER QR
===================================================== */

async function processAnswerQR(text) {

    try {

        const packet =
            JSON.parse(text);

        if (
            packet.protocol !==
            "p2p-file-transfer"
        ) {

            return;

        }

        if (
            packet.type !== "answer"
        ) {

            return;

        }

        receivedAnswerChunks[
            packet.index
        ] = packet.data;

        const count =
            receivedAnswerChunks.filter(
                Boolean
            ).length;

        document.getElementById(
            "answer-scan-status"
        ).textContent =
            `Received ${count} / ${packet.total}`;

        if (
            count === packet.total
        ) {

            await finishAnswer();

        }

    } catch (error) {

        console.error(
            "Answer QR error:",
            error
        );

    }

}


/* =====================================================
   FINISH ANSWER
===================================================== */

async function finishAnswer() {

    try {

        if (answerScanner) {

            await answerScanner.stop();

            answerScanner.clear();

        }

        const encoded =
            receivedAnswerChunks.join("");

        const answer =
            decodeSignal(encoded);

        await pc.setRemoteDescription(
            answer
        );

        document
            .getElementById("answer-area")
            .classList.add("hidden");

        senderStatus.textContent =
            "Answer received. Connecting...";

    } catch (error) {

        console.error(error);

        senderStatus.textContent =
            "Answer processing failed: " +
            error.message;

    }

}


/* =====================================================
   FORMAT BYTES
===================================================== */

function formatBytes(bytes) {

    if (!bytes) {
        return "0 Bytes";
    }

    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB",
        "TB"
    ];

    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );

    return (
        (
            bytes /
            Math.pow(
                1024,
                index
            )
        ).toFixed(2) +
        " " +
        units[index]
    );

}