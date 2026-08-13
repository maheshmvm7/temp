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
   PEER VARIABLES
========================================================= */

let peer = null;
let connection = null;

let qrScanner = null;
let scannerRunning = false;
let connectingToPeer = false;


/* =========================================================
   FILE VARIABLES
========================================================= */

let selectedFiles = [];

let sendingFiles = false;

let receivingFile = null;
let receivedChunks = [];
let receivedBytes = 0;

let receivedFileNumber = 0;
let receivedTotalFiles = 0;


/* =========================================================
   DOWNLOAD URLS
========================================================= */

let receivedObjectUrls = [];


/* =========================================================
   TRANSFER SETTINGS
========================================================= */

const CHUNK_SIZE = 64 * 1024;


/* =========================================================
   ACK SYSTEM
========================================================= */

let chunkAckResolver = null;
let chunkAckRejecter = null;
let chunkAckTimeout = null;

let fileAckResolver = null;
let fileAckRejecter = null;
let fileAckTimeout = null;


/* =========================================================
   STATUS
========================================================= */

function setStatus(text, connected = false) {

    if (statusText) {
        statusText.textContent = text;
    }

    if (!statusDot) {
        return;
    }

    if (connected) {
        statusDot.classList.add("connected");
    } else {
        statusDot.classList.remove("connected");
    }
}


/* =========================================================
   CREATE PEER
========================================================= */

function createPeer() {

    setStatus("Connecting...");

    if (typeof Peer === "undefined") {

        console.error(
            "PeerJS library is not loaded."
        );

        setStatus("PeerJS unavailable");

        return;
    }


    peer = new Peer();


    /* =====================================================
       PEER READY
    ===================================================== */

    peer.on("open", (id) => {

        console.log("My Peer ID:", id);

        peerIdElement.textContent = id;

        setStatus("Ready");

        generateQRCode(id);
    });


    /* =====================================================
       INCOMING CONNECTION
    ===================================================== */

    peer.on("connection", (conn) => {

        console.log(
            "Incoming connection:",
            conn.peer
        );

        setupConnection(conn);
    });


    /* =====================================================
       PEER ERROR
    ===================================================== */

    peer.on("error", (error) => {

        console.error(
            "PeerJS error:",
            error
        );

        setStatus("Connection error");

        if (transferStatus) {
            transferStatus.textContent =
                `Connection error: ${error.type || "unknown"}`;
        }
    });


    /* =====================================================
       PEER DISCONNECTED
    ===================================================== */

    peer.on("disconnected", () => {

        console.log(
            "Disconnected from PeerServer"
        );

        setStatus(
            "Signaling disconnected"
        );
    });


    /* =====================================================
       PEER CLOSED
    ===================================================== */

    peer.on("close", () => {

        console.log("Peer closed");

        setStatus("Closed");
    });
}


/* =========================================================
   GENERATE QR
========================================================= */

function generateQRCode(peerId) {

    const qrContainer =
        document.getElementById("qrcode");

    if (!qrContainer) {
        return;
    }

    qrContainer.innerHTML = "";


    if (typeof QRCode === "undefined") {

        console.error(
            "QRCode library is not loaded."
        );

        return;
    }


    new QRCode(qrContainer, {

        text: peerId,

        width: 220,
        height: 220,

        colorDark: "#111111",
        colorLight: "#ffffff",

        correctLevel:
            QRCode.CorrectLevel.M
    });


    console.log(
        "QR generated:",
        peerId
    );
}


/* =========================================================
   SETUP CONNECTION
========================================================= */

function setupConnection(conn) {

    if (!conn) {
        return;
    }


    /*
        Close an old connection.
    */

    if (
        connection &&
        connection !== conn &&
        connection.open
    ) {

        try {
            connection.close();
        } catch (error) {
            console.warn(error);
        }
    }


    connection = conn;


    /* =====================================================
       CONNECTION OPEN
    ===================================================== */

    conn.on("open", () => {

        console.log(
            "P2P connection established"
        );

        console.log(
            "Connected peer:",
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


        /*
            Show file-transfer section.
        */

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


    /* =====================================================
       DATA
    ===================================================== */

    conn.on("data", (data) => {

        handleIncomingData(data);
    });


    /* =====================================================
       CLOSE
    ===================================================== */

    conn.on("close", () => {

        console.log(
            "Peer connection closed"
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


    /* =====================================================
       ERROR
    ===================================================== */

    conn.on("error", (error) => {

        console.error(
            "Data connection error:",
            error
        );


        if (transferStatus) {

            transferStatus.textContent =
                "Data connection error.";
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


        /*
            Prefer rear camera.
        */

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

            () => {
                /*
                    Ignore normal
                    scanning failures.
                */
            }
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
   QR CODE FOUND
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


    /*
        Don't connect to ourselves.
    */

    if (
        peer &&
        peer.id === remotePeerId
    ) {

        scannerMessage.textContent =
            "This is your own QR code.";

        return;
    }


    connectingToPeer = true;


    console.log(
        "QR scanned:",
        remotePeerId
    );


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
            "Connection failed:",
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
   FILE SELECTION
========================================================= */

if (fileInput) {

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


            const count =
                selectedFiles.length;


            const totalSize =
                selectedFiles.reduce(
                    (total, file) =>
                        total + file.size,
                    0
                );


            /*
                Display number of files.
            */

            fileName.textContent =
                `${count} file${count > 1 ? "s" : ""} selected`;


            /*
                Display total size.
            */

            fileSize.textContent =
                formatFileSize(
                    totalSize
                );


            /*
                Reset progress.
            */

            transferProgress.style.width =
                "0%";


            transferStatus.textContent =
                `${count} file${count > 1 ? "s" : ""} ready to send.`;


            updateSendButton();
        }
    );
}


/* =========================================================
   SEND FILE BUTTON
========================================================= */

if (sendFileBtn) {

    sendFileBtn.addEventListener(
        "click",
        sendMultipleFiles
    );
}


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
            "No peer connection.";

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


    const totalFiles =
        selectedFiles.length;


    try {

        /*
            Send each file sequentially.
        */

        for (
            let i = 0;
            i < totalFiles;
            i++
        ) {

            const file =
                selectedFiles[i];


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
            "Multiple file transfer failed:",
            error
        );


        transferStatus.textContent =
            "File transfer failed.";
    }


    sendingFiles = false;

    updateSendButton();
}


/* =========================================================
   SEND SINGLE FILE
========================================================= */

async function sendSingleFile(
    file,
    fileNumber,
    totalFiles
) {

    console.log(
        `Sending ${fileNumber}/${totalFiles}:`,
        file.name
    );


    /*
        Tell receiver about the file.
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
        Empty file.
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
        Send chunks.
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


        const chunk =
            file.slice(
                offset,
                offset + CHUNK_SIZE
            );


        const buffer =
            await chunk.arrayBuffer();


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
            `${Math.min(
                progress,
                100
            )}%`;


        transferStatus.textContent =
            `Sending ${fileNumber}/${totalFiles}: ${file.name} — ${Math.round(progress)}%`;


        /*
            Wait for receiver.
        */

        await waitForChunkAck();
    }


    /*
        Tell receiver that the
        current file is complete.
    */

    connection.send({

        type: "file-end"
    });


    /*
        Wait for receiver to rebuild
        the file.
    */

    await waitForFileAck();


    console.log(
        `Finished: ${file.name}`
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

            chunkAckRejecter =
                reject;


            chunkAckTimeout =
                setTimeout(
                    () => {

                        chunkAckResolver =
                            null;

                        chunkAckRejecter =
                            null;

                        reject(
                            new Error(
                                "Chunk acknowledgement timeout."
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

            fileAckRejecter =
                reject;


            fileAckTimeout =
                setTimeout(
                    () => {

                        fileAckResolver =
                            null;

                        fileAckRejecter =
                            null;

                        reject(
                            new Error(
                                "File acknowledgement timeout."
                            )
                        );

                    },
                    30000
                );
        }
    );
}


/* =========================================================
   HANDLE INCOMING DATA
========================================================= */

function handleIncomingData(data) {

    if (!data) {
        return;
    }


    /*
        FILE START
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
        FILE CHUNK
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
        FILE END
    */

    if (
        data.type === "file-end"
    ) {

        finishReceivingFile();

        return;
    }


    /*
        CHUNK ACK
    */

    if (
        data.type === "chunk-ack"
    ) {

        resolveChunkAck();

        return;
    }


    /*
        FILE ACK
    */

    if (
        data.type === "file-ack"
    ) {

        resolveFileAck();

        return;
    }


    console.log(
        "Unknown data:",
        data
    );
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


    chunkAckResolver = null;
    chunkAckRejecter = null;


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


    fileAckResolver = null;
    fileAckRejecter = null;


    resolve();
}


/* =========================================================
   START RECEIVING FILE
========================================================= */

function startReceivingFile(data) {

    console.log(
        `Receiving ${data.fileNumber}/${data.totalFiles}:`,
        data.name
    );


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


    /*
        Hide previous single-file
        result while receiving.
    */

    if (receivedFile) {

        receivedFile.classList.add(
            "hidden"
        );
    }


    transferProgress.style.width =
        "0%";


    transferStatus.textContent =
        `Receiving ${receivedFileNumber}/${receivedTotalFiles}: ${data.name}`;
}


/* =========================================================
   RECEIVE FILE CHUNK
========================================================= */

function receiveFileChunk(data) {

    if (!receivingFile) {

        console.warn(
            "Chunk received without file."
        );

        return;
    }


    let chunk = data;


    /*
        ArrayBuffer.
    */

    if (
        chunk instanceof ArrayBuffer
    ) {

        receivedChunks.push(
            chunk
        );

        receivedBytes +=
            chunk.byteLength;

    }


    /*
        Uint8Array.
    */

    else if (
        chunk instanceof Uint8Array
    ) {

        receivedChunks.push(
            chunk
        );

        receivedBytes +=
            chunk.byteLength;
    }


    /*
        Blob.
    */

    else if (
        chunk instanceof Blob
    ) {

        /*
            Convert Blob asynchronously.
            ACK after conversion.
        */

        chunk.arrayBuffer()
            .then((buffer) => {

                receiveFileChunk(
                    buffer
                );

            });

        return;
    }


    else {

        console.error(
            "Unknown chunk type:",
            chunk
        );

        return;
    }


    /*
        Calculate progress.
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
        `${progress}%`;


    transferStatus.textContent =
        `Receiving ${receivedFileNumber}/${receivedTotalFiles}: ${receivingFile.name} — ${Math.round(progress)}%`;


    /*
        ACK this chunk.
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
        "Finished receiving:",
        receivingFile.name
    );


    /*
        Create Blob.
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
        Create download URL.
    */

    const url =
        URL.createObjectURL(
            blob
        );


    receivedObjectUrls.push(
        url
    );


    /*
        Add file to receiver UI.
    */

    addReceivedFile(
        receivingFile.name,
        url
    );


    transferProgress.style.width =
        "100%";


    transferStatus.textContent =
        `Received ${receivedFileNumber}/${receivedTotalFiles}: ${receivingFile.name}`;


    /*
        Tell sender the complete file
        has been reconstructed.
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
        Clear current receiving state.
    */

    receivedChunks = [];

    receivedBytes = 0;

    receivingFile = null;
}


/* =========================================================
   ADD RECEIVED FILE
========================================================= */

function addReceivedFile(
    name,
    url
) {

    /*
        If the original received-file
        element exists, use it.
    */

    if (
        receivedFile &&
        receivedFile.classList.contains(
            "hidden"
        )
    ) {

        receivedFile.classList.remove(
            "hidden"
        );


        receivedFileName.textContent =
            name;


        downloadFile.href =
            url;


        downloadFile.download =
            name;


        return;
    }


    /*
        Additional received files.
    */

    const item =
        document.createElement(
            "div"
        );


    item.className =
        "received-file-item";


    const nameElement =
        document.createElement(
            "span"
        );


    nameElement.textContent =
        name;


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
        Add to file-transfer area.
    */

    if (fileTransfer) {

        fileTransfer.appendChild(
            item
        );
    }
}


/* =========================================================
   FORMAT FILE SIZE
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

        /*
            Stop camera.
        */

        if (
            qrScanner &&
            scannerRunning
        ) {

            qrScanner
                .stop()
                .catch(() => {});
        }


        /*
            Revoke received file URLs.
        */

        for (
            const url of receivedObjectUrls
        ) {

            URL.revokeObjectURL(
                url
            );
        }


        /*
            Clear ACK timers.
        */

        clearTimeout(
            chunkAckTimeout
        );

        clearTimeout(
            fileAckTimeout
        );
    }
);


/* =========================================================
   START
========================================================= */

createPeer();