let peer = null;
let connection = null;
let mode = null;

let selectedFile = null;
let receivingFile = null;
let receivedChunks = [];
let receivedBytes = 0;

const CHUNK_SIZE = 16 * 1024; // 16 KB
const MAX_BUFFERED_AMOUNT = 1024 * 1024; // 1 MB


/* =========================================================
   MODE SELECTION
========================================================= */

function selectMode(selectedMode) {
    mode = selectedMode;

    document.getElementById("modeSelect").classList.add("hidden");

    document.getElementById("step1").classList.remove("active");
    document.getElementById("step1").classList.add("done");

    document.getElementById("step2").classList.add("active");

    if (selectedMode === "sender") {
        document.getElementById("senderSection").classList.remove("hidden");

        setupSenderUI();
        initSenderPeer();

    } else {
        document.getElementById("receiverSection").classList.remove("hidden");

        setupReceiverUI();
        initReceiver();
    }
}


/* =========================================================
   BACK BUTTON
========================================================= */

function goBack() {
    cleanupConnection();

    if (peer) {
        peer.destroy();
        peer = null;
    }

    mode = null;
    selectedFile = null;

    receivedChunks = [];
    receivingFile = null;
    receivedBytes = 0;

    document.getElementById("senderSection").classList.add("hidden");
    document.getElementById("receiverSection").classList.add("hidden");

    document.getElementById("modeSelect").classList.remove("hidden");

    document.getElementById("step1").classList.remove("done");
    document.getElementById("step1").classList.add("active");

    document.getElementById("step2").classList.remove("active");
    document.getElementById("step2").classList.remove("done");

    document.getElementById("step3").classList.remove("active");

    const peerId = document.getElementById("myPeerId");

    if (peerId) {
        peerId.textContent = "generating...";
    }

    const remoteVideo = document.getElementById("remoteVideo");

    if (remoteVideo) {
        remoteVideo.classList.remove("active");
        remoteVideo.srcObject = null;
    }
}


/* =========================================================
   SENDER
========================================================= */

function initSenderPeer() {
    if (peer) {
        peer.destroy();
    }

    peer = new Peer(undefined, {
        debug: 2
    });

    peer.on("open", () => {
        setStatus(
            "sender",
            "success",
            "Ready. Enter the Receiver Peer ID."
        );
    });

    peer.on("error", (error) => {
        console.error("Peer error:", error);

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
            "Disconnected from PeerJS server."
        );
    });

    peer.on("close", () => {
        setStatus(
            "sender",
            "error",
            "Peer connection closed."
        );
    });
}


/* =========================================================
   CREATE SENDER UI
========================================================= */

function setupSenderUI() {
    const card = document.querySelector("#senderSection .card");

    if (!card) return;

    if (document.getElementById("fileInput")) {
        return;
    }

    const fileContainer = document.createElement("div");

    fileContainer.id = "fileTransferControls";

    fileContainer.innerHTML = `
        <div style="
            margin-top:20px;
            padding-top:20px;
            border-top:1px solid var(--border);
        ">

            <label style="
                font-size:12px;
                font-family:'JetBrains Mono',monospace;
                color:var(--muted);
                display:block;
                margin-bottom:8px;
            ">
                SELECT FILE
            </label>

            <input
                type="file"
                id="fileInput"
                style="
                    width:100%;
                    padding:12px;
                    background:var(--bg);
                    border:1px solid var(--border);
                    border-radius:var(--radius);
                    color:var(--text);
                    font-family:'JetBrains Mono',monospace;
                    cursor:pointer;
                "
            >

            <div
                id="selectedFileInfo"
                style="
                    margin-top:12px;
                    padding:12px;
                    background:var(--bg);
                    border:1px solid var(--border);
                    border-radius:var(--radius);
                    font-family:'JetBrains Mono',monospace;
                    font-size:12px;
                    color:var(--muted);
                    display:none;
                    line-height:1.6;
                "
            ></div>

            <div
                id="transferProgressContainer"
                style="
                    margin-top:12px;
                    display:none;
                "
            >
                <div style="
                    display:flex;
                    justify-content:space-between;
                    font-family:'JetBrains Mono',monospace;
                    font-size:11px;
                    color:var(--muted);
                    margin-bottom:6px;
                ">
                    <span>TRANSFER</span>
                    <span id="transferPercent">0%</span>
                </div>

                <div style="
                    width:100%;
                    height:6px;
                    background:var(--border);
                    border-radius:10px;
                    overflow:hidden;
                ">
                    <div
                        id="transferProgress"
                        style="
                            width:0%;
                            height:100%;
                            background:var(--accent);
                            transition:width .15s ease;
                        "
                    ></div>
                </div>
            </div>

            <button
                id="sendFileBtn"
                class="btn btn-primary"
                style="margin-top:12px;"
                disabled
            >
                Send File
            </button>

        </div>
    `;

    card.appendChild(fileContainer);

    document
        .getElementById("fileInput")
        .addEventListener("change", handleFileSelect);

    document
        .getElementById("sendFileBtn")
        .addEventListener("click", sendSelectedFile);
}


/* =========================================================
   FILE SELECT
========================================================= */

function handleFileSelect(event) {
    const file = event.target.files[0];

    if (!file) {
        selectedFile = null;

        document.getElementById("sendFileBtn").disabled = true;

        return;
    }

    selectedFile = file;

    const info = document.getElementById("selectedFileInfo");

    info.style.display = "block";

    info.innerHTML = `
        <strong style="color:var(--text)">
            ${escapeHTML(file.name)}
        </strong>
        <br>
        Size: ${formatBytes(file.size)}
        <br>
        Type: ${escapeHTML(file.type || "Unknown")}
    `;

    document.getElementById("sendFileBtn").disabled = false;

    setStatus(
        "sender",
        "info",
        "File selected. Ready to send."
    );
}


/* =========================================================
   CONNECT TO RECEIVER
========================================================= */

function connectToReceiver(remoteId) {
    return new Promise((resolve, reject) => {

        if (!peer) {
            reject(new Error("Peer is not initialized."));
            return;
        }

        if (peer.destroyed) {
            reject(new Error("Peer has been destroyed."));
            return;
        }

        const conn = peer.connect(remoteId, {
            reliable: true,
            serialization: "binary"
        });

        connection = conn;

        let finished = false;

        conn.on("open", () => {

            if (finished) return;

            finished = true;

            console.log("DataChannel connected");

            setStatus(
                "sender",
                "success",
                "Connected to receiver."
            );

            resolve(conn);
        });

        conn.on("error", (error) => {

            console.error("Data connection error:", error);

            if (!finished) {
                finished = true;
                reject(error);
            }

            setStatus(
                "sender",
                "error",
                "Data connection error."
            );
        });

        conn.on("close", () => {

            console.log("Data connection closed");

            if (mode === "sender") {
                setStatus(
                    "sender",
                    "info",
                    "Connection closed."
                );
            }
        });
    });
}


/* =========================================================
   SEND FILE
========================================================= */

async function sendSelectedFile() {

    if (!selectedFile) {
        setStatus(
            "sender",
            "error",
            "Please select a file first."
        );

        return;
    }

    const remoteId =
        document.getElementById("remoteIdInput").value.trim();

    if (!remoteId) {
        setStatus(
            "sender",
            "error",
            "Enter the Receiver Peer ID first."
        );

        return;
    }

    if (!peer) {
        setStatus(
            "sender",
            "error",
            "Peer is not ready yet."
        );

        return;
    }

    const sendButton =
        document.getElementById("sendFileBtn");

    sendButton.disabled = true;

    try {

        /*
         * If there is already a connection, reuse it.
         */
        if (!connection || !connection.open) {

            setStatus(
                "sender",
                "info",
                "Connecting to receiver..."
            );

            await connectToReceiver(remoteId);
        }

        if (!connection || !connection.open) {
            throw new Error("DataChannel is not open.");
        }

        await sendFile(connection, selectedFile);

    } catch (error) {

        console.error("File transfer error:", error);

        setStatus(
            "sender",
            "error",
            "Transfer failed: " + error.message
        );

    } finally {

        sendButton.disabled = false;
    }
}


/* =========================================================
   ACTUAL FILE TRANSFER
========================================================= */

async function sendFile(conn, file) {

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

    progressContainer.style.display = "block";

    progress.style.width = "0%";
    percent.textContent = "0%";

    setStatus(
        "sender",
        "info",
        "Preparing file..."
    );

    /*
     * Tell receiver about the file.
     */

    conn.send({
        type: "file-start",
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream"
    });

    await sleep(100);

    let offset = 0;

    while (offset < file.size) {

        /*
         * Wait if WebRTC's send buffer becomes large.
         */

        await waitForBuffer(conn);

        const chunk = file.slice(
            offset,
            offset + CHUNK_SIZE
        );

        const buffer = await chunk.arrayBuffer();

        conn.send(buffer);

        offset += buffer.byteLength;

        const percentage =
            Math.min(
                100,
                Math.round(
                    (offset / file.size) * 100
                )
            );

        progress.style.width =
            percentage + "%";

        percent.textContent =
            percentage + "%";

        setStatus(
            "sender",
            "info",
            `Sending ${percentage}%`
        );

        /*
         * Give the browser a chance to process
         * the WebRTC queue.
         */
        await sleep(0);
    }

    /*
     * Tell receiver that the file is complete.
     */

    await waitForBuffer(conn);

    conn.send({
        type: "file-end"
    });

    progress.style.width = "100%";
    percent.textContent = "100%";

    setStatus(
        "sender",
        "success",
        "File sent successfully."
    );

    document.getElementById("step2")
        .classList.remove("active");

    document.getElementById("step2")
        .classList.add("done");

    document.getElementById("step3")
        .classList.add("active");
}


/* =========================================================
   WEBRTC BUFFER CONTROL
========================================================= */

function waitForBuffer(conn) {

    return new Promise((resolve) => {

        /*
         * PeerJS exposes the underlying RTCDataChannel
         * through dataChannel in current versions.
         */

        const channel =
            conn.dataChannel ||
            conn._dc;

        if (!channel) {
            resolve();
            return;
        }

        if (
            channel.bufferedAmount <
            MAX_BUFFERED_AMOUNT
        ) {
            resolve();
            return;
        }

        const checkBuffer = () => {

            if (
                channel.bufferedAmount <
                MAX_BUFFERED_AMOUNT
            ) {

                channel.removeEventListener(
                    "bufferedamountlow",
                    checkBuffer
                );

                resolve();
            }
        };

        channel.bufferedAmountLowThreshold =
            CHUNK_SIZE;

        channel.addEventListener(
            "bufferedamountlow",
            checkBuffer
        );

        /*
         * Fallback for browsers that do not
         * trigger bufferedamountlow correctly.
         */

        const interval = setInterval(() => {

            if (
                channel.bufferedAmount <
                MAX_BUFFERED_AMOUNT
            ) {

                clearInterval(interval);

                channel.removeEventListener(
                    "bufferedamountlow",
                    checkBuffer
                );

                resolve();
            }

        }, 20);
    });
}


/* =========================================================
   RECEIVER
========================================================= */

function initReceiver() {

    if (peer) {
        peer.destroy();
    }

    peer = new Peer(undefined, {
        debug: 2
    });

    peer.on("open", (id) => {

        const idElement =
            document.getElementById("myPeerId");

        if (idElement) {
            idElement.textContent = id;
        }

        setStatus(
            "receiver",
            "info",
            "Waiting for sender..."
        );
    });


    /*
     * Incoming WebRTC DataChannel
     */

    peer.on("connection", (conn) => {

        console.log(
            "Incoming connection:",
            conn.peer
        );

        connection = conn;

        setStatus(
            "receiver",
            "success",
            "Sender connected."
        );

        conn.on("open", () => {

            console.log(
                "DataChannel opened."
            );

            setStatus(
                "receiver",
                "success",
                "Connected. Waiting for file..."
            );

            document.getElementById("step2")
                .classList.remove("active");

            document.getElementById("step2")
                .classList.add("done");

            document.getElementById("step3")
                .classList.add("active");
        });


        conn.on("data", handleIncomingData);


        conn.on("close", () => {

            setStatus(
                "receiver",
                "info",
                "Sender disconnected."
            );

            connection = null;
        });


        conn.on("error", (error) => {

            console.error(
                "Receiver connection error:",
                error
            );

            setStatus(
                "receiver",
                "error",
                "Connection error: " +
                error.message
            );
        });
    });


    peer.on("error", (error) => {

        console.error(
            "Receiver peer error:",
            error
        );

        setStatus(
            "receiver",
            "error",
            "Peer error: " + error.type
        );
    });


    peer.on("disconnected", () => {

        setStatus(
            "receiver",
            "error",
            "Disconnected from PeerJS server."
        );
    });
}


/* =========================================================
   RECEIVE DATA
========================================================= */

function handleIncomingData(data) {

    /*
     * Metadata
     */

    if (
        typeof data === "object" &&
        data !== null &&
        !isBinaryData(data)
    ) {

        if (data.type === "file-start") {

            startReceivingFile(data);

            return;
        }

        if (data.type === "file-end") {

            finishReceivingFile();

            return;
        }
    }


    /*
     * Binary chunk
     */

    if (isBinaryData(data)) {

        receiveChunk(data);

        return;
    }

    console.warn(
        "Unknown data received:",
        data
    );
}


/* =========================================================
   START RECEIVING
========================================================= */

function startReceivingFile(metadata) {

    console.log(
        "Receiving:",
        metadata.name,
        metadata.size
    );

    receivingFile = {
        name: metadata.name,
        size: metadata.size,
        mime:
            metadata.mime ||
            "application/octet-stream"
    };

    receivedChunks = [];
    receivedBytes = 0;

    createReceiverProgressUI();

    updateReceiverProgress();

    setStatus(
        "receiver",
        "info",
        "Receiving " + metadata.name
    );
}


/* =========================================================
   RECEIVE CHUNK
========================================================= */

function receiveChunk(data) {

    if (!receivingFile) {

        console.warn(
            "Received chunk without file metadata."
        );

        return;
    }

    let chunk;

    /*
     * PeerJS may return ArrayBuffer,
     * Uint8Array, Blob, etc.
     */

    if (data instanceof ArrayBuffer) {

        chunk = data;

    } else if (
        data instanceof Uint8Array
    ) {

        chunk = data.buffer;

    } else if (
        data instanceof Blob
    ) {

        data.arrayBuffer().then(buffer => {

            receiveChunk(buffer);

        });

        return;

    } else {

        console.warn(
            "Unknown binary data type."
        );

        return;
    }


    receivedChunks.push(chunk);

    receivedBytes += chunk.byteLength;

    updateReceiverProgress();

    const percentage =
        Math.min(
            100,
            Math.round(
                (receivedBytes /
                    receivingFile.size) *
                100
            )
        );

    setStatus(
        "receiver",
        "info",
        `Receiving ${percentage}%`
    );
}


/* =========================================================
   FINISH RECEIVING
========================================================= */

function finishReceivingFile() {

    if (!receivingFile) {
        return;
    }

    console.log(
        "File transfer complete."
    );

    const blob = new Blob(
        receivedChunks,
        {
            type: receivingFile.mime
        }
    );

    const url =
        URL.createObjectURL(blob);

    showDownloadButton(
        url,
        receivingFile.name,
        blob.size
    );

    updateReceiverProgress(100);

    setStatus(
        "receiver",
        "success",
        "File received successfully."
    );

    document.getElementById("step3")
        .classList.add("done");

    /*
     * Reset the transfer buffers.
     */

    receivedChunks = [];
    receivedBytes = 0;
    receivingFile = null;
}


/* =========================================================
   RECEIVER PROGRESS UI
========================================================= */

function createReceiverProgressUI() {

    const card =
        document.querySelector(
            "#receiverSection .card"
        );

    if (!card) return;

    let container =
        document.getElementById(
            "receiverTransferUI"
        );

    if (container) {
        container.style.display = "block";
        return;
    }

    container =
        document.createElement("div");

    container.id =
        "receiverTransferUI";

    container.style.marginTop = "20px";

    container.innerHTML = `
        <div style="
            padding-top:20px;
            border-top:1px solid var(--border);
        ">

            <div style="
                display:flex;
                justify-content:space-between;
                font-family:'JetBrains Mono',monospace;
                font-size:11px;
                color:var(--muted);
                margin-bottom:6px;
            ">
                <span id="receivingFileName">
                    Receiving...
                </span>

                <span id="receivePercent">
                    0%
                </span>
            </div>

            <div style="
                width:100%;
                height:6px;
                background:var(--border);
                border-radius:10px;
                overflow:hidden;
            ">

                <div
                    id="receiveProgress"
                    style="
                        width:0%;
                        height:100%;
                        background:var(--accent);
                        transition:width .15s ease;
                    "
                ></div>

            </div>

            <div
                id="receivedFileSize"
                style="
                    margin-top:8px;
                    font-family:'JetBrains Mono',monospace;
                    font-size:11px;
                    color:var(--muted);
                "
            >
                0 B
            </div>

            <div id="downloadArea"></div>

        </div>
    `;

    card.appendChild(container);
}


/* =========================================================
   UPDATE RECEIVER PROGRESS
========================================================= */

function updateReceiverProgress(forcePercent = null) {

    if (!receivingFile) {
        return;
    }

    const percentage =
        forcePercent !== null
            ? forcePercent
            : Math.min(
                100,
                Math.round(
                    (receivedBytes /
                        receivingFile.size) *
                    100
                )
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
            `${formatBytes(receivedBytes)} / ${formatBytes(receivingFile.size)}`;
    }
}


/* =========================================================
   DOWNLOAD BUTTON
========================================================= */

function showDownloadButton(
    url,
    filename,
    size
) {

    const area =
        document.getElementById(
            "downloadArea"
        );

    if (!area) return;

    area.innerHTML = `
        <div style="
            margin-top:16px;
            padding:14px;
            background:var(--bg);
            border:1px solid var(--accent);
            border-radius:var(--radius);
        ">

            <div style="
                font-family:'JetBrains Mono',monospace;
                font-size:12px;
                color:var(--text);
                margin-bottom:10px;
                word-break:break-word;
            ">
                ${escapeHTML(filename)}
            </div>

            <div style="
                font-family:'JetBrains Mono',monospace;
                font-size:11px;
                color:var(--muted);
                margin-bottom:12px;
            ">
                ${formatBytes(size)}
            </div>

            <a
                href="${url}"
                download="${escapeHTML(filename)}"
                class="btn btn-primary"
                style="
                    text-decoration:none;
                    display:flex;
                "
            >
                Download File
            </a>

        </div>
    `;
}


/* =========================================================
   RECEIVER UI
========================================================= */

function setupReceiverUI() {

    /*
     * Remove the old video card because
     * this is now a file-transfer application.
     */

    const videoCard =
        document.getElementById("videoCard");

    if (videoCard) {
        videoCard.remove();
    }

    /*
     * Remove old screen-share wording.
     */

    const receiverTitle =
        document.querySelector(
            "#receiverSection .card-title"
        );

    if (receiverTitle) {
        receiverTitle.textContent =
            "Receiver — File Transfer";
    }

    const receiverText =
        document.querySelector(
            "#receiverSection .card p"
        );

    if (receiverText) {
        receiverText.innerHTML =
            `Your Peer ID is ready. Share it with the <strong style="color:var(--text)">Sender</strong>.`;
    }
}


/* =========================================================
   STATUS
========================================================= */

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
        "status-bar " + type;

    textElement.textContent =
        text;

    const dot =
        bar.querySelector(".dot");

    if (dot) {

        dot.className =
            "dot" +
            (type === "info"
                ? " pulse"
                : "");
    }
}


/* =========================================================
   COPY PEER ID
========================================================= */

function copyId() {

    const element =
        document.getElementById(
            "myPeerId"
        );

    if (!element) return;

    const id =
        element.textContent;

    if (
        !id ||
        id === "generating..."
    ) {
        return;
    }

    navigator.clipboard
        .writeText(id)
        .then(() => {

            const btn =
                document.querySelector(
                    ".copy-btn"
                );

            if (!btn) return;

            btn.textContent = "✓";

            setTimeout(() => {
                btn.textContent = "📋";
            }, 2000);
        })
        .catch(error => {

            console.error(
                "Copy failed:",
                error
            );
        });
}


/* =========================================================
   CLEANUP
========================================================= */

function cleanupConnection() {

    if (connection) {

        try {
            connection.close();
        } catch (error) {
            console.error(error);
        }

        connection = null;
    }
}


/* =========================================================
   HELPERS
========================================================= */

function isBinaryData(data) {

    return (
        data instanceof ArrayBuffer ||
        data instanceof Uint8Array ||
        data instanceof Blob
    );
}


function formatBytes(bytes) {

    if (!bytes || bytes === 0) {
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

    const value =
        bytes /
        Math.pow(1024, index);

    return (
        value.toFixed(
            index === 0 ? 0 : 2
        ) +
        " " +
        units[index]
    );
}


function sleep(ms) {

    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}


function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   STARTUP
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "P2P File Transfer ready."
        );

    }
);