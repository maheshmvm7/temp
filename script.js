/* =========================================================
   ELEMENTS
========================================================= */

const showQrBtn =
    document.getElementById("show-qr-btn");

const scanQrBtn =
    document.getElementById("scan-qr-btn");

const qrSection =
    document.getElementById("qr-section");

const scannerSection =
    document.getElementById("scanner-section");

const peerIdElement =
    document.getElementById("peer-id");

const statusText =
    document.getElementById("status-text");

const statusDot =
    document.getElementById("status-dot");

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


/* =========================================================
   FILE VARIABLES
========================================================= */

let selectedFile = null;

let receivingFile = null;

let receivedChunks = [];

let receivedBytes = 0;

let receivedObjectUrl = null;


/*
    64 KB chunks.

    The receiver acknowledges every chunk
    before the sender sends the next one.
*/

const CHUNK_SIZE = 64 * 1024;


/*
    Used to prevent multiple QR callbacks.
*/

let connectingToPeer = false;



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

        statusDot.classList.add(
            "connected"
        );

    } else {

        statusDot.classList.remove(
            "connected"
        );
    }
}



/* =========================================================
   CREATE PEER
========================================================= */

function createPeer() {

    setStatus("Connecting...");


    /*
        Create a PeerJS peer.

        PeerJS automatically generates
        the Peer ID.
    */

    peer = new Peer();


    /* =====================================================
       PEER OPEN
    ===================================================== */

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


    /* =====================================================
       INCOMING CONNECTION
    ===================================================== */

    peer.on("connection", (conn) => {

        console.log(
            "Incoming connection from:",
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


        setStatus(
            "Connection error"
        );


        if (transferStatus) {

            transferStatus.textContent =
                "PeerJS connection error.";
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

        console.log(
            "Peer closed"
        );


        setStatus("Closed");
    });
}



/* =========================================================
   GENERATE QR CODE
========================================================= */

function generateQRCode(peerId) {

    const qrContainer =
        document.getElementById("qrcode");


    if (!qrContainer) {
        return;
    }


    qrContainer.innerHTML = "";


    if (
        typeof QRCode ===
        "undefined"
    ) {

        console.error(
            "QRCode library not loaded."
        );

        return;
    }


    new QRCode(
        qrContainer,
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


    console.log(
        "QR generated:",
        peerId
    );
}



/* =========================================================
   SETUP PEER CONNECTION
========================================================= */

function setupConnection(conn) {

    /*
        If another connection already exists,
        close it before replacing it.
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
            Enable file-transfer UI.
        */

        if (fileTransfer) {

            fileTransfer.classList.remove(
                "hidden"
            );
        }


        if (transferStatus) {

            transferStatus.textContent =
                "Connected. Select a file.";
        }


        if (sendFileBtn) {

            sendFileBtn.disabled = true;
        }
    });


    /* =====================================================
       DATA RECEIVED
    ===================================================== */

    conn.on("data", (data) => {

        handleIncomingData(data);
    });


    /* =====================================================
       CONNECTION CLOSED
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
    });


    /* =====================================================
       CONNECTION ERROR
    ===================================================== */

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
   START QR SCANNER
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

        console.error(
            "Html5Qrcode not found."
        );

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
            Use the rear camera when available.
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
                    Ignore normal scan failures.
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
   QR CODE DETECTED
========================================================= */

async function handleQRCode(
    decodedText
) {

    /*
        QR scanner can call this function
        multiple times.

        Prevent duplicate connections.
    */

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
   STOP QR SCANNER
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
   FILE SELECTED
========================================================= */

if (fileInput) {

    fileInput.addEventListener(
        "change",
        () => {

            const file =
                fileInput.files[0];


            if (!file) {

                selectedFile = null;

                if (sendFileBtn) {
                    sendFileBtn.disabled =
                        true;
                }

                return;
            }


            selectedFile =
                file;


            if (fileName) {

                fileName.textContent =
                    file.name;
            }


            if (fileSize) {

                fileSize.textContent =
                    formatFileSize(
                        file.size
                    );
            }


            /*
                Enable only when the
                PeerJS connection is open.
            */

            if (sendFileBtn) {

                sendFileBtn.disabled =
                    !connection ||
                    !connection.open;
            }


            if (transferStatus) {

                transferStatus.textContent =
                    "File ready to send.";
            }


            if (transferProgress) {

                transferProgress.style.width =
                    "0%";
            }
        }
    );
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
   SEND FILE BUTTON
========================================================= */

if (sendFileBtn) {

    sendFileBtn.addEventListener(
        "click",
        sendSelectedFile
    );
}



/* =========================================================
   SEND FILE
========================================================= */

async function sendSelectedFile() {

    if (!selectedFile) {

        if (transferStatus) {

            transferStatus.textContent =
                "Select a file first.";
        }

        return;
    }


    if (
        !connection ||
        !connection.open
    ) {

        if (transferStatus) {

            transferStatus.textContent =
                "No peer connection.";
        }

        return;
    }


    sendFileBtn.disabled = true;


    transferProgress.style.width =
        "0%";


    transferStatus.textContent =
        "Preparing file...";


    /*
        Send metadata first.
    */

    connection.send({
        type: "file-start",

        name:
            selectedFile.name,

        size:
            selectedFile.size,

        mime:
            selectedFile.type ||
            "application/octet-stream"
    });


    let offset = 0;


    try {

        while (
            offset <
            selectedFile.size
        ) {

            /*
                Read one 64 KB chunk.
            */

            const blob =
                selectedFile.slice(
                    offset,
                    offset + CHUNK_SIZE
                );


            const buffer =
                await blob.arrayBuffer();


            /*
                Send chunk.
            */

            connection.send({
                type: "file-chunk",

                data: buffer
            });


            offset +=
                buffer.byteLength;


            const progress =
                (
                    offset /
                    selectedFile.size
                ) * 100;


            transferProgress.style.width =
                `${progress}%`;


            transferStatus.textContent =
                `Sending ${Math.round(progress)}%`;


            /*
                Wait for the receiver's
                acknowledgement before
                sending the next chunk.

                This prevents excessive
                buffering.
            */

            await waitForChunkAck();
        }


        /*
            Tell receiver the file
            is completely transferred.
        */

        connection.send({
            type: "file-end"
        });


        transferProgress.style.width =
            "100%";


        transferStatus.textContent =
            "File sent successfully.";

    }

    catch (error) {

        console.error(
            "File send error:",
            error
        );


        transferStatus.textContent =
            "File transfer failed.";

    }


    sendFileBtn.disabled = false;
}



/* =========================================================
   CHUNK ACK
========================================================= */

let chunkAckResolver = null;


function waitForChunkAck() {

    return new Promise(
        (resolve, reject) => {

            chunkAckResolver =
                resolve;


            /*
                Safety timeout.

                If the receiver does not
                acknowledge within 30 seconds,
                stop the transfer.
            */

            setTimeout(
                () => {

                    if (
                        chunkAckResolver ===
                        resolve
                    ) {

                        chunkAckResolver =
                            null;

                        reject(
                            new Error(
                                "Chunk acknowledgement timeout"
                            )
                        );
                    }

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
        typeof data === "object" &&
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
        typeof data === "object" &&
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
        typeof data === "object" &&
        data.type === "file-end"
    ) {

        finishReceivingFile();

        return;
    }


    /*
        CHUNK ACK
    */

    if (
        typeof data === "object" &&
        data.type === "chunk-ack"
    ) {

        if (chunkAckResolver) {

            const resolve =
                chunkAckResolver;

            chunkAckResolver =
                null;

            resolve();
        }

        return;
    }


    /*
        Unknown data.
    */

    console.log(
        "Received data:",
        data
    );
}



/* =========================================================
   START RECEIVING FILE
========================================================= */

function startReceivingFile(data) {

    console.log(
        "Receiving file:",
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


    receivedChunks = [];

    receivedBytes = 0;


    /*
        Remove old download URL.
    */

    if (receivedObjectUrl) {

        URL.revokeObjectURL(
            receivedObjectUrl
        );

        receivedObjectUrl =
            null;
    }


    if (receivedFile) {

        receivedFile.classList.add(
            "hidden"
        );
    }


    if (transferProgress) {

        transferProgress.style.width =
            "0%";
    }


    if (transferStatus) {

        transferStatus.textContent =
            `Receiving ${data.name}...`;
    }
}



/* =========================================================
   RECEIVE FILE CHUNK
========================================================= */

function receiveFileChunk(data) {

    if (!receivingFile) {

        console.warn(
            "Received chunk without file metadata."
        );

        return;
    }


    /*
        PeerJS may provide the binary
        data as ArrayBuffer or Uint8Array.
    */

    let chunk = data;


    if (
        chunk instanceof Uint8Array
    ) {

        chunk =
            chunk.buffer;
    }


    if (
        chunk instanceof Blob
    ) {

        console.warn(
            "Blob received. Converting..."
        );

        chunk.arrayBuffer()
            .then(buffer => {

                receiveFileChunk(
                    buffer
                );
            });

        return;
    }


    if (
        !(chunk instanceof ArrayBuffer)
    ) {

        console.error(
            "Invalid file chunk:",
            chunk
        );

        return;
    }


    receivedChunks.push(
        chunk
    );


    receivedBytes +=
        chunk.byteLength;


    const progress =
        (
            receivedBytes /
            receivingFile.size
        ) * 100;


    if (transferProgress) {

        transferProgress.style.width =
            `${Math.min(
                progress,
                100
            )}%`;
    }


    if (transferStatus) {

        transferStatus.textContent =
            `Receiving ${Math.round(
                progress
            )}%`;
    }


    /*
        Tell sender that this chunk
        was successfully received.
    */

    if (
        connection &&
        connection.open
    ) {

        connection.send({
            type: "chunk-ack"
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
        "File transfer complete:",
        receivingFile.name
    );


    /*
        Create the final Blob.
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
        Create browser download URL.
    */

    receivedObjectUrl =
        URL.createObjectURL(
            blob
        );


    /*
        Display received file.
    */

    if (receivedFileName) {

        receivedFileName.textContent =
            receivingFile.name;
    }


    if (downloadFile) {

        downloadFile.href =
            receivedObjectUrl;

        downloadFile.download =
            receivingFile.name;
    }


    if (receivedFile) {

        receivedFile.classList.remove(
            "hidden"
        );
    }


    if (transferProgress) {

        transferProgress.style.width =
            "100%";
    }


    if (transferStatus) {

        transferStatus.textContent =
            "File received successfully.";
    }


    /*
        Clear receiving state.

        Keep the Blob URL alive because
        the Download button needs it.
    */

    receivedChunks = [];

    receivedBytes = 0;

    receivingFile = null;
}



/* =========================================================
   PAGE EXIT
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


        if (
            receivedObjectUrl
        ) {

            URL.revokeObjectURL(
                receivedObjectUrl
            );
        }
    }
);



/* =========================================================
   START APPLICATION
========================================================= */

createPeer();