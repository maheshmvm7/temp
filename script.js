let peer = null;
let conn = null;

let selectedFile = null;

let receivingFile = null;
let receivedChunks = [];
let receivedBytes = 0;

const CHUNK_SIZE = 16 * 1024;


/* =====================================================
   MODE
===================================================== */

function selectMode(mode) {

    document.getElementById("modeSelect")
        .classList.add("hidden");

    document.getElementById("step1")
        .classList.remove("active");

    document.getElementById("step1")
        .classList.add("done");

    document.getElementById("step2")
        .classList.add("active");


    if (mode === "sender") {

        document.getElementById("senderSection")
            .classList.remove("hidden");

        initSender();

    } else {

        document.getElementById("receiverSection")
            .classList.remove("hidden");

        initReceiver();
    }
}


/* =====================================================
   SENDER
===================================================== */

function initSender() {

    console.log("Creating sender Peer...");

    peer = new Peer();

    peer.on("open", function (id) {

        console.log("Sender Peer ID:", id);

        setStatus(
            "sender",
            "success",
            "Peer ready. Enter receiver ID."
        );
    });


    peer.on("error", function (error) {

        console.error("PeerJS error:", error);

        setStatus(
            "sender",
            "error",
            "Peer error: " + error.type
        );
    });


    peer.on("disconnected", function () {

        console.log("Peer disconnected");

        setStatus(
            "sender",
            "error",
            "Disconnected from PeerJS server."
        );
    });


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
}


/* =====================================================
   SELECT FILE
===================================================== */

function selectFile(event) {

    selectedFile = event.target.files[0];

    if (!selectedFile) {
        return;
    }

    const info =
        document.getElementById(
            "selectedFileInfo"
        );

    info.style.display = "block";

    info.innerHTML = `
        <strong style="color:var(--text)">
            ${escapeHTML(selectedFile.name)}
        </strong>
        <br>
        ${formatBytes(selectedFile.size)}
    `;

    document.getElementById(
        "sendFileBtn"
    ).disabled = false;

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
            "Enter receiver Peer ID."
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


        /*
         * Create PeerJS DataConnection.
         *
         * IMPORTANT:
         * Do NOT specify serialization:"binary".
         */

        conn = peer.connect(
            remoteId,
            {
                reliable: true
            }
        );


        conn.on("open", async function () {

            console.log(
                "Data connection opened"
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
                    "Transfer error:",
                    error
                );

                setStatus(
                    "sender",
                    "error",
                    "Transfer failed."
                );

                button.disabled = false;
            }
        });


        conn.on("error", function (error) {

            console.error(
                "Data connection error:",
                error
            );

            setStatus(
                "sender",
                "error",
                "Connection error."
            );

            button.disabled = false;
        });


        conn.on("close", function () {

            console.log(
                "Data connection closed"
            );

        });

    } catch (error) {

        console.error(error);

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
     * Send file information first.
     */

    conn.send({
        type: "file-start",
        name: file.name,
        size: file.size,
        mime: file.type ||
            "application/octet-stream"
    });


    await sleep(100);


    let offset = 0;


    while (offset < file.size) {

        /*
         * Prevent the WebRTC buffer from
         * becoming too large.
         */

        await waitForBuffer();


        const slice =
            file.slice(
                offset,
                offset + CHUNK_SIZE
            );


        const buffer =
            await slice.arrayBuffer();


        /*
         * Send binary data.
         */

        conn.send(buffer);


        offset += buffer.byteLength;


        const percentage =
            Math.floor(
                (offset / file.size) * 100
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


        /*
         * Let browser process the
         * DataChannel queue.
         */

        await sleep(0);
    }


    /*
     * Tell receiver transfer is complete.
     */

    await waitForBuffer();


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


/* =====================================================
   BUFFER CONTROL
===================================================== */

function waitForBuffer() {

    return new Promise(function (resolve) {

        if (!conn) {
            resolve();
            return;
        }


        /*
         * PeerJS exposes the underlying
         * RTCDataChannel as _dc in 1.5.x.
         */

        const channel =
            conn._dc;


        /*
         * If the internal channel isn't
         * available yet, don't block.
         */

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
            setInterval(function () {

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
   RECEIVER
===================================================== */

function initReceiver() {

    console.log(
        "Creating receiver Peer..."
    );


    peer = new Peer();


    peer.on("open", function (id) {

        console.log(
            "Receiver Peer ID:",
            id
        );


        document.getElementById(
            "myPeerId"
        ).textContent = id;


        setStatus(
            "receiver",
            "info",
            "Waiting for sender..."
        );
    });


    /*
     * This is the important event.
     *
     * Sender uses:
     *
     * peer.connect(receiverId)
     *
     * Receiver receives:
     *
     * peer.on("connection")
     */

    peer.on(
        "connection",
        function (connection) {

            console.log(
                "Incoming connection:",
                connection.peer
            );


            conn = connection;


            setStatus(
                "receiver",
                "success",
                "Sender connected."
            );


            conn.on("open", function () {

                console.log(
                    "Receiver DataConnection open"
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


            conn.on(
                "data",
                handleReceivedData
            );


            conn.on(
                "close",
                function () {

                    console.log(
                        "Sender disconnected"
                    );


                    setStatus(
                        "receiver",
                        "info",
                        "Sender disconnected."
                    );
                }
            );


            conn.on(
                "error",
                function (error) {

                    console.error(
                        "Connection error:",
                        error
                    );


                    setStatus(
                        "receiver",
                        "error",
                        "Connection error."
                    );
                }
            );
        }
    );


    peer.on("error", function (error) {

        console.error(
            "Receiver PeerJS error:",
            error
        );


        setStatus(
            "receiver",
            "error",
            "Peer error: " +
            error.type
        );
    });


    peer.on(
        "disconnected",
        function () {

            setStatus(
                "receiver",
                "error",
                "PeerJS disconnected."
            );
        }
    );
}


/* =====================================================
   RECEIVE DATA
===================================================== */

function handleReceivedData(data) {

    console.log(
        "Received:",
        typeof data,
        data
    );


    /*
     * Metadata object
     */

    if (
        data &&
        typeof data === "object" &&
        !(data instanceof ArrayBuffer) &&
        !(data instanceof Uint8Array) &&
        !(data instanceof Blob)
    ) {

        if (
            data.type ===
            "file-start"
        ) {

            startReceiving(
                data
            );

            return;
        }


        if (
            data.type ===
            "file-end"
        ) {

            finishReceiving();

            return;
        }
    }


    /*
     * Binary chunk
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
            .then(function (buffer) {

                receiveChunk(buffer);

            });

        return;
    }


    console.warn(
        "Unknown data:",
        data
    );
}


/* =====================================================
   START RECEIVING
===================================================== */

function startReceiving(data) {

    console.log(
        "File incoming:",
        data.name,
        data.size
    );


    receivingFile = {
        name: data.name,
        size: data.size,
        mime: data.mime
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

        console.warn(
            "Received data without file metadata."
        );

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
            (receivedBytes /
                receivingFile.size) *
            100
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


    console.log(
        "File received."
    );


    const blob =
        new Blob(
            receivedChunks,
            {
                type:
                    receivingFile.mime
            }
        );


    const url =
        URL.createObjectURL(blob);


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


    /*
     * Don't clear the Blob URL immediately.
     * The download button still needs it.
     */

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
                (receivedBytes /
                    receivingFile.size) *
                100
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
        document.getElementById(
            "myPeerId"
        ).textContent;


    if (
        !id ||
        id === "generating..."
    ) {
        return;
    }


    navigator.clipboard
        .writeText(id)
        .then(function () {

            const button =
                document.querySelector(
                    ".copy-btn"
                );


            button.textContent =
                "✓";


            setTimeout(
                function () {

                    button.textContent =
                        "📋";

                },
                2000
            );
        });
}


/* =====================================================
   BACK
===================================================== */

function goBack() {

    if (conn) {

        try {
            conn.close();
        } catch (e) {}

        conn = null;
    }


    if (peer) {

        try {
            peer.destroy();
        } catch (e) {}

        peer = null;
    }


    selectedFile = null;

    receivingFile = null;

    receivedChunks = [];

    receivedBytes = 0;


    document.getElementById(
        "senderSection"
    ).classList.add("hidden");


    document.getElementById(
        "receiverSection"
    ).classList.add("hidden");


    document.getElementById(
        "modeSelect"
    ).classList.remove("hidden");


    document.getElementById(
        "step1"
    ).classList.remove("done");


    document.getElementById(
        "step1"
    ).classList.add("active");


    document.getElementById(
        "step2"
    ).classList.remove("active");


    document.getElementById(
        "step2"
    ).classList.remove("done");


    document.getElementById(
        "step3"
    ).classList.remove("active");
}


/* =====================================================
   HELPERS
===================================================== */

function sleep(ms) {

    return new Promise(
        resolve => setTimeout(
            resolve,
            ms
        )
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


    const i =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return (
        (bytes /
            Math.pow(1024, i))
            .toFixed(
                i === 0 ? 0 : 2
            )
        +
        " " +
        units[i]
    );
}


function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}