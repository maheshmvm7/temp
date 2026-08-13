let peer = null;
let conn = null;

let selectedFile = null;

let receivingFile = null;
let receivedChunks = [];
let receivedBytes = 0;

let qrScanner = null;
let scannerRunning = false;

const CHUNK_SIZE = 16 * 1024;


/* =====================================================
   DOM READY
===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    document
        .getElementById("senderModeBtn")
        .addEventListener("click", () => {
            selectMode("sender");
        });


    document
        .getElementById("receiverModeBtn")
        .addEventListener("click", () => {
            selectMode("receiver");
        });


    document
        .getElementById("senderBackBtn")
        .addEventListener("click", goBack);


    document
        .getElementById("receiverBackBtn")
        .addEventListener("click", goBack);


    document
        .getElementById("copyIdBtn")
        .addEventListener("click", copyId);


    document
        .getElementById("showQrBtn")
        .addEventListener("click", showReceiverQR);


    document
        .getElementById("hideQrBtn")
        .addEventListener("click", hideReceiverQR);


    document
        .getElementById("manualMethodBtn")
        .addEventListener(
            "click",
            showManualConnection
        );


    document
        .getElementById("scanMethodBtn")
        .addEventListener(
            "click",
            showScanner
        );


    document
        .getElementById("stopScannerBtn")
        .addEventListener(
            "click",
            stopScanner
        );


    document
        .getElementById("fileInput")
        .addEventListener(
            "change",
            selectFile
        );


    document
        .getElementById("sendFileBtn")
        .addEventListener(
            "click",
            sendFile
        );

});


/* =====================================================
   MODE
===================================================== */

function selectMode(mode) {

    document
        .getElementById("modeSelect")
        .classList.add("hidden");


    document
        .getElementById("step1")
        .classList.remove("active");


    document
        .getElementById("step1")
        .classList.add("done");


    document
        .getElementById("step2")
        .classList.add("active");


    if (mode === "sender") {

        document
            .getElementById("senderSection")
            .classList.remove("hidden");


        initSender();

    } else {

        document
            .getElementById("receiverSection")
            .classList.remove("hidden");


        initReceiver();
    }
}


/* =====================================================
   SENDER INITIALIZATION
===================================================== */

function initSender() {

    if (peer) {
        return;
    }


    peer = new Peer();


    peer.on("open", () => {

        console.log(
            "Sender Peer ID:",
            peer.id
        );


        setStatus(
            "sender",
            "success",
            "Ready. Enter ID or scan QR."
        );

    });


    peer.on("error", error => {

        console.error(
            "PeerJS error:",
            error
        );


        setStatus(
            "sender",
            "error",
            "Peer error: " + error.type
        );

    });


    peer.on("disconnected", () => {

        setStatus(
            "sender",
            "error",
            "Disconnected from signaling server."
        );

    });

}


/* =====================================================
   RECEIVER INITIALIZATION
===================================================== */

function initReceiver() {

    if (peer) {
        return;
    }


    peer = new Peer();


    peer.on("open", id => {

        console.log(
            "Receiver Peer ID:",
            id
        );


        document
            .getElementById("myPeerId")
            .textContent = id;


        setStatus(
            "receiver",
            "info",
            "Waiting for sender..."
        );

    });


    peer.on("connection", incomingConnection => {

        console.log(
            "Incoming connection:",
            incomingConnection.peer
        );


        conn = incomingConnection;


        setStatus(
            "receiver",
            "success",
            "Sender connected."
        );


        conn.on("open", () => {

            console.log(
                "Receiver DataConnection open."
            );


            setStatus(
                "receiver",
                "success",
                "Connected. Waiting for file..."
            );


            document
                .getElementById("step2")
                .classList.remove("active");


            document
                .getElementById("step2")
                .classList.add("done");


            document
                .getElementById("step3")
                .classList.add("active");

        });


        conn.on("data", handleReceivedData);


        conn.on("close", () => {

            setStatus(
                "receiver",
                "info",
                "Sender disconnected."
            );

        });


        conn.on("error", error => {

            console.error(
                "Data connection error:",
                error
            );


            setStatus(
                "receiver",
                "error",
                "Connection error."
            );

        });

    });


    peer.on("error", error => {

        console.error(
            "Receiver PeerJS error:",
            error
        );


        setStatus(
            "receiver",
            "error",
            "Peer error: " + error.type
        );

    });

}


/* =====================================================
   RECEIVER QR
===================================================== */

function showReceiverQR() {

    const peerId =
        document
            .getElementById("myPeerId")
            .textContent
            .trim();


    if (
        !peerId ||
        peerId === "generating..."
    ) {

        setStatus(
            "receiver",
            "error",
            "Peer ID is not ready yet."
        );

        return;
    }


    const qrDisplay =
        document.getElementById(
            "qrDisplay"
        );


    const qrContainer =
        document.getElementById(
            "receiverQr"
        );


    /*
     * Clear previous QR code.
     */

    qrContainer.innerHTML = "";


    /*
     * Generate QR containing ONLY
     * the Peer ID.
     */

    new QRCode(
        qrContainer,
        {
            text: peerId,

            width: 220,
            height: 220,

            colorDark: "#000000",
            colorLight: "#ffffff",

            correctLevel:
                QRCode.CorrectLevel.H
        }
    );


    qrDisplay.classList.remove(
        "hidden"
    );


    setStatus(
        "receiver",
        "success",
        "QR code ready to scan."
    );
}


/* =====================================================
   HIDE QR
===================================================== */

function hideReceiverQR() {

    document
        .getElementById("qrDisplay")
        .classList.add("hidden");

}


/* =====================================================
   MANUAL CONNECTION
===================================================== */

function showManualConnection() {

    document
        .getElementById("manualMethodBtn")
        .classList.add("active");


    document
        .getElementById("scanMethodBtn")
        .classList.remove("active");


    document
        .getElementById("manualConnection")
        .classList.remove("hidden");


    document
        .getElementById("scannerSection")
        .classList.add("hidden");


    stopScanner();


    setStatus(
        "sender",
        "info",
        "Enter Receiver Peer ID."
    );
}


/* =====================================================
   START QR SCANNER
===================================================== */

async function showScanner() {

    document
        .getElementById("manualMethodBtn")
        .classList.remove("active");


    document
        .getElementById("scanMethodBtn")
        .classList.add("active");


    document
        .getElementById("manualConnection")
        .classList.add("hidden");


    document
        .getElementById("scannerSection")
        .classList.remove("hidden");


    if (scannerRunning) {
        return;
    }


    /*
     * Camera access requires HTTPS
     * or localhost in normal browsers.
     */

    if (
        location.protocol !== "https:" &&
        location.hostname !== "localhost" &&
        location.hostname !== "127.0.0.1"
    ) {

        setStatus(
            "sender",
            "error",
            "Camera scanning requires HTTPS or localhost."
        );

        return;
    }


    try {

        qrScanner =
            new Html5Qrcode(
                "qr-reader"
            );


        scannerRunning = true;


        await qrScanner.start(

            {
                facingMode: "environment"
            },


            {
                fps: 10,

                qrbox: {
                    width: 220,
                    height: 220
                }
            },


            decodedText => {

                console.log(
                    "QR scanned:",
                    decodedText
                );


                handleScannedPeerId(
                    decodedText
                );

            },


            errorMessage => {

                /*
                 * Scanner continuously generates
                 * "QR code not found" messages.
                 *
                 * We intentionally don't display
                 * those as errors.
                 */

            }

        );


        setStatus(
            "sender",
            "info",
            "Point camera at Receiver QR code."
        );

    } catch (error) {

        console.error(
            "Scanner error:",
            error
        );


        scannerRunning = false;


        setStatus(
            "sender",
            "error",
            "Could not start camera scanner."
        );

    }
}


/* =====================================================
   SCANNED PEER ID
===================================================== */

async function handleScannedPeerId(
    scannedText
) {

    const peerId =
        scannedText.trim();


    if (!peerId) {
        return;
    }


    /*
     * Put scanned ID into manual field
     * as well, so the user can see it.
     */

    document
        .getElementById("remoteIdInput")
        .value = peerId;


    setStatus(
        "sender",
        "success",
        "QR scanned. Receiver ID detected."
    );


    await stopScanner();


    /*
     * Automatically switch back to
     * manual connection UI.
     */

    document
        .getElementById("manualMethodBtn")
        .classList.add("active");


    document
        .getElementById("scanMethodBtn")
        .classList.remove("active");


    document
        .getElementById("manualConnection")
        .classList.remove("hidden");


    document
        .getElementById("scannerSection")
        .classList.add("hidden");


    /*
     * Don't automatically send the file.
     *
     * User still selects a file and
     * presses Send File.
     */

}


/* =====================================================
   STOP SCANNER
===================================================== */

async function stopScanner() {

    if (!qrScanner || !scannerRunning) {
        return;
    }


    try {

        await qrScanner.stop();

    } catch (error) {

        console.warn(
            "Scanner stop:",
            error
        );

    }


    try {

        await qrScanner.clear();

    } catch (error) {

        console.warn(
            "Scanner clear:",
            error
        );

    }


    qrScanner = null;

    scannerRunning = false;

}


/* =====================================================
   FILE SELECT
===================================================== */

function selectFile(event) {

    selectedFile =
        event.target.files[0];


    if (!selectedFile) {
        return;
    }


    const info =
        document.getElementById(
            "selectedFileInfo"
        );


    info.style.display =
        "block";


    info.innerHTML = `
        <strong style="color:var(--text)">
            ${escapeHTML(selectedFile.name)}
        </strong>
        <br>
        Size:
        ${formatBytes(selectedFile.size)}
    `;


    document
        .getElementById("sendFileBtn")
        .disabled = false;


    setStatus(
        "sender",
        "info",
        "File selected."
    );
}


/* =====================================================
   SEND FILE
===================================================== */

async function sendFile() {

    if (!selectedFile) {

        setStatus(
            "sender",
            "error",
            "Select a file first."
        );

        return;
    }


    const remoteId =
        document
            .getElementById("remoteIdInput")
            .value
            .trim();


    if (!remoteId) {

        setStatus(
            "sender",
            "error",
            "Enter or scan Receiver ID."
        );

        return;
    }


    if (!peer || peer.destroyed) {

        setStatus(
            "sender",
            "error",
            "Peer is not ready."
        );

        return;
    }


    const button =
        document.getElementById(
            "sendFileBtn"
        );


    button.disabled = true;


    try {

        setStatus(
            "sender",
            "info",
            "Connecting to receiver..."
        );


        conn =
            peer.connect(
                remoteId,
                {
                    reliable: true
                }
            );


        conn.on("open", async () => {

            console.log(
                "DataConnection opened."
            );


            setStatus(
                "sender",
                "success",
                "Connected. Starting transfer..."
            );


            try {

                await transferFile(
                    selectedFile
                );

            } catch (error) {

                console.error(
                    error
                );


                setStatus(
                    "sender",
                    "error",
                    "Transfer failed."
                );

            }


            button.disabled = false;

        });


        conn.on("error", error => {

            console.error(
                error
            );


            setStatus(
                "sender",
                "error",
                "Connection error."
            );


            button.disabled = false;

        });

    } catch (error) {

        console.error(
            error
        );


        setStatus(
            "sender",
            "error",
            error.message
        );


        button.disabled = false;
    }
}


/* =====================================================
   TRANSFER FILE
===================================================== */

async function transferFile(file) {

    const progressContainer =
        document.getElementById(
            "transferProgressContainer"
        );


    const progress =
        document.getElementById(
            "transferProgress"
        );


    const percent =
        document.getElementById(
            "transferPercent"
        );


    progressContainer.style.display =
        "block";


    /*
     * FILE START
     */

    conn.send({

        type: "file-start",

        name: file.name,

        size: file.size,

        mime:
            file.type ||
            "application/octet-stream"

    });


    await sleep(100);


    let offset = 0;


    while (offset < file.size) {

        await waitForBuffer();


        const slice =
            file.slice(
                offset,
                offset + CHUNK_SIZE
            );


        const buffer =
            await slice.arrayBuffer();


        conn.send(buffer);


        offset +=
            buffer.byteLength;


        const percentage =
            Math.floor(
                (
                    offset /
                    file.size
                ) * 100
            );


        progress.style.width =
            percentage + "%";


        percent.textContent =
            percentage + "%";


        setStatus(
            "sender",
            "info",
            "Sending " +
            percentage +
            "%"
        );


        await sleep(0);
    }


    await waitForBuffer();


    /*
     * FILE END
     */

    conn.send({

        type: "file-end"

    });


    progress.style.width =
        "100%";


    percent.textContent =
        "100%";


    setStatus(
        "sender",
        "success",
        "File sent successfully."
    );


    document
        .getElementById("step2")
        .classList.remove("active");


    document
        .getElementById("step2")
        .classList.add("done");


    document
        .getElementById("step3")
        .classList.add("active");
}


/* =====================================================
   BUFFER
===================================================== */

function waitForBuffer() {

    return new Promise(resolve => {

        if (!conn) {

            resolve();

            return;
        }


        const channel =
            conn._dc;


        if (!channel) {

            resolve();

            return;
        }


        if (
            channel.bufferedAmount <
            512 * 1024
        ) {

            resolve();

            return;
        }


        const timer =
            setInterval(() => {

                if (
                    !conn ||
                    !conn.open ||
                    channel.bufferedAmount <
                    512 * 1024
                ) {

                    clearInterval(timer);

                    resolve();
                }

            }, 20);

    });
}


/* =====================================================
   RECEIVE DATA
===================================================== */

function handleReceivedData(data) {

    /*
     * FILE START
     */

    if (
        data &&
        typeof data === "object" &&
        !(data instanceof ArrayBuffer) &&
        !(data instanceof Uint8Array) &&
        !(data instanceof Blob)
    ) {

        if (
            data.type === "file-start"
        ) {

            startReceiving(
                data
            );

            return;
        }


        if (
            data.type === "file-end"
        ) {

            finishReceiving();

            return;
        }
    }


    /*
     * BINARY DATA
     */

    if (
        data instanceof ArrayBuffer
    ) {

        receiveChunk(data);

        return;
    }


    if (
        data instanceof Uint8Array
    ) {

        receiveChunk(
            data.buffer
        );

        return;
    }


    if (
        data instanceof Blob
    ) {

        data.arrayBuffer()
            .then(buffer => {

                receiveChunk(
                    buffer
                );

            });

    }

}


/* =====================================================
   START RECEIVING
===================================================== */

function startReceiving(data) {

    receivingFile = {

        name: data.name,

        size: data.size,

        mime:
            data.mime ||
            "application/octet-stream"

    };


    receivedChunks = [];

    receivedBytes = 0;


    createReceiverUI();


    updateReceiveProgress();


    setStatus(
        "receiver",
        "info",
        "Receiving " +
        data.name
    );
}


/* =====================================================
   RECEIVE CHUNK
===================================================== */

function receiveChunk(buffer) {

    if (!receivingFile) {
        return;
    }


    receivedChunks.push(
        buffer
    );


    receivedBytes +=
        buffer.byteLength;


    updateReceiveProgress();


    const percentage =
        Math.floor(
            (
                receivedBytes /
                receivingFile.size
            ) * 100
        );


    setStatus(
        "receiver",
        "info",
        "Receiving " +
        percentage +
        "%"
    );
}


/* =====================================================
   FINISH RECEIVING
===================================================== */

function finishReceiving() {

    if (!receivingFile) {
        return;
    }


    const blob =
        new Blob(
            receivedChunks,
            {
                type:
                    receivingFile.mime
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    showDownload(
        url,
        receivingFile.name,
        blob.size
    );


    updateReceiveProgress(
        100
    );


    setStatus(
        "receiver",
        "success",
        "File received successfully."
    );


    receivedChunks = [];

    receivedBytes = 0;

    receivingFile = null;
}


/* =====================================================
   RECEIVER UI
===================================================== */

function createReceiverUI() {

    let ui =
        document.getElementById(
            "receiverTransferUI"
        );


    if (ui) {

        ui.style.display =
            "block";

        return;
    }


    const card =
        document.querySelector(
            "#receiverSection .card"
        );


    ui =
        document.createElement(
            "div"
        );


    ui.id =
        "receiverTransferUI";


    ui.innerHTML = `

        <div class="receiver-transfer">

            <div class="progress-header">

                <span id="receivingFileName">
                    Receiving...
                </span>

                <span id="receivePercent">
                    0%
                </span>

            </div>


            <div class="progress-track">

                <div
                    id="receiveProgress"
                    class="progress-bar"
                ></div>

            </div>


            <div
                id="receivedFileSize"
                class="received-size"
            >
                0 B
            </div>


            <div id="downloadArea"></div>

        </div>

    `;


    card.appendChild(ui);
}


/* =====================================================
   RECEIVE PROGRESS
===================================================== */

function updateReceiveProgress(
    forcePercent = null
) {

    if (!receivingFile) {
        return;
    }


    const percentage =
        forcePercent !== null
            ? forcePercent
            : Math.floor(
                (
                    receivedBytes /
                    receivingFile.size
                ) * 100
            );


    const progress =
        document.getElementById(
            "receiveProgress"
        );


    const percent =
        document.getElementById(
            "receivePercent"
        );


    const filename =
        document.getElementById(
            "receivingFileName"
        );


    const size =
        document.getElementById(
            "receivedFileSize"
        );


    if (progress) {

        progress.style.width =
            percentage + "%";
    }


    if (percent) {

        percent.textContent =
            percentage + "%";
    }


    if (filename) {

        filename.textContent =
            receivingFile.name;
    }


    if (size) {

        size.textContent =
            formatBytes(
                receivedBytes
            ) +
            " / " +
            formatBytes(
                receivingFile.size
            );
    }

}


/* =====================================================
   DOWNLOAD
===================================================== */

function showDownload(
    url,
    filename,
    size
) {

    const area =
        document.getElementById(
            "downloadArea"
        );


    area.innerHTML = `

        <div class="download-box">

            <div class="download-name">
                ${escapeHTML(filename)}
            </div>

            <div class="download-size">
                ${formatBytes(size)}
            </div>

            <a
                class="btn btn-primary"
                href="${url}"
                download="${escapeHTML(filename)}"
            >
                Download File
            </a>

        </div>

    `;
}


/* =====================================================
   STATUS
===================================================== */

function setStatus(
    section,
    type,
    text
) {

    const bar =
        document.getElementById(
            section + "Status"
        );


    const textElement =
        document.getElementById(
            section + "StatusText"
        );


    if (!bar || !textElement) {
        return;
    }


    bar.className =
        "status-bar " +
        type;


    textElement.textContent =
        text;


    const dot =
        bar.querySelector(
            ".dot"
        );


    if (dot) {

        dot.className =
            "dot" +
            (
                type === "info"
                    ? " pulse"
                    : ""
            );

    }

}


/* =====================================================
   COPY ID
===================================================== */

function copyId() {

    const id =
        document
            .getElementById("myPeerId")
            .textContent
            .trim();


    if (
        !id ||
        id === "generating..."
    ) {

        return;
    }


    navigator.clipboard
        .writeText(id)
        .then(() => {

            const button =
                document.getElementById(
                    "copyIdBtn"
                );


            button.textContent =
                "✓";


            setTimeout(() => {

                button.textContent =
                    "📋";

            }, 2000);

        });

}


/* =====================================================
   BACK
===================================================== */

async function goBack() {

    await stopScanner();


    if (conn) {

        try {
            conn.close();
        } catch (error) {}

        conn = null;
    }


    if (peer) {

        try {
            peer.destroy();
        } catch (error) {}

        peer = null;
    }


    selectedFile = null;

    receivingFile = null;

    receivedChunks = [];

    receivedBytes = 0;


    document
        .getElementById("senderSection")
        .classList.add("hidden");


    document
        .getElementById("receiverSection")
        .classList.add("hidden");


    document
        .getElementById("modeSelect")
        .classList.remove("hidden");


    document
        .getElementById("step1")
        .classList.remove("done");


    document
        .getElementById("step1")
        .classList.add("active");


    document
        .getElementById("step2")
        .classList.remove("active");


    document
        .getElementById("step2")
        .classList.remove("done");


    document
        .getElementById("step3")
        .classList.remove("active");

}


/* =====================================================
   HELPERS
===================================================== */

function sleep(ms) {

    return new Promise(
        resolve => {
            setTimeout(
                resolve,
                ms
            );
        }
    );

}


function formatBytes(bytes) {

    if (bytes === 0) {
        return "0 B";
    }


    const units = [
        "B",
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
        ).toFixed(
            index === 0 ? 0 : 2
        )
        +
        " " +
        units[index]
    );

}


function escapeHTML(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}
