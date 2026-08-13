/* =========================================================
   ELEMENTS
========================================================= */

const showQrBtn = document.getElementById("show-qr-btn");
const scanQrBtn = document.getElementById("scan-qr-btn");

const qrSection = document.getElementById("qr-section");
const scannerSection = document.getElementById("scanner-section");

const peerIdElement = document.getElementById("peer-id");

const statusText = document.getElementById("status-text");
const statusDot = document.getElementById("status-dot");

const scannerMessage =
    document.getElementById("scanner-message");

const connectionResult =
    document.getElementById("connection-result");

const connectedPeer =
    document.getElementById("connected-peer");

const peerIdInput =
    document.getElementById("peer-id-input");

const connectPeerBtn =
    document.getElementById("connect-peer-btn");

const copyPeerIdBtn =
    document.getElementById("copy-peer-id");

/* =========================================================
   FILE TRANSFER ELEMENTS
========================================================= */

const fileTransfer =
    document.getElementById("file-transfer");

const fileInput =
    document.getElementById("file-input");

const sendFileBtn =
    document.getElementById("send-file-btn");

const fileName =
    document.getElementById("file-name");

const fileSize =
    document.getElementById("file-size");

const transferProgress =
    document.getElementById("transfer-progress");

const transferStatus =
    document.getElementById("transfer-status");

const receivedFile =
    document.getElementById("received-file");

const receivedFileName =
    document.getElementById("received-file-name");

const downloadFile =
    document.getElementById("download-file");


/* =========================================================
   PEER
========================================================= */

let peer = null;
let connection = null;


/* =========================================================
   QR SCANNER
========================================================= */

let qrScanner = null;
let scannerRunning = false;
let connectingToPeer = false;


/* =========================================================
   FILE SENDING
========================================================= */

let selectedFiles = [];
let sendingFiles = false;

const CHUNK_SIZE = 64 * 1024;


/* =========================================================
   FILE RECEIVING
========================================================= */

let receivingFile = null;

let receivedChunks = [];
let receivedBytes = 0;

let receivedFileNumber = 0;
let receivedTotalFiles = 0;


/* =========================================================
   ACK SYSTEM
========================================================= */

let chunkAckResolver = null;
let chunkAckTimeout = null;

let fileAckResolver = null;
let fileAckTimeout = null;


/* =========================================================
   RECEIVED FILE DOWNLOAD URLS
========================================================= */

const receivedObjectUrls = [];


/* =========================================================
   STATUS
========================================================= */

function setStatus(text, connected = false) {

    if (statusText) {
        statusText.textContent = text;
    }

    if (statusDot) {

        statusDot.classList.toggle(
            "connected",
            connected
        );
    }
}


/* =========================================================
   CREATE PEER
========================================================= */

function createPeer() {

    setStatus("Connecting...");


    if (typeof Peer === "undefined") {

        console.error(
            "PeerJS is not loaded."
        );

        setStatus("PeerJS unavailable");

        return;
    }


    peer = new Peer();


    /* -----------------------------------------------------
       PEER READY
    ----------------------------------------------------- */

    peer.on("open", (id) => {

        console.log(
            "My Peer ID:",
            id
        );


        peerIdElement.textContent =
            id;


        setStatus("Ready");


        generateQRCode(id);
    });


    /* -----------------------------------------------------
       INCOMING CONNECTION
    ----------------------------------------------------- */

    peer.on("connection", (conn) => {

        console.log(
            "Incoming connection:",
            conn.peer
        );


        setupConnection(conn);
    });


    /* -----------------------------------------------------
       ERROR
    ----------------------------------------------------- */

    peer.on("error", (error) => {

        console.error(
            "PeerJS error:",
            error
        );


        setStatus(
            "Connection error"
        );


        if (transferStatus) {

            transferStatus.textContent =
                "PeerJS connection error.";
        }
    });


    /* -----------------------------------------------------
       DISCONNECTED
    ----------------------------------------------------- */

    peer.on("disconnected", () => {

        setStatus(
            "Signaling disconnected"
        );
    });


    /* -----------------------------------------------------
       CLOSED
    ----------------------------------------------------- */

    peer.on("close", () => {

        setStatus("Closed");
    });
}


/* =========================================================
   QR GENERATOR
========================================================= */

function generateQRCode(peerId) {

    const container =
        document.getElementById("qrcode");


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (typeof QRCode === "undefined") {

        console.error(
            "QRCode library not loaded."
        );

        return;
    }


    new QRCode(
        container,
        {
            text: peerId,

            width: 220,
            height: 220,

            colorDark: "#111111",
            colorLight: "#ffffff",

            correctLevel:
                QRCode.CorrectLevel.M
        }
    );
}


/* =========================================================
   SETUP CONNECTION
========================================================= */

function setupConnection(conn) {

    connection = conn;


    conn.on("open", () => {

        console.log(
            "CONNECTED TO:",
            conn.peer
        );


        setStatus(
            "Connected",
            true
        );


        if (connectedPeer) {

            connectedPeer.textContent =
                conn.peer;
        }


        if (connectionResult) {

            connectionResult.classList.remove(
                "hidden"
            );
        }


        if (fileTransfer) {

            fileTransfer.classList.remove(
                "hidden"
            );
        }


        if (transferStatus) {

            transferStatus.textContent =
                "Connected. Select files.";
        }


        updateSendButton();
    });


    /* -----------------------------------------------------
       RECEIVE DATA
    ----------------------------------------------------- */

    conn.on("data", (data) => {

        handleIncomingData(data);
    });


    /* -----------------------------------------------------
       CLOSE
    ----------------------------------------------------- */

    conn.on("close", () => {

        console.log(
            "Connection closed."
        );


        setStatus(
            "Disconnected"
        );


        if (connectionResult) {

            connectionResult.classList.add(
                "hidden"
            );
        }


        if (fileTransfer) {

            fileTransfer.classList.add(
                "hidden"
            );
        }


        connection = null;

        selectedFiles = [];

        sendingFiles = false;

        updateSendButton();
    });


    /* -----------------------------------------------------
       ERROR
    ----------------------------------------------------- */

    conn.on("error", (error) => {

        console.error(
            "Data connection error:",
            error
        );


        if (transferStatus) {

            transferStatus.textContent =
                "Connection error.";
        }
    });
}


/* =========================================================
   UPDATE SEND BUTTON
========================================================= */

function updateSendButton() {

    if (!sendFileBtn) {
        return;
    }


    sendFileBtn.disabled =
        sendingFiles ||
        selectedFiles.length === 0 ||
        !connection ||
        !connection.open;
}


/* =========================================================
   MY QR BUTTON
========================================================= */

showQrBtn.addEventListener(
    "click",
    async () => {

        showQrBtn.classList.add(
            "active"
        );

        scanQrBtn.classList.remove(
            "active"
        );


        qrSection.classList.remove(
            "hidden"
        );

        scannerSection.classList.add(
            "hidden"
        );


        await stopScanner();
    }
);


/* =========================================================
   SCAN QR BUTTON
========================================================= */

scanQrBtn.addEventListener(
    "click",
    async () => {

        showQrBtn.classList.remove(
            "active"
        );

        scanQrBtn.classList.add(
            "active"
        );


        qrSection.classList.add(
            "hidden"
        );

        scannerSection.classList.remove(
            "hidden"
        );


        await startScanner();
    }
);


/* =========================================================
   START SCANNER
========================================================= */

async function startScanner() {

    if (scannerRunning) {
        return;
    }


    if (
        typeof Html5Qrcode ===
        "undefined"
    ) {

        scannerMessage.textContent =
            "QR scanner library not loaded.";

        return;
    }


    scannerMessage.textContent =
        "Starting camera...";


    qrScanner =
        new Html5Qrcode("reader");


    try {

        const cameras =
            await Html5Qrcode.getCameras();


        if (
            !cameras ||
            cameras.length === 0
        ) {

            scannerMessage.textContent =
                "No camera found.";

            return;
        }


        let cameraId =
            cameras[0].id;


        for (
            const camera of cameras
        ) {

            const label =
                (
                    camera.label ||
                    ""
                ).toLowerCase();


            if (
                label.includes("back") ||
                label.includes("rear") ||
                label.includes("environment")
            ) {

                cameraId =
                    camera.id;

                break;
            }
        }


        await qrScanner.start(

            cameraId,

            {
                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                }
            },

            handleQRCode,

            () => {}
        );


        scannerRunning = true;


        scannerMessage.textContent =
            "Point the camera at the QR code.";

    }

    catch (error) {

        console.error(
            "Camera error:",
            error
        );


        scannerMessage.textContent =
            "Unable to access camera.";
    }
}


/* =========================================================
   QR SCANNED
========================================================= */

async function handleQRCode(decodedText) {

    if (connectingToPeer) {
        return;
    }


    const remotePeerId =
        decodedText.trim();


    if (!remotePeerId) {
        return;
    }


    if (
        peer &&
        peer.id === remotePeerId
    ) {

        scannerMessage.textContent =
            "This is your own QR code.";

        return;
    }


    connectingToPeer = true;


    scannerMessage.textContent =
        "Peer found. Connecting...";


    await stopScanner();


    try {

        const conn =
            peer.connect(
                remotePeerId,
                {
                    reliable: true
                }
            );


        setupConnection(conn);

    }

    catch (error) {

        console.error(
            "Connection error:",
            error
        );


        scannerMessage.textContent =
            "Unable to connect.";

        connectingToPeer = false;
    }
}


/* =========================================================
   STOP SCANNER
========================================================= */

async function stopScanner() {

    if (!qrScanner) {
        return;
    }


    try {

        if (scannerRunning) {

            await qrScanner.stop();
        }


        qrScanner.clear();

    }

    catch (error) {

        console.warn(
            "Scanner stop error:",
            error
        );
    }


    qrScanner = null;

    scannerRunning = false;
}


/* =========================================================
   MULTIPLE FILE SELECTION
========================================================= */

fileInput.addEventListener(
    "change",
    () => {

        selectedFiles =
            Array.from(
                fileInput.files
            );


        if (
            selectedFiles.length === 0
        ) {

            fileName.textContent =
                "No files selected";

            fileSize.textContent = "";

            updateSendButton();

            return;
        }


        const totalSize =
            selectedFiles.reduce(
                (total, file) => {

                    return total +
                        file.size;

                },
                0
            );


        fileName.textContent =
            `${selectedFiles.length} files selected`;


        fileSize.textContent =
            formatFileSize(
                totalSize
            );


        transferProgress.style.width =
            "0%";


        transferStatus.textContent =
            `${selectedFiles.length} files ready to send.`;


        updateSendButton();
    }
);


/* =========================================================
   SEND BUTTON
========================================================= */

sendFileBtn.addEventListener(
    "click",
    sendMultipleFiles
);


/* =========================================================
   SEND MULTIPLE FILES
========================================================= */

async function sendMultipleFiles() {

    if (sendingFiles) {
        return;
    }


    if (
        !connection ||
        !connection.open
    ) {

        transferStatus.textContent =
            "No connection.";

        return;
    }


    if (
        selectedFiles.length === 0
    ) {

        transferStatus.textContent =
            "Select files first.";

        return;
    }


    sendingFiles = true;

    updateSendButton();


    const files =
        [...selectedFiles];


    const totalFiles =
        files.length;


    try {

        /*
         * IMPORTANT:
         * Each file is completely finished
         * before the next file starts.
         */

        for (
            let i = 0;
            i < totalFiles;
            i++
        ) {

            const file =
                files[i];


            await sendSingleFile(
                file,
                i + 1,
                totalFiles
            );
        }


        transferProgress.style.width =
            "100%";


        transferStatus.textContent =
            `All ${totalFiles} files sent successfully.`;

    }

    catch (error) {

        console.error(
            "Transfer failed:",
            error
        );


        transferStatus.textContent =
            `Transfer failed: ${error.message}`;
    }


    sendingFiles = false;

    updateSendButton();
}


/* =========================================================
   SEND ONE FILE
========================================================= */

async function sendSingleFile(
    file,
    fileNumber,
    totalFiles
) {

    console.log(
        `START FILE ${fileNumber}/${totalFiles}:`,
        file.name
    );


    /*
     * Tell receiver a new file is starting.
     */

    connection.send({

        type: "file-start",

        fileNumber:
            fileNumber,

        totalFiles:
            totalFiles,

        name:
            file.name,

        size:
            file.size,

        mime:
            file.type ||
            "application/octet-stream"
    });


    /*
     * Empty file.
     */

    if (file.size === 0) {

        connection.send({

            type: "file-end"
        });


        await waitForFileAck();

        return;
    }


    let offset = 0;


    /*
     * SEND CHUNKS
     */

    while (
        offset <
        file.size
    ) {

        if (
            !connection ||
            !connection.open
        ) {

            throw new Error(
                "Connection lost."
            );
        }


        const blob =
            file.slice(
                offset,
                offset + CHUNK_SIZE
            );


        const buffer =
            await blob.arrayBuffer();


        connection.send({

            type: "file-chunk",

            data: buffer
        });


        offset +=
            buffer.byteLength;


        const progress =
            (
                offset /
                file.size
            ) * 100;


        transferProgress.style.width =
            `${Math.round(progress)}%`;


        transferStatus.textContent =
            `Sending ${fileNumber}/${totalFiles}: ${file.name} — ${Math.round(progress)}%`;


        /*
         * Wait until receiver confirms
         * this chunk.
         */

        await waitForChunkAck();
    }


    /*
     * File completely sent.
     */

    connection.send({

        type: "file-end"
    });


    /*
     * Wait until receiver has reconstructed
     * the complete file.
     */

    await waitForFileAck();


    console.log(
        `COMPLETE FILE ${fileNumber}/${totalFiles}:`,
        file.name
    );
}


/* =========================================================
   WAIT FOR CHUNK ACK
========================================================= */

function waitForChunkAck() {

    return new Promise(
        (resolve, reject) => {

            clearTimeout(
                chunkAckTimeout
            );


            chunkAckResolver =
                resolve;


            chunkAckTimeout =
                setTimeout(
                    () => {

                        chunkAckResolver =
                            null;


                        reject(
                            new Error(
                                "Receiver stopped responding."
                            )
                        );

                    },
                    30000
                );
        }
    );
}


/* =========================================================
   WAIT FOR FILE ACK
========================================================= */

function waitForFileAck() {

    return new Promise(
        (resolve, reject) => {

            clearTimeout(
                fileAckTimeout
            );


            fileAckResolver =
                resolve;


            fileAckTimeout =
                setTimeout(
                    () => {

                        fileAckResolver =
                            null;


                        reject(
                            new Error(
                                "File completion acknowledgement timeout."
                            )
                        );

                    },
                    30000
                );
        }
    );
}


/* =========================================================
   RECEIVE DATA
========================================================= */

function handleIncomingData(data) {

    if (!data) {
        return;
    }


    /*
     * NEW FILE
     */

    if (
        data.type === "file-start"
    ) {

        startReceivingFile(
            data
        );

        return;
    }


    /*
     * FILE CHUNK
     */

    if (
        data.type === "file-chunk"
    ) {

        receiveFileChunk(
            data.data
        );

        return;
    }


    /*
     * FILE COMPLETE
     */

    if (
        data.type === "file-end"
    ) {

        finishReceivingFile();

        return;
    }


    /*
     * CHUNK ACK
     */

    if (
        data.type === "chunk-ack"
    ) {

        resolveChunkAck();

        return;
    }


    /*
     * FILE ACK
     */

    if (
        data.type === "file-ack"
    ) {

        resolveFileAck();

        return;
    }
}


/* =========================================================
   RESOLVE CHUNK ACK
========================================================= */

function resolveChunkAck() {

    if (!chunkAckResolver) {
        return;
    }


    clearTimeout(
        chunkAckTimeout
    );


    const resolve =
        chunkAckResolver;


    chunkAckResolver =
        null;


    resolve();
}


/* =========================================================
   RESOLVE FILE ACK
========================================================= */

function resolveFileAck() {

    if (!fileAckResolver) {
        return;
    }


    clearTimeout(
        fileAckTimeout
    );


    const resolve =
        fileAckResolver;


    fileAckResolver =
        null;


    resolve();
}


/* =========================================================
   START RECEIVING FILE
========================================================= */

function startReceivingFile(data) {

    console.log(
        `START RECEIVING ${data.fileNumber}/${data.totalFiles}:`,
        data.name
    );


    /*
     * Reset receiver state for THIS file.
     */

    receivingFile = {

        name:
            data.name,

        size:
            Number(data.size),

        mime:
            data.mime ||
            "application/octet-stream"
    };


    receivedFileNumber =
        Number(data.fileNumber);


    receivedTotalFiles =
        Number(data.totalFiles);


    receivedChunks = [];

    receivedBytes = 0;


    transferProgress.style.width =
        "0%";


    transferStatus.textContent =
        `Receiving ${receivedFileNumber}/${receivedTotalFiles}: ${data.name}`;
}


/* =========================================================
   RECEIVE CHUNK
========================================================= */

function receiveFileChunk(data) {

    if (!receivingFile) {

        console.error(
            "Chunk received without file metadata."
        );

        return;
    }


    let buffer;


    /*
     * ArrayBuffer
     */

    if (
        data instanceof ArrayBuffer
    ) {

        buffer = data;
    }


    /*
     * Uint8Array
     */

    else if (
        data instanceof Uint8Array
    ) {

        buffer =
            data.buffer.slice(
                data.byteOffset,
                data.byteOffset +
                data.byteLength
            );
    }


    /*
     * Blob
     */

    else if (
        data instanceof Blob
    ) {

        data.arrayBuffer()
            .then(
                receiveFileChunk
            );

        return;
    }


    else {

        console.error(
            "Unknown chunk type:",
            data
        );

        return;
    }


    /*
     * Store chunk.
     */

    receivedChunks.push(
        buffer
    );


    receivedBytes +=
        buffer.byteLength;


    /*
     * Progress.
     */

    let progress = 100;


    if (
        receivingFile.size > 0
    ) {

        progress =
            (
                receivedBytes /
                receivingFile.size
            ) * 100;
    }


    progress =
        Math.min(
            progress,
            100
        );


    transferProgress.style.width =
        `${Math.round(progress)}%`;


    transferStatus.textContent =
        `Receiving ${receivedFileNumber}/${receivedTotalFiles}: ${receivingFile.name} — ${Math.round(progress)}%`;


    /*
     * Tell sender to continue.
     */

    if (
        connection &&
        connection.open
    ) {

        connection.send({

            type:
                "chunk-ack"
        });
    }
}


/* =========================================================
   FINISH RECEIVING FILE
========================================================= */

function finishReceivingFile() {

    if (!receivingFile) {
        return;
    }


    console.log(
        `COMPLETE ${receivedFileNumber}/${receivedTotalFiles}:`,
        receivingFile.name
    );


    /*
     * Rebuild this file.
     */

    const blob =
        new Blob(
            receivedChunks,
            {
                type:
                    receivingFile.mime
            }
        );


    /*
     * Create download URL.
     */

    const url =
        URL.createObjectURL(
            blob
        );


    receivedObjectUrls.push(
        url
    );


    /*
     * Add separate download.
     */

    createReceivedFileElement(
        receivingFile.name,
        url
    );


    transferProgress.style.width =
        "100%";


    transferStatus.textContent =
        `Received ${receivedFileNumber}/${receivedTotalFiles}: ${receivingFile.name}`;


    /*
     * ACK the complete file.
     */

    if (
        connection &&
        connection.open
    ) {

        connection.send({

            type:
                "file-ack"
        });
    }


    /*
     * Reset ONLY current file.
     *
     * This is important because the
     * next file must start fresh.
     */

    receivingFile = null;

    receivedChunks = [];

    receivedBytes = 0;
}


/* =========================================================
   CREATE RECEIVED FILE ELEMENT
========================================================= */

function createReceivedFileElement(
    name,
    url
) {

    /*
     * Create a new element EVERY TIME.
     */

    const item =
        document.createElement(
            "div"
        );


    item.className =
        "received-file-item";


    const nameElement =
        document.createElement(
            "div"
        );


    nameElement.textContent =
        name;


    nameElement.style.wordBreak =
        "break-all";


    const download =
        document.createElement(
            "a"
        );


    download.href =
        url;


    download.download =
        name;


    download.textContent =
        "Download";


    item.appendChild(
        nameElement
    );


    item.appendChild(
        download
    );


    /*
     * Always append a NEW element.
     */

    if (fileTransfer) {

        fileTransfer.appendChild(
            item
        );
    }
}


/* =========================================================
   FILE SIZE
========================================================= */

function formatFileSize(bytes) {

    if (bytes === 0) {
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
        bytes /
        Math.pow(
            1024,
            index
        )
    ).toFixed(2)
    + " "
    + units[index];
}


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        if (
            qrScanner &&
            scannerRunning
        ) {

            qrScanner
                .stop()
                .catch(() => {});
        }


        for (
            const url of receivedObjectUrls
        ) {

            URL.revokeObjectURL(
                url
            );
        }


        clearTimeout(
            chunkAckTimeout
        );


        clearTimeout(
            fileAckTimeout
        );
    }
);


/* =========================================================
   COPY PEER ID
========================================================= */

copyPeerIdBtn.addEventListener(
    "click",
    async () => {

        const id =
            peerIdElement.textContent.trim();


        if (
            !id ||
            id === "Connecting..."
        ) {

            return;
        }


        try {

            await navigator.clipboard.writeText(
                id
            );


            const originalText =
                copyPeerIdBtn.textContent;


            copyPeerIdBtn.textContent =
                "Copied";


            setTimeout(() => {

                copyPeerIdBtn.textContent =
                    originalText;

            }, 1500);

        }

        catch (error) {

            console.error(
                "Copy failed:",
                error
            );
        }
    }
);

/* =========================================================
   CONNECT USING PEER ID
========================================================= */

connectPeerBtn.addEventListener(
    "click",
    connectUsingPeerId
);


peerIdInput.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Enter"
        ) {

            connectUsingPeerId();
        }
    }
);


function connectUsingPeerId() {

    if (
        !peer ||
        !peer.id
    ) {

        scannerMessage.textContent =
            "Peer is not ready yet.";

        return;
    }


    const remotePeerId =
        peerIdInput.value.trim();


    if (!remotePeerId) {

        scannerMessage.textContent =
            "Enter a Peer ID.";

        return;
    }


    if (
        remotePeerId === peer.id
    ) {

        scannerMessage.textContent =
            "You cannot connect to yourself.";

        return;
    }


    if (
        connection &&
        connection.open
    ) {

        scannerMessage.textContent =
            "Already connected.";

        return;
    }


    console.log(
        "Connecting manually to:",
        remotePeerId
    );


    scannerMessage.textContent =
        "Connecting to peer...";


    connectPeerBtn.disabled =
        true;


    try {

        const conn =
            peer.connect(
                remotePeerId,
                {
                    reliable: true
                }
            );


        setupConnection(conn);


        /*
            setupConnection() handles
            the open/error/close events.
        */

        conn.on("open", () => {

            connectPeerBtn.disabled =
                false;

            peerIdInput.value = "";

        });


        conn.on("error", () => {

            connectPeerBtn.disabled =
                false;
        });

    }

    catch (error) {

        console.error(
            "Manual connection error:",
            error
        );


        scannerMessage.textContent =
            "Unable to connect.";

        connectPeerBtn.disabled =
            false;
    }
}

/* =========================================================
   START APPLICATION
========================================================= */

createPeer();